import { canonicalHighlightCoinGeckoId } from '@/lib/mercado-highlight-ids'
import {
  deleteGfCryptoHolding,
  ensureGfDb,
  ensureGfPortfolioWallet,
  listGfCryptoHoldings,
  pruneDuplicateGfCryptoHoldings,
  upsertGfCryptoHolding,
} from '@/lib/gestao-financeira/db'
import type { GfCryptoHolding } from '@/lib/gestao-financeira/types'
import type { PortfolioData, PortfolioHolding } from '@/lib/portfolio/types'

function resolvePortfolioCoinId(holding: PortfolioHolding): string | null {
  const gecko = holding.geckoId?.trim().toLowerCase()
  if (gecko) return gecko
  const sym = holding.symbol.trim().toLowerCase()
  if (!sym) return null
  const canonical = canonicalHighlightCoinGeckoId(sym)
  return canonical || null
}

type PortfolioCoinKeys = {
  coinIds: Set<string>
  symbols: Set<string>
}

function buildPortfolioCoinKeys(portfolio: PortfolioData): PortfolioCoinKeys {
  const coinIds = new Set<string>()
  const symbols = new Set<string>()
  for (const h of portfolio.holdings) {
    if (h.quantity <= 0) continue
    const coinId = resolvePortfolioCoinId(h)
    if (coinId) coinIds.add(coinId)
    const sym = h.symbol.trim().toUpperCase()
    if (sym) symbols.add(sym)
  }
  return { coinIds, symbols }
}

function holdingMatchesPortfolioKeys(holding: GfCryptoHolding, keys: PortfolioCoinKeys): boolean {
  const coinCanon = canonicalHighlightCoinGeckoId(holding.coinId)
  if (keys.coinIds.has(holding.coinId) || (coinCanon && keys.coinIds.has(coinCanon))) return true

  const sym = holding.symbol.trim().toUpperCase()
  if (sym && keys.symbols.has(sym)) return true

  const symAsCoin = sym ? canonicalHighlightCoinGeckoId(sym.toLowerCase()) : ''
  return Boolean(symAsCoin && keys.coinIds.has(symAsCoin))
}

/** Espelha posições da Carteira (/portfolio) na aba Cripto da Gestão Financeira. */
export async function syncPortfolioToGfCrypto(portfolio: PortfolioData): Promise<boolean> {
  await ensureGfDb()
  const walletId = ensureGfPortfolioWallet(portfolio.name)
  let changed = false

  const existingInWallet = listGfCryptoHoldings().filter((h) => h.walletId === walletId)
  const existingByCoin = new Map(existingInWallet.map((h) => [h.coinId, h]))
  const activeCoinIds = new Set<string>()
  const portfolioKeys = buildPortfolioCoinKeys(portfolio)

  for (const h of portfolio.holdings) {
    if (h.quantity <= 0) continue
    const coinId = resolvePortfolioCoinId(h)
    if (!coinId) continue
    activeCoinIds.add(coinId)
    const symbol = h.symbol.trim().toUpperCase()
    const prev = existingByCoin.get(coinId)
    if (
      !prev ||
      prev.quantity !== h.quantity ||
      prev.avgPriceUsd !== h.avgBuyUsd ||
      prev.symbol !== symbol
    ) {
      upsertGfCryptoHolding({
        walletId,
        coinId,
        symbol,
        quantity: h.quantity,
        avgPriceUsd: h.avgBuyUsd,
      })
      changed = true
    }
  }

  for (const gh of existingInWallet) {
    if (activeCoinIds.has(gh.coinId)) continue
    if (deleteGfCryptoHolding(gh.id)) changed = true
  }

  // Posições antigas (Hold, Trade, etc.) que já existem na Carteira passam a contar só no espelho.
  if (portfolioKeys.coinIds.size > 0 || portfolioKeys.symbols.size > 0) {
    for (const gh of listGfCryptoHoldings()) {
      if (gh.walletId === walletId) continue
      if (!holdingMatchesPortfolioKeys(gh, portfolioKeys)) continue
      if (deleteGfCryptoHolding(gh.id)) changed = true
    }
  }

  if (pruneDuplicateGfCryptoHoldings(walletId)) changed = true

  return changed
}
