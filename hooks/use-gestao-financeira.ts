'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  buildPatrimonySnapshot,
  computeDashboardStats,
} from '@/lib/gestao-financeira/calculations'
import { fetchGfCryptoPrices } from '@/lib/gestao-financeira/crypto-prices'
import {
  createGfCategory,
  deleteGfCryptoHolding,
  deleteGfDebt,
  deleteGfTransaction,
  ensureGfDb,
  exportGfBackup,
  importGfBackup,
  insertGfPatrimonySnapshot,
  insertGfTransaction,
  listGfCashBoxes,
  listGfCategories,
  listGfCryptoHoldings,
  listGfCryptoWallets,
  listGfDebts,
  listGfInvestments,
  listGfPatrimonySnapshots,
  listGfTransactions,
  restoreGfFromAutoBackupIfNeeded,
  upsertGfCryptoHolding,
  upsertGfInvestment,
  insertGfDebt,
  insertGfTodosBatch,
  insertGfTodo,
  listGfTodos,
  toggleGfTodoComplete,
  deleteGfTodo,
  updateGfTodo,
  updateGfDebtPayment,
  findGfCategoryByName,
  getDefaultCashBox,
} from '@/lib/gestao-financeira/db'
import { GF_DATA_CHANGED_EVENT } from '@/lib/gestao-financeira/save-parsed-voice'
import { pullGfFromNeon, pushGfToNeonNow } from '@/lib/neon/sync-gestao'
import { loadPortfolio } from '@/lib/portfolio/storage'
import { syncPortfolioToGfCrypto } from '@/lib/portfolio/gf-sync'
import { generateGfInsights } from '@/lib/gestao-financeira/insights'
import { findGfTodoByTitleMatch } from '@/lib/gestao-financeira/todos-utils'
import { resolveCashBoxId } from '@/lib/gestao-financeira/voice-parser'
import type {
  GfCashBox,
  GfCategory,
  GfCryptoHolding,
  GfCryptoWallet,
  GfDashboardStats,
  GfDebt,
  GfInvestment,
  GfPatrimonySnapshot,
  GfParsedTodoAction,
  GfTodo,
  GfTodoPriority,
  GfTransaction,
} from '@/lib/gestao-financeira/types'
import type { GfCryptoPriceMap } from '@/lib/gestao-financeira/calculations'

