import { canonicalHighlightCoinGeckoId } from '@/lib/mercado-highlight-ids'
import {
  deleteGfCryptoHolding,
  ensureGfDb,
  ensureGfPortfolioWallet,
  listGfCryptoHoldings,
  upsertGfCryptoHolding,
} from '@/lib/gestao-financeira/db'
import type { PortfolioData, PortfolioHolding } from '@/lib/portfolio/types'

function resolvePortfolioCoinId(holding: PortfolioHolding): string | null {
  const gecko = holding.geckoId?.trim().toLowerCase()
  if (gecko) return gecko
  const sym = holding.symbol.trim().toLowerCase()
  if (!sym) return null
  const canonical = canonicalHighlightCoinGeckoId(sym)
  return canonical || null
}

/** Espelha posições da Carteira (/portfolio) na aba Cripto da Gestão Financeira. */
export async function syncPortfolioToGfCrypto(portfolio: PortfolioData): Promise<boolean> {
  await ensureGfDb()
  const walletId = ensureGfPortfolioWallet(portfolio.name)
  let changed = false

  const existingInWallet = listGfCryptoHoldings().filter((h) => h.walletId === walletId)
  const existingByCoin = new Map(existingInWallet.map((h) => [h.coinId, h]))
  const activeCoinIds = new Set<string>()

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

  return changed
}
