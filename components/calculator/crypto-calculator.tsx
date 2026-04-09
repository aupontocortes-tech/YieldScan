'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowUpDown, Calculator, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalculatorAssetPicker } from '@/components/calculator/calculator-asset-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  buildCoinAsset,
  buildVsAsset,
  findDefaultAssetById,
  getCoinAndVsFromAssets,
  isVsSixDecimals,
  normalizeCalculatorAssetPair,
  pickDefaultPairAssets,
  type CalculatorAsset,
} from '@/lib/calculator/assets'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'yieldscan-calculator-v3'
const STORAGE_KEY_LEGACY = 'yieldscan-calculator-v2'

type LastEdited = 'left' | 'right'

const ERR_MSG =
  'Price unavailable at the moment. Please try again in a few seconds.'

function formatCrypto(n: number): string {
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6,
    minimumFractionDigits: 0,
  }).format(n)
}

function formatFiat(n: number): string {
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(n)
}

function formatQuote(n: number, vsId: string): string {
  if (isVsSixDecimals(vsId)) return formatCrypto(n)
  return formatFiat(n)
}

function parseAmount(s: string): number {
  const t = s.replace(',', '.').trim()
  if (!t) return 0
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

function formatAmountForField(n: number, kind: 'coin' | 'quote', vsId: string): string {
  if (!Number.isFinite(n) || n === 0) return ''
  if (kind === 'quote') {
    const s = formatQuote(n, vsId).replace(/,/g, '')
    return s
  }
  const s = n.toFixed(8).replace(/\.?0+$/, '')
  return s || ''
}

function assetsEqual(a: CalculatorAsset, b: CalculatorAsset): boolean {
  return a.id === b.id && a.type === b.type
}

function legacyAssetFromId(id: string): CalculatorAsset {
  const d = findDefaultAssetById(id)
  if (d) return d
  const short = ['usd', 'brl', 'eur', 'gbp', 'btc', 'eth', 'sol', 'jpy', 'cad', 'aud', 'chf', 'mxn']
  if (short.includes(id.toLowerCase())) return buildVsAsset(id)
  return buildCoinAsset({
    id,
    name: id.replace(/-/g, ' '),
    symbol: id.slice(0, 8).toUpperCase(),
  })
}

async function fetchPairRate(coinId: string, vsId: string): Promise<number> {
  const res = await fetch(
    `/api/coingecko/simple-price?ids=${encodeURIComponent(coinId)}&vs=${encodeURIComponent(vsId)}`
  )
  if (!res.ok) {
    const err = new Error(ERR_MSG)
    ;(err as Error & { status?: number }).status = res.status
    throw err
  }
  const j = (await res.json()) as Record<string, Record<string, number>>
  const n = j[coinId]?.[vsId]
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
    throw new Error(ERR_MSG)
  }
  return n
}

/* ─── sub-components (must live outside CryptoCalculator to avoid remount) ─── */

function AssetLogo({ asset }: { asset: CalculatorAsset }) {
  if (asset.image) {
    return (
      <img
        src={asset.image}
        alt={asset.symbol}
        className="size-8 shrink-0 rounded-full object-cover"
        onError={(e) => {
          const el = e.currentTarget as HTMLImageElement
          el.style.display = 'none'
          const fb = el.nextElementSibling as HTMLElement | null
          if (fb) fb.style.display = 'flex'
        }}
      />
    )
  }
  return (
    <div className="size-8 shrink-0 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300">
      {asset.symbol.slice(0, 2)}
    </div>
  )
}

type InputCardProps = {
  side: LastEdited
  asset: CalculatorAsset
  amount: string
  focused: boolean
  swapPulse: boolean
  disabled: boolean
  pickerMode: 'coin' | 'vs'
  autoFocus?: boolean
  onAmountChange: (v: string) => void
  onFocus: () => void
  onBlur: () => void
  onLastEdited: (side: LastEdited) => void
  onAssetChange: (a: CalculatorAsset) => void
}

