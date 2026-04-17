'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeftRight } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { TokenSelector, type TokenOption } from '@/components/rebalance-pro/token-selector'
import { cn } from '@/lib/utils'

export type SeletorDeParProps = {
  tokenA: TokenOption | null
  tokenB: TokenOption | null
  onTokenAChange: (t: TokenOption) => void
  onTokenBChange: (t: TokenOption) => void
  onSwapPair: () => void
  className?: string
}

export function SeletorDePar({
  tokenA,
  tokenB,
  onTokenAChange,
  onTokenBChange,
  onSwapPair,
  className,
}: SeletorDeParProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        'rounded-3xl border border-white/[0.07] bg-zinc-950/70 p-5 shadow-xl shadow-black/40 backdrop-blur-xl sm:p-6',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-bold text-violet-200">
          1
        </span>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">Par de liquidez</h2>
          <p className="text-xs text-muted-foreground">
            Token A e B como na pool — ex.: ETH / USDC, SOL / USDT. O preço em USD vem do token A (CoinGecko).
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end sm:gap-3">
        <div className="space-y-2">
          <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Token A</Label>
          <TokenSelector
            value={tokenA}
            onChange={onTokenAChange}
            excludeIds={tokenB ? [tokenB.id] : undefined}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl border-white/12 bg-white/[0.04] hover:bg-white/[0.08]"
          onClick={onSwapPair}
          aria-label="Trocar token A e B"
        >
          <ArrowLeftRight className="size-4" />
        </Button>
        <div className="space-y-2">
          <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Token B</Label>
          <TokenSelector
            value={tokenB}
            onChange={onTokenBChange}
            excludeIds={tokenA ? [tokenA.id] : undefined}
          />
        </div>
      </div>
    </motion.section>
  )
}
