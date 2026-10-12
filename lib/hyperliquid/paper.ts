import {
  DAILY_LOSS_LIMIT_PCT,
  FROZEN_RULES,
  MAX_CONSECUTIVE_ERRORS,
  MAX_OPEN_POSITIONS,
  SLIPPAGE_RATE,
  STARTING_CASH_USD,
  TAKER_FEE_RATE,
} from '@/lib/hyperliquid/constants'
import { evaluateStrategy } from '@/lib/hyperliquid/strategy'
import type {
  BotLog,
  ClosedTrade,
  HlBar,
  HlSymbol,
  NewsRisk,
  PaperBook,
  PaperOrder,
  PaperPosition,
  TrainingSample,
} from '@/lib/hyperliquid/types'

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function dayKey(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10)
}

function log(book: PaperBook, level: BotLog['level'], message: string): PaperBook {
  return {
    ...book,
    logs: [{ at: Date.now(), level, message }, ...book.logs].slice(0, 80),
  }
}

export function createPaperBook(): PaperBook {
  return {
    rulesVersion: FROZEN_RULES.id,
    rules: FROZEN_RULES,
    cashUsd: STARTING_CASH_USD,
    dayKey: dayKey(),
    dayStartEquity: STARTING_CASH_USD,
    robotOn: false,
    haltedReason: null,
    consecutiveErrors: 0,
    positions: [],
    orders: [],
    trades: [],
    logs: [
      {
        at: Date.now(),
        level: 'info',
        message: 'Livro simulado criado. Modo real bloqueado. Treino não altera as regras enquanto o robô opera.',
      },
    ],
    samples: [],
    pending: null,
  }
}

function fee(notional: number): number {
  return notional * TAKER_FEE_RATE
}

function closePosition(
  book: PaperBook,
  pos: PaperPosition,
  exitPrice: number,
  exitReason: string,
): PaperBook {
  const slip = exitPrice * SLIPPAGE_RATE
  const fill = Math.max(0.01, exitPrice - slip)
  const gross = (fill - pos.entry) * pos.qty
  const exitFee = fee(fill * pos.qty)
  const slippageUsd = slip * pos.qty
  const net = gross - exitFee - pos.feesUsd
  const risk = (pos.entry - pos.stop) * pos.qty
  const trade: ClosedTrade = {
    id: pos.id,
    symbol: pos.symbol,
    side: pos.side,
    entry: pos.entry,
    exit: fill,
    sizeUsd: pos.sizeUsd,
    pnlUsd: gross,
    feesUsd: pos.feesUsd + exitFee,
    slippageUsd,
    netUsd: net,
    openedAt: pos.openedAt,
    closedAt: Date.now(),
    entryReason: pos.reason,
    exitReason,
    rMultiple: risk > 0 ? net / risk : 0,
  }
  const sample: TrainingSample | null = pos.features
    ? {
        id: pos.id,
        at: Date.now(),
        source: 'paper',
        features: pos.features,
        entry: pos.entry,
        atr: pos.atr ?? Math.abs(pos.entry - pos.stop),
        pathHigh: [],
        pathLow: [],
        pathClose: [],
        realized: true,
        win: net > 0,
        netUsd: net,
      }
    : null
  const order: PaperOrder = {
    id: id('ord'),
    symbol: pos.symbol,
    side: 'sell',
    type: exitReason.startsWith('Stop') ? 'stop' : exitReason.startsWith('Take') ? 'take-profit' : 'market',
    status: 'filled',
    price: fill,
    sizeUsd: fill * pos.qty,
    createdAt: Date.now(),
    reason: exitReason,
  }
  return {
    ...book,
    cashUsd: book.cashUsd + pos.qty * fill - exitFee,
    positions: book.positions.filter((p) => p.id !== pos.id),
    orders: [order, ...book.orders].slice(0, 40),
    trades: [trade, ...book.trades].slice(0, 80),
    samples: sample ? [sample, ...(book.samples ?? []).filter((s) => s.id !== sample.id)].slice(0, 400) : (book.samples ?? []),
  }
}

export function emergencyStop(book: PaperBook): PaperBook {
  const cancelled = book.orders.map((o) => (o.status === 'open' ? { ...o, status: 'cancelled' as const } : o))
  return log(
    {
      ...book,
      robotOn: false,
      haltedReason: 'Paragem de emergência.',
      orders: cancelled,
    },
    'warn',
    'Emergência: robô parado e ordens abertas canceladas. Posições simuladas ficam visíveis, sem novas entradas.',
  )
}

export function setRobot(book: PaperBook, on: boolean): PaperBook {
  if (on && book.haltedReason) {
    return log(book, 'warn', `Robô bloqueado: ${book.haltedReason}`)
  }
  if (on && book.rules.id !== book.rulesVersion) {
    return log(book, 'error', 'Regras ativas inconsistentes. Corre o treino de novo antes de ligar.')
  }
  return log(
    { ...book, robotOn: on, haltedReason: on ? null : book.haltedReason },
    'info',
    on ? 'Robô ligado em modo simulado (testnet/paper).' : 'Robô desligado. Nenhuma ordem nova.',
  )
}

export function clearHalt(book: PaperBook): PaperBook {
  return log(
    { ...book, haltedReason: null, consecutiveErrors: 0, robotOn: false },
    'info',
    'Bloqueio limpo. O robô continua desligado até ligares de novo.',
  )
}