function InputCard({
  side,
  asset,
  amount,
  focused,
  swapPulse,
  disabled,
  pickerMode,
  autoFocus,
  onAmountChange,
  onFocus,
  onBlur,
  onLastEdited,
  onAssetChange,
}: InputCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-zinc-900 p-5 transition-all duration-200',
        focused ? 'border-primary/60 shadow-sm shadow-primary/10' : 'border-zinc-800',
        swapPulse && 'opacity-90'
      )}
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
        {asset.type === 'crypto' ? 'Crypto' : 'Quote'}
      </p>
      <div className="flex items-center gap-3">
        <AssetLogo asset={asset} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => {
              onAmountChange(e.target.value)
              onLastEdited(side)
            }}
            onFocus={onFocus}
            onBlur={onBlur}
            disabled={disabled}
            autoFocus={autoFocus}
            autoComplete="off"
            className={cn(
              'h-14 border-0 bg-transparent p-0 text-2xl font-semibold tabular-nums text-foreground',
              'placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:ring-offset-0'
            )}
          />
          <span className="text-sm text-zinc-500">{asset.name}</span>
        </div>
      </div>
      <div className="mt-4 border-t border-zinc-800 pt-4">
        <CalculatorAssetPicker
          mode={pickerMode}
          value={asset}
          onChange={onAssetChange}
          disabled={disabled}
          className="w-full"
        />
      </div>
    </div>
  )
}

/* ─── main component ─── */