export function useGestaoFinanceira() {
  const [ready, setReady] = useState(false)
  const [categories, setCategories] = useState<GfCategory[]>([])
  const [cashBoxes, setCashBoxes] = useState<GfCashBox[]>([])
  const [transactions, setTransactions] = useState<GfTransaction[]>([])
  const [debts, setDebts] = useState<GfDebt[]>([])
  const [cryptoWallets, setCryptoWallets] = useState<GfCryptoWallet[]>([])
  const [cryptoHoldings, setCryptoHoldings] = useState<GfCryptoHolding[]>([])
  const [investments, setInvestments] = useState<GfInvestment[]>([])
  const [snapshots, setSnapshots] = useState<GfPatrimonySnapshot[]>([])
  const [todos, setTodos] = useState<GfTodo[]>([])
  const [cryptoPrices, setCryptoPrices] = useState<GfCryptoPriceMap>({})
  const [brlPerUsd, setBrlPerUsd] = useState(5.1)
  const [stats, setStats] = useState<GfDashboardStats | null>(null)
  const [insights, setInsights] = useState<string[]>([])
  const [pricesLoading, setPricesLoading] = useState(false)

  const applyLocalData = useCallback(
    (prices: GfCryptoPriceMap, fx: number) => {
      const cats = listGfCategories()
      const boxes = listGfCashBoxes()
      const txs = listGfTransactions()
      const d = listGfDebts()
      const wallets = listGfCryptoWallets()
      const holdings = listGfCryptoHoldings()
      const inv = listGfInvestments()
      const snaps = listGfPatrimonySnapshots()
      const todoList = listGfTodos(true)

      const dashboard = computeDashboardStats({
        cashBoxes: boxes,
        transactions: txs,
        debts: d,
        investments: inv,
        cryptoHoldings: holdings,
        cryptoWallets: wallets,
        cryptoPrices: prices,
        brlPerUsd: fx,
      })

      setCategories(cats)
      setCashBoxes(boxes)
      setTransactions(txs)
      setDebts(d)
      setCryptoWallets(wallets)
      setCryptoHoldings(holdings)
      setInvestments(inv)
      setSnapshots(snaps)
      setTodos(todoList)
      setCryptoPrices(prices)
      setBrlPerUsd(fx)
      setStats(dashboard)
      setInsights(
        generateGfInsights({
          stats: dashboard,
          transactions: txs,
          categories: cats,
          cryptoHoldings: holdings,
          cryptoPrices: prices,
          snapshots: snaps,
        }),
      )
      return { dashboard, snaps }
    },
    [],
  )

  const reload = useCallback(async () => {
    await ensureGfDb()
    await syncPortfolioToGfCrypto(loadPortfolio())
    const holdings = listGfCryptoHoldings()
    const coinIds = [...new Set(holdings.map((h) => h.coinId))]

    // Fase 1: SQLite local — abre já (não espera Neon)
    const { dashboard, snaps } = applyLocalData({}, 5.1)
    setReady(true)

    const today = new Date().toISOString().slice(0, 10)
    const lastSnap = snaps[snaps.length - 1]
    if (!lastSnap || lastSnap.recordedAt.slice(0, 10) !== today) {
      insertGfPatrimonySnapshot(buildPatrimonySnapshot(dashboard))
    }

    // Fase 1b: merge Neon em background
    void pullGfFromNeon().then(async () => {
      await syncPortfolioToGfCrypto(loadPortfolio())
      applyLocalData({}, 5.1)
    })

    // Fase 2: preços cripto em background (só se houver posições)
    if (coinIds.length === 0) return
    setPricesLoading(true)
    try {
      const { prices, brlPerUsd: fx } = await fetchGfCryptoPrices(coinIds)
      applyLocalData(prices, fx)
    } finally {
      setPricesLoading(false)
    }
  }, [applyLocalData])

  const refreshCryptoPrices = useCallback(async (extraCoinIds: string[] = []) => {
    const holdings = listGfCryptoHoldings()
    const coinIds = [...new Set([...holdings.map((h) => h.coinId), ...extraCoinIds].filter(Boolean))]
    if (coinIds.length === 0) return
    setPricesLoading(true)
    try {
      const { prices, brlPerUsd: fx } = await fetchGfCryptoPrices(coinIds)
      applyLocalData(prices, fx)
    } finally {
      setPricesLoading(false)
    }
  }, [applyLocalData])

  useEffect(() => {
    void ensureGfDb().then(() => {
      restoreGfFromAutoBackupIfNeeded()
      void reload()
    })
  }, [reload])

  useEffect(() => {
    if (!ready || cryptoHoldings.length === 0) return
    const timer = window.setInterval(() => {
      void refreshCryptoPrices()
    }, 45_000)
    return () => window.clearInterval(timer)
  }, [ready, cryptoHoldings.length, refreshCryptoPrices])

  const addTransaction = useCallback(
    async (input: Parameters<typeof insertGfTransaction>[0]) => {
      insertGfTransaction(input)
      await reload()
    },
    [reload],
  )

  const addFromParsed = useCallback(
    async (parsed: {
      type: GfTransaction['type']
      amount: number
      categoryName: string | null
      cashBoxName?: string | null
      toCashBoxName?: string | null
      description: string
      occurredAt: string
    }) => {
      const boxes = listGfCashBoxes()
      const cashBoxId = resolveCashBoxId(boxes, parsed.cashBoxName ?? null) ?? getDefaultCashBox()?.id
      if (!cashBoxId) return false

      let categoryId: string | null = null
      if (parsed.categoryName) {
        categoryId =
          findGfCategoryByName(parsed.categoryName)?.id ??
          createGfCategory(parsed.categoryName, parsed.type === 'income' ? 'income' : 'expense').id
      }

      const toCashBoxId =
        parsed.type === 'transfer'
          ? resolveCashBoxId(boxes, parsed.toCashBoxName ?? null)
          : null

      if (parsed.type === 'transfer' && (!toCashBoxId || toCashBoxId === cashBoxId)) return false

      insertGfTransaction({
        type: parsed.type,
        amount: parsed.amount,
        categoryId,
        cashBoxId,
        toCashBoxId: parsed.type === 'transfer' ? toCashBoxId : null,
        description: parsed.description,
        occurredAt: parsed.occurredAt,
      })
      await reload()
      return true
    },
    [reload],
  )

  const notifyDataChanged = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(GF_DATA_CHANGED_EVENT))
    }
  }, [])

  const removeTransaction = useCallback(
    async (id: string) => {
      const ok = deleteGfTransaction(id)
      if (!ok) return false
      await pushGfToNeonNow()
      applyLocalData(cryptoPrices, brlPerUsd)
      notifyDataChanged()
      return true
    },
    [applyLocalData, cryptoPrices, brlPerUsd, notifyDataChanged],
  )

  const removeDebt = useCallback(
    async (id: string) => {
      const ok = deleteGfDebt(id)
      if (!ok) return false
      await pushGfToNeonNow()
      applyLocalData(cryptoPrices, brlPerUsd)
      notifyDataChanged()
      return true
    },
    [applyLocalData, cryptoPrices, brlPerUsd, notifyDataChanged],
  )

  const removeCryptoHolding = useCallback(
    async (id: string) => {
      const ok = deleteGfCryptoHolding(id)
      if (!ok) return false
      await pushGfToNeonNow()
      applyLocalData(cryptoPrices, brlPerUsd)
      notifyDataChanged()
      return true
    },
    [applyLocalData, cryptoPrices, brlPerUsd, notifyDataChanged],
  )

  const addTodo = useCallback(
    async (input: {
      title: string
      notes?: string | null
      dueDate: string
      dueTime?: string | null
      priority?: GfTodoPriority
    }) => {
      insertGfTodo(input)
      await reload()
      notifyDataChanged()
    },
    [reload, notifyDataChanged],
  )

  const addTodos = useCallback(
    async (
      items: {
        title: string
        notes?: string | null
        dueDate: string
        dueTime?: string | null
        priority?: GfTodoPriority
      }[],
    ) => {
      insertGfTodosBatch(items)
      await reload()
      notifyDataChanged()
    },
    [reload, notifyDataChanged],
  )

  const toggleTodo = useCallback(
    async (id: string) => {
      toggleGfTodoComplete(id)
      await reload()
      notifyDataChanged()
    },
    [reload, notifyDataChanged],
  )

  const removeTodo = useCallback(
    async (id: string) => {
      deleteGfTodo(id)
      await reload()
      notifyDataChanged()
    },
    [reload, notifyDataChanged],
  )

  const rescheduleTodo = useCallback(
    async (id: string, dueDate: string, opts?: { dueTime?: string | null }) => {
      updateGfTodo(id, {
        dueDate: dueDate.slice(0, 10),
        dueTime: opts?.dueTime ?? null,
        completed: false,
      })
      await reload()
      notifyDataChanged()
    },
    [reload, notifyDataChanged],
  )

  const applyTodoAction = useCallback(
    async (action: GfParsedTodoAction): Promise<boolean> => {
      const todo = findGfTodoByTitleMatch(todos, action.titleMatch)
      if (!todo) return false
      if (action.action === 'complete') {
        updateGfTodo(todo.id, { completed: true })
      } else if (action.action === 'pending') {
        updateGfTodo(todo.id, { completed: false })
      } else if (action.action === 'reschedule' && action.dueDate) {
        updateGfTodo(todo.id, {
          completed: false,
          dueDate: action.dueDate,
          dueTime: action.dueTime ?? null,
        })
      } else {
        return false
      }
      await reload()
      notifyDataChanged()
      return true
    },
    [todos, reload, notifyDataChanged],
  )

  return {
    ready,
    categories,
    cashBoxes,
    transactions,
    debts,
    cryptoWallets,
    cryptoHoldings,
    investments,
    snapshots,
    todos,
    cryptoPrices,
    brlPerUsd,
    stats,
    insights,
    pricesLoading,
    reload,
    refreshCryptoPrices,
    addTransaction,
    addFromParsed,
    removeTransaction,
    removeDebt,
    removeCryptoHolding,
    addTodo,
    addTodos,
    toggleTodo,
    removeTodo,
    rescheduleTodo,
    applyTodoAction,
    exportBackup: exportGfBackup,
    importBackup: async (payload: Parameters<typeof importGfBackup>[0]) => {
      importGfBackup(payload)
      await reload()
    },
    addDebt: async (input: Parameters<typeof insertGfDebt>[0]) => {
      insertGfDebt(input)
      await reload()
    },
    payDebt: async (id: string, paid: number) => {
      updateGfDebtPayment(id, paid)
      await reload()
    },
    saveHolding: async (input: Parameters<typeof upsertGfCryptoHolding>[0]) => {
      upsertGfCryptoHolding(input)
      notifyDataChanged()
      await refreshCryptoPrices([input.coinId])
    },
    saveInvestment: async (input: Parameters<typeof upsertGfInvestment>[0]) => {
      upsertGfInvestment(input)
      await reload()
    },
    addCategory: async (name: string, type: GfCategory['type']) => {
      const cat = createGfCategory(name, type)
      await reload()
      return cat
    },
  }
}
