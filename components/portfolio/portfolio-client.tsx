'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/api'
import { appendSnapshot, defaultPortfolio } from '@/lib/portfolio/storage'
import { totalsFromHoldings, rowMetrics, quoteForHolding } from '@/lib/portfolio/metrics'
import type { CmcQuote, PortfolioHolding } from '@/lib/portfolio/types'
import { CoinAvatar } from '@/lib/portfolio/cmc-assets'
import { usePortfolioStore } from '@/hooks/use-portfolio'
import { AddTransactionDialog } from '@/components/portfolio/add-transaction-dialog'
import { PortfolioTransactionRow } from '@/components/portfolio/transaction-row'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

const CARD =
  'rounded-2xl border border-white/[0.06] bg-[#111827] text-card-foreground shadow-lg shadow-black/30'
const PAGE_BG = 'bg-[#0B0F14]'

async function fetchPrices(
  holdings: Pick<PortfolioHolding, 'symbol' | 'geckoId'>[],
  extraSymbols: string[],
): Promise<{
  prices: Record<string, CmcQuote>
  byGeckoId?: Record<string, CmcQuote>
  error?: string
}> {
  const symbols = new Set<string>()
  const geckoIds = new Set<string>()
  for (const h of holdings) {
    const s = h.symbol.trim().toUpperCase()
    if (s) symbols.add(s)
    const g = h.geckoId?.trim().toLowerCase()
    if (g) geckoIds.add(g)
  }
  for (const s of extraSymbols) {
    const u = s.trim().toUpperCase()
    if (u) symbols.add(u)
  }
  const symList = [...symbols]
  const idList = [...geckoIds]
  if (!symList.length && !idList.length) return { prices: {} }
  const sp = new URLSearchParams()
  if (idList.length) sp.set('ids', idList.join(','))
  if (symList.length) sp.set('symbols', symList.join(','))
  const res = await fetch(`/api/prices?${sp.toString()}`)
  const j = (await res.json()) as {
    prices?: Record<string, CmcQuote>
    byGeckoId?: Record<string, CmcQuote>
    error?: string
  }
  return {
    prices: j.prices ?? {},
    byGeckoId: j.byGeckoId,
    error: j.error,
  }
}

const PIE_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#fb7185',
  '#06b6d4',
  '#a855f7',
  '#e11d48',
  '#d4af37',
  '#84cc16',
  '#ec4899',
  '#14b8a6',
  '#8b5cf6',
]

type PieSlice = {
  id: string
  name: string
  displayName: string
  value: number
  pct: number
  color: string
}

function pctTone(v: number) {
  if (v > 0.0001) return 'text-[#22c55e]'
  if (v < -0.0001) return 'text-[#ef4444]'
  return 'text-muted-foreground'
}

