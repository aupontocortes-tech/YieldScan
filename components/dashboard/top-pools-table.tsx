'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ChainBadge } from '@/components/chain-badge'
import { Pool } from '@/lib/types'
import { formatCurrency, formatPercent, getApyColorClass } from '@/lib/api'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopPoolsTableProps {
  pools: Pool[]
  isLoading: boolean
  title: string
  sortBy: 'apy' | 'volume'
}

export function TopPoolsTable({ pools, isLoading, title, sortBy }: TopPoolsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Pool</TableHead>
                <TableHead className="text-muted-foreground">Chain</TableHead>
                <TableHead className="text-right text-muted-foreground">
                  {sortBy === 'apy' ? 'APY' : 'Volume 24h'}
                </TableHead>
                <TableHead className="text-right text-muted-foreground">TVL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="ml-auto h-4 w-20" /></TableCell>
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
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Pool</TableHead>
              <TableHead className="text-muted-foreground">Chain</TableHead>
              <TableHead className="text-right text-muted-foreground">
                {sortBy === 'apy' ? 'APY' : 'Volume 24h'}
              </TableHead>
              <TableHead className="text-right text-muted-foreground">TVL</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pools.map((pool, index) => (
              <TableRow 
                key={pool.pool} 
                className="table-row-animate border-border hover:bg-secondary/50"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{pool.symbol}</span>
                    <span className="text-xs text-muted-foreground">{pool.project}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <ChainBadge chain={pool.chain} />
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn('font-mono font-semibold', getApyColorClass(pool.apy))}>
                    {sortBy === 'apy' 
                      ? formatPercent(pool.apy) 
                      : formatCurrency(pool.volumeUsd1d ?? 0)
                    }
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono text-muted-foreground">
                    {formatCurrency(pool.tvlUsd)}
                  </span>
                </TableCell>
                <TableCell>
                  {pool.url ? (
                    <a 
                      href={pool.url} 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground transition-colors hover:text-cyan"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground/50">
                      <ExternalLink className="h-4 w-4" />
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
