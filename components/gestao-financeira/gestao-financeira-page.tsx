'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useGestaoFinanceira } from '@/hooks/use-gestao-financeira'
import {
  buildPeriodSummary,
  debtsDueSoon,
  resolvePeriodRange,
  shiftPeriodAnchor,
} from '@/lib/gestao-financeira/calculations'
import { downloadGfCsv, downloadGfJsonBackup, openGfReportPreview, printGfReportHtml, readGfBackupFile } from '@/lib/gestao-financeira/export'
import { buildGfEpigraphicReport, renderGfReportHtml } from '@/lib/gestao-financeira/report-document'
import { buildGfSimpleNarrative } from '@/lib/gestao-financeira/simple-narrative'
import { GF_DATA_CHANGED_EVENT } from '@/lib/gestao-financeira/save-parsed-voice'
import { dispatchGfFocusPhrase } from '@/lib/gestao-financeira/voice-bridge'
import { GfCharts } from '@/components/gestao-financeira/gf-charts'
import { GfReportView } from '@/components/gestao-financeira/gf-report-view'
import { GfQuickRegister } from '@/components/gestao-financeira/gf-quick-register'
import { GfVoicePanel } from '@/components/gestao-financeira/gf-voice-panel'
import { GfOpenAiPanel } from '@/components/gestao-financeira/gf-openai-panel'
import { GfNavTabs, type GfTabValue } from '@/components/gestao-financeira/gf-nav-tabs'
import { GfAfazeres } from '@/components/gestao-financeira/gf-afazeres'
import { GfTodoNotifyBanner } from '@/components/gestao-financeira/gf-todo-notify-banner'
import { countGfTodosToday } from '@/lib/gestao-financeira/todos-utils'
import { useGfTodoNotifications } from '@/hooks/use-gf-todo-notifications'
import {
  GfCryptoCoinPicker,
  type GfCryptoCoinPick,
} from '@/components/gestao-financeira/gf-crypto-coin-picker'
import { GfCryptoHoldingCard } from '@/components/gestao-financeira/gf-crypto-holding-card'
import { GfTransactionHistory } from '@/components/gestao-financeira/gf-transaction-history'
import { loadGfOpenAiSettings, summarizeGfOpenAiUsage } from '@/lib/gestao-financeira/openai-config'
import {
  defaultReportPeriodState,
  GfPeriodSelector,
  type GfReportPeriodState,
} from '@/components/gestao-financeira/gf-period-selector'
import { cn } from '@/lib/utils'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bitcoin,
  Download,
  FileText,
  Gauge,
  Landmark,
  PiggyBank,
  Printer,
  RefreshCw,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react'

function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type DeleteTarget =
  | { kind: 'transaction'; id: string; label: string }
  | { kind: 'debt'; id: string; label: string }
  | { kind: 'crypto'; id: string; label: string }

function CashBoxTransfer({
  cashBoxes,
  onTransfer,
}: {
  cashBoxes: { id: string; name: string }[]
  onTransfer: (input: {
    type: 'transfer'
    amount: number
    cashBoxId: string
    toCashBoxId: string
    description?: string
  }) => void
}) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  useEffect(() => {
    if (cashBoxes[0] && !from) setFrom(cashBoxes[0]!.id)
    if (cashBoxes[1] && !to) setTo(cashBoxes[1]!.id)
  }, [cashBoxes, from, to])

  if (cashBoxes.length < 2) return null

  return (
    <form
      className="rounded-2xl border border-border/50 bg-card/40 p-4 grid gap-3 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault()
        const v = Number(amount.replace(',', '.'))
        if (!v || !from || !to || from === to) return
        onTransfer({ type: 'transfer', amount: v, cashBoxId: from, toCashBoxId: to, description: 'Transferência entre caixas' })
        setAmount('')
      }}
    >
      <div>
        <Label>De</Label>
        <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={from} onChange={(e) => setFrom(e.target.value)}>
          {cashBoxes.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <div>
        <Label>Para</Label>
        <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={to} onChange={(e) => setTo(e.target.value)}>
          {cashBoxes.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <div>
        <Label>Valor</Label>
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required />
      </div>
      <div className="flex items-end">
        <Button type="submit" className="w-full">Transferir</Button>
      </div>
    </form>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string
  icon: typeof Wallet
  tone?: 'default' | 'green' | 'red' | 'blue' | 'amber'
}) {
  const tones = {
    default: 'border-border/50',
    green: 'border-emerald-500/30 bg-emerald-950/10',
    red: 'border-red-500/25 bg-red-950/10',
    blue: 'border-blue-500/30 bg-blue-950/10',
    amber: 'border-amber-500/30 bg-amber-950/10',
  }
  return (
    <div className={cn('rounded-2xl border p-4 backdrop-blur-sm', tones[tone])}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-bold tracking-tight sm:text-xl">{value}</p>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
      </div>
    </div>
  )
}

