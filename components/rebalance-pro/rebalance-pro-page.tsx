'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { SeletorDePar } from '@/components/rebalance-pro/seletor-de-par'
import { InputsDePosicao } from '@/components/rebalance-pro/inputs-de-posicao'
import { CardDeDecisao } from '@/components/rebalance-pro/card-de-decisao'
import { BotoesDeAcao } from '@/components/rebalance-pro/botoes-de-acao'
import { PainelDeDetalhes } from '@/components/rebalance-pro/painel-de-detalhes'
import { DEFAULT_TOKENS, type TokenOption } from '@/components/rebalance-pro/token-selector'
import { computeRebalance } from '@/lib/rebalance-pro/compute'
import {
  analyzeTrendFromChart,
  decideLiquidityAction,
  type DecisionOutput,
} from '@/lib/rebalance-pro/decision-engine'
import { cn } from '@/lib/utils'

const DEFAULT_TOKEN_B =
  DEFAULT_TOKENS.find((t) => t.id === 'usdc') ?? DEFAULT_TOKENS[1] ?? DEFAULT_TOKENS[0]!

function parseNum(s: string): number {
  const n = parseFloat(String(s).replace(',', '.').trim())
  return Number.isFinite(n) ? n : Number.NaN
}

async function fetchPriceWith24h(
  coingeckoId: string,
  signal?: AbortSignal,
): Promise<{ usd: number; change24h: number | null } | null> {
  try {
    const res = await fetch(
      `/api/coingecko/simple-price?ids=${encodeURIComponent(coingeckoId)}&vs=usd&include_24hr_change=true`,
      { cache: 'no-store', signal },
    )
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>
    const row = data[coingeckoId]
    if (row?.usd == null || !Number.isFinite(row.usd)) return null
    const ch =
      typeof row.usd_24h_change === 'number' && Number.isFinite(row.usd_24h_change)
        ? row.usd_24h_change
        : null
    return { usd: Math.max(0, row.usd), change24h: ch }
  } catch {
    return null
  }
}

async function fetchMarketChartPrices(
  coingeckoId: string,
  days: 1 | 7,
  signal?: AbortSignal,
): Promise<[number, number][]> {
  try {
    const res = await fetch(
      `/api/coingecko/market-chart?id=${encodeURIComponent(coingeckoId)}&days=${days}`,
      { cache: 'no-store', signal },
    )
    if (!res.ok) return []
    const data = (await res.json()) as { prices?: [number, number][] }
    const raw = Array.isArray(data.prices) ? data.prices : []
    return raw.map(([ts, p]) => [ts, typeof p === 'number' && p >= 0 ? p : 0] as [number, number])
  } catch {
    return []
  }
}

