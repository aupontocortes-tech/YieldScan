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
    if (!row) continue
    const changePct = tokenChangePct(row)
    if (changePct <= 0) continue
    out.push({ symbol: sym, count: m.count, changePct })
  }

  return out
    .sort((a, b) => b.count - a.count || (b.changePct ?? 0) - (a.changePct ?? 0))
    .slice(0, MAX_POOL)
}

function rankStockMentions(
  raw: TendenciasNewsMention[],
  equities: TendenciasEquitiesPanel | null,
): TendenciasNewsMention[] {
  if (!equities) return []
  const bySym = equityMap(equities)
  const out: TendenciasNewsMention[] = []

  for (const m of raw) {
    const sym = m.symbol.toUpperCase()
    const eq = bySym.get(sym)
    if (!eq) continue
    if (eq.changePct <= 0) continue
    out.push({ symbol: sym, count: m.count, changePct: eq.changePct })
  }

  return out
    .sort((a, b) => b.count - a.count || (b.changePct ?? 0) - (a.changePct ?? 0))
    .slice(0, MAX_POOL)
}

/** Top falados = menções em notícias PT + preço em alta (período de momentum). Não usa TVL/volume no ranking. */
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
  'Menções nas manchetes (últimas 24h) entre ativos com preço a subir no período que escolheste em Definições. Não entra TVL nem volume neste top.'
