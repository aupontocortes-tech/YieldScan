'use client'

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { formatCurrency } from '@/lib/api'
import { CoinAvatar } from '@/lib/portfolio/cmc-assets'
import type { PortfolioHolding, PortfolioTransaction } from '@/lib/portfolio/types'
import { cn } from '@/lib/utils'

function pctTone(v: number) {
  if (v > 0.0001) return 'text-[#22c55e]'
  if (v < -0.0001) return 'text-[#ef4444]'
  return 'text-muted-foreground'
}

/** Aceita `datetime-local`, ISO ou só data (YYYY-MM-DD). */
export function parseTransactionAt(raw: string): Date | null {
  const t = raw.trim()
  if (!t) return null
  const normalized = t.length <= 10 ? `${t}T12:00:00` : t.replace(' ', 'T')
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatTransactionWhen(raw: string): string {
  const d = parseTransactionAt(raw)
  if (!d) return raw
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function iconUrlForTx(tx: PortfolioTransaction, holdings: PortfolioHolding[]): string | undefined {
  const h = holdings.find((x) => x.symbol === tx.symbol)
  return h?.iconUrl
}

type TransactionRowProps = {
  tx: PortfolioTransaction
  holdings: PortfolioHolding[]
  className?: string
}

export function PortfolioTransactionRow({ tx, holdings, className }: TransactionRowProps) {
  const isBuy = tx.type === 'buy'
  const iconUrl = iconUrlForTx(tx, holdings)
  const when = formatTransactionWhen(tx.at)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0d1117]/90 px-3 py-3 sm:gap-4',
        className,
      )}
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-white/10',
          isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400',
        )}
        aria-hidden
      >
        {isBuy ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
      </div>

      <CoinAvatar cmcId={tx.cmcId} symbol={tx.symbol} iconUrl={iconUrl} size={40} />

      <div className="min-w-0 flex-1 basis-[min(100%,200px)]">
        <p className="text-sm font-semibold leading-snug text-foreground">
          <span className={isBuy ? 'text-emerald-400' : 'text-amber-400'}>
            {isBuy ? 'Compra' : 'Venda'}
          </span>{' '}
          <span>{tx.symbol}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">{tx.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground/90">{when}</p>
      </div>

      <div className="ml-auto w-full text-right sm:w-auto sm:min-w-[160px]">
        <p className="font-mono text-sm font-medium tabular-nums text-foreground">
          {tx.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}{' '}
          <span className="font-sans font-normal text-muted-foreground">×</span>{' '}
          {formatCurrency(tx.priceUsd, false)}
        </p>
        {tx.realizedPnlUsd != null && (
          <p className={cn('mt-1 text-xs font-mono', pctTone(tx.realizedPnlUsd))}>
            P&amp;L {formatCurrency(tx.realizedPnlUsd, false)}
          </p>
        )}
        {tx.feeUsd != null && tx.feeUsd > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Taxa {formatCurrency(tx.feeUsd, false)}
          </p>
        )}
        {tx.note && (
          <p className="mt-1 max-w-[260px] truncate text-xs text-muted-foreground sm:ml-auto" title={tx.note}>
            {tx.note}
          </p>
        )}
      </div>
    </div>
  )
}
