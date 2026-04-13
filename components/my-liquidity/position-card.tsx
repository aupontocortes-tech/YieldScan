'use client'

import { ExternalLink } from 'lucide-react'
import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { LiquidityPairAvatars } from '@/components/my-liquidity/liquidity-pair-avatars'
import type { PositionWithWallet } from '@/hooks/use-liquidity-positions'
import { cn } from '@/lib/utils'

const GOLD = '#e8c547'
const CYAN = '#28a0f0'

// ─── formatters ───────────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function fmtToken(n: number, sym: string): string {
  if (!Number.isFinite(n) || n === 0) return `— ${sym}`
  const digits = n >= 1000 ? 2 : n >= 1 ? 4 : n >= 0.001 ? 6 : 8
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: digits })} ${sym}`
}

function fmtPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n < 0.00001) return n.toExponential(3)
  if (n < 0.001) return n.toFixed(7)
  if (n < 1) return n.toFixed(5)
  if (n < 100) return n.toFixed(4)
  if (n < 1_000_000) return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  return n.toExponential(3)
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2).replace('.', ',')}%`
}

function fmtApr(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n >= 1000 ? n.toFixed(0) : n.toFixed(2).replace('.', ',')}%`
}

/** Gráfico circular — alocação de valor USD entre os dois tokens */
function AllocationDonut({
  tokenA,
  tokenB,
  valueUSD,
  tokenAValuePct,
}: {
  tokenA: string
  tokenB: string
  valueUSD: number
  tokenAValuePct: number
}) {
  const pctA = Math.max(0, Math.min(100, tokenAValuePct))
  const vA = Math.max(0, valueUSD * (pctA / 100))
  const vB = Math.max(0, valueUSD - vA)
  const data = [
    { name: tokenA, value: vA, key: 'a' },
    { name: tokenB, value: vB, key: 'b' },
  ].filter((d) => d.value > 1e-6)

  if (data.length === 0) return null

  return (
    <div className="flex w-full flex-col gap-1 sm:w-[200px]">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Alocação (valor)
      </p>
      <div className="relative mx-auto h-[140px] w-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={62}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.key === 'a' ? GOLD : CYAN} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) =>
                v.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
              }
              contentStyle={{
                background: '#0c0c0c',
                border: '1px solid #262626',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: GOLD }} />
          {tokenA}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: CYAN }} />
          {tokenB}
        </span>
      </div>
    </div>
  )
}

// ─── tick → price (token1 per token0, in human units) ─────────────────────────

function tickToHumanPrice(tick: number, d0: number, d1: number): number {
  return Math.pow(1.0001, tick) * Math.pow(10, d0 - d1)
}

// ─── sub-components ──────────────────────────────────────────────────────────

/** Indicador "Dentro/Fora do intervalo" */
function RangeBadge({ inRange }: { inRange: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        inRange
          ? 'border-success/40 bg-success/10 text-success'
          : 'border-destructive/40 bg-destructive/10 text-destructive',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          inRange ? 'animate-pulse bg-success' : 'bg-destructive',
        )}
      />
      {inRange ? 'Dentro do intervalo' : 'Fora do intervalo'}
    </span>
  )
}

/** Barra de distribuição tokenA vs tokenB */
function TokenDistributionBar({
  tokenAValuePct,
  symA,
  symB,
}: {
  tokenAValuePct: number
  symA: string
  symB: string
}) {
  const pctA = Math.max(0, Math.min(100, tokenAValuePct))
  const pctB = 100 - pctA
  const allA = pctA >= 99
  const allB = pctB >= 99
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>{symA}</span>
        <span>{symB}</span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-background/60">
        {!allB && (
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-gold transition-all duration-500"
            style={{ width: `${pctA}%`, borderRadius: allA ? '999px' : undefined }}
          />
        )}
        {!allA && (
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-[var(--chart-7)] transition-all duration-500"
            style={{ width: `${pctB}%`, borderRadius: allB ? '999px' : undefined }}
          />
        )}
      </div>
      <div className="flex items-center justify-between tabular-nums text-[11px] text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{pctA}%</span> {symA}
        </span>
        <span>
          {symB} <span className="font-semibold text-foreground">{pctB}%</span>
        </span>
      </div>
    </div>
  )
}

/** Barra de range de preço (onde o preço atual está entre tickLower e tickUpper) */
function RangeBar({
  tickLower,
  tickUpper,
  currentTick,
  priceLower,
  priceUpper,
  priceCurrent,
  quoteLabel,
}: {
  tickLower: number
  tickUpper: number
  currentTick: number
  priceLower: number
  priceUpper: number
  priceCurrent: number
  quoteLabel: string
}) {
  const rangeWidth = tickUpper - tickLower
  const rawPct = rangeWidth > 0 ? ((currentTick - tickLower) / rangeWidth) * 100 : 50
  const clampedPct = Math.max(0, Math.min(100, rawPct))
  const inRange = currentTick >= tickLower && currentTick <= tickUpper

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Intervalo de preço <span className="normal-case">({quoteLabel})</span>
      </p>
      {/* Barra */}
      <div className="relative h-2 w-full rounded-full bg-border/50">
        <div className="absolute inset-0 rounded-full bg-muted/40" />
        {/* Zona activa */}
        <div className="absolute inset-y-0 rounded-full bg-gold/40" style={{ left: '0%', right: '0%' }} />
        {/* Marcador de preço atual */}
        <div
          className={cn(
            'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-1.5 rounded-sm transition-all duration-500',
            inRange ? 'bg-success shadow-[0_0_6px_rgba(34,197,94,0.7)]' : 'bg-destructive',
          )}
          style={{ left: `${clampedPct}%` }}
        />
      </div>
      {/* Etiquetas */}
      <div className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
        <div className="min-w-0">
          <p className="text-[9px] uppercase text-muted-foreground">Mín.</p>
          <p className="truncate font-medium text-foreground">{fmtPrice(priceLower)}</p>
        </div>
        <div className="min-w-0 text-center">
          <p className="text-[9px] uppercase text-muted-foreground">Atual</p>
          <p
            className={cn(
              'truncate font-semibold',
              inRange ? 'text-success' : 'text-destructive',
            )}
          >
            {fmtPrice(priceCurrent)}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[9px] uppercase text-muted-foreground">Máx.</p>
          <p className="truncate font-medium text-foreground">{fmtPrice(priceUpper)}</p>
        </div>
      </div>
    </div>
  )
}

// ─── main card ───────────────────────────────────────────────────────────────

export function LiquidityPositionCard({ p }: { p: PositionWithWallet }) {
  const hasRange =
    p.tickLower !== undefined &&
    p.tickUpper !== undefined &&
    p.currentTick !== undefined &&
    p.decimalsA !== undefined &&
    p.decimalsB !== undefined

  const { priceLower, priceUpper, priceCurrent } = useMemo(() => {
    if (!hasRange) return { priceLower: 0, priceUpper: 0, priceCurrent: 0 }
    const d0 = p.decimalsA!
    const d1 = p.decimalsB!
    return {
      priceLower: tickToHumanPrice(p.tickLower!, d0, d1),
      priceUpper: tickToHumanPrice(p.tickUpper!, d0, d1),
      priceCurrent: tickToHumanPrice(p.currentTick!, d0, d1),
    }
  }, [hasRange, p.tickLower, p.tickUpper, p.currentTick, p.decimalsA, p.decimalsB])

  const feeTierLabel = p.feeTierBps != null ? `${(p.feeTierBps / 10_000).toFixed(2)}%` : null
  const explorer =
    p.poolAddress
      ? p.chain === 'ethereum'
        ? `https://etherscan.io/address/${p.poolAddress}`
        : `https://solscan.io/account/${p.poolAddress}`
      : null

  const tokenAValuePct = p.tokenAValuePct ?? (p.amountA > 0 && p.amountB === 0 ? 100 : 50)
  const showRangeUi = hasRange
  const isLpToken = p.positionKind === 'lp_token'
  const isUnindexedClmmNft = Boolean((p.raw as { unindexedClmmNft?: boolean } | undefined)?.unindexedClmmNft)

  return (
    <article
      className={cn(
        'flex flex-col gap-5 rounded-2xl border bg-card/60 p-4 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md sm:p-5',
        showRangeUi && p.inRange === false
          ? 'border-destructive/25'
          : showRangeUi && p.inRange === true
            ? 'border-success/20'
            : 'border-border/60',
      )}
    >
      {/* ── Cabeçalho ── */}
      <header className="flex flex-wrap items-center gap-3">
        <LiquidityPairAvatars chain={p.chain} symbolA={p.tokenA} symbolB={p.tokenB} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              <span className="text-gold">{p.tokenA}</span>
              <span className="text-muted-foreground"> / </span>
              {p.tokenB}
            </h3>
            {feeTierLabel && (
              <span className="rounded border border-border/60 bg-background/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {feeTierLabel}
              </span>
            )}
            <span className="rounded border border-border/50 bg-background/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {p.chain === 'ethereum' ? 'ETH' : 'SOL'}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {showRangeUi && p.inRange !== undefined && <RangeBadge inRange={p.inRange} />}
            {isLpToken && (
              <span className="rounded-full border border-border/50 bg-background/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                Token LP (não é saldo spot de uma só moeda)
              </span>
            )}
            {isUnindexedClmmNft && (
              <span className="rounded-full border border-gold/35 bg-gold/[0.08] px-2 py-0.5 text-[10px] text-foreground">
                CLMM NFT detetado (sem valuation)
              </span>
            )}
            {explorer && (
              <a
                href={explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <ExternalLink className="size-3" />
                Explorer
              </a>
            )}
          </div>
        </div>
        {/* Valor da posição */}
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Posição</p>
          <p className="font-mono text-xl font-bold text-foreground">{fmtUsd(p.valueUSD)}</p>
        </div>
      </header>

      {/* ── Gráfico + barra de distribuição ── */}
      <div className="flex flex-col gap-4 border-b border-border/30 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <AllocationDonut
          tokenA={p.tokenA}
          tokenB={p.tokenB}
          valueUSD={p.valueUSD}
          tokenAValuePct={tokenAValuePct}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <TokenDistributionBar
            tokenAValuePct={tokenAValuePct}
            symA={p.tokenA}
            symB={p.tokenB}
          />
        </div>
      </div>

      {/* ── Tokens na posição ── */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-border/40 bg-background/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.tokenA}</p>
          <p className="mt-0.5 font-mono font-semibold tabular-nums text-foreground">
            {fmtToken(p.amountA, '')}
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.tokenB}</p>
          <p className="mt-0.5 font-mono font-semibold tabular-nums text-foreground">
            {fmtToken(p.amountB, '')}
          </p>
        </div>
      </div>

      {/* ── Range de preço ── */}
      {hasRange && (
        <RangeBar
          tickLower={p.tickLower!}
          tickUpper={p.tickUpper!}
          currentTick={p.currentTick!}
          priceLower={priceLower}
          priceUpper={priceUpper}
          priceCurrent={priceCurrent}
          quoteLabel={`${p.tokenB} / ${p.tokenA}`}
        />
      )}

      {/* ── Métricas ── */}
      <div className="flex flex-wrap items-stretch gap-2 border-t border-border/40 pt-4">
        <div className="flex-1 min-w-[88px]">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fees acumuladas</p>
          <p className="mt-0.5 font-mono font-semibold tabular-nums text-foreground">
            {fmtUsd(p.feesEarnedUSD)}
          </p>
        </div>
        <div className="flex-1 min-w-[88px]">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">APR est. (pool)</p>
          <p className="mt-0.5 font-mono font-semibold tabular-nums text-gold">{fmtApr(p.estimatedAprPct)}</p>
          <p className="text-[9px] leading-tight text-muted-foreground">Volume 24h / TVL × fee</p>
        </div>
        <div className="flex-1 min-w-[88px]">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">P&amp;L estimado</p>
          <p
            className={cn(
              'mt-0.5 font-mono font-semibold tabular-nums',
              Number.isFinite(p.pnlPct) && p.pnlPct >= 0 ? 'text-success' : 'text-destructive',
            )}
          >
            {Number.isFinite(p.pnlPct) ? fmtPct(p.pnlPct) : '—'}
          </p>
        </div>
        <div className="flex-1 min-w-[88px]">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Carteira</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground truncate">
            {p.walletAddress.slice(0, 6)}…{p.walletAddress.slice(-4)}
          </p>
        </div>
      </div>
    </article>
  )
}