export function CryptoCalculator() {
  const def = pickDefaultPairAssets()
  const [leftAsset, setLeftAsset] = useState<CalculatorAsset>(def.left)
  const [rightAsset, setRightAsset] = useState<CalculatorAsset>(def.right)
  const [leftAmount, setLeftAmount] = useState('1')
  const [rightAmount, setRightAmount] = useState('')
  const [lastEdited, setLastEdited] = useState<LastEdited>('left')
  const [focusedField, setFocusedField] = useState<LastEdited | null>(null)
  const [swapPulse, setSwapPulse] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [nowTick, setNowTick] = useState(0)

  const prevRateRef = useRef<number | null>(null)
  const [changePct, setChangePct] = useState<number | null>(null)

  const pair = useMemo(
    () => normalizeCalculatorAssetPair(leftAsset, rightAsset),
    [leftAsset, rightAsset]
  )

  useEffect(() => {
    if (!assetsEqual(leftAsset, pair.left)) setLeftAsset(pair.left)
    if (!assetsEqual(rightAsset, pair.right)) setRightAsset(pair.right)
  }, [pair, leftAsset, rightAsset])

  const left = pair.left
  const right = pair.right
  const leftIsCoin = left.type === 'crypto'

  const coinVs = useMemo(() => getCoinAndVsFromAssets(left, right), [left, right])
  const pairKey = useMemo(
    () => (coinVs ? `${coinVs.coinId}|${coinVs.vsId}` : ''),
    [coinVs]
  )

  useEffect(() => {
    prevRateRef.current = null
    setChangePct(null)
  }, [pairKey])

  useEffect(() => {
    const t = window.setInterval(() => setNowTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY_LEGACY)
      if (raw) {
        const j = JSON.parse(raw) as {
          v?: number
          leftAsset?: CalculatorAsset
          rightAsset?: CalculatorAsset
          leftAssetId?: string
          rightAssetId?: string
          leftAmount?: string
          rightAmount?: string
          lastEdited?: LastEdited
          cryptoId?: string
          fiatId?: string
          leftIsCrypto?: boolean
          amount?: string
        }
        if (j.v === 3 && j.leftAsset && j.rightAsset) {
          const L = j.leftAsset
          const R = j.rightAsset
          if (L.id && R.id && L.type && R.type) {
            setLeftAsset(L)
            setRightAsset(R)
            if (typeof j.leftAmount === 'string') setLeftAmount(j.leftAmount)
            if (typeof j.rightAmount === 'string') setRightAmount(j.rightAmount)
            if (j.lastEdited === 'left' || j.lastEdited === 'right') setLastEdited(j.lastEdited)
          }
        } else if (j.leftAssetId && j.rightAssetId) {
          setLeftAsset(legacyAssetFromId(j.leftAssetId))
          setRightAsset(legacyAssetFromId(j.rightAssetId))
          if (typeof j.leftAmount === 'string') setLeftAmount(j.leftAmount)
          if (typeof j.rightAmount === 'string') setRightAmount(j.rightAmount)
          if (j.lastEdited === 'left' || j.lastEdited === 'right') setLastEdited(j.lastEdited)
        } else if (j.cryptoId && j.fiatId) {
          const lc = Boolean(j.leftIsCrypto !== false)
          setLeftAsset(legacyAssetFromId(lc ? j.cryptoId : j.fiatId))
          setRightAsset(legacyAssetFromId(lc ? j.fiatId : j.cryptoId))
          if (typeof j.amount === 'string') {
            setLeftAmount(j.amount)
            setLastEdited('left')
          }
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const n = normalizeCalculatorAssetPair(leftAsset, rightAsset)
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            v: 3,
            leftAsset: n.left,
            rightAsset: n.right,
            leftAmount,
            rightAmount,
            lastEdited,
          })
        )
      } catch {
        /* ignore */
      }
    }, 300)
    return () => clearTimeout(t)
  }, [hydrated, leftAsset, rightAsset, leftAmount, rightAmount, lastEdited])

  const {
    data: unitRate,
    isLoading,
    isFetching,
    isError,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['cg-calculator-unit', coinVs?.coinId, coinVs?.vsId],
    queryFn: () => fetchPairRate(coinVs!.coinId, coinVs!.vsId),
    enabled: Boolean(coinVs?.coinId && coinVs?.vsId),
    staleTime: 10_000,
    gcTime: 60_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    retry: (failureCount, err) => {
      const status = (err as Error & { status?: number })?.status
      if (status === 429) return failureCount < 1
      return failureCount < 2
    },
    retryDelay: (attempt) => Math.min(3000 * (attempt + 1), 12_000),
  })

  useEffect(() => {
    if (unitRate == null) return
    const prev = prevRateRef.current
    if (prev != null && prev > 0) {
      setChangePct(((unitRate - prev) / prev) * 100)
    } else {
      setChangePct(null)
    }
    prevRateRef.current = unitRate
  }, [unitRate])

  const vsId = coinVs?.vsId ?? ''

  useEffect(() => {
    if (unitRate == null || unitRate <= 0 || !coinVs) return

    if (lastEdited === 'left') {
      const lv = parseAmount(leftAmount)
      let nextRight: number
      if (leftIsCoin) nextRight = lv * unitRate
      else nextRight = lv / unitRate
      const formatted = formatAmountForField(
        nextRight,
        leftIsCoin ? 'quote' : 'coin',
        vsId
      )
      setRightAmount((prev) => (prev === formatted ? prev : formatted))
    } else {
      const rv = parseAmount(rightAmount)
      let nextLeft: number
      if (leftIsCoin) nextLeft = rv / unitRate
      else nextLeft = rv * unitRate
      const formatted = formatAmountForField(
        nextLeft,
        leftIsCoin ? 'coin' : 'quote',
        vsId
      )
      setLeftAmount((prev) => (prev === formatted ? prev : formatted))
    }
  }, [
    lastEdited,
    leftAmount,
    rightAmount,
    unitRate,
    leftIsCoin,
    vsId,
    coinVs,
    left.id,
    right.id,
  ])

  const handleSwap = useCallback(() => {
    setSwapPulse(true)
    window.setTimeout(() => setSwapPulse(false), 320)
    setLeftAsset(right)
    setRightAsset(left)
    setLeftAmount(rightAmount)
    setRightAmount(leftAmount)
    setLastEdited((e) => (e === 'left' ? 'right' : 'left'))
  }, [left, right, leftAmount, rightAmount])

  const referenceLine = useMemo(() => {
    if (!coinVs || unitRate == null) return null
    const coin = leftIsCoin ? left : right
    const vs = leftIsCoin ? right : left
    const num = formatQuote(unitRate, vs.id)
    if (vs.id === 'usd') return `1 ${coin.symbol} = $${num} USD`
    if (vs.id === 'brl') return `1 ${coin.symbol} = R$${num} BRL`
    return `1 ${coin.symbol} = ${num} ${vs.symbol}`
  }, [coinVs, unitRate, leftIsCoin, left, right])

  const secondsSinceUpdate = useMemo(() => {
    if (dataUpdatedAt <= 0) return null
    return Math.max(0, Math.floor((Date.now() - dataUpdatedAt) / 1000))
  }, [dataUpdatedAt, nowTick])

  const hasStalePrices = typeof unitRate === 'number' && unitRate > 0
  /** Erro sem cotação em cache: ainda mostramos o formulário para poder trocar de moeda. */
  const hardPriceError = isError && !hasStalePrices
  const softPriceError = isError && hasStalePrices

  const inputDisabled = !hasStalePrices && isLoading

  return (
    <div className="flex flex-1 flex-col bg-background">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/35 bg-primary/10 text-primary">
            <Calculator className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Crypto Calculator
            </h1>
            <div
              className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500"
              aria-live="polite"
            >
              {isLoading && !hasStalePrices && (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" />
                  Loading…
                </span>
              )}
              {isFetching && hasStalePrices && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Loader2 className="size-3 animate-spin" />
                  Updating…
                </span>
              )}
              {secondsSinceUpdate != null && hasStalePrices && (
                <span suppressHydrationWarning>Last updated {secondsSinceUpdate}s ago</span>
              )}
              {changePct != null && Number.isFinite(changePct) && unitRate != null && (
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    changePct >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {changePct >= 0 ? '+' : ''}
                  {changePct.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {hardPriceError && (
          <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-foreground">
            <p>{ERR_MSG}</p>
            <p className="mt-2 text-xs text-zinc-400">
              Pode trocar a cripto ou a moeda de cotação abaixo — outro par ou Tentar de novo.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
              onClick={() => void refetch()}
            >
              Try again
            </Button>
          </div>
        )}

        {softPriceError && (
          <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/80">
            {ERR_MSG}{' '}
            <button
              type="button"
              className="font-semibold text-primary underline-offset-2 hover:underline"
              onClick={() => void refetch()}
            >
              Try again
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
            <InputCard
              side="left"
              asset={left}
              amount={leftAmount}
              focused={focusedField === 'left'}
              swapPulse={swapPulse}
              disabled={inputDisabled}
              pickerMode={left.type === 'crypto' ? 'coin' : 'vs'}
              autoFocus
              onAmountChange={setLeftAmount}
              onFocus={() => setFocusedField('left')}
              onBlur={() => setFocusedField(null)}
              onLastEdited={setLastEdited}
              onAssetChange={setLeftAsset}
            />

            {/* Swap button */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleSwap}
                title="Swap currencies"
                aria-label="Swap from and to"
                className={cn(
                  'flex size-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800',
                  'text-zinc-400 transition-all duration-200 hover:scale-105 hover:border-primary/50 hover:bg-zinc-700 hover:text-primary',
                  'active:scale-95',
                  swapPulse && 'rotate-180'
                )}
              >
                <ArrowUpDown className="size-5" />
              </button>
            </div>

            <InputCard
              side="right"
              asset={right}
              amount={rightAmount}
              focused={focusedField === 'right'}
              swapPulse={swapPulse}
              disabled={inputDisabled}
              pickerMode={right.type === 'crypto' ? 'coin' : 'vs'}
              onAmountChange={setRightAmount}
              onFocus={() => setFocusedField('right')}
              onBlur={() => setFocusedField(null)}
              onLastEdited={setLastEdited}
              onAssetChange={setRightAsset}
            />

            {/* Result card */}
            {referenceLine && hasStalePrices && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-4 text-center">
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Rate
                </p>
                <p className="text-xl font-semibold text-foreground">{referenceLine}</p>
              </div>
            )}
        </div>
      </main>
    </div>
  )
}
