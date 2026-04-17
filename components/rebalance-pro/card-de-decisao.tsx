'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { actionDisplayLabel, type DecisionOutput } from '@/lib/rebalance-pro/decision-engine'

function actionEmoji(action: DecisionOutput['action']): string {
  switch (action) {
    case 'hold':
      return '✅'
    case 'wait':
      return '🟡'
    case 'rebalance':
      return '🔵'
    case 'single_token_entry':
      return '🟣'
    default:
      return '⏳'
  }
}

export type CardDeDecisaoProps = {
  invalidRange: boolean
  hasEnoughData: boolean
  inRange: boolean
  decision: DecisionOutput | null
  className?: string
}

export function CardDeDecisao({
  invalidRange,
  hasEnoughData,
  inRange,
  decision,
  className,
}: CardDeDecisaoProps) {
  const status = (() => {
    if (invalidRange) {
      return {
        label: 'Revise o intervalo',
        tone: 'amber' as const,
        sub: 'Pmin deve ser menor que Pmax.',
      }
    }
    if (!hasEnoughData) {
      return {
        label: 'Quase lá',
        tone: 'zinc' as const,
        sub: 'Informe preço e faixa válidos para eu analisar.',
      }
    }
    if (inRange) {
      return {
        label: 'Dentro da faixa',
        tone: 'green' as const,
        sub: 'Sua liquidez está no intervalo ativo.',
      }
    }
    return {
      label: 'Fora da faixa',
      tone: 'red' as const,
      sub: 'O preço saiu dos limites da posição.',
    }
  })()

  const toneStyles = {
    green: 'border-emerald-500/35 bg-emerald-500/[0.12] text-emerald-100',
    red: 'border-red-500/40 bg-red-500/[0.1] text-red-100',
    amber: 'border-amber-500/40 bg-amber-500/[0.12] text-amber-100',
    zinc: 'border-white/10 bg-white/[0.04] text-zinc-200',
  }

  const hero = invalidRange
    ? {
        emoji: '⚠️',
        title: 'Ajuste necessário',
        lines: decision?.summary ?? 'O preço mínimo precisa ser menor que o máximo, sem valores negativos.',
      }
    : decision
      ? {
          emoji: actionEmoji(decision.action),
          title: actionDisplayLabel(decision.action),
          lines: decision.summary,
        }
      : {
          emoji: '✨',
          title: 'Assistente',
          lines: status.sub,
        }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/95 via-zinc-950 to-black p-6 shadow-2xl shadow-violet-950/20 sm:p-8',
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-violet-600/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 size-56 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative flex flex-wrap items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white">
          3
        </span>
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-4 text-violet-400" aria-hidden />
          Decisão inteligente
        </h2>
      </div>

      <div className={cn('relative mt-6 inline-flex rounded-2xl border px-4 py-2', toneStyles[status.tone])}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Status</p>
          <p className="text-lg font-bold tracking-tight">{status.label}</p>
          <p className="mt-0.5 text-xs opacity-90">{status.sub}</p>
        </div>
      </div>

      <div className="relative mt-8 border-t border-white/10 pt-8">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ação principal</p>
        <p className="mt-3 flex flex-wrap items-center gap-3 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
          <span className="select-none" aria-hidden>
            {hero.emoji}
          </span>
          <span>{hero.title}</span>
        </p>
        <p className="mt-4 line-clamp-2 text-base leading-relaxed text-zinc-400 sm:text-lg">{hero.lines}</p>
      </div>
    </motion.article>
  )
}