export function GestaoFinanceiraPage() {
  const gf = useGestaoFinanceira()
  const [tab, setTab] = useState('dashboard')
  const [reportPeriod, setReportPeriod] = useState<GfReportPeriodState>(defaultReportPeriodState)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [openAiPanelOpen, setOpenAiPanelOpen] = useState(false)
  const [usageRefresh, setUsageRefresh] = useState(0)

  const openAiUsage = useMemo(() => {
    void usageRefresh
    return summarizeGfOpenAiUsage(loadGfOpenAiSettings(), gf.brlPerUsd)
  }, [usageRefresh, gf.brlPerUsd])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('voz') !== '1' && params.get('mic') !== '1') return
    window.history.replaceState({}, '', '/news/gestao-financeira')
    const t = window.setTimeout(() => dispatchGfFocusPhrase(), 250)
    return () => window.clearTimeout(t)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (deleteTarget.kind === 'transaction') await gf.removeTransaction(deleteTarget.id)
      else if (deleteTarget.kind === 'debt') await gf.removeDebt(deleteTarget.id)
      else await gf.removeCryptoHolding(deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, gf])

  // Crypto form
  const [cryptoWallet, setCryptoWallet] = useState('')
  const [cryptoCoin, setCryptoCoin] = useState<GfCryptoCoinPick | null>({
    id: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'BTC',
  })
  const [cryptoQty, setCryptoQty] = useState('')
  const [cryptoAvg, setCryptoAvg] = useState('')

  // Debt form
  const [debtName, setDebtName] = useState('')
  const [debtTotal, setDebtTotal] = useState('')
  const [debtDue, setDebtDue] = useState('')

  useEffect(() => {
    const onDataChanged = () => void gf.reload()
    window.addEventListener(GF_DATA_CHANGED_EVENT, onDataChanged)
    return () => window.removeEventListener(GF_DATA_CHANGED_EVENT, onDataChanged)
  }, [gf.reload])

  useEffect(() => {
    if (gf.cryptoWallets[0] && !cryptoWallet) setCryptoWallet(gf.cryptoWallets[0]!.id)
  }, [gf.cryptoWallets, cryptoWallet])

  useEffect(() => {
    if (!cryptoCoin?.id) return
    void gf.refreshCryptoPrices([cryptoCoin.id])
  }, [cryptoCoin?.id, gf.refreshCryptoPrices])

  const cryptoBreakdown = useMemo(() => {
    return gf.cryptoHoldings
      .map((h) => {
        const px = gf.cryptoPrices[h.coinId]?.usd ?? 0
        return { name: h.symbol, value: h.quantity * px * gf.brlPerUsd }
      })
      .filter((x) => x.value > 0)
  }, [gf.cryptoHoldings, gf.cryptoPrices, gf.brlPerUsd])

  const dueSoon = useMemo(() => debtsDueSoon(gf.debts), [gf.debts])
  const pendingTodosToday = useMemo(() => countGfTodosToday(gf.todos), [gf.todos])

  useGfTodoNotifications(gf.todos)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    const valid: GfTabValue[] = [
      'dashboard',
      'movimentos',
      'caixas',
      'dividas',
      'cripto',
      'afazeres',
      'relatorios',
    ]
    if (tabParam && (valid as string[]).includes(tabParam)) {
      setTab(tabParam)
      window.history.replaceState({}, '', '/news/gestao-financeira')
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GF_OPEN_AFAZERES') setTab('afazeres')
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  const reportRange = useMemo(
    () =>
      resolvePeriodRange(reportPeriod.preset, reportPeriod.anchor, {
        from: reportPeriod.customFrom,
        to: reportPeriod.customTo,
      }),
    [reportPeriod],
  )

  const periodSummary = useMemo(
    () => buildPeriodSummary(gf.transactions, reportPeriod.preset, reportRange),
    [gf.transactions, reportPeriod.preset, reportRange],
  )

  const reportNarrative = useMemo(() => {
    if (!gf.stats) return null
    return buildGfSimpleNarrative({
      stats: gf.stats,
      insights: gf.insights,
      todos: gf.todos,
      transactions: gf.transactions,
      categories: gf.categories,
    })
  }, [gf.stats, gf.insights, gf.todos, gf.transactions, gf.categories])

  const epigraphicReport = useMemo(() => {
    if (!gf.ready || !gf.stats) return null
    return buildGfEpigraphicReport({
      periodLabel: periodSummary.label,
      period: periodSummary,
      reportRange,
      transactions: gf.transactions,
      categories: gf.categories,
      cashBoxes: gf.cashBoxes,
      cryptoHoldings: gf.cryptoHoldings,
      cryptoPrices: gf.cryptoPrices,
      debts: gf.debts,
      investments: gf.investments,
      brlPerUsd: gf.brlPerUsd,
    })
  }, [
    gf.ready,
    gf.stats,
    gf.transactions,
    gf.categories,
    gf.cashBoxes,
    gf.cryptoHoldings,
    gf.cryptoPrices,
    gf.debts,
    gf.investments,
    gf.brlPerUsd,
    periodSummary,
    reportRange,
  ])

  const reportHtml = useMemo(
    () => (epigraphicReport ? renderGfReportHtml(epigraphicReport) : ''),
    [epigraphicReport],
  )

  const shiftReportPeriod = (delta: -1 | 1) => {
    setReportPeriod((prev) => ({
      ...prev,
      anchor: shiftPeriodAnchor(prev.preset, prev.anchor, delta),
    }))
  }

  const handleCryptoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cryptoWallet || !cryptoCoin) return
    await gf.saveHolding({
      walletId: cryptoWallet,
      coinId: cryptoCoin.id,
      symbol: cryptoCoin.symbol.trim().toUpperCase(),
      quantity: Number(cryptoQty.replace(',', '.')),
      avgPriceUsd: Number(cryptoAvg.replace(',', '.')),
    })
    setCryptoQty('')
    setCryptoAvg('')
  }

  const selectedLiveUsd = cryptoCoin ? gf.cryptoPrices[cryptoCoin.id]?.usd : undefined
  const selectedLiveBrl =
    cryptoCoin != null
      ? gf.cryptoPrices[cryptoCoin.id]?.brl ?? (selectedLiveUsd != null ? selectedLiveUsd * gf.brlPerUsd : undefined)
      : undefined

  const handleDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const total = Number(debtTotal.replace(',', '.'))
    if (!debtName.trim() || !total) return
    await gf.addDebt({
      name: debtName.trim(),
      totalAmount: total,
      paidAmount: 0,
      installments: null,
      paidInstallments: 0,
      dueDate: debtDue || null,
    })
    setDebtName('')
    setDebtTotal('')
    setDebtDue('')
  }

  const s = gf.stats

  return (
    <div className="gestao-financeira space-y-6 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Landmark className="h-6 w-6 text-emerald-400" />
            <h2 className="text-2xl font-bold tracking-tight">Gestão Financeira</h2>
            <Badge className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0">Premium</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Dados guardados neste dispositivo (SQLite) · sobrevivem a actualizações do app · confirmação antes de salvar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 border-violet-500/35"
            onClick={() => {
              setUsageRefresh((n) => n + 1)
              setOpenAiPanelOpen(true)
            }}
          >
            <Gauge className="h-4 w-4 text-violet-400" />
            Uso da API
            {openAiUsage.callsToday > 0 ? (
              <Badge variant="secondary" className="text-[10px]">
                {openAiUsage.callsToday}
              </Badge>
            ) : null}
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void gf.reload()}>
            <RefreshCw className={cn('h-4 w-4', gf.pricesLoading && 'animate-spin')} />
            Actualizar
          </Button>
        </div>
      </div>

      <GfQuickRegister gf={gf} onTabChange={setTab} />

      {gf.ready ? <GfTodoNotifyBanner todos={gf.todos} className="mt-4" /> : null}

      {!gf.ready ? (
        <p className="py-6 text-center text-sm text-muted-foreground">A carregar…</p>
      ) : (
        <>
      {s ? <GfVoicePanel gf={gf} insights={gf.insights} /> : null}

      <Tabs value={tab} onValueChange={setTab}>
        <GfNavTabs pendingToday={pendingTodosToday} />

        <TabsContent value="dashboard" className="mt-4 space-y-6">
          {!s ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl bg-muted/30" />
              ))}
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            <StatCard label="Patrimônio total" value={fmtBrl(s.totalPatrimony)} icon={TrendingUp} tone="blue" />
            <StatCard label="Patrimônio líquido" value={fmtBrl(s.netWorth)} icon={Landmark} tone="green" />
            <StatCard label="Saldo em caixa" value={fmtBrl(s.cashBalance)} icon={Wallet} />
            <StatCard label="Receitas do mês" value={fmtBrl(s.monthIncome)} icon={ArrowDownLeft} tone="green" />
            <StatCard label="Despesas do mês" value={fmtBrl(s.monthExpense)} icon={ArrowUpRight} tone="red" />
            <StatCard label="Economia do mês" value={fmtBrl(s.monthSavings)} icon={PiggyBank} tone="amber" />
            <StatCard label="Dívidas pendentes" value={fmtBrl(s.pendingDebts)} icon={ArrowUpRight} tone="red" />
            <StatCard label="Total investido" value={fmtBrl(s.totalInvested)} icon={TrendingUp} tone="blue" />
            <StatCard label="Total em cripto" value={fmtBrl(s.totalCrypto)} icon={Bitcoin} tone="amber" />
          </div>
          )}

          {s && dueSoon.length > 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 px-4 py-3 text-sm">
              <p className="font-medium text-amber-200">Vencimentos próximos</p>
              <ul className="mt-1 text-muted-foreground">
                {dueSoon.map((d) => (
                  <li key={d.id}>
                    {d.name} — restam {fmtBrl(d.totalAmount - d.paidAmount)} · vence {d.dueDate?.slice(0, 10)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {s ? (
          <GfCharts
            transactions={gf.transactions}
            categories={gf.categories}
            snapshots={gf.snapshots}
            stats={s}
            cryptoBreakdown={cryptoBreakdown}
          />
          ) : null}
        </TabsContent>

        <TabsContent value="movimentos" className="mt-4 space-y-6">
          <GfTransactionHistory
            transactions={gf.transactions}
            categories={gf.categories}
            fmtBrl={fmtBrl}
            onDelete={(id, label) => setDeleteTarget({ kind: 'transaction', id, label })}
          />
        </TabsContent>

        <TabsContent value="caixas" className="mt-4 space-y-4">
          <CashBoxTransfer cashBoxes={gf.cashBoxes} onTransfer={(input) => void gf.addTransaction(input)} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gf.cashBoxes.map((box) => (
              <div key={box.id} className="rounded-2xl border border-border/50 bg-card/40 p-4">
                <p className="font-semibold">{box.name}</p>
                <p className="mt-2 text-2xl font-bold text-emerald-400">{fmtBrl(box.balance)}</p>
                {box.goal != null ? (
                  <p className="mt-1 text-xs text-muted-foreground">Objetivo: {fmtBrl(box.goal)}</p>
                ) : null}
                {box.note ? <p className="mt-2 text-xs text-muted-foreground">{box.note}</p> : null}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="dividas" className="mt-4 space-y-6">
          <form onSubmit={(e) => void handleDebtSubmit(e)} className="rounded-2xl border border-border/50 bg-card/40 p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Nome</Label>
              <Input value={debtName} onChange={(e) => setDebtName(e.target.value)} required />
            </div>
            <div>
              <Label>Valor total</Label>
              <Input value={debtTotal} onChange={(e) => setDebtTotal(e.target.value)} required />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input type="date" value={debtDue} onChange={(e) => setDebtDue(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">Adicionar dívida</Button>
            </div>
          </form>

          <div className="grid gap-3 sm:grid-cols-2">
            {gf.debts.map((d) => {
              const remaining = d.totalAmount - d.paidAmount
              return (
                <div key={d.id} className="rounded-2xl border border-border/50 bg-card/40 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{d.name}</p>
                    <div className="flex items-center gap-1">
                      <Badge variant={d.status === 'paid' ? 'secondary' : 'outline'}>{d.status}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        aria-label={`Excluir dívida ${d.name}`}
                        onClick={() => setDeleteTarget({ kind: 'debt', id: d.id, label: d.name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-lg font-bold text-red-300">{fmtBrl(remaining)}</p>
                  <p className="text-xs text-muted-foreground">
                    Pago {fmtBrl(d.paidAmount)} de {fmtBrl(d.totalAmount)}
                    {d.dueDate ? ` · vence ${d.dueDate.slice(0, 10)}` : ''}
                  </p>
                  {remaining > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => void gf.payDebt(d.id, d.totalAmount)}
                    >
                      Marcar como paga
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="cripto" className="mt-4 space-y-6">
          <form onSubmit={(e) => void handleCryptoSubmit(e)} className="rounded-2xl border border-border/50 bg-card/40 p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Carteira</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={cryptoWallet}
                onChange={(e) => setCryptoWallet(e.target.value)}
              >
                {gf.cryptoWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <GfCryptoCoinPicker value={cryptoCoin} onChange={setCryptoCoin} />
            </div>
            {cryptoCoin && selectedLiveUsd != null ? (
              <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-amber-500/25 bg-amber-950/15 px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">Preço ao vivo (CoinGecko · actualiza ~45s)</p>
                <p className="font-semibold">
                  {cryptoCoin.symbol.toUpperCase()}: ${selectedLiveUsd.toLocaleString('en-US', { maximumFractionDigits: selectedLiveUsd < 1 ? 6 : 2 })}
                  {selectedLiveBrl != null ? (
                    <span className="ml-2 text-muted-foreground">
                      · {fmtBrl(selectedLiveBrl)} · USD/BRL {gf.brlPerUsd.toFixed(2)}
                    </span>
                  ) : null}
                </p>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs text-amber-300"
                  onClick={() => {
                    if (selectedLiveUsd != null) setCryptoAvg(String(selectedLiveUsd))
                  }}
                >
                  Usar preço actual como preço médio
                </Button>
              </div>
            ) : null}
            <div>
              <Label>Quantidade</Label>
              <Input value={cryptoQty} onChange={(e) => setCryptoQty(e.target.value)} placeholder="0,5" />
            </div>
            <div>
              <Label>Preço médio (USD)</Label>
              <Input value={cryptoAvg} onChange={(e) => setCryptoAvg(e.target.value)} placeholder="65000" />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full gap-2" disabled={!cryptoCoin}>
                <Bitcoin className="h-4 w-4" />
                Guardar posição
              </Button>
            </div>
          </form>

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Valores em tempo real via CoinGecko</span>
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1" onClick={() => void gf.refreshCryptoPrices()}>
              <RefreshCw className={cn('h-3.5 w-3.5', gf.pricesLoading && 'animate-spin')} />
              Actualizar preços
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {gf.cryptoHoldings.map((h) => {
              const wallet = gf.cryptoWallets.find((w) => w.id === h.walletId)
              const fromPortfolio = wallet?.walletType === 'portfolio'
              return (
              <GfCryptoHoldingCard
                key={h.id}
                holding={h}
                wallet={wallet}
                prices={gf.cryptoPrices}
                brlPerUsd={gf.brlPerUsd}
                fmtBrl={fmtBrl}
                readOnly={fromPortfolio}
                onDelete={() => setDeleteTarget({ kind: 'crypto', id: h.id, label: h.symbol })}
              />
            )})}
            {gf.cryptoHoldings.length === 0 ? (
              <p className="text-sm text-muted-foreground sm:col-span-2">Adicione posições em BTC, ETH, SOL e outras moedas CoinGecko.</p>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="afazeres" className="mt-4">
          <GfAfazeres gf={gf} />
        </TabsContent>

        <TabsContent value="relatorios" className="mt-4 space-y-4">
          <GfPeriodSelector
            value={reportPeriod}
            onChange={setReportPeriod}
            onPrev={() => shiftReportPeriod(-1)}
            onNext={() => shiftReportPeriod(1)}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              className="gap-2 bg-emerald-600 hover:bg-emerald-500"
              disabled={!epigraphicReport}
              onClick={() => {
                document.getElementById('gf-report-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              <FileText className="h-4 w-4" />
              Ver relatório
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={!reportHtml}
              onClick={() => {
                if (!openGfReportPreview(reportHtml)) {
                  window.alert('Permita pop-ups para ver o PDF.')
                }
              }}
            >
              <FileText className="h-4 w-4" />
              Abrir PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={!reportHtml}
              onClick={() => {
                if (!printGfReportHtml(reportHtml)) {
                  window.alert('Permita pop-ups para imprimir.')
                }
              }}
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => downloadGfCsv(gf.transactions, gf.categories, reportRange)}
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => downloadGfJsonBackup(gf.exportBackup())}
            >
              <Download className="h-4 w-4" />
              Backup JSON
            </Button>
            <label className="inline-flex">
              <Button type="button" variant="outline" className="gap-2" asChild>
                <span>
                  <Upload className="h-4 w-4" />
                  Importar
                  <input
                    type="file"
                    accept="application/json"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      void readGfBackupFile(f).then((p) => gf.importBackup(p))
                      e.target.value = ''
                    }}
                  />
                </span>
              </Button>
            </label>
          </div>

          {epigraphicReport ? (
            <GfReportView id="gf-report-view" report={epigraphicReport} fmtBrl={fmtBrl} />
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-border/50 bg-card/30 p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Gráficos fáceis de entender</h3>
              {reportNarrative?.chartHint ? (
                <p className="mt-1 text-xs text-muted-foreground">{reportNarrative.chartHint}</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Cada cor mostra para onde foi o dinheiro. Verde entrou, vermelho saiu.
                </p>
              )}
            </div>
            {s ? (
              <GfCharts
                transactions={gf.transactions}
                categories={gf.categories}
                snapshots={gf.snapshots}
                stats={s}
                cryptoBreakdown={cryptoBreakdown}
                reportRange={reportRange}
                periodLabel={periodSummary.label}
                intuitive
                chartHint={reportNarrative?.chartHint}
              />
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
        </>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `“${deleteTarget.label}” será removido permanentemente.${
                    deleteTarget.kind === 'transaction'
                      ? ' O saldo da caixa será ajustado automaticamente.'
                      : ''
                  }`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-red-600 hover:bg-red-500"
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {deleting ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GfOpenAiPanel
        open={openAiPanelOpen}
        brlPerUsd={gf.brlPerUsd}
        onOpenChange={(open) => {
          setOpenAiPanelOpen(open)
          if (!open) setUsageRefresh((n) => n + 1)
        }}
      />

    </div>
  )
}
