'use client'

import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { DataLoadError } from '@/components/data-load-error'
import { UnlocksDatesBanner } from '@/components/unlocks/unlocks-dates-banner'
import { UnlocksVestingChart } from '@/components/unlocks/unlocks-vesting-chart'
import { UnlocksReleasedRing } from '@/components/unlocks/unlocks-released-ring'
import { UnlocksTokenPicker } from '@/components/unlocks/unlocks-token-picker'
import { UnlocksFocusCard } from '@/components/unlocks/unlocks-focus-card'
import { UnlocksRankedChart } from '@/components/unlocks/unlocks-ranked-chart'
import { UnlocksTable } from '@/components/unlocks/unlocks-table'
import { useUnlocks } from '@/hooks/use-unlocks'
import { usePortfolioUnlockMatches } from '@/hooks/use-portfolio-unlock-tokens'
import { useUnlocksStore } from '@/store/unlocks-store'
import type { UnlocksPeriod } from '@/services/api/types/unlocks'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const PERIODS: { value: UnlocksPeriod; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
]

export function UnlocksDashboard() {
  const searchParams = useSearchParams()
  const period = useUnlocksStore((s) => s.period)
  const view = useUnlocksStore((s) => s.view)
  const search = useUnlocksStore((s) => s.search)
  const extraGeckoIds = useUnlocksStore((s) => s.extraGeckoIds)
  const selectedGeckoId = useUnlocksStore((s) => s.selectedGeckoId)
  const setPeriod = useUnlocksStore((s) => s.setPeriod)
  const setView = useUnlocksStore((s) => s.setView)
  const setSelectedGeckoId = useUnlocksStore((s) => s.setSelectedGeckoId)

  useEffect(() => {
    const q = searchParams.get('view')
    if (q === 'wallet' || q === 'carteira') setView('wallet')
  }, [searchParams, setView])

  const { data, isLoading, isError, refetch, isFetching } = useUnlocks(
    period,
    view,
    extraGeckoIds
  )

  const walletRows = usePortfolioUnlockMatches(data?.catalog)

  const catalogFiltered = useMemo(() => {
    let rows = data?.catalog ?? []
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.symbol.toLowerCase().includes(q) ||
          r.geckoId.toLowerCase().includes(q)
      )
    } else if (view === 'next') {
      rows = rows.filter((r) => r.hasUnlockInPeriod || r.releasedPct != null)
    } else if (view === 'largest') {
      rows = rows.filter((r) => (r.remainingUsd ?? 0) > 0 || (r.remainingPct ?? 0) > 0)
    }
    return rows
  }, [data?.catalog, search, view])

  const list = useMemo(() => {
    if (view === 'wallet') {
      let w = walletRows
      const q = search.trim().toLowerCase()
      if (q) {
        w = w.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.symbol.toLowerCase().includes(q) ||
            r.geckoId.toLowerCase().includes(q)
        )
      }
      return w
    }
    return catalogFiltered
  }, [view, walletRows, catalogFiltered, search])

  const focus = useMemo(() => {
    if (!list.length) return null
    if (selectedGeckoId) {
      return list.find((r) => r.geckoId === selectedGeckoId) ?? list[0]
    }
    return list[0]
  }, [list, selectedGeckoId])

  useEffect(() => {
    if (!selectedGeckoId && list[0]?.geckoId) {
      setSelectedGeckoId(list[0].geckoId)
    }
  }, [list, selectedGeckoId, setSelectedGeckoId])

  useEffect(() => {
    if (view === 'wallet' && list.length && selectedGeckoId) {
      const inList = list.some((r) => r.geckoId === selectedGeckoId)
      if (!inList) setSelectedGeckoId(list[0]!.geckoId)
    }
  }, [view, list, selectedGeckoId, setSelectedGeckoId])

  const vesting =
    (focus?.geckoId && data?.vestingByGeckoId?.[focus.geckoId]) || null

  const showRanked = view === 'largest' || view === 'wallet'
  const rankedTitle =
    view === 'wallet'
      ? 'Falta desbloquear — tokens da tua carteira'
      : 'Falta desbloquear — maior para menor'

  const handleSelect = (id: string) => {
    setSelectedGeckoId(id)
    requestAnimationFrame(() => {
      document.getElementById('unlocks-focus-anchor')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    })
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Unlocks</h1>
          <div className="flex gap-2">
            <UnlocksTokenPicker />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 size-9"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Actualizar"
            >
              <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
            </Button>
          </div>
        </header>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-3">
            <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
              <TabsList className="h-9 flex-wrap bg-muted/30">
                <TabsTrigger value="next" className="text-xs data-[state=active]:text-gold">
                  Próximo
                </TabsTrigger>
                <TabsTrigger value="largest" className="text-xs data-[state=active]:text-gold">
                  Maior
                </TabsTrigger>
                <TabsTrigger value="wallet" className="text-xs data-[state=active]:text-gold">
                  Carteira
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {focus && <UnlocksReleasedRing releasedPct={focus.releasedPct} />}
          </div>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as UnlocksPeriod)}>
            <TabsList className="h-9 bg-muted/30">
              {PERIODS.map((p) => (
                <TabsTrigger key={p.value} value={p.value} className="px-3 text-xs">
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {view === 'wallet' && !walletRows.length && !isLoading && (
          <p className="rounded-lg border border-border/50 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
            Nenhum token da tua{' '}
            <Link href="/portfolio" className="text-gold underline-offset-2 hover:underline">
              carteira
            </Link>{' '}
            tem dados de unlock. Adiciona posições com id CoinGecko ou pesquisa o token acima.
          </p>
        )}

        {isError && <DataLoadError onRetry={() => refetch()} />}

        {!isLoading && list.length > 0 && (
          <UnlocksDatesBanner
            rows={list}
            selectedGeckoId={selectedGeckoId}
            onSelect={handleSelect}
          />
        )}

        {showRanked && (
          <UnlocksRankedChart
            rows={list}
            title={rankedTitle}
            isLoading={isLoading}
            selectedGeckoId={selectedGeckoId}
            onSelect={handleSelect}
          />
        )}

        <div id="unlocks-focus-anchor">
          {isLoading ? (
            <Skeleton className="h-44 rounded-xl" />
          ) : focus ? (
            <UnlocksFocusCard token={focus} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {view === 'wallet'
                ? 'Adiciona tokens na Carteira para ver unlocks aqui.'
                : 'Pesquisa uma moeda ou alarga o período.'}
            </p>
          )}
        </div>

        <UnlocksVestingChart
          tokenName={focus?.name ?? '—'}
          timeline={vesting}
          isLoading={isLoading}
        />

        <UnlocksTable
          rows={list}
          isLoading={isLoading}
          selectedGeckoId={selectedGeckoId}
          onSelect={handleSelect}
        />
      </main>
    </div>
  )
}
