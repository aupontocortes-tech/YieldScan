'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, Calculator, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CalculatorAssetPicker } from '@/components/calculator/calculator-asset-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    error,
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
  const blockingError = isError && !hasStalePrices
  const softError = isError && hasStalePrices

  const inputWrap = (side: LastEdited, children: ReactNode) => (
    <div
      className={cn(
        'rounded-lg transition-[box-shadow,background-color] duration-200 ease-out',
        focusedField === side && 'ring-2 ring-primary/55 ring-offset-2 ring-offset-background',
        swapPulse && 'scale-[0.99] opacity-95 sm:scale-100'
      )}
    >
      {children}
    </div>
  )

  const leftPickerMode = left.type === 'crypto' ? 'coin' : 'vs'
  const rightPickerMode = right.type === 'crypto' ? 'coin' : 'vs'

  return (
    <div className="flex flex-1 flex-col bg-background">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-8 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/35 bg-primary/10 text-primary">
            <Calculator className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Crypto Calculator
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Search any CoinGecko coin and quote currency — type to find assets
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {isFetching && hasStalePrices && (
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  <Loader2 className="size-3.5 animate-spin" />
                  Updating…
                </span>
              )}
              {secondsSinceUpdate != null && hasStalePrices && (
                <span className="tabular-nums" suppressHydrationWarning>
                  Last updated {secondsSinceUpdate}s ago
                </span>
              )}
            </div>
            {changePct != null && Number.isFinite(changePct) && unitRate != null && (
              <p
                className={cn(
                  'mt-2 text-xs font-medium tabular-nums',
                  changePct >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                Price vs. previous tick: {changePct >= 0 ? '+' : ''}
                {changePct.toFixed(2)}%
              </p>
            )}
          </div>
        </div>

        <Card
          className={cn(
            'relative border-border/80 bg-card/50 transition-shadow duration-300 ease-out',
            swapPulse && 'shadow-md shadow-primary/10'
          )}
        >
          <div
            className="pointer-events-none absolute right-4 top-4 flex items-center gap-1.5 text-xs text-muted-foreground"
            aria-live="polite"
          >
            {isLoading && !hasStalePrices && (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Loading…
              </>
            )}
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Converter</CardTitle>
            <CardDescription>
              CoinGecko live prices · search coins (2+ letters) or filter quote currencies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            {blockingError && (
              <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
                <p>{ERR_MSG}</p>
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

            {softError && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
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

            {!blockingError && (
              <div
                className={cn(
                  'flex flex-col items-stretch gap-4 transition-opacity duration-200 lg:flex-row lg:items-end lg:justify-between',
                  swapPulse && 'opacity-90'
                )}
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {left.type === 'crypto' ? 'Crypto' : 'Quote'}
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {inputWrap(
                      'left',
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="Enter amount"
                        value={leftAmount}
                        onChange={(e) => {
                          setLeftAmount(e.target.value)
                          setLastEdited('left')
                        }}
                        onFocus={() => setFocusedField('left')}
                        onBlur={() => setFocusedField(null)}
                        disabled={!hasStalePrices && isLoading}
                        className="min-h-11 border-border bg-secondary font-mono text-base tabular-nums sm:max-w-[200px]"
                        autoComplete="off"
                      />
                    )}
                    <CalculatorAssetPicker
                      mode={leftPickerMode}
                      value={left}
                      onChange={setLeftAsset}
                      disabled={!hasStalePrices && isLoading}
                    />
                  </div>
                </div>

                <div className="flex justify-center lg:px-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={handleSwap}
                    className="size-11 shrink-0 rounded-full border-primary/50 bg-primary text-primary-foreground shadow-sm transition-transform duration-200 hover:bg-primary/90 active:scale-95"
                    title="Swap currencies"
                    aria-label="Swap from and to"
                  >
                    <ArrowLeftRight className="size-5" />
                  </Button>
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {right.type === 'crypto' ? 'Crypto' : 'Quote'}
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {inputWrap(
                      'right',
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="Enter amount"
                        value={rightAmount}
                        onChange={(e) => {
                          setRightAmount(e.target.value)
                          setLastEdited('right')
                        }}
                        onFocus={() => setFocusedField('right')}
                        onBlur={() => setFocusedField(null)}
                        disabled={!hasStalePrices && isLoading}
                        className="min-h-11 border-border bg-secondary font-mono text-base tabular-nums sm:max-w-[200px]"
                        autoComplete="off"
                      />
                    )}
                    <CalculatorAssetPicker
                      mode={rightPickerMode}
                      value={right}
                      onChange={setRightAsset}
                      disabled={!hasStalePrices && isLoading}
                    />
                  </div>
                </div>
              </div>
            )}

            {referenceLine && hasStalePrices && !blockingError && (
              <p className="border-t border-border/60 pt-4 text-center text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{referenceLine}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
