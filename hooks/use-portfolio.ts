'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  addBuy,
  defaultPortfolio,
  loadPortfolio,
  registerSell,
  removeHolding,
  savePortfolio,
  updateHolding,
} from '@/lib/portfolio/storage'
import type { PortfolioData } from '@/lib/portfolio/types'

export function usePortfolioStore() {
  const [data, setData] = useState<PortfolioData>(() => defaultPortfolio())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setData(loadPortfolio())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    savePortfolio(data)
  }, [data, ready])

  /** Valor em tempo real no input; não forçar o nome antigo quando o campo está vazio (permite apagar e escrever de novo). */
  const setName = useCallback((name: string) => {
    setData((d) => ({ ...d, name }))
  }, [])

  const mergePortfolio = useCallback((updater: (prev: PortfolioData) => PortfolioData) => {
    setData(updater)
  }, [])

  const addPurchase = useCallback(
    (input: Parameters<typeof addBuy>[1]) => {
      setData((d) => addBuy(d, input))
    },
    [],
  )

  const editHolding = useCallback(
    (id: string, patch: Parameters<typeof updateHolding>[2]) => {
      setData((d) => updateHolding(d, id, patch))
    },
    [],
  )

  const deleteHolding = useCallback((id: string) => {
    setData((d) => removeHolding(d, id))
  }, [])

  const setAllocationTargets = useCallback((pctByHoldingId: Record<string, number>) => {
    setData((d) => {
      const ids = new Set(d.holdings.map((h) => h.id))
      const cleaned: Record<string, number> = {}
      for (const [k, v] of Object.entries(pctByHoldingId)) {
        if (!ids.has(k)) continue
        if (typeof v === 'number' && Number.isFinite(v)) cleaned[k] = Math.max(0, Math.min(100, v))
      }
      return { ...d, allocationTargetsPct: cleaned }
    })
  }, [])

  const sell = useCallback(
    (
      holdingId: string,
      qty: number,
      sellPriceUsd: number,
      at: string,
      meta?: { feeUsd?: number; note?: string },
    ) => {
      let err: string | null = null
      setData((d) => {
        const r = registerSell(d, holdingId, qty, sellPriceUsd, at, meta)
        if ('error' in r) {
          err = r.error
          return d
        }
        return r.data
      })
      return err
    },
    [],
  )

  return {
    data,
    ready,
    setName,
    mergePortfolio,
    addPurchase,
    editHolding,
    deleteHolding,
    setAllocationTargets,
    sell,
  }
}
