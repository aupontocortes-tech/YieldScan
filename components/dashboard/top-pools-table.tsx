'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ChainBadge } from '@/components/chain-badge'
import { Pool } from '@/lib/types'
import { formatCurrency, formatPercent, getAprColorClass } from '@/lib/api'
import { resolvePoolOrDexUrl } from '@/lib/dex'
import { getDexScreenerUrl } from '@/lib/dexscreener'
import { getPoolMetaHint, getPoolSwapFeeLabel } from '@/lib/pool-fee'
import { ExternalLink, LineChart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopPoolsTableProps {
  pools: Pool[]
  isLoading: boolean
  title: string
  sortBy: 'apr' | 'volume'
}

export function TopPoolsTable({ pools, isLoading, title, sortBy }: TopPoolsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="min-w-[120px] text-muted-foreground">Pool</TableHead>
                <TableHead className="min-w-[88px] text-muted-foreground">Taxa</TableHead>
                <TableHead className="min-w-[100px] text-muted-foreground">Chain</TableHead>
                <TableHead className="min-w-[92px] text-right text-muted-foreground whitespace-nowrap">
                  {sortBy === 'apr' ? 'APR' : 'Vol. 24h'}
                </TableHead>
                <TableHead className="min-w-[88px] text-right text-muted-foreground whitespace-nowrap">TVL</TableHead>
                <TableHead className="w-[88px] text-muted-foreground">Links</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="min-w-[120px] text-muted-foreground">Pool</TableHead>
              <TableHead className="min-w-[88px] text-muted-foreground">Taxa</TableHead>
              <TableHead className="min-w-[100px] text-muted-foreground">Chain</TableHead>
              <TableHead className="min-w-[92px] text-right text-muted-foreground whitespace-nowrap">
                {sortBy === 'apr' ? 'APR' : 'Vol. 24h'}
              </TableHead>
              <TableHead className="min-w-[88px] text-right text-muted-foreground whitespace-nowrap">TVL</TableHead>
              <TableHead className="w-[88px] text-muted-foreground">Links</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pools.map((pool, index) => {
              const feeLabel = getPoolSwapFeeLabel(pool)
              const metaHint = getPoolMetaHint(pool)
              const dexHref = resolvePoolOrDexUrl(pool)
              return (
                <TableRow 
                  key={pool.pool} 
                  className="table-row-animate border-border hover:bg-secondary/50"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-foreground">{pool.symbol}</span>
                      {dexHref ? (
                        <a
                          href={dexHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir esta pool na corretora (nova aba)"
                          className="w-fit text-xs font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {pool.project}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">{pool.project}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {feeLabel ? (
                      <Badge
                        variant="secondary"
                        className="border border-border bg-secondary/80 px-2 font-mono text-xs font-semibold"
                        title={pool.poolMeta ?? feeLabel}
                      >
                        {feeLabel}
                      </Badge>
                    ) : metaHint ? (
                      <span className="text-xs text-muted-foreground" title={pool.poolMeta ?? ''}>
                        {metaHint}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ChainBadge chain={pool.chain} />
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        'inline-block min-w-[4.5rem] font-mono font-semibold tabular-nums',
                        sortBy === 'apr' ? getAprColorClass(pool.apy) : 'text-foreground'
                      )}
                    >
                      {sortBy === 'apr'
                        ? formatPercent(pool.apy)
                        : formatCurrency(pool.volumeUsd1d ?? 0)
                      }
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-block min-w-[4.25rem] font-mono tabular-nums text-muted-foreground">
                      {formatCurrency(pool.tvlUsd)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-cyan hover:bg-cyan/15 hover:text-cyan"
                        title="Gráfico DEXScreener (nova aba)"
                        onClick={() =>
                          window.open(getDexScreenerUrl(pool), '_blank', 'noopener,noreferrer')
                        }
                      >
                        <LineChart className="h-4 w-4" />
                      </Button>
                      {dexHref ? (
                        <a
                          href={dexHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir esta pool na corretora (nova aba)"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-cyan"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground/40">
                          <ExternalLink className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
