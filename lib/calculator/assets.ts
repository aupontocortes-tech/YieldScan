/**
 * Ativos suportados no conversor (crypto ↔ fiat via CoinGecko simple/price).
 * Para novas moedas: acrescentar entrada e, se crypto, incluir o id na lista da API.
 */

export type CalculatorAssetType = 'crypto' | 'fiat'

export type CalculatorAsset = {
  id: string
  symbol: string
  name: string
  type: CalculatorAssetType
  /** Rótulo curto no select */
  label: string
}

export const CALCULATOR_ASSETS: CalculatorAsset[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    type: 'crypto',
    label: 'Bitcoin (BTC)',
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    type: 'crypto',
    label: 'Ethereum (ETH)',
  },
  {
    id: 'solana',
    symbol: 'SOL',
    name: 'Solana',
    type: 'crypto',
    label: 'Solana (SOL)',
  },
  {
    id: 'tether',
    symbol: 'USDT',
    name: 'Tether',
    type: 'crypto',
    label: 'Tether (USDT)',
  },
  {
    id: 'usd',
    symbol: 'USD',
    name: 'US Dollar',
    type: 'fiat',
    label: 'USD',
  },
  {
    id: 'brl',
    symbol: 'BRL',
    name: 'Brazilian Real',
    type: 'fiat',
    label: 'BRL',
  },
]

/** Ids enviados ao CoinGecko (simple/price). */
export const CALCULATOR_COINGECKO_IDS = CALCULATOR_ASSETS.filter((a) => a.type === 'crypto')
  .map((a) => a.id)
  .join(',')

export function getCalculatorAsset(id: string): CalculatorAsset | undefined {
  return CALCULATOR_ASSETS.find((a) => a.id === id)
}

export function calculatorAssetsByType(type: CalculatorAssetType): CalculatorAsset[] {
  return CALCULATOR_ASSETS.filter((a) => a.type === type)
}

export function pickDefaultPair(): { leftId: string; rightId: string } {
  const firstCrypto = CALCULATOR_ASSETS.find((a) => a.type === 'crypto')
  const firstFiat = CALCULATOR_ASSETS.find((a) => a.type === 'fiat')
  return {
    leftId: firstCrypto?.id ?? 'bitcoin',
    rightId: firstFiat?.id ?? 'usd',
  }
}

/** Garante um par crypto + fiat; ajusta `rightId` se necessário. */
export function normalizeCalculatorPair(leftId: string, rightId: string): { leftId: string; rightId: string } {
  const L = getCalculatorAsset(leftId)
  const R = getCalculatorAsset(rightId)
  const def = pickDefaultPair()
  if (!L || !R) return def
  if (L.type !== R.type) return { leftId: L.id, rightId: R.id }
  const opposite =
    L.type === 'crypto'
      ? CALCULATOR_ASSETS.find((a) => a.type === 'fiat')
      : CALCULATOR_ASSETS.find((a) => a.type === 'crypto')
  return { leftId: L.id, rightId: opposite?.id ?? def.rightId }
}

export function getCryptoAndFiatFromPair(
  leftId: string,
  rightId: string
): { cryptoId: string; fiatId: string } | null {
  const L = getCalculatorAsset(leftId)
  const R = getCalculatorAsset(rightId)
  if (!L || !R || L.type === R.type) return null
  const crypto = L.type === 'crypto' ? L : R
  const fiat = L.type === 'fiat' ? L : R
  return { cryptoId: crypto.id, fiatId: fiat.id }
}