export function RebalanceProPage() {
  const [tokenA, setTokenAState] = React.useState<TokenOption>(DEFAULT_TOKENS[0]!)
  const [tokenB, setTokenBState] = React.useState<TokenOption>(DEFAULT_TOKEN_B)
  const [detailsOpen, setDetailsOpen] = React.useState(false)

  const setTokenA = React.useCallback((t: TokenOption) => {
    setTokenAState(t)
    setTokenBState((b) =>
      b.id === t.id ? DEFAULT_TOKENS.find((x) => x.id !== t.id) ?? DEFAULT_TOKEN_B : b,
    )
  }, [])

  const setTokenB = React.useCallback((t: TokenOption) => {
    setTokenBState(t)
    setTokenAState((a) =>
      a.id === t.id ? DEFAULT_TOKENS.find((x) => x.id !== t.id) ?? DEFAULT_TOKENS[0]! : a,
    )
  }, [])

  const swapPair = React.useCallback(() => {
    setTokenAState(tokenB)
    setTokenBState(tokenA)
  }, [tokenA, tokenB])

  const pairLabel = `${tokenA.symbol} / ${tokenB.symbol}`

  const [autoPrice, setAutoPrice] = React.useState(true)
  const [manualPrice, setManualPrice] = React.useState('2500')
  const [livePrice, setLivePrice] = React.useState<number | null>(null)
  const [change24h, setChange24h] = React.useState<number | null>(null)
  const [priceLoading, setPriceLoading] = React.useState(false)
  const [priceError, setPriceError] = React.useState<string | null>(null)

  const [chartDays, setChartDays] = React.useState<1 | 7>(1)
  const [chartPrices, setChartPrices] = React.useState<[number, number][]>([])
  const [chartLoading, setChartLoading] = React.useState(false)
  const [chartError, setChartError] = React.useState<string | null>(null)

  const [pMin, setPMin] = React.useState('2000')
  const [pMax, setPMax] = React.useState('3000')
  const [capital, setCapital] = React.useState('')

  const [rangeMode, setRangeMode] = React.useState<'simples' | 'dinamico'>('simples')
  const [percentualFrac, setPercentualFrac] = React.useState(0.1)

  const [notice, setNotice] = React.useState<string | null>(null)
  const marketAbortRef = React.useRef<AbortController | null>(null)
  const marketGenRef = React.useRef(0)

  const refreshMarket = React.useCallback(async () => {
    marketAbortRef.current?.abort()
    const ac = new AbortController()
    marketAbortRef.current = ac
    const { signal } = ac
    const gen = ++marketGenRef.current

    setChartError(null)
    setPriceError(null)

    setPriceLoading(true)
    void (async () => {
      try {
        const priceRow = await fetchPriceWith24h(tokenA.coingeckoId, signal)
        if (gen !== marketGenRef.current) return
        if (priceRow) {
          setChange24h(priceRow.change24h)
          if (autoPrice) {
            setLivePrice(priceRow.usd)
            setManualPrice(String(priceRow.usd))
            setPriceError(null)
          }
        } else {
          setChange24h(null)
          if (autoPrice) {
            setPriceError('Não foi possível carregar o preço. Tente o modo manual ou atualize.')
            setLivePrice(null)
          }
        }
      } catch {
        if (gen === marketGenRef.current && autoPrice) {
          setPriceError('Pedido de preço cancelado ou falhou.')
        }
      } finally {
        if (gen === marketGenRef.current) setPriceLoading(false)
      }
    })()

    setChartLoading(true)
    void (async () => {
      try {
        const prices = await fetchMarketChartPrices(tokenA.coingeckoId, chartDays, signal)
        if (gen !== marketGenRef.current) return
        if (prices.length < 2) {
          setChartError('Gráfico indisponível. Atualize ou verifique os limites da CoinGecko.')
          setChartPrices([])
        } else {
          setChartPrices(prices)
        }
      } catch {
        if (gen === marketGenRef.current) {
          setChartError('Pedido do gráfico cancelado ou falhou.')
          setChartPrices([])
        }
      } finally {
        if (gen === marketGenRef.current) setChartLoading(false)
      }
    })()
  }, [tokenA, chartDays, autoPrice])

  React.useEffect(() => {
    void refreshMarket()
  }, [refreshMarket])

  const trendAnalysis = React.useMemo(() => analyzeTrendFromChart(chartPrices), [chartPrices])

  const effectivePrice = React.useMemo(() => {
    if (autoPrice && livePrice != null && livePrice >= 0) return livePrice
    const m = parseNum(manualPrice)
    if (!Number.isFinite(m)) return 0
    return Math.max(0, m)
  }, [autoPrice, livePrice, manualPrice])

  const pMinN = parseNum(pMin)
  const pMaxN = parseNum(pMax)
  const invalidRange = !(pMaxN > pMinN) || pMinN < 0 || pMaxN < 0

  const capitalN = parseNum(capital)
  const hasValidCapital = Number.isFinite(capitalN) && capitalN > 0

  const rangeResult = React.useMemo(() => {
    if (invalidRange || effectivePrice <= 0) return null
    return computeRebalance({
      price: effectivePrice,
      pMin: pMinN,
      pMax: pMaxN,
      modo: rangeMode,
      percentual: rangeMode === 'dinamico' ? percentualFrac : undefined,
      valorTotal: hasValidCapital ? capitalN : undefined,
    })
  }, [effectivePrice, pMinN, pMaxN, rangeMode, percentualFrac, hasValidCapital, capitalN, invalidRange])

  const inRange = rangeResult ? rangeResult.inRange : false
  const hasEnoughData = rangeResult != null

  const volatilityPct = React.useMemo(() => {
    if (change24h != null && Number.isFinite(change24h)) return Math.abs(change24h)
    return Math.abs(trendAnalysis.windowReturnPct)
  }, [change24h, trendAnalysis.windowReturnPct])

  const decision: DecisionOutput | null = React.useMemo(() => {
    if (invalidRange) {
      return decideLiquidityAction({
        inRange: false,
        volatilityPct,
        trendAnalysis,
        invalidRange: true,
      })
    }
    if (!rangeResult) return null
    return decideLiquidityAction({
      inRange,
      volatilityPct,
      trendAnalysis,
      invalidRange: false,
    })
  }, [rangeResult, invalidRange, inRange, volatilityPct, trendAnalysis])

  const marketError = [priceError, chartError].filter(Boolean).join(' — ') || null
  const marketRefreshing = priceLoading || chartLoading

  const displayPriceForPanel = effectivePrice > 0 ? effectivePrice : livePrice != null ? livePrice : null
  const safeDisplayPrice = displayPriceForPanel != null ? Math.max(0, displayPriceForPanel) : null

  const onPrimaryAction = () => {
    const act = decision?.action ?? 'wait'
    if (act === 'hold') {
      setNotice('Está tudo dentro da faixa — não precisa fazer nada por agora.')
    } else if (act === 'wait') {
      setNotice('Fique de olho no mercado. Volte quando o preço ou a volatilidade mudarem.')
    } else if (act === 'rebalance') {
      setNotice('Demo: em produção isso abriria a carteira e a transação no pool.')
    } else {
      setNotice('Demo: em produção o app guiaria um reforço só em um dos tokens.')
    }
    window.setTimeout(() => setNotice(null), 4500)
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-auto bg-[#050505]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,80,255,0.18),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(34,211,238,0.08),transparent)]" />

      <div className="relative z-[1] mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center sm:mb-12"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-violet-200/90">
            <Zap className="size-3.5 text-cyan-400" aria-hidden />
            Assistente de liquidez
          </div>
          <h1 className="bg-gradient-to-r from-white via-violet-100 to-cyan-200 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl md:text-5xl">
            Rebalance Pro
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
            Inspirado no Uniswap v3, sem a complexidade. O app analisa preço e volatilidade e sugere o próximo passo —
            rebalancear, esperar ou entrar com um token só.
          </p>
        </motion.header>

        <AnimatePresence>
          {notice && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-100/95"
            >
              {notice}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="space-y-5 lg:col-span-7">
            <SeletorDePar
              tokenA={tokenA}
              tokenB={tokenB}
              onTokenAChange={setTokenA}
              onTokenBChange={setTokenB}
              onSwapPair={swapPair}
            />
            <InputsDePosicao
              pairLabel={pairLabel}
              priceSymbol={tokenA.symbol}
              autoPrice={autoPrice}
              onAutoPriceChange={setAutoPrice}
              manualPrice={manualPrice}
              onManualPriceChange={setManualPrice}
              livePrice={livePrice}
              priceLoading={priceLoading}
              priceError={priceError}
              pMin={pMin}
              pMax={pMax}
              capital={capital}
              onPMin={setPMin}
              onPMax={setPMax}
              onCapital={setCapital}
              invalidRange={invalidRange}
            />
            <PainelDeDetalhes
              open={detailsOpen}
              onOpenChange={setDetailsOpen}
              pairLabel={pairLabel}
              priceSymbol={tokenA.symbol}
              quoteSymbol={tokenB.symbol}
              marketProps={{
                price: safeDisplayPrice,
                change24hPct: change24h,
                volatilityPct,
                trend: trendAnalysis.trend,
                windowReturnPct: trendAnalysis.windowReturnPct,
                chartDays,
                onChartDaysChange: setChartDays,
                prices: chartPrices,
                priceLoading,
                chartLoading,
                refreshing: marketRefreshing,
                error: marketError,
                onRefresh: () => void refreshMarket(),
              }}
              rangeMode={rangeMode}
              onRangeModeChange={setRangeMode}
              percentualFrac={percentualFrac}
              onPercentualFracChange={setPercentualFrac}
              newMin={rangeResult?.newMin ?? null}
              newMax={rangeResult?.newMax ?? null}
              rangeUsado={rangeResult?.rangeUsado ?? null}
              tokenAQty={rangeResult?.tokenA ?? null}
              tokenBUsd={rangeResult?.tokenB ?? null}
              rangeShiftPct={rangeResult?.rangeShiftPct ?? null}
              impermanentLossHintPct={rangeResult?.impermanentLossHintPct ?? null}
              showRangeSuggestion={hasEnoughData}
            />
          </div>

          <motion.aside
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="space-y-5 lg:col-span-5"
          >
            <CardDeDecisao
              invalidRange={invalidRange}
              hasEnoughData={hasEnoughData}
              inRange={inRange}
              decision={decision}
            />
            <BotoesDeAcao
              action={decision?.action ?? null}
              disabled={invalidRange || decision == null}
              onPress={onPrimaryAction}
            />

            {capital.trim() && hasValidCapital && (
              <p className="text-center text-[11px] text-muted-foreground">
                Montagem 50/50 em valor no painel &quot;Detalhes&quot; usando{' '}
                <span className="font-mono text-foreground/90">
                  ${capitalN.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                </span>{' '}
                USD.
              </p>
            )}

            {!hasEnoughData && !invalidRange && (
              <div
                className={cn(
                  'rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center text-sm text-muted-foreground',
                )}
              >
                Preencha preço e intervalo válidos para liberar a sugestão e o botão de ação.
              </div>
            )}
          </motion.aside>
        </div>
      </div>
    </div>
  )
}
