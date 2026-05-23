'use client'

import { memo, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import { UnlocksImpactBadge } from '@/components/unlocks/unlocks-impact-badge'
import { UnlocksDualPct } from '@/components/unlocks/unlocks-dual-pct'
import { UnlocksAlertDot } from '@/components/unlocks/unlocks-alert-dot'
import type { UnlockTokenProfile } from '@/services/api/types/unlocks'
import { formatCurrency } from '@/lib/unlocks-format'
import { UnlocksNextDate } from '@/components/unlocks/unlocks-next-date'
import { cn } from '@/lib/utils'

const UnlocksTableRow = memo(function UnlocksTableRow({
  row,
  active,
  onSelect,
}: {
  row: UnlockTokenProfile
  active: boolean
  onSelect: (id: string) => void
}) {
  return (
    <TableRow
      className={cn(
        'cursor-pointer transition-colors',
        active ? 'bg-gold/10 hover:bg-gold/12' : 'hover:bg-muted/30'
      )}
      onClick={() => onSelect(row.geckoId)}
    >
      <TableCell className="py-2.5">
        <div className="flex items-center gap-2">
          <UnlocksAlertDot alert={row.alert} />
          <TokenSymbolAvatar
            symbol={row.symbol}
            coingeckoId={row.geckoId}
            iconUrl={row.image}
            size={26}
          />
          <div className="min-w-0">
            <p className="font-medium leading-tight">{row.symbol}</p>
            <p className="truncate text-[10px] text-muted-foreground sm:hidden">{row.name}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-2.5">
        <UnlocksNextDate unlockAt={row.nextUnlockAt} />
      </TableCell>
      <TableCell className="hidden py-2.5 sm:table-cell">
        <UnlocksImpactBadge level={row.nextImpact} compact />
      </TableCell>
      <TableCell className="py-2.5 text-right">
        <UnlocksDualPct circPct={row.nextInflationPct} maxPct={row.nextSupplyPct} />
      </TableCell>
      <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums text-gold">
        {formatCurrency(row.nextUnlockUsd ?? 0, true)}
      </TableCell>
      <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums text-muted-foreground">
        {row.releasedPct != null ? `${row.releasedPct.toFixed(0)}%` : '—'}
      </TableCell>
      <TableCell className="hidden py-2.5 text-right font-mono text-sm tabular-nums text-cyan-400/90 md:table-cell">
        {row.remainingPct != null ? `${row.remainingPct.toFixed(0)}%` : '—'}
      </TableCell>
    </TableRow>
  )
})

export function UnlocksTable({
  rows,
  isLoading,
  selectedGeckoId,
  onSelect,
}: {
  rows: UnlockTokenProfile[]
  isLoading: boolean
  selectedGeckoId: string | null
  onSelect: (id: string) => void
}) {
  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id)
      requestAnimationFrame(() => {
        document.getElementById('unlocks-chart-anchor')?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      })
    },
    [onSelect]
  )

  return (
    <div className="overflow-x-auto rounded-xl border border-border/50">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[120px]">Token</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="hidden sm:table-cell">Impacto</TableHead>
            <TableHead className="text-right">% evento</TableHead>
            <TableHead className="text-right">Mercado</TableHead>
            <TableHead className="text-right">Circ.</TableHead>
            <TableHead className="hidden text-right md:table-cell">Falta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7}>
                <Skeleton className="h-10 w-full" />
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                Nada encontrado — pesquisa e selecciona na lista (Enter).
              </TableCell>
            </TableRow>
          ) : (
            rows.slice(0, 100).map((row) => (
              <UnlocksTableRow
                key={row.geckoId}
                row={row}
                active={row.geckoId === selectedGeckoId}
                onSelect={handleSelect}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
