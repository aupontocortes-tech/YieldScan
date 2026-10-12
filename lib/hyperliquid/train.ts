import { atr, bollingerBands, ema, macd, rsi } from '@/lib/btc/indicators'
import {
  FROZEN_RULES,
  MAX_NOTIONAL_USD,
  ORACLE_DIVERGENCE_MAX,
  SLIPPAGE_RATE,
  SYMBOLS,
  TAKER_FEE_RATE,
} from '@/lib/hyperliquid/constants'
import { generateBars, simulatedNews, simulatedOraclePrice } from '@/lib/hyperliquid/market'
import type { HlBar, HlSymbol, PaperBook, RuleParams, TrainReport, TrainingSample } from '@/lib/hyperliquid/types'
const FORWARD = 8
const MIN_HOLDOUT = 6

function ruleId(p: Omit<RuleParams, 'id'>): string {
  return `hl-rsi${p.rsiMin}-${p.rsiMax}-s${p.atrStopMult}-t${p.atrTpMult}-btc${p.requireBtcFilter ? 1 : 0}`
}

function passes(sample: TrainingSample, params: RuleParams): boolean {
  const f = sample.features
  if (!f.ema9Above21 || f.macdHist <= 0 || !f.closeAboveOpen) return false
  if (f.rsi < params.rsiMin || f.rsi > params.rsiMax) return false
  if (params.requireBtcFilter && f.symbol !== 'BTC' && !f.btcTrendUp) return false
  if (params.blockHighNews && f.newsRisk === 'alto') return false
  if (f.oracleDivergence > ORACLE_DIVERGENCE_MAX) return false
  if (!f.aboveEma200) return false
  return true
}

function simulate(sample: TrainingSample, params: RuleParams): { win: boolean; netUsd: number } {
  if (sample.realized) return { win: sample.win, netUsd: sample.netUsd }
  const entry = sample.entry
  const stop = entry - params.atrStopMult * sample.atr
  const take = entry + params.atrTpMult * sample.atr
  const fill = entry * (1 + SLIPPAGE_RATE)
  const risk = fill - stop
  if (risk <= 0 || sample.pathClose.length === 0) return { win: false, netUsd: 0 }
  const qty = Math.min((10_000 * 0.005) / risk, MAX_NOTIONAL_USD[sample.features.symbol] / fill)
  let exit = sample.pathClose[sample.pathClose.length - 1] ?? fill
  for (let i = 0; i < sample.pathLow.length; i++) {
    if (sample.pathLow[i]! <= stop) {
      exit = stop
      break
    }
    if (sample.pathHigh[i]! >= take) {
      exit = take
      break
    }
  }
  const exitFill = exit * (1 - SLIPPAGE_RATE)
  const gross = (exitFill - fill) * qty
  const fees = (fill + exitFill) * qty * TAKER_FEE_RATE
  const net = gross - fees
  return { win: net > 0, netUsd: net }
}

function score(samples: TrainingSample[], params: RuleParams): { n: number; winPct: number; netUsd: number } {
  let n = 0
  let wins = 0
  let netUsd = 0
  for (const sample of samples) {
    if (!passes(sample, params)) continue
    const result = simulate(sample, params)
    n += 1
    if (result.win) wins += 1
    netUsd += result.netUsd
  }
  return { n, winPct: n ? (wins / n) * 100 : 0, netUsd }
}

function grid(): RuleParams[] {
  const out: RuleParams[] = []
  for (const rsiMin of [38, 42, 48]) {
    for (const rsiMax of [62, 68, 74]) {
      for (const atrStopMult of [1.3, 1.5, 1.8]) {
        for (const atrTpMult of [1.8, 2.2, 2.8]) {
          for (const requireBtcFilter of [true, false]) {
            const draft = {
              rsiMin,
              rsiMax,
              atrStopMult,
              atrTpMult,
              requireBtcFilter,
              blockHighNews: true,
            }
            out.push({ ...draft, id: ruleId(draft) })
          }
        }
      }
    }
  }
  return out
}

function replaySymbol(symbol: HlSymbol, btcBars: HlBar[], now: number): TrainingSample[] {
  const bars = symbol === 'BTC' ? btcBars : generateBars(symbol, '1h', 220, now)
  const closes = bars.map((b) => b.close)
  const highs = bars.map((b) => b.high)
  const lows = bars.map((b) => b.low)
  const ema9 = ema(closes, 9)
  const ema21 = ema(closes, 21)
  const ema200 = ema(closes, 200)
  const rsiS = rsi(closes, 14)
  const macdHist = macd(closes, 12, 26, 9).hist
  const atrS = atr(highs, lows, closes, 14)
  const bb = bollingerBands(closes, 20, 2)
  const btcCloses = btcBars.map((b) => b.close)
  const btc9 = ema(btcCloses, 9)
  const btc21 = ema(btcCloses, 21)
  const samples: TrainingSample[] = []

  for (let i = 80; i < bars.length - FORWARD; i++) {
    const e9 = ema9[i]
    const e21 = ema21[i]
    const e200 = ema200[i]
    const rsiNow = rsiS[i]
    const hist = macdHist[i]
    const atrNow = atrS[i]
    const upper = bb.upper[i]
    if (e9 == null || e21 == null || rsiNow == null || hist == null || atrNow == null) continue
    const bar = bars[i]!
    const btcUp = btc9[i] != null && btc21[i] != null && btc9[i]! >= btc21[i]!
    const wide =
      e9 > e21 &&
      hist > 0 &&
      rsiNow >= 30 &&
      rsiNow <= 80 &&
      bar.close > bar.open &&
      (upper == null || bar.close < upper)
    if (!wide) continue
    const oracle = simulatedOraclePrice(bar.close, symbol, bar.time)
    const news = simulatedNews(symbol, bar.time)
    const divergence = Math.abs(oracle - bar.close) / bar.close
    samples.push({
      id: `replay-${symbol}-${bar.time}`,
      at: bar.time,
      source: 'replay',
      features: {
        symbol,
        rsi: rsiNow,
        macdHist: hist,
        ema9Above21: true,
        aboveEma200: e200 == null || bar.close >= e200,
        btcTrendUp: btcUp,
        newsRisk: news.risk,
        oracleDivergence: divergence,
        closeAboveOpen: true,
      },
      entry: bar.close,
      atr: atrNow,
      pathHigh: highs.slice(i + 1, i + 1 + FORWARD),
      pathLow: lows.slice(i + 1, i + 1 + FORWARD),
      pathClose: closes.slice(i + 1, i + 1 + FORWARD),
      realized: false,
      win: false,
      netUsd: 0,
    })
  }
  return samples
}

