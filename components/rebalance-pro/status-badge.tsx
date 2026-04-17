'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

type StatusBadgeProps = {
  inRange: boolean
  className?: string
}

export function StatusBadge({ inRange, className }: StatusBadgeProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('inline-flex items-center gap-2', className)}
    >
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide',
          inRange
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-[0_0_20px_-4px_rgba(34,197,94,0.45)]'
            : 'border-red-500/45 bg-red-500/10 text-red-300 shadow-[0_0_20px_-4px_rgba(248,113,113,0.35)]',
        )}
      >
        <span
          className={cn('size-1.5 rounded-full', inRange ? 'bg-emerald-400' : 'bg-red-400')}
          aria-hidden
        />
        {inRange ? 'Dentro da faixa' : 'Fora da faixa'}
      </span>
    </motion.div>
  )
}
