import { getChainColor } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ChainBadgeProps {
  chain: string
  className?: string
}

export function ChainBadge({ chain, className }: ChainBadgeProps) {
  const color = getChainColor(chain)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        className
      )}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {chain}
    </span>
  )
}
