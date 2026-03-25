'use client'

import { Fragment, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChainBadge } from '@/components/chain-badge'
import { PoolApyChart } from './pool-apy-chart'
import { Pool, PoolAprPeriod, PoolFilters } from '@/lib/types'
import {
  formatCurrency,
  formatPercent,
  getAprColorClass,
  poolDisplayApr,
} from '@/lib/api'
import {
  computePoolRiskLevel,
  getChainCategory,
  getVolumeTier,
  inferPoolTypes,
  isPreferredChain,
  isPrimaryDexProject,
  shouldExtremeAprWarning,
} from '@/lib/pool-classification'
import { getDexScreenerUrl } from '@/lib/dexscreener'
import { getPoolMetaHint, getPoolSwapFeeLabel } from '@/lib/pool-fee'
import { PairTokenAvatars } from '@/components/pools/pair-token-avatars'
import { ExternalLink, ChevronDown, ChevronUp, ArrowUpDown, LineChart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PoolTableProps {
  pools: Pool[]
  isLoading: boolean
  filters: PoolFilters
  period: PoolAprPeriod
  /** Redes novas vs. visitas anteriores (localStorage). */
  novelChains?: Set<string>
  onSortChange: (sortBy: PoolFilters['sortBy']) => void
}

const COL_COUNT = 7

export function PoolTable({
  pools,
  isLoading,
  filters,
  period,
  novelChains = new Set(),
  onSortChange,
}: PoolTableProps) {
  const [expandedPool, setExpandedPool] = useState<string | null>(null)
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const paginatedPools = pools.slice(page * pageSize, (page + 1) * pageSize)
  const totalPages = Math.ceil(pools.length / pageSize)

  const handleSort = (column: PoolFilters['sortBy']) => {
    onSortChange(column)
  }

  const SortableHeader = ({ column, children }: { column: PoolFilters['sortBy']; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => handleSort(column)}
      className={cn(
        'flex w-full items-center justify-end gap-1 text-muted-foreground transition-colors hover:text-foreground',
        filters.sortBy === column && 'text-gold'
      )}
    >
      {children}
      <ArrowUpDown className="h-3 w-3 shrink-0" />
    </button>
  )

  const openDexScreener = (pool: Pool, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPool(pool)
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Par</TableHead>
              <TableHead>Taxa · gráfico</TableHead>
              <TableHead>Rede</TableHead>
              <TableHead className="text-right">Volume 24h</TableHead>
              <TableHead className="text-right">TVL</TableHead>
              <TableHead className="text-right">APR</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i} className="border-border">
                <TableCell><Skeleton className="h-9 w-44" /></TableCell>
                <TableCell><Skeleton className="h-8 w-28" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                <TableCell><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="ml-auto h-4 w-14" /></TableCell>
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Dialog open={selectedPool !== null} onOpenChange={(open) => !open && setSelectedPool(null)}>
        <DialogContent
          showCloseButton
          className="max-h-[90vh] max-w-4xl w-full gap-0 overflow-hidden border-gold/30 bg-card p-0 sm:max-w-4xl"
        >
          <DialogHeader className="border-b border-border/60 p-4 pb-3">
            <DialogTitle className="font-mono text-base text-gold">
              {selectedPool?.symbol} — {selectedPool?.project} — {selectedPool?.chain}
            </DialogTitle>
            {selectedPool && (
              <Button variant="link" className="h-auto p-0 text-xs text-gold" asChild>
                <a href={getDexScreenerUrl(selectedPool)} target="_blank" rel="noopener noreferrer">
                  Abrir DEXScreener em nova aba
                  <ExternalLink className="ml-1 inline h-3 w-3" />
                </a>
              </Button>
            )}
          </DialogHeader>
          {selectedPool && (
            <iframe
              title="DEXScreener"
              src={getDexScreenerUrl(selectedPool)}
              className="h-[min(560px,70vh)] w-full border-0"
              allow="clipboard-write"
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="min-w-[200px] text-muted-foreground">Par</TableHead>
              <TableHead className="min-w-[140px] text-muted-foreground">Taxa · gráfico</TableHead>
              <TableHead className="min-w-[100px] text-muted-foreground">Rede</TableHead>
              <TableHead className="text-right text-muted-foreground">
                <SortableHeader column="volume">Volume 24h</SortableHeader>
              </TableHead>
              <TableHead className="text-right text-muted-foreground">
                <SortableHeader column="tvl">TVL</SortableHeader>
              </TableHead>
              <TableHead className="text-right text-muted-foreground">
                <SortableHeader column="apr">APR</SortableHeader>
              </TableHead>
              <TableHead className="w-10 p-2 text-muted-foreground" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPools.map((pool, index) => {
              const isExpanded = expandedPool === pool.pool
              const displayApr = poolDisplayApr(pool, period)
              const feeLabel = getPoolSwapFeeLabel(pool)
              const metaHint = getPoolMetaHint(pool)
              const primaryDex = isPrimaryDexProject(pool.project)
              const chainSafe = getChainCategory(pool.chain) === 'safe'

              return (
                <Fragment key={pool.pool}>
                  <TableRow
                    className={cn(
                      'table-row-animate cursor-pointer border-border transition-colors',
                      isExpanded ? 'bg-secondary/50' : 'hover:bg-secondary/30',
                      primaryDex && 'ring-1 ring-inset ring-gold/35'
                    )}
                    style={{ animationDelay: `${index * 30}ms` }}
                    onClick={() => setExpandedPool(isExpanded ? null : pool.pool)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <PairTokenAvatars pool={pool} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">{pool.symbol}</span>
                            {primaryDex && (
                              <Badge
                                variant="outline"
                                className="border-gold/70 bg-gold/10 text-[10px] font-semibold text-gold"
                              >
                                DEX principal
                              </Badge>
                            )}
                            {pool.stablecoin && (
                              <Badge variant="outline" className="text-[10px] border-gold text-gold">
                                Stable
                              </Badge>
                            )}
                          </div>
                          <p
                            className={cn(
                              'truncate text-xs',
                              primaryDex ? 'text-gold/90' : 'text-muted-foreground'
                            )}
                            title={pool.project}
                          >
                            {pool.project}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {feeLabel ? (
                            <Badge
                              variant="secondary"
                              className="border border-border bg-secondary/80 px-2 font-mono text-xs font-semibold"
                              title={pool.poolMeta ?? feeLabel}
                            >
                              {feeLabel}
                            </Badge>
                          ) : metaHint ? (
                            <Badge
                              variant="outline"
                              className="max-w-[120px] truncate px-2 text-[10px] text-muted-foreground"
                              title={pool.poolMeta ?? ''}
                            >
                              {metaHint}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-gold hover:bg-gold/10 hover:text-gold"
                          title="DEXScreener"
                          onClick={(e) => openDexScreener(pool, e)}
                        >
                          <LineChart className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ChainBadge
                        chain={pool.chain}
                        className="text-[11px]"
                        isSafe={chainSafe}
                        isFocus={isPreferredChain(pool.chain)}
                        isNovel={novelChains.has(pool.chain)}
                        showHighApr={displayApr >= 50}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-sm tabular-nums text-foreground">
                        {pool.volumeUsd1d != null ? formatCurrency(pool.volumeUsd1d) : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-sm tabular-nums text-foreground">
                        {formatCurrency(pool.tvlUsd)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span
                          className={cn(
                            'font-mono text-sm font-semibold tabular-nums',
                            getAprColorClass(displayApr),
                            shouldExtremeAprWarning(displayApr) && 'rounded px-1 ring-1 ring-destructive/60'
                          )}
                        >
                          {formatPercent(displayApr)}
                        </span>
                        {shouldExtremeAprWarning(displayApr) && (
                          <span className="text-[10px] font-medium text-destructive">APR extremo — alto risco</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-2 text-center">
                      {isExpanded ? (
                        <ChevronUp className="mx-auto h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="mx-auto h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="border-border bg-secondary/30 hover:bg-secondary/30">
                      <TableCell colSpan={COL_COUNT} className="p-0">
                        <div className="p-4">
                          <button
                            type="button"
                            className="mb-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedPool(null)
                            }}
                          >
                            <ChevronUp className="h-4 w-4" />
                            Fechar detalhe
                          </button>
                          <div className="mb-4 flex flex-wrap gap-3 text-sm">
                            <span className="text-muted-foreground">
                              APR base:{' '}
                              <span className="font-mono text-foreground">{formatPercent(pool.apyBase)}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Recompensa:{' '}
                              <span className="font-mono text-foreground">{formatPercent(pool.apyReward)}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Risco (estim.):{' '}
                              <span className="font-mono text-foreground">
                                {computePoolRiskLevel(pool, displayApr)}
                              </span>
                            </span>
                            <span className="text-muted-foreground">
                              Volume:{' '}
                              <span className="font-mono text-foreground">
                                {getVolumeTier(pool.volumeUsd1d)}
                              </span>
                            </span>
                            <span className="text-muted-foreground">
                              Tipos:{' '}
                              <span className="font-mono text-xs text-foreground">
                                {inferPoolTypes(pool).join(', ')}
                              </span>
                            </span>
                            {pool.poolMeta && (
                              <span className="text-muted-foreground" title={pool.poolMeta}>
                                Meta: <span className="font-mono text-xs text-foreground">{pool.poolMeta}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <PoolApyChart poolId={pool.pool} />
                            </div>
                            <div className="flex flex-col gap-2 shrink-0">
                              {pool.url ? (
                                <a href={pool.url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="outline" size="sm" className="gap-2">
                                    <ExternalLink className="h-4 w-4" />
                                    Abrir no {pool.project}
                                  </Button>
                                </a>
                              ) : (
                                <Button variant="outline" size="sm" className="gap-2" disabled>
                                  <ExternalLink className="h-4 w-4" />
                                  {pool.project}
                                </Button>
                              )}
                              {pool.underlyingTokens && pool.underlyingTokens.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-medium">Tokens:</span>{' '}
                                  {pool.underlyingTokens.slice(0, 3).join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Mostrando {page * pageSize + 1}-{Math.min((page + 1) * pageSize, pools.length)} de {pools.length}
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(0)
            }}
            className="rounded-md border border-border bg-card px-2 py-1 text-sm"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Pagina {page + 1} de {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || totalPages === 0}
          >
            Proxima
          </Button>
        </div>
      </div>
    </div>
  )
}
