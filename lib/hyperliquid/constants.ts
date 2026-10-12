import type { HlSymbol, HlTimeframe, RuleParams } from '@/lib/hyperliquid/types'

/** Regras base. O robô só troca de versão depois de um teste fora da amostra. */
export const STRATEGY_RULES_VERSION = 'hl-strategy-v1'

export const FROZEN_RULES: RuleParams = {
  id: STRATEGY_RULES_VERSION,
  rsiMin: 42,
  rsiMax: 68,
  atrStopMult: 1.5,
  atrTpMult: 2.2,
  requireBtcFilter: true,
  blockHighNews: true,
}

/** Modo real fica bloqueado nesta versão. Nenhuma ordem sai para a mainnet. */
export const LIVE_TRADING_LOCKED = true

export const HL_NETWORK = 'testnet' as const

export const STARTING_CASH_USD = 10_000

export const TAKER_FEE_RATE = 0.00045
export const SLIPPAGE_RATE = 0.0002

export const SYMBOLS: HlSymbol[] = ['BTC', 'ETH', 'SOL', 'HYPE']

export const TIMEFRAMES: { id: HlTimeframe; seconds: number; label: string }[] = [
  { id: '15m', seconds: 15 * 60, label: '15 min' },
  { id: '1h', seconds: 60 * 60, label: '1 h' },
  { id: '4h', seconds: 4 * 60 * 60, label: '4 h' },
  { id: '1d', seconds: 24 * 60 * 60, label: '1 D' },
]

export const BASE_PRICE: Record<HlSymbol, number> = {
  BTC: 83_000,
  ETH: 3_200,
  SOL: 180,
  HYPE: 28,
}

/** Volatilidade relativa usada na simulação e no tamanho. */
export const VOL_MULT: Record<HlSymbol, number> = {
  BTC: 1,
  ETH: 1.15,
  SOL: 1.45,
  HYPE: 2.2,
}

/** Teto de nocional por operação (USDC simulado), sem alavancagem. */
export const MAX_NOTIONAL_USD: Record<HlSymbol, number> = {
  BTC: 500,
  ETH: 400,
  SOL: 250,
  HYPE: 100,
}

export const RISK_PER_TRADE_PCT = 0.005
export const DAILY_LOSS_LIMIT_PCT = 0.03
export const MAX_OPEN_POSITIONS = 2
export const MAX_CONSECUTIVE_ERRORS = 3
export const ATR_STOP_MULT = 1.5
export const ATR_TP_MULT = 2.2
export const ORACLE_DIVERGENCE_MAX = 0.008

export const PAPER_STORAGE_KEY = 'hl-paper-v1'
