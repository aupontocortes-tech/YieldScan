import { atr, bollingerBands, ema, macd, rsi } from '@/lib/btc/indicators'
import {
  FROZEN_RULES,
  MAX_NOTIONAL_USD,
  ORACLE_DIVERGENCE_MAX,
  RISK_PER_TRADE_PCT,
} from '@/lib/hyperliquid/constants'
import type { HlBar, HlSignal, HlSymbol, NewsRisk, RuleParams, SignalDecision, TradeFeatures } from '@/lib/hyperliquid/types'

export type IndicatorSnapshot = {
  ema9: number | null
  ema21: number | null
  ema200: number | null
  rsi: number | null
  macdHist: number | null
  atr: number | null
  bbUpper: number | null
  bbLower: number | null
  support: number | null
  resistance: number | null
  btcTrendUp: boolean
}

function last<T>(arr: (T | null)[]): T | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i] as T
  }
  return null
}

function swingLevels(bars: HlBar[]): { support: number | null; resistance: number | null } {
  const window = bars.slice(-20)
  if (window.length < 5) return { support: null, resistance: null }
  return {
    support: Math.min(...window.map((b) => b.low)),
    resistance: Math.max(...window.map((b) => b.high)),
  }
}

export function snapshotIndicators(bars: HlBar[], btcBars: HlBar[]): IndicatorSnapshot {
  const closes = bars.map((b) => b.close)
  const highs = bars.map((b) => b.high)
  const lows = bars.map((b) => b.low)
  const ema9 = ema(closes, 9)
  const ema21 = ema(closes, 21)
  const ema200 = ema(closes, 200)
  const rsiS = rsi(closes, 14)
  const macdOut = macd(closes, 12, 26, 9)
  const atrS = atr(highs, lows, closes, 14)
  const bb = bollingerBands(closes, 20, 2)
  const levels = swingLevels(bars)
  const btcCloses = btcBars.map((b) => b.close)
  const btc9 = last(ema(btcCloses, 9))
  const btc21 = last(ema(btcCloses, 21))
  return {
    ema9: last(ema9),
    ema21: last(ema21),
    ema200: last(ema200),
    rsi: last(rsiS),
    macdHist: last(macdOut.hist),
    atr: last(atrS),
    bbUpper: last(bb.upper),
    bbLower: last(bb.lower),
    support: levels.support,
    resistance: levels.resistance,
    btcTrendUp: btc9 != null && btc21 != null && btc9 >= btc21,
  }
}

function none(reason: string, blocked = false): SignalDecision {
  return {
    signal: 'none',
    reason,
    entry: null,
    stop: null,
    takeProfit: null,
    sizeUsd: 0,
    blocked,
    blockReason: blocked ? reason : null,
  }
}

/**
 * Regras v1 congeladas (`STRATEGY_RULES_VERSION`).
 * Notícias e oráculo só bloqueiam. Não geram ordem sozinhos.
 * Sem alavancagem: tamanho limitado pelo risco e pelo teto do ativo.
 */
export function featuresFrom(
  symbol: HlSymbol,
  indicators: IndicatorSnapshot,
  newsRisk: NewsRisk,
  oracleDivergence: number,
  closeAboveOpen: boolean,
  price: number,
): TradeFeatures | null {
  if (indicators.rsi == null || indicators.macdHist == null || indicators.ema9 == null || indicators.ema21 == null) {
    return null
  }
  return {
    symbol,
    rsi: indicators.rsi,
    macdHist: indicators.macdHist,
    ema9Above21: indicators.ema9 > indicators.ema21,
    aboveEma200: indicators.ema200 == null || price >= indicators.ema200,
    btcTrendUp: indicators.btcTrendUp,
    newsRisk,
    oracleDivergence,
    closeAboveOpen,
  }
}

export function evaluateStrategy(input: {
  symbol: HlSymbol
  bars: HlBar[]
  btcBars: HlBar[]
  equityUsd: number
  newsRisk: NewsRisk
  oraclePrice: number
  params?: RuleParams
}): SignalDecision & { indicators: IndicatorSnapshot; version: string; features: TradeFeatures | null; atr: number | null } {
  const params = input.params ?? FROZEN_RULES
  const { symbol, bars, btcBars, equityUsd, newsRisk, oraclePrice } = input
  const indicators = snapshotIndicators(bars, btcBars)
  const bar = bars[bars.length - 1]
  const price = bar?.close ?? 0
  const divergence = price > 0 ? Math.abs(oraclePrice - price) / price : 0
  const features = bar
    ? featuresFrom(symbol, indicators, newsRisk, divergence, bar.close > bar.open, price)
    : null
  const pack = { indicators, version: params.id, features, atr: indicators.atr }

  if (!bar || bars.length < 30) {
    return { ...none('Histórico insuficiente para os indicadores.'), ...pack }
  }

  if (divergence > ORACLE_DIVERGENCE_MAX) {
    return { ...none('Oráculo diverge do preço do candle. Entrada bloqueada.', true), ...pack }
  }
  if (params.blockHighNews && newsRisk === 'alto') {
    return { ...none('Filtro de notícias em risco alto. Sem novas entradas.', true), ...pack }
  }

  const { ema9, ema21, ema200, rsi: rsiNow, macdHist, atr: atrNow, bbUpper } = indicators
  if (ema9 == null || ema21 == null || atrNow == null || rsiNow == null || macdHist == null) {
    return { ...none('Indicadores ainda a aquecer.'), ...pack }
  }

  if (params.requireBtcFilter && symbol !== 'BTC' && !indicators.btcTrendUp) {
    return { ...none('Filtro Bitcoin: tendência do BTC não confirma alta.'), ...pack }
  }

  const trendUp = ema9 > ema21 && (ema200 == null || price >= ema200 * 0.985)
  const momentum = macdHist > 0 && rsiNow >= params.rsiMin && rsiNow <= params.rsiMax
  const notExtended = bbUpper == null || price < bbUpper
  let signal: HlSignal = 'none'
  let reason = 'Sem confluência suficiente para entrar.'

  if (trendUp && momentum && notExtended && bar.close > bar.open) {
    signal = 'buy'
    reason = `EMA9>EMA21, MACD positivo, RSI ${rsiNow.toFixed(0)} e fecho acima da abertura.`
  } else if (ema9 < ema21 && macdHist < 0) {
    signal = 'sell'
    reason = 'EMA9 cruzou abaixo da EMA21 com MACD negativo. Saída / sem compra.'
  }

  if (signal !== 'buy') {
    return { ...none(reason), signal, ...pack }
  }

  const stop = price - params.atrStopMult * atrNow
  const takeProfit = price + params.atrTpMult * atrNow
  const riskPerUnit = price - stop
  if (riskPerUnit <= 0) {
    return { ...none('Stop inválido.'), ...pack }
  }
  const riskBudget = equityUsd * RISK_PER_TRADE_PCT * (newsRisk === 'medio' ? 0.5 : 1)
  const qty = riskBudget / riskPerUnit
  const uncapped = qty * price
  const sizeUsd = Math.max(0, Math.min(uncapped, MAX_NOTIONAL_USD[symbol]))

  return {
    signal,
    reason,
    entry: price,
    stop,
    takeProfit,
    sizeUsd,
    blocked: false,
    blockReason: null,
    ...pack,
  }
}