export function PortfolioClient() {
  const { data, ready, setName, mergePortfolio, addPurchase, editHolding, deleteHolding, sell } =
    usePortfolioStore()

  const [addDialogSymbol, setAddDialogSymbol] = useState<string | null>(null)

  const symbols = useMemo(() => {
    const s = new Set(data.holdings.map((h) => h.symbol))
    if (addDialogSymbol) s.add(addDialogSymbol)
    return [...s].sort()
  }, [data.holdings, addDialogSymbol])

  const priceQueryKey = useMemo(() => {
    const gecko = [
      ...new Set(
        data.holdings
          .map((h) => h.geckoId?.trim().toLowerCase())
          .filter((g): g is string => Boolean(g)),
      ),
    ].sort()
    return ['portfolio-prices', symbols.join(','), gecko.join(',')] as const
  }, [data.holdings, symbols])

  const {
    data: pricePayload,
    isLoading: pricesLoading,
    isFetching: pricesFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: priceQueryKey,
    queryFn: () =>
      fetchPrices(data.holdings, addDialogSymbol ? [addDialogSymbol] : []),
    enabled: ready && symbols.length > 0,
    refetchInterval: 60_000,
    staleTime: 45_000,
  })

  const prices = pricePayload?.prices ?? {}
  const byGeckoId = pricePayload?.byGeckoId

  const totals = useMemo(
    () =>
      totalsFromHoldings(data.holdings, prices, data.realizedPnlUsd, byGeckoId),
    [data.holdings, data.realizedPnlUsd, prices, byGeckoId],
  )

  useEffect(() => {
    if (!ready || symbols.length === 0 || !dataUpdatedAt) return
    mergePortfolio((prev) => appendSnapshot(prev, totals.valueUsd))
  }, [ready, dataUpdatedAt, symbols.length, totals.valueUsd, mergePortfolio])

  const [filter, setFilter] = useState<'all' | 'up' | 'down'>('all')

  const rows = useMemo(() => {
    const list = data.holdings.map((h) => {
      const q = quoteForHolding(h, prices, byGeckoId)
      const m = rowMetrics(h, q)
      return { h, m, q }
    })
    if (filter === 'up') return list.filter((r) => r.m.pnlUsd > 0)
    if (filter === 'down') return list.filter((r) => r.m.pnlUsd < 0)
    return list
  }, [data.holdings, prices, byGeckoId, filter])

  const bestWorst = useMemo(() => {
    const withVal = rows.filter((r) => r.m.valueUsd > 0)
    if (!withVal.length) return { best: null as null | (typeof rows)[0], worst: null }
    const byPnl = [...withVal].sort((a, b) => b.m.pnlUsd - a.m.pnlUsd)
    return { best: byPnl[0] ?? null, worst: byPnl[byPnl.length - 1] ?? null }
  }, [rows])

  const pieSlices = useMemo((): PieSlice[] => {
    const t = totals.valueUsd
    if (t <= 0) return []
    const rows = data.holdings
      .map((h) => {
        const m = rowMetrics(h, quoteForHolding(h, prices, byGeckoId))
        return {
          id: h.id,
          name: h.symbol,
          displayName: (h.name || h.symbol).trim() || h.symbol,
          value: m.valueUsd,
          pct: t > 0 ? (m.valueUsd / t) * 100 : 0,
        }
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
    return rows.map((r, i) => ({
      ...r,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }))
  }, [data.holdings, prices, byGeckoId, totals.valueUsd])

  const lineData = useMemo(() => {
    return [...data.snapshots]
      .sort((a, b) => a.t - b.t)
      .map((s) => ({
        t: s.t,
        v: s.totalUsd,
        label: new Date(s.t).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      }))
  }, [data.snapshots])

  const [addOpen, setAddOpen] = useState(false)
  const [overviewTab, setOverviewTab] = useState<'history' | 'allocation'>('allocation')
  const [allocHover, setAllocHover] = useState<number | null>(null)

  const handleAddDialogOpen = useCallback((next: boolean) => {
    setAddOpen(next)
    if (!next) setAddDialogSymbol(null)
  }, [])
  const [editOpen, setEditOpen] = useState(false)
  const [sellOpen, setSellOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [activeHolding, setActiveHolding] = useState<PortfolioHolding | null>(null)

  const [editQty, setEditQty] = useState('')
  const [editAvg, setEditAvg] = useState('')
  const [editDate, setEditDate] = useState('')

  const [sellQty, setSellQty] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [sellDate, setSellDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [formErr, setFormErr] = useState<string | null>(null)

  const openEdit = (h: PortfolioHolding) => {
    setActiveHolding(h)
    setEditQty(String(h.quantity))
    setEditAvg(String(h.avgBuyUsd))
    setEditDate(h.firstBuyAt)
    setEditOpen(true)
  }

  const submitEdit = () => {
    if (!activeHolding) return
    const qty = Number(editQty.replace(',', '.'))
    const avg = Number(editAvg.replace(',', '.'))
    if (!Number.isFinite(qty) || qty < 0) return
    if (!Number.isFinite(avg) || avg < 0) return
    editHolding(activeHolding.id, {
      quantity: qty,
      avgBuyUsd: avg,
      firstBuyAt: editDate,
    })
    setEditOpen(false)
    setActiveHolding(null)
  }

  const openSell = (h: PortfolioHolding) => {
    setActiveHolding(h)
    setSellQty('')
    const sq = quoteForHolding(h, prices, byGeckoId)
    setSellPrice(sq?.price != null ? String(sq.price) : '')
    setSellDate(new Date().toISOString().slice(0, 10))
    setFormErr(null)
    setSellOpen(true)
  }

  const submitSell = () => {
    if (!activeHolding) return
    const qty = Number(sellQty.replace(',', '.'))
    const px = Number(sellPrice.replace(',', '.'))
    const err = sell(activeHolding.id, qty, px, sellDate)
    if (err) {
      setFormErr(err)
      return
    }
    setSellOpen(false)
    setActiveHolding(null)
    setFormErr(null)
  }

  const openDelete = (h: PortfolioHolding) => {
    setActiveHolding(h)
    setDeleteOpen(true)
  }

  const priceBanner =
    pricePayload?.error === 'coingecko_429'
      ? 'CoinGecko está a limitar pedidos (429). Adiciona COINGECKO_DEMO_API_KEY ou COINGECKO_PRO_API_KEY no servidor para limites mais altos.'
      : pricePayload?.error?.startsWith('coingecko_')
        ? 'Não foi possível obter preços ao vivo. Tenta de novo dentro de instantes.'
        : null

  if (!ready) {
    return (
      <div className={cn('flex flex-1 flex-col', PAGE_BG)}>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Skeleton className="mb-6 h-32 rounded-2xl bg-white/5" />
          <Skeleton className="h-96 rounded-2xl bg-white/5" />
        </main>
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', PAGE_BG)}>
      <main className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {priceBanner && (
          <div
            className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
            role="status"
          >
            {priceBanner}
          </div>
        )}

        {/* Header */}
        <div className={cn('mb-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between', CARD)}>
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-[#3b82f6]">
              <Wallet className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Portfólio
              </p>
              <div
                className="mt-1 flex flex-wrap items-center gap-2"
                data-no-swipe-nav
              >
                <Input
                  value={data.name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={(e) => {
                    const t = e.currentTarget.value.trim()
                    setName(t.length > 0 ? t : defaultPortfolio().name)
                  }}
                  placeholder={defaultPortfolio().name}
                  autoComplete="off"
                  className="h-9 max-w-[220px] border-white/10 bg-black/20 font-semibold"
                />
                {pricesFetching && symbols.length > 0 && (
                  <span className="text-xs text-[#3b82f6]">A atualizar…</span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Lucro realizado acumulado:{' '}
                <span className={cn('font-mono font-medium', pctTone(data.realizedPnlUsd))}>
                  {formatCurrency(data.realizedPnlUsd, false)}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <span className="text-xs text-muted-foreground">Valor total (USD)</span>
            <span className="font-mono text-3xl font-bold tracking-tight text-foreground">
              {pricesLoading && symbols.length > 0 ? '—' : formatCurrency(totals.valueUsd, false)}
            </span>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">P&amp;L total</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 font-mono font-semibold',
                  pctTone(totals.totalPnlUsd),
                )}
              >
                {totals.totalPnlUsd >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                {formatCurrency(totals.totalPnlUsd, false)}
                <span className="text-muted-foreground">({formatPercent(totals.totalPnlPct)})</span>
              </span>
            </div>
          </div>
        </div>

        {(bestWorst.best || bestWorst.worst) && (
          <div className="mb-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {bestWorst.best && (
              <span className="rounded-full border border-white/10 bg-[#111827] px-3 py-1">
                Melhor posição:{' '}
                <strong className="text-[#22c55e]">{bestWorst.best.h.symbol}</strong> (
                {formatCurrency(bestWorst.best.m.pnlUsd, false)})
              </span>
            )}
            {bestWorst.worst && bestWorst.worst.h.id !== bestWorst.best?.h.id && (
              <span className="rounded-full border border-white/10 bg-[#111827] px-3 py-1">
                Pior posição:{' '}
                <strong className="text-[#ef4444]">{bestWorst.worst.h.symbol}</strong> (
                {formatCurrency(bestWorst.worst.m.pnlUsd, false)})
              </span>
            )}
          </div>
        )}

        <Card className={cn(CARD, 'mb-8')}>
          <CardHeader className="pb-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base font-semibold">Carteira</CardTitle>
              <Tabs
                value={overviewTab}
                onValueChange={(v) => {
                  setOverviewTab(v as 'history' | 'allocation')
                  setAllocHover(null)
                }}
              >
                <TabsList className="h-9 border border-white/10 bg-[#0d1117] p-1">
                  <TabsTrigger
                    value="history"
                    className="rounded-md px-4 text-xs font-medium data-[state=active]:bg-[#252936] data-[state=active]:text-white data-[state=inactive]:text-muted-foreground"
                  >
                    Histórico
                  </TabsTrigger>
                  <TabsTrigger
                    value="allocation"
                    className="rounded-md px-4 text-xs font-medium data-[state=active]:bg-[#252936] data-[state=active]:text-white data-[state=inactive]:text-muted-foreground"
                  >
                    Alocação
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {overviewTab === 'history' ? (
              <div className="h-[300px] sm:h-[320px]">
                {lineData.length < 2 ? (
                  <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                    O gráfico preenche após atualizações de preço (ex.: a cada minuto com CoinGecko).
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickFormatter={(v) => {
                          if (!Number.isFinite(v)) return ''
                          if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
                          if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`
                          return v.toFixed(0)
                        }}
                      />
                      <ReTooltip
                        formatter={(v: number) => formatCurrency(v, false)}
                        labelFormatter={(_, p) => {
                          const row = p?.[0]?.payload as { t?: number }
                          return row?.t
                            ? new Date(row.t).toLocaleString('pt-BR')
                            : ''
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#3b82f6' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            ) : (
              <div className="flex min-h-[300px] flex-col gap-8 lg:flex-row lg:items-center lg:gap-10">
                <div className="flex flex-1 items-center justify-center lg:max-w-[min(100%,360px)]">
                  {pieSlices.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      Adiciona ativos para ver a distribuição e as percentagens.
                    </p>
                  ) : (
                    <div className="aspect-square w-full max-w-[280px] sm:max-w-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieSlices}
                            dataKey="value"
                            nameKey="displayName"
                            cx="50%"
                            cy="50%"
                            innerRadius="52%"
                            outerRadius="78%"
                            paddingAngle={2}
                            stroke="transparent"
                            onMouseEnter={(_, i) => setAllocHover(i)}
                            onMouseLeave={() => setAllocHover(null)}
                          >
                            {pieSlices.map((slice, i) => (
                              <Cell
                                key={slice.id}
                                fill={slice.color}
                                fillOpacity={
                                  allocHover === null ? 1 : allocHover === i ? 1 : 0.35
                                }
                                className="outline-none transition-[fill-opacity] duration-150"
                              />
                            ))}
                          </Pie>
                          <ReTooltip
                            formatter={(value: number, _n, item) => {
                              const payload = item?.payload as PieSlice | undefined
                              const pct = payload?.pct ?? 0
                              const label = payload?.displayName ?? payload?.name ?? ''
                              return [
                                `${formatCurrency(value, false)} · ${pct.toFixed(2)}%`,
                                label,
                              ]
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-center lg:min-w-0 lg:pl-2">
                  {pieSlices.length > 0 && (
                    <ul className="space-y-0.5">
                      {pieSlices.map((row, i) => (
                        <li key={row.id}>
                          <button
                            type="button"
                            className={cn(
                              'flex w-full items-center justify-between gap-3 rounded-lg py-2.5 pl-1 pr-2 text-left transition-colors',
                              allocHover === i ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]',
                            )}
                            onMouseEnter={() => setAllocHover(i)}
                            onMouseLeave={() => setAllocHover(null)}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span
                                className="size-2.5 shrink-0 rounded-full ring-1 ring-white/10"
                                style={{ backgroundColor: row.color }}
                                aria-hidden
                              />
                              <span className="truncate text-sm font-medium text-foreground">
                                {row.displayName}
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums text-sm font-mono text-muted-foreground">
                              {row.pct.toFixed(2)}%
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="border border-white/10 bg-[#111827]">
              <TabsTrigger
                value="all"
                className="data-[state=active]:bg-[#3b82f6]/20 data-[state=active]:text-[#60a5fa]"
              >
                Todos
              </TabsTrigger>
              <TabsTrigger
                value="up"
                className="data-[state=active]:bg-[#22c55e]/15 data-[state=active]:text-[#22c55e]"
              >
                Em lucro
              </TabsTrigger>
              <TabsTrigger
                value="down"
                className="data-[state=active]:bg-[#ef4444]/15 data-[state=active]:text-[#ef4444]"
              >
                Em prejuízo
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            onClick={() => setAddOpen(true)}
            className="bg-[#3b82f6] text-white hover:bg-[#2563eb]"
          >
            <Plus className="size-4" />
            Adicionar transação
          </Button>
        </div>

        <Card className={cn(CARD, 'min-h-0 flex-1')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Ativos</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4 sm:px-4">
            {data.holdings.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Ainda não tem posições. Usa &quot;Adicionar transação&quot; para começar.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">24h</TableHead>
                    <TableHead className="text-right">7d</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Preço médio</TableHead>
                    <TableHead className="text-right">P&amp;L</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ h, m }) => (
                    <TableRow key={h.id} className="border-white/10">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CoinAvatar
                            cmcId={h.cmcId}
                            symbol={h.symbol}
                            iconUrl={h.iconUrl}
                            size={32}
                          />
                          <div>
                            <div className="font-medium">{h.name}</div>
                            <div className="text-xs text-muted-foreground">{h.symbol}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {m.price > 0 ? formatCurrency(m.price, false) : '—'}
                      </TableCell>
                      <TableCell className={cn('text-right font-mono text-sm', pctTone(m.pct24h))}>
                        {m.price > 0 ? formatPercent(m.pct24h) : '—'}
                      </TableCell>
                      <TableCell className={cn('text-right font-mono text-sm', pctTone(m.pct7d))}>
                        {m.price > 0 ? formatPercent(m.pct7d) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {h.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(m.valueUsd, false)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(h.avgBuyUsd, false)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={cn('font-mono text-sm font-semibold', pctTone(m.pnlUsd))}>
                          {formatCurrency(m.pnlUsd, false)}
                        </div>
                        <div className={cn('text-xs', pctTone(m.pnlPct))}>
                          {formatPercent(m.pnlPct)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-white/10 bg-[#111827]">
                            <DropdownMenuItem onClick={() => openEdit(h)}>
                              <Pencil className="size-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openSell(h)}>
                              <Tag className="size-4" />
                              Registrar venda
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-[#ef4444] focus:text-[#ef4444]"
                              onClick={() => openDelete(h)}
                            >
                              <Trash2 className="size-4" />
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <AddTransactionDialog
          open={addOpen}
          onOpenChange={handleAddDialogOpen}
          holdings={data.holdings}
          spotPrices={prices}
          spotByGeckoId={byGeckoId}
          onActiveBuySymbolChange={setAddDialogSymbol}
          onBuy={addPurchase}
          onSell={sell}
        />

        {/* Edit */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="border-white/10 bg-[#111827] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar posição</DialogTitle>
            </DialogHeader>
            {activeHolding && (
              <div className="grid gap-3 py-2">
                <p className="text-sm text-muted-foreground">
                  {activeHolding.name} ({activeHolding.symbol})
                </p>
                <div className="grid gap-1">
                  <Label>Quantidade</Label>
                  <Input
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    className="border-white/10 bg-black/25"
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Preço médio de compra (USD)</Label>
                  <Input
                    value={editAvg}
                    onChange={(e) => setEditAvg(e.target.value)}
                    className="border-white/10 bg-black/25"
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Data (referência)</Label>
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="border-white/10 bg-black/25"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="secondary" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button className="bg-[#3b82f6] hover:bg-[#2563eb]" onClick={submitEdit}>
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sell */}
        <Dialog open={sellOpen} onOpenChange={setSellOpen}>
          <DialogContent className="border-white/10 bg-[#111827] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar venda</DialogTitle>
            </DialogHeader>
            {activeHolding && (
              <div className="grid gap-3 py-2">
                <p className="text-sm text-muted-foreground">
                  Disponível: {activeHolding.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}{' '}
                  {activeHolding.symbol}
                </p>
                <div className="grid gap-1">
                  <Label>Quantidade vendida</Label>
                  <Input
                    value={sellQty}
                    onChange={(e) => setSellQty(e.target.value)}
                    className="border-white/10 bg-black/25"
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Preço de venda (USD)</Label>
                  <Input
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    className="border-white/10 bg-black/25"
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={sellDate}
                    onChange={(e) => setSellDate(e.target.value)}
                    className="border-white/10 bg-black/25"
                  />
                </div>
                {formErr && <p className="text-sm text-[#ef4444]">{formErr}</p>}
              </div>
            )}
            <DialogFooter>
              <Button variant="secondary" onClick={() => (setSellOpen(false), setFormErr(null))}>
                Cancelar
              </Button>
              <Button className="bg-[#3b82f6] hover:bg-[#2563eb]" onClick={submitSell}>
                Confirmar venda
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {data.transactions.length > 0 && (
          <Card className={cn(CARD, 'mt-8')}>
            <CardHeader className="pb-3">
              <Link
                href="/portfolio/historico"
                aria-label="Ver histórico completo de transações"
                className="group -m-1 rounded-xl p-1 outline-none transition-colors hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-[#3b82f6]/45"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <CardTitle className="text-base font-semibold transition-colors group-hover:text-[#93c5fd]">
                        Histórico recente
                      </CardTitle>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[#93c5fd]" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Últimas {Math.min(8, data.transactions.length)} movimentações · clica para ver todo o
                      histórico
                    </p>
                  </div>
                </div>
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="flex flex-col gap-2">
                {data.transactions.slice(0, 8).map((tx) => (
                  <li key={tx.id}>
                    <PortfolioTransactionRow tx={tx} holdings={data.holdings} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent className="border-white/10 bg-[#111827]">
            <AlertDialogHeader>
              <AlertDialogTitle>Remover ativo?</AlertDialogTitle>
              <AlertDialogDescription>
                {activeHolding
                  ? `Isto remove ${activeHolding.symbol} da carteira. O histórico de compras/vendas em memória mantém-se, mas a posição deixa de aparecer.`
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/10 bg-transparent">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-[#ef4444] hover:bg-[#dc2626]"
                onClick={() => {
                  if (activeHolding) deleteHolding(activeHolding.id)
                  setDeleteOpen(false)
                  setActiveHolding(null)
                }}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}
