'use client'

import { motion } from 'framer-motion'
import { Coins, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DepositMode, DepositToken, OutOfRangeSide } from '@/lib/rebalance-pro/compute'

export type ModoDeEntradaProps = {
  depositMode: DepositMode
  onDepositModeChange: (m: DepositMode) => void
  outOfRangeSide: OutOfRangeSide
  inferredToken: DepositToken | null
  depositToken: DepositToken | null
  onDepositTokenChange: (t: DepositToken) => void
  tokenASymbol: string
  tokenBSymbol: string
  className?: string
}

export function ModoDeEntrada({
  depositMode,
  onDepositModeChange,
  outOfRangeSide,
  inferredToken,
  depositToken,
  onDepositTokenChange,
  tokenASymbol,
  tokenBSymbol,
  className,
}: ModoDeEntradaProps) {
  const activeToken = depositToken ?? inferredToken
  const inRange = outOfRangeSide === 'in'

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.06 }}
      className={cn(
        'rounded-3xl border border-white/[0.07] bg-zinc-950/70 p-5 shadow-xl shadow-black/40 backdrop-blur-xl sm:p-6',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-bold text-violet-200">
          2b
        </span>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">Modo de entrada</h2>
          <p className="text-xs text-muted-foreground">
            Dois tokens (50/50) ou um só — quando a posição saiu para uma moeda.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onDepositModeChange('dual')}
          className={cn(
            'flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition',
            depositMode === 'dual'
              ? 'border-cyan-500/45 bg-cyan-500/10 ring-1 ring-cyan-500/20'
              : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
          )}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Layers className="size-4 text-cyan-400" aria-hidden />
            Dois tokens (50/50)
          </span>
          <span className="text-xs leading-relaxed text-muted-foreground">
            Faixa centrada no preço atual. Metade do capital em {tokenASymbol}, metade em {tokenBSymbol}.
          </span>
        </button>

        <button
          type="button"
          onClick={() => onDepositModeChange('single')}
          className={cn(
            'flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition',
            depositMode === 'single'
              ? 'border-violet-500/45 bg-violet-500/10 ring-1 ring-violet-500/20'
              : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
          )}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Coins className="size-4 text-violet-400" aria-hidden />
            Um token só
          </span>
          <span className="text-xs leading-relaxed text-muted-foreground">
            Deposita só o ativo que você já tem. Faixa acima ou abaixo do preço — sem swap.
          </span>
        </button>
      </div>

      {depositMode === 'single' && (
        <div className="mt-4 space-y-3 rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] p-4">
          {inRange ? (
            <p className="text-xs leading-relaxed text-amber-200/90">
              O preço ainda está <strong>dentro</strong> da faixa antiga. Escolha manualmente qual token
              depositar ou espere sair da faixa para detectar automaticamente.
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-violet-100/90">
              {outOfRangeSide === 'below'
                ? `Preço abaixo da faixa → posição em ${tokenASymbol}. Nova faixa será colocada acima do preço.`
                : `Preço acima da faixa → posição em ${tokenBSymbol}. Nova faixa será colocada abaixo do preço.`}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'token_a' as const, label: tokenASymbol },
                { id: 'token_b' as const, label: tokenBSymbol },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => onDepositTokenChange(id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                  activeToken === id
                    ? 'border-violet-400/60 bg-violet-500/20 text-violet-100'
                    : 'border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07]',
                  !inRange && inferredToken === id && 'ring-1 ring-emerald-500/30',
                )}
              >
                {label}
                {!inRange && inferredToken === id ? ' · detectado' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        <strong className="font-medium text-foreground/90">Sobre IL:</strong> não existe rebalanceamento
        com zero impermanent loss em pool de dois ativos. Entrar com um token só evita o swap imediato; se o
        preço cruzar a nova faixa, o IL pode aparecer como em qualquer LP concentrada.
      </p>
    </motion.section>
  )
}
