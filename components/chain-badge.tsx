import { getChainColor } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface ChainBadgeProps {
  chain: string
  className?: string
  /** Rede consolidada (Ethereum, Arbitrum, Base, Polygon, Solana). */
  isSafe?: boolean
  /** Primeira vez que a rede aparece nas pools carregadas (vs. visitas anteriores). */
  isNovel?: boolean
  /** APR da pool muito alto — alerta de risco. */
  showHighApr?: boolean
  /** Rede na lista “em foco” (famosas + hypadas). */
  isFocus?: boolean
}

export function ChainBadge({
  chain,
  className,
  isSafe,
  isNovel,
  showHighApr,
  isFocus,
}: ChainBadgeProps) {
  const color = getChainColor(chain)

  return (
    <div className={cn('inline-flex flex-col gap-1', className)}>
      <span
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
        style={{
          backgroundColor: `${color}18`,
          color,
          border: `1px solid ${color}55`,
        }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        {chain}
      </span>
      <div className="flex flex-wrap gap-1">
        {isSafe ? (
          <Badge
            variant="outline"
            className="border-gold/60 bg-gold/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-gold"
          >
            Seguro
          </Badge>
        ) : isFocus ? (
          <Badge
            variant="outline"
            className="border-amber-500/50 bg-amber-500/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-amber-200"
          >
            Foco
          </Badge>
        ) : null}
        {isNovel && (
          <Badge
            variant="outline"
            className="border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-emerald-400"
          >
            Novo
          </Badge>
        )}
        {showHighApr && (
          <Badge
            variant="outline"
            className="border-amber-500/60 bg-amber-500/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-amber-300"
          >
            Alto APR
          </Badge>
        )}
      </div>
    </div>
  )
}