export function buildReplaySamples(now = Date.now()): TrainingSample[] {
  const btcBars = generateBars('BTC', '1h', 220, now)
  const all: TrainingSample[] = []
  for (const symbol of SYMBOLS) all.push(...replaySymbol(symbol, btcBars, now))
  return all.sort((a, b) => a.at - b.at)
}

export function proposeRules(samples: TrainingSample[], active: RuleParams): TrainReport {
  const ordered = [...samples].sort((a, b) => a.at - b.at)
  const split = Math.floor(ordered.length * 0.6)
  const train = ordered.slice(0, split)
  const holdout = ordered.slice(split)
  const activeHoldout = score(holdout, active)
  const base: TrainReport = {
    at: Date.now(),
    samples: ordered.length,
    trainWinPct: 0,
    holdoutWinPct: activeHoldout.winPct,
    holdoutNetUsd: activeHoldout.netUsd,
    activeHoldoutWinPct: activeHoldout.winPct,
    activeHoldoutNetUsd: activeHoldout.netUsd,
    approved: false,
    reason: 'Amostra curta. O robô precisa de mais trades simulados antes de mudar as regras.',
    candidate: null,
  }
  if (holdout.length < MIN_HOLDOUT || train.length < MIN_HOLDOUT) return base

  let best: RuleParams | null = null
  let bestTrain = { n: 0, winPct: -1, netUsd: -Infinity }
  for (const params of grid()) {
    const trainScore = score(train, params)
    if (trainScore.n < MIN_HOLDOUT || trainScore.netUsd <= 0) continue
    const better =
      trainScore.winPct > bestTrain.winPct ||
      (trainScore.winPct === bestTrain.winPct && trainScore.netUsd > bestTrain.netUsd)
    if (better) {
      best = params
      bestTrain = trainScore
    }
  }
  if (!best) {
    return { ...base, trainWinPct: bestTrain.winPct, reason: 'Nenhuma variante ficou lucrativa no treino.' }
  }

  const hold = score(holdout, best)
  const beats =
    hold.n >= MIN_HOLDOUT &&
    hold.netUsd > 0 &&
    (hold.winPct > activeHoldout.winPct || (hold.winPct === activeHoldout.winPct && hold.netUsd > activeHoldout.netUsd))
  return {
    ...base,
    trainWinPct: bestTrain.winPct,
    holdoutWinPct: hold.winPct,
    holdoutNetUsd: hold.netUsd,
    approved: beats && best.id !== active.id,
    candidate: best,
    reason: beats
      ? `Teste cego: ${hold.winPct.toFixed(1)}% de acerto e ${hold.netUsd.toFixed(0)} USDC líquidos, acima das regras atuais.`
      : `Teste cego não superou as regras atuais (${activeHoldout.winPct.toFixed(1)}% / ${activeHoldout.netUsd.toFixed(0)} USDC). Regras mantidas.`,
  }
}

export function runTraining(book: PaperBook): PaperBook {
  const replay = buildReplaySamples()
  const paper = (book.samples ?? []).filter((s) => s.source === 'paper')
  const samples = [...replay, ...paper].sort((a, b) => a.at - b.at).slice(-500)
  const pending = proposeRules(samples, book.rules ?? FROZEN_RULES)
  const level = pending.approved ? 'info' : 'warn'
  return {
    ...book,
    samples,
    pending,
    logs: [{ at: Date.now(), level, message: `Treino: ${pending.reason}` }, ...book.logs].slice(0, 80),
  }
}

export function applyPendingRules(book: PaperBook): PaperBook {
  if (book.robotOn) {
    return {
      ...book,
      logs: [
        { at: Date.now(), level: 'warn', message: 'Robô ligado. As regras ficam congeladas até o desligares.' },
        ...book.logs,
      ].slice(0, 80),
    }
  }
  if (!book.pending?.approved || !book.pending.candidate) {
    return {
      ...book,
      logs: [
        { at: Date.now(), level: 'warn', message: 'Não há regras aprovadas no teste cego.' },
        ...book.logs,
      ].slice(0, 80),
    }
  }
  const rules = book.pending.candidate
  return {
    ...book,
    rules,
    rulesVersion: rules.id,
    pending: null,
    logs: [
      {
        at: Date.now(),
        level: 'info',
        message: `Regras ${rules.id} aplicadas. RSI ${rules.rsiMin}-${rules.rsiMax}, stop ${rules.atrStopMult} ATR, alvo ${rules.atrTpMult} ATR.`,
      },
      ...book.logs,
    ].slice(0, 80),
  }
}
