'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Clock, PauseCircle, RefreshCw, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RecommendedAction } from '@/lib/rebalance-pro/decision-engine'

const cfg: Record<
  RecommendedAction,
  { label: string; hint: string; icon: typeof ArrowRight; className: string }
> = {
  hold: {
    label: 'Manter posição',
    hint: 'Nada a fazer agora — só acompanhe o mercado',
    icon: PauseCircle,
    className:
      'bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-emerald-500/25 hover:from-emerald-500 hover:to-emerald-600',
  },
  wait: {
    label: 'Esperar',
    hint: 'Volte mais tarde ou ative um alerta de preço',
    icon: Clock,
    className:
      'bg-gradient-to-r from-amber-500 to-amber-600 shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500',
  },
  rebalance: {
    label: 'Rebalancear agora',
    hint: 'Demo — em produção abriria sua carteira',
    icon: RefreshCw,
    className: 'bg-gradient-to-r from-sky-600 to-violet-600 shadow-sky-500/25 hover:from-sky-500 hover:to-violet-500',
  },
  single_token_entry: {
    label: 'Entrar com 1 token',
    hint: 'Reforço só de um lado — menos risco com vol alta',
    icon: Shield,
    className:
      'bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-violet-500/25 hover:from-violet-500 hover:to-fuchsia-500',
  },
}

export type BotoesDeAcaoProps = {
  action: RecommendedAction | null
  disabled?: boolean
  onPress: () => void
  className?: string
}

export function BotoesDeAcao({ action, disabled, onPress, className }: BotoesDeAcaoProps) {
  const a = action ?? 'wait'
  const c = cfg[a]
  const Icon = c.icon

  return (
    <motion.div layout className={cn('w-full', className)}>
      <Button
        type="button"
        size="lg"
        disabled={disabled || action == null}
        className={cn(
          'relative h-auto min-h-[4.5rem] w-full flex-col gap-1 rounded-2xl py-5 text-lg font-semibold text-white sm:text-xl',
          c.className,
        )}
        onClick={onPress}
      >
        <span className="flex items-center gap-2">
          <Icon className="size-5 shrink-0" />
          {c.label}
        </span>
        <span className="text-sm font-normal text-white/85">{c.hint}</span>
        {a === 'rebalance' && (
          <ArrowRight className="absolute right-5 top-1/2 size-5 -translate-y-1/2 opacity-80" aria-hidden />
        )}
      </Button>
    </motion.div>
  )
}
