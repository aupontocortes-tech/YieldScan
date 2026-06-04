'use client'

import Link from 'next/link'
import { useAccount } from 'wagmi'
import { useWallet } from '@solana/wallet-adapter-react'
import { Droplets, SlidersHorizontal, Wallet } from 'lucide-react'
import { useLiquidityPositions } from '@/hooks/useLiquidityPositions'
import { HubPanel } from '@/components/dashboard/hub/hub-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { AggregatorLiquidityPosition } from '@/services/types'

function fmtUsd(n: number) {
  return n.toLocaleString('pt-PT', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function PositionRow({ p }: { p: AggregatorLiquidityPosition }) {
  const pair = `${p.token0.symbol}/${p.token1.symbol}`
  return (
    <Link
      href="/my-liquidity"
      className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-background/30 px-2.5 py-2 transition-colors hover:border-sky-500/30 hover:bg-sky-500/5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-foreground">{pair}</span>
          <span
            className={cn(
              'shrink-0 rounded px-1 py-px text-[9px] font-medium uppercase',
              p.inRange
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-amber-500/15 text-amber-400',
            )}
          >
            {p.inRange ? 'Em range' : 'Fora'}
          </span>
        </div>
        <p className="truncate text-[10px] text-muted-foreground">
          {p.protocol} · {p.chain}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-xs font-semibold tabular-nums text-foreground">
          {fmtUsd(p.totalValueUSD)}
        </p>
        {p.feesUSD > 0 && (
          <p className="text-[10px] tabular-nums text-muted-foreground">
            +{fmtUsd(p.feesUSD)} fees
          </p>
        )}
      </div>
    </Link>
  )
}

export function HubLiquidity({ className }: { className?: string }) {
  const { isConnected: evmConnected } = useAccount()
  const { connected: solConnected } = useWallet()
  const { positions, isLoading, hasWallet, warnings } = useLiquidityPositions()

  const totalValue = positions.reduce((s, p) => s + p.totalValueUSD, 0)
  const totalFees = positions.reduce((s, p) => s + p.feesUSD, 0)
  const top = positions.slice(0, 3)

  const walletLabel = [
    evmConnected && 'EVM',
    solConnected && 'Solana',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <HubPanel
      title="A minha liquidez"
      subtitle="Posições LP nas tuas carteiras"
      icon={Droplets}
      accent="sky"
      href="/my-liquidity"
      linkLabel="Abrir painel"
      className={cn('min-h-0', className)}
    >
      {!hasWallet && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-sky-500/25 bg-sky-500/5 px-4 py-8 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10">
            <Wallet className="h-5 w-5 text-sky-400" aria-hidden />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">Liga uma carteira</p>
          <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">
            Conecta Phantom (Solana) ou MetaMask (EVM) para ver TVL, fees e posições LP aqui.
          </p>
          <Link
            href="/my-liquidity"
            className="mt-4 rounded-lg border border-sky-500/35 bg-sky-500/15 px-4 py-2 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/25"
          >
            Ir para liquidez →
          </Link>
        </div>
      )}

      {hasWallet && isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      )}

      {hasWallet && !isLoading && (
        <div className="space-y-4">
          {walletLabel && (
            <p className="text-[10px] text-muted-foreground">
              Ligado: <span className="font-medium text-foreground">{walletLabel}</span>
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/40 bg-muted/10 p-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Valor
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-foreground">
                {fmtUsd(totalValue)}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Fees
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-emerald-400/90">
                {fmtUsd(totalFees)}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Pools
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-foreground">
                {positions.length}
              </p>
            </div>
          </div>

          {positions.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground">
              Nenhuma posição LP encontrada nas redes suportadas.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {top.map((p) => (
                <li key={p.id}>
                  <PositionRow p={p} />
                </li>
              ))}
            </ul>
          )}

          {positions.length > 3 && (
            <p className="text-center text-[10px] text-muted-foreground">
              +{positions.length - 3} posição{positions.length - 3 === 1 ? '' : 'ões'} no painel
              completo
            </p>
          )}

          {warnings.length > 0 && (
            <p className="line-clamp-2 text-[10px] text-amber-400/90">{warnings[0]}</p>
          )}

          <Link
            href="/rebalance-pro"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-orange-500/25 bg-orange-500/5 py-2 text-[11px] font-medium text-orange-300/90 transition-colors hover:bg-orange-500/10"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Rebalance Pro
          </Link>
        </div>
      )}
    </HubPanel>
  )
}
