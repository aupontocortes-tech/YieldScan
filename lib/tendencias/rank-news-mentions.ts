import type { MomentumPeriod } from '@/lib/tendencias/types'
import type {
  TendenciasEquitiesPanel,
  TendenciasNewsInsight,
  TendenciasNewsMention,
  TendenciasTokenRow,
} from '@/lib/tendencias/types'

const MAX_POOL = 20

function tokenChangePct(row: TendenciasTokenRow): number {
  return row.changePeriod ?? row.change24h ?? 0
}

function equityMap(panel: TendenciasEquitiesPanel): Map<string, { changePct: number }> {
  const m = new Map<string, { changePct: number }>()
  for (const r of [...panel.highlights, ...panel.topVolume, ...panel.aiWatchlist]) {
    const sym = r.symbol.toUpperCase()
    if (!m.has(sym)) {
      m.set(sym, { changePct: r.changePct ?? 0 })
    }
  }
  return m
}

function rankCryptoMentions(
  raw: TendenciasNewsMention[],
  tokenRows: TendenciasTokenRow[],
): TendenciasNewsMention[] {
  const bySym = new Map(tokenRows.map((r) => [r.symbol.toUpperCase(), r]))
  const out: TendenciasNewsMention[] = []

  for (const m of raw) {
    const sym = m.symbol.toUpperCase()
    const row = bySym.get(sym)
    const changePct = row != null ? tokenChangePct(row) : null
    out.push({ symbol: sym, count: m.count, changePct })
  }

  return out.sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol)).slice(0, MAX_POOL)
}

function rankStockMentions(
  raw: TendenciasNewsMention[],
  equities: TendenciasEquitiesPanel | null,
): TendenciasNewsMention[] {
  const bySym = equities ? equityMap(equities) : new Map<string, { changePct: number }>()
  const out: TendenciasNewsMention[] = []

  for (const m of raw) {
    const sym = m.symbol.toUpperCase()
    const eq = bySym.get(sym)
    out.push({
      symbol: sym,
      count: m.count,
      changePct: eq != null ? eq.changePct : null,
    })
  }

  return out.sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol)).slice(0, MAX_POOL)
}

/** Top falados = menções em notícias PT; variação de preço é informativa (positiva ou negativa). */
export function applyRankedNewsMentions(
  insight: TendenciasNewsInsight,
  opts: {
    tokenRows: TendenciasTokenRow[]
    equities: TendenciasEquitiesPanel | null
    period: MomentumPeriod
  },
): TendenciasNewsInsight {
  const topCryptoMentions = rankCryptoMentions(
    insight.topCryptoMentions?.length ? insight.topCryptoMentions : insight.topMentions,
    opts.tokenRows,
  )
  const topStockMentions = rankStockMentions(insight.topStockMentions ?? [], opts.equities)

  return {
    ...insight,
    topMentions: topCryptoMentions,
    topCryptoMentions,
    topStockMentions,
    rankingPeriod: opts.period,
  }
}

export const NEWS_MENTIONS_RANKING_HINT =
  'Ranking por menções nas manchetes em português (últimas 24h). A variação de preço é só referência do período em Definições — não filtra quem entra no top. Clica num ativo para ver só as notícias dele.'
