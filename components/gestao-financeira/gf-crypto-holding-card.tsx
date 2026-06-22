'use client'

import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { GfCryptoHolding, GfCryptoWallet } from '@/lib/gestao-financeira/types'
import type { GfCryptoPriceMap } from '@/lib/gestao-financeira/calculations'
import { cn } from '@/lib/utils'
import { Trash2, TrendingDown, TrendingUp } from 'lucide-react'

type Props = {
  holding: GfCryptoHolding
  wallet?: GfCryptoWallet
  prices: GfCryptoPriceMap
  brlPerUsd: number
  onDelete: () => void
  fmtBrl: (n: number) => string
}

export function GfCryptoHoldingCard({
  holding: h,
  wallet,
  prices,
  brlPerUsd,
  onDelete,
  fmtBrl,
}: Props) {
  const pxUsd = prices[h.coinId]?.usd ?? 0
  const pxBrl = prices[h.coinId]?.brl ?? pxUsd * brlPerUsd
  const current = h.quantity * pxBrl
  const invested = h.quantity * h.avgPriceUsd * brlPerUsd
  const pnl = current - invested
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4">
      <div className="flex justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TokenSymbolAvatar symbol={h.symbol} coingeckoId={h.coinId} size={36} />
          <div className="min-w-0">
            <p className="font-bold truncate">{h.symbol}</p>
            <p className="text-[10px] text-muted-foreground truncate">{h.coinId}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="outline">{wallet?.name}</Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-red-400"
            aria-label={`Excluir posição ${h.symbol}`}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="mt-2 text-lg font-semibold">{fmtBrl(current)}</p>

      <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          <p>Quantidade</p>
          <p className="font-medium text-foreground">
            {h.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}
          </p>
        </div>
        <div>
          <p>Preço ao vivo</p>
          <p className="font-medium text-foreground">
            ${pxUsd.toLocaleString('en-US', { maximumFractionDigits: pxUsd < 1 ? 6 : 2 })}
          </p>
          <p className="text-[10px]">{fmtBrl(pxBrl)} / un.</p>
        </div>
        <div>
          <p>Preço médio</p>
          <p className="font-medium text-foreground">${h.avgPriceUsd.toLocaleString('en-US')}</p>
        </div>
        <div>
          <p>Resultado</p>
          <p className={cn('font-medium flex items-center gap-1', pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {pnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {pnl >= 0 ? '+' : ''}
            {fmtBrl(pnl)} ({pnlPct.toFixed(1)}%)
          </p>
        </div>
      </div>
    </div>
  )
}
