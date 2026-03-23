'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChainBadge } from '@/components/chain-badge'
import { PoolApyChart } from './pool-apy-chart'
import { Pool, PoolFilters } from '@/lib/types'
import { formatCurrency, formatPercent, getApyColorClass, getChangeIndicator } from '@/lib/api'
import { ExternalLink, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PoolTableProps {
  pools: Pool[]
  isLoading: boolean
  filters: PoolFilters
  onSortChange: (sortBy: PoolFilters['sortBy']) => void
}

export function PoolTable({ pools, isLoading, filters, onSortChange }: PoolTableProps) {
  const [expandedPool, setExpandedPool] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const paginatedPools = pools.slice(page * pageSize, (page + 1) * pageSize)
  const totalPages = Math.ceil(pools.length / pageSize)

  const handleSort = (column: PoolFilters['sortBy']) => {
    onSortChange(column)
  }

  const SortableHeader = ({ column, children }: { column: PoolFilters['sortBy']; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(column)}
      className={cn(
        'flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors',
        filters.sortBy === column && 'text-cyan'
      )}
    >
      {children}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  )

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-[300px]">Pool</TableHead>
              <TableHead>Chain</TableHead>
              <TableHead className="text-right">APY</TableHead>
              <TableHead className="text-right">TVL</TableHead>
              <TableHead className="text-right">Volume 24h</TableHead>
              <TableHead className="text-right">Var. 7d</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i} className="border-border">
                <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="ml-auto h-4 w-16" /></TableCell>
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
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-[300px] text-muted-foreground">Pool</TableHead>
              <TableHead className="text-muted-foreground">Chain</TableHead>
              <TableHead className="text-right">
                <SortableHeader column="apy">APY</SortableHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader column="tvl">TVL</SortableHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader column="volume">Volume 24h</SortableHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader column="change7d">Var. 7d</SortableHeader>
              </TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPools.map((pool, index) => {
              const isExpanded = expandedPool === pool.pool
              const change = getChangeIndicator(pool.apyPct7D)

              return (
                <Collapsible
                  key={pool.pool}
                  open={isExpanded}
                  onOpenChange={() => setExpandedPool(isExpanded ? null : pool.pool)}
                  asChild
                >
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow 
                        className={cn(
                          'table-row-animate border-border cursor-pointer transition-colors',
                          isExpanded ? 'bg-secondary/50' : 'hover:bg-secondary/30'
                        )}
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">{pool.symbol}</span>
                              <span className="text-xs text-muted-foreground">{pool.project}</span>
                            </div>
                            {pool.stablecoin && (
                              <Badge variant="outline" className="text-xs border-gold text-gold">
                                Stable
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ChainBadge chain={pool.chain} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span className={cn('font-mono font-semibold', getApyColorClass(pool.apy))}>
                              {formatPercent(pool.apy)}
                            </span>
                            {pool.apyReward && pool.apyReward > 0 && (
                              <span className="text-xs text-muted-foreground">
                                +{formatPercent(pool.apyReward)} rewards
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-muted-foreground">
                            {formatCurrency(pool.tvlUsd)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-muted-foreground">
                            {pool.volumeUsd1d ? formatCurrency(pool.volumeUsd1d) : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={cn('font-mono text-sm', change.color)}>
                            {change.text}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow className="border-border bg-secondary/30 hover:bg-secondary/30">
                        <TableCell colSpan={7} className="p-0">
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <PoolApyChart poolId={pool.pool} />
                              </div>
                              <div className="flex flex-col gap-2">
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
                    </CollapsibleContent>
                  </>
                </Collapsible>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
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
            Pagina {page + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Proxima
          </Button>
        </div>
      </div>
    </div>
  )
}