function equityOf(book: PaperBook, prices: Partial<Record<HlSymbol, number>>): number {
  let equity = book.cashUsd
  for (const pos of book.positions) {
    const px = prices[pos.symbol] ?? pos.entry
    equity += pos.qty * px
  }
  return equity
}

export function stepPaper(input: {
  book: PaperBook
  symbol: HlSymbol
  bars: HlBar[]
  btcBars: HlBar[]
  prices: Partial<Record<HlSymbol, number>>
  newsRisk: NewsRisk
  oraclePrice: number
}): PaperBook {
  let book = input.book
  const bar = input.bars[input.bars.length - 1]
  if (!bar) return book

  const today = dayKey()
  if (book.dayKey !== today) {
    book = {
      ...book,
      dayKey: today,
      dayStartEquity: equityOf(book, input.prices),
    }
  }

  for (const pos of [...book.positions]) {
    if (pos.symbol !== input.symbol) continue
    if (bar.low <= pos.stop) {
      book = log(closePosition(book, pos, pos.stop, 'Stop-loss obrigatório atingido.'), 'warn', `${pos.symbol}: stop em ${pos.stop.toFixed(2)}.`)
    } else if (bar.high >= pos.takeProfit) {
      book = log(closePosition(book, pos, pos.takeProfit, 'Take-profit atingido.'), 'info', `${pos.symbol}: alvo em ${pos.takeProfit.toFixed(2)}.`)
    }
  }

  if (!book.robotOn || book.haltedReason) return book

  try {
    const decision = evaluateStrategy({
      symbol: input.symbol,
      bars: input.bars,
      btcBars: input.btcBars,
      equityUsd: equityOf(book, input.prices),
      newsRisk: input.newsRisk,
      oraclePrice: input.oraclePrice,
      params: book.rules,
    })

    if (decision.signal === 'sell') {
      const pos = book.positions.find((p) => p.symbol === input.symbol)
      if (pos) {
        book = log(
          closePosition(book, pos, bar.close, `Saída por sinal: ${decision.reason}`),
          'info',
          `${input.symbol}: posição fechada pelo sinal de saída.`,
        )
      }
      book = { ...book, consecutiveErrors: 0 }
      return book
    }

    if (decision.signal !== 'buy' || decision.blocked || decision.entry == null || decision.stop == null || decision.takeProfit == null) {
      if (decision.blocked && decision.blockReason) {
        book = log(book, 'info', `${input.symbol}: ${decision.blockReason}`)
      }
      book = { ...book, consecutiveErrors: 0 }
      return book
    }

    if (book.positions.some((p) => p.symbol === input.symbol)) return book
    if (book.positions.length >= MAX_OPEN_POSITIONS) {
      return log(book, 'info', 'Limite de posições simultâneas atingido.')
    }

    const equity = equityOf(book, input.prices)
    const dayLoss = book.dayStartEquity > 0 ? (book.dayStartEquity - equity) / book.dayStartEquity : 0
    if (dayLoss >= DAILY_LOSS_LIMIT_PCT) {
      return log(
        { ...book, robotOn: false, haltedReason: 'Limite de perda diária.' },
        'error',
        'Perda diária máxima atingida. Robô parado.',
      )
    }

    const slip = decision.entry * SLIPPAGE_RATE
    const fill = decision.entry + slip
    const sizeUsd = Math.min(decision.sizeUsd, book.cashUsd * 0.95)
    if (sizeUsd < 10) return log(book, 'warn', 'Caixa insuficiente para o tamanho mínimo.')
    const qty = sizeUsd / fill
    const entryFee = fee(sizeUsd)
    if (book.cashUsd < sizeUsd + entryFee) return log(book, 'warn', 'Caixa insuficiente depois de taxas.')

    const position: PaperPosition = {
      id: id('pos'),
      symbol: input.symbol,
      side: 'long',
      entry: fill,
      stop: decision.stop,
      takeProfit: decision.takeProfit,
      sizeUsd,
      qty,
      openedAt: Date.now(),
      reason: decision.reason,
      feesUsd: entryFee,
      features: decision.features ?? undefined,
      atr: decision.atr ?? undefined,
    }
    const order: PaperOrder = {
      id: id('ord'),
      symbol: input.symbol,
      side: 'buy',
      type: 'market',
      status: 'filled',
      price: fill,
      sizeUsd,
      createdAt: Date.now(),
      reason: decision.reason,
    }
    book = log(
      {
        ...book,
        cashUsd: book.cashUsd - sizeUsd - entryFee,
        positions: [...book.positions, position],
        orders: [order, ...book.orders].slice(0, 40),
        consecutiveErrors: 0,
      },
      'info',
      `${input.symbol}: compra simulada ${sizeUsd.toFixed(0)} USDC. ${decision.reason}`,
    )
    return book
  } catch (err) {
    const errors = book.consecutiveErrors + 1
    const halt = errors >= MAX_CONSECUTIVE_ERRORS
    return log(
      {
        ...book,
        consecutiveErrors: errors,
        robotOn: halt ? false : book.robotOn,
        haltedReason: halt ? 'Erros repetidos. Robô parado.' : book.haltedReason,
      },
      'error',
      halt ? 'Três erros seguidos. Robô parado.' : `Erro ao avaliar: ${err instanceof Error ? err.message : 'desconhecido'}`,
    )
  }
}
