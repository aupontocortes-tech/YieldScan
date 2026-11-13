import type { HoldersBuybackOverview } from '@/lib/tendencias/fetch-defi'
import type { RawMarketCoin } from '@/lib/tendencias/fetch-data'
import type { RawLlamaProtocol } from '@/lib/tendencias/fetch-l1'
import type { RawCgCategory } from '@/lib/tendencias/fetch-narrative-markets'
import { NARRATIVE_GECKO_IDS } from '@/lib/tendencias/fetch-narrative-markets'
import type { MomentumPeriod, TendenciasNarrative, TendenciasNarrativeSpotlight } from '@/lib/tendencias/types'

export const NARRATIVE_DEFS: Array<{
  id: string
  label: string
  simple: string
  llamaCats: string[]
  geckoIds: string[]
  newsId: string | null
}> = [
  {
    id: 'rwa',
    label: 'RWA',
    simple: 'Activos reais tokenizados (títulos, crédito, imobiliário).',
    llamaCats: ['RWA', 'Real World Assets'],
    geckoIds: NARRATIVE_GECKO_IDS.rwa ?? [],
    newsId: 'rwa',
  },
  {
    id: 'ia',
    label: 'IA',
    simple: 'Tokens ligados a inteligência artificial e computação.',
    llamaCats: ['AI Agents', 'AI'],
    geckoIds: NARRATIVE_GECKO_IDS.ia ?? [],
    newsId: 'ia',
  },
  {
    id: 'emprestimos',
    label: 'Empréstimos',
    simple: 'Protocolos de crédito: depositas cripto e recebes juros, ou pedes emprestado.',
    llamaCats: ['Lending'],
    geckoIds: NARRATIVE_GECKO_IDS.emprestimos ?? [],
    newsId: 'defi',
  },
  {
    id: 'defi',
    label: 'DeFi',
    simple: 'Finanças na cadeia: bolsas, rendimento e crédito colateralizado.',
    llamaCats: ['Dexes', 'Dexs', 'Yield', 'Yield Aggregator', 'CDP'],
    geckoIds: NARRATIVE_GECKO_IDS.defi ?? [],
    newsId: 'defi',
  },
  {
    id: 'layer1',
    label: 'Camada 1',
    simple: 'Blockchains de base (Ethereum, Solana, Sui…).',
    llamaCats: ['Chain'],
    geckoIds: NARRATIVE_GECKO_IDS.layer1 ?? [],
    newsId: null,
  },
  {
    id: 'layer2',
    label: 'Camada 2',
    simple: 'Redes em cima do Ethereum, mais baratas e rápidas.',
    llamaCats: [],
    geckoIds: NARRATIVE_GECKO_IDS.layer2 ?? [],
    newsId: 'layer2',
  },
  {
    id: 'restaking',
    label: 'Staking',
    simple: 'Tokens de staking e restaking — rendimento sobre ETH e similares.',
    llamaCats: ['Liquid Staking', 'Liquid Restaking', 'Restaking'],
    geckoIds: NARRATIVE_GECKO_IDS.restaking ?? [],
    newsId: null,
  },
  {
    id: 'memecoins',
    label: 'Memecoins',
    simple: 'Moedas de comunidade / meme — alto risco.',
    llamaCats: [],
    geckoIds: NARRATIVE_GECKO_IDS.memecoins ?? [],
    newsId: 'memecoins',
  },
  {
    id: 'gaming',
    label: 'Jogos',
    simple: 'Jogos e coleccionáveis digitais (NFTs).',
    llamaCats: ['Gaming', 'NFT Marketplace', 'NFT'],
    geckoIds: NARRATIVE_GECKO_IDS.gaming ?? [],
    newsId: 'gaming',
  },
  {
    id: 'depin',
    label: 'DePIN',
    simple: 'Redes físicas (energia, wireless, sensores) com token.',
    llamaCats: [],
    geckoIds: NARRATIVE_GECKO_IDS.depin ?? [],
    newsId: null,
  },
  {
    id: 'buybacks',
    label: 'Recompra e queima',
    simple: 'Protocolos que usam taxas para comprar o token no mercado ou queimá-lo — menos moedas em circulação.',
    llamaCats: [],
    geckoIds: [],
    newsId: 'buybacks',
  },
]

const MEGA = new Set(['bitcoin', 'ethereum', 'tether', 'usd-coin', 'binancecoin', 'ripple', 'solana'])
const STABLE = new Set(['tether', 'usd-coin', 'dai', 'first-digital-usd', 'usds', 'paypal-usd', 'ethena-usde'])

function percentile(value: number, all: number[]): number {
  if (!all.length) return 50
  const sorted = [...all].sort((a, b) => a - b)
  let below = 0
  for (const v of sorted) if (v < value) below++
  return Math.round((below / sorted.length) * 100)
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function protocolChange(p: RawLlamaProtocol, period: MomentumPeriod): number | null {
  if (period === '24h') return p.change1d
  if (period === '7d') return p.change7d
  return p.change1m
}

function coinChange(c: RawMarketCoin, period: MomentumPeriod): number | null {
  if (period === '24h') return c.price_change_percentage_24h
  if (period === '7d') return c.price_change_percentage_7d_in_currency ?? null
  if (period === '30d') return c.price_change_percentage_30d_in_currency ?? null
  return c.price_change_percentage_200d_in_currency ?? null
}

function coinsPeriodChange(coins: RawMarketCoin[], period: MomentumPeriod): number | null {
  let w = 0
  let wSum = 0
  for (const c of coins) {
    const ch = coinChange(c, period)
    const cap = c.market_cap ?? 0
    if (ch == null || cap <= 0) continue
    w += ch * cap
    wSum += cap
  }
  return wSum > 0 ? w / wSum : null
}

function llamaFor(def: (typeof NARRATIVE_DEFS)[number], protocols: RawLlamaProtocol[], period: MomentumPeriod) {
  const cats = new Set(def.llamaCats.map((c) => c.toLowerCase()))
  const rows = protocols.filter((p) => cats.has(p.category.toLowerCase()))
  const tvl = rows.reduce((s, p) => s + (p.tvl > 0 ? p.tvl : 0), 0)
  let w = 0
  let wSum = 0
  for (const p of rows) {
    const ch = protocolChange(p, period)
    if (ch == null || p.tvl <= 0) continue
    w += ch * p.tvl
    wSum += p.tvl
  }
  return {
    tvl,
    tvlChange: wSum > 0 ? w / wSum : null,
    symbols: rows.map((p) => p.symbol).filter(Boolean) as string[],
  }
}

function cgFor(def: (typeof NARRATIVE_DEFS)[number], categories: RawCgCategory[]) {
  const ids = new Set(def.geckoIds)
  const hits = categories.filter((c) => ids.has(c.id))
  if (!hits.length) return { marketCap: null as number | null, change24h: null as number | null, volume24h: null as number | null }
  const marketCap = hits.reduce((s, c) => s + (c.marketCap ?? 0), 0)
  const volume24h = hits.reduce((s, c) => s + (c.volume24h ?? 0), 0)
  const withCh = hits.filter((c) => c.marketCapChange24h != null && c.marketCap)
  const change24h =
    withCh.length > 0
      ? withCh.reduce((s, c) => s + (c.marketCapChange24h ?? 0) * (c.marketCap ?? 0), 0) /
        withCh.reduce((s, c) => s + (c.marketCap ?? 0), 0)
      : null
  return { marketCap: marketCap > 0 ? marketCap : null, change24h, volume24h: volume24h > 0 ? volume24h : null }
}

function pickSpotlights(
  def: (typeof NARRATIVE_DEFS)[number],
  coinsByCat: Record<string, RawMarketCoin[]>,
): TendenciasNarrativeSpotlight[] {
  const coins: RawMarketCoin[] = []
  const seen = new Set<string>()
  for (const gid of def.geckoIds) {
    for (const c of coinsByCat[gid] ?? []) {
      if (!c.id || seen.has(c.id)) continue
      seen.add(c.id)
      coins.push(c)
    }
  }
  const usable = coins.filter((c) => {
    if (STABLE.has(c.id)) return false
    if (def.id !== 'layer1' && MEGA.has(c.id)) return false
    const cap = c.market_cap ?? 0
    if (cap > 0 && (cap < 8_000_000 || cap > 12_000_000_000)) return false
    return true
  })
  const avg7d =
    usable.reduce((s, c) => s + (c.price_change_percentage_7d_in_currency ?? 0), 0) / Math.max(1, usable.length)

  return [...usable]
    .map((c) => {
      const ch7 = c.price_change_percentage_7d_in_currency ?? c.price_change_percentage_24h ?? 0
      const vol = c.total_volume ?? 0
      const cap = c.market_cap ?? 1
      const vsAvg = ch7 - avg7d
      const volRatio = cap > 0 ? vol / cap : 0
      const score = vsAvg * 1.4 + volRatio * 40 + (c.price_change_percentage_24h ?? 0) * 0.3
      const why =
        vsAvg >= 3
          ? `Subiu ${vsAvg.toFixed(0)} pontos acima da média deste tema.`
          : volRatio > 0.18
            ? 'Muito volume para o tamanho — está a ser negociada de forma activa.'
            : 'Uma das mais activas deste tema hoje.'
      return { c, score, why, ch7 }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ c, why, ch7 }) => ({
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      geckoId: c.id,
      marketCap: c.market_cap,
      change24h: c.price_change_percentage_24h,
      change7d: c.price_change_percentage_7d_in_currency ?? ch7,
      volume24h: c.total_volume,
      why,
    }))
}

export function pickHotGeckoCategoryIds(categories: RawCgCategory[]): string[] {
  const wanted = new Set(NARRATIVE_DEFS.flatMap((d) => d.geckoIds))
  return categories
    .filter((c) => wanted.has(c.id) && c.marketCapChange24h != null)
    .sort((a, b) => (b.marketCapChange24h ?? -999) - (a.marketCapChange24h ?? -999))
    .slice(0, 4)
    .map((c) => c.id)
}

function buybackSpotlights(
  holders: HoldersBuybackOverview | undefined,
  markets: RawMarketCoin[],
): TendenciasNarrativeSpotlight[] {
  if (!holders?.protocols.length) return []
  const byGecko = new Map(markets.map((m) => [m.id, m]))
  const bySym = new Map(markets.map((m) => [m.symbol.toUpperCase(), m]))
  const seen = new Set<string>()
  const out: TendenciasNarrativeSpotlight[] = []
  for (const p of holders.protocols) {
    const m = (p.geckoId ? byGecko.get(p.geckoId) : undefined) ?? (p.symbol ? bySym.get(p.symbol) : undefined)
    const symbol = (m?.symbol ?? p.symbol ?? p.name.replace(/\s+/g, '').slice(0, 8)).toUpperCase()
    if (!symbol || seen.has(symbol)) continue
    seen.add(symbol)
    const mil = p.revenue24h >= 1e6 ? `${(p.revenue24h / 1e6).toFixed(1)} M` : `${(p.revenue24h / 1e3).toFixed(0)} K`
    out.push({
      symbol,
      name: m?.name ?? p.name,
      geckoId: m?.id ?? p.geckoId ?? '',
      marketCap: m?.market_cap ?? null,
      change24h: m?.price_change_percentage_24h ?? null,
      change7d: m?.price_change_percentage_7d_in_currency ?? p.change7d,
      volume24h: m?.total_volume ?? p.revenue24h,
      why: `Recompra/queima: cerca de ${mil} US$ em 24h devolvidos a quem tem o token.`,
    })
    if (out.length >= 4) break
  }
  return out
}

export function buildAdoptionNarratives(input: {
  categories: RawCgCategory[]
  coinsByCat: Record<string, RawMarketCoin[]>
  protocols: RawLlamaProtocol[]
  newsById: Map<string, { mentionCount: number; posCount: number; negCount: number }>
  holders?: HoldersBuybackOverview
  markets?: RawMarketCoin[]
  period?: MomentumPeriod
}): TendenciasNarrative[] {
  const period = input.period ?? '7d'
  const scored = NARRATIVE_DEFS.map((def) => {
    const llama = llamaFor(def, input.protocols, period)
    const cg = cgFor(def, input.categories)
    const catCoins = def.geckoIds.flatMap((id) => input.coinsByCat[id] ?? [])
    const cgPeriod = coinsPeriodChange(catCoins, period) ?? (period === '24h' ? cg.change24h : null)
    const news = def.newsId ? input.newsById.get(def.newsId) : undefined
    const mentionCount = news?.mentionCount ?? 0
    return { def, llama, cg, cgPeriod, mentionCount, pos: news?.posCount ?? 0, neg: news?.negCount ?? 0 }
  })

  const tvlVals = scored.map((s) => s.llama.tvl)
  const newsVals = scored.map((s) => s.mentionCount)

  const holders = input.holders
  const rows: TendenciasNarrative[] = scored.map((s) => {
    const isBuy = s.def.id === 'buybacks'
    const holdersChg =
      period === '24h' ? holders?.change1d : (holders?.change7d ?? holders?.change1d)
    const llamaMeaningful = !isBuy && s.llama.tvl >= 200_000_000 && s.llama.tvlChange != null
    const llamaChg = isBuy ? holdersChg ?? null : llamaMeaningful ? s.llama.tvlChange : null
    const cgChg = s.cgPeriod ?? (period === '24h' ? s.cg.change24h : null)
    const parts = [llamaChg, cgChg].filter((v): v is number => v != null)
    const perform = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null
    const adopt = clamp(Math.round(50 + (perform ?? 0) * 1.1), 0, 100)
    const attention = percentile(s.mentionCount, newsVals)
    const score = clamp(Math.round(adopt * 0.92 + attention * 0.08), 0, 100)
    const spotlights =
      s.def.id === 'buybacks'
        ? buybackSpotlights(holders, input.markets ?? [])
        : pickSpotlights(s.def, input.coinsByCat)
    const related = [
      ...spotlights.map((x) => x.symbol),
      ...s.llama.symbols.slice(0, 3),
    ].filter((v, i, a) => a.indexOf(v) === i)

    const tvlBit =
      s.def.id === 'buybacks' && holders && holders.total24h > 0
        ? `Recompra/queima agora: ~${(holders.total24h / 1e6).toFixed(1)} M US$ em 24h (receita devolvida a holders, DefiLlama).`
        : s.llama.tvl > 0
          ? `Dinheiro neste tema (TVL): ${(s.llama.tvl / 1e9 >= 1 ? `${(s.llama.tvl / 1e9).toFixed(1)} mil milhões` : `${(s.llama.tvl / 1e6).toFixed(0)} milhões`)} USD.`
          : 'Ainda pouco TVL medido neste tema.'
    const chgBit =
      perform != null
        ? ` No período escolhido o nicho ${perform >= 0 ? 'sobe' : 'desce'} ${Math.abs(perform).toFixed(1)}% (DefiLlama TVL e/ou CoinGecko).`
        : ''
    const talkBit = s.mentionCount > 0 ? ` Nas notícias aparece ${s.mentionCount} vezes.` : ''

    const sentimentScore = 50 + (perform ?? 0) * 0.6
    const sentiment: TendenciasNarrative['sentiment'] =
      sentimentScore >= 56 ? 'optimista' : sentimentScore <= 44 ? 'pessimista' : 'neutro'

    return {
      id: s.def.id as TendenciasNarrative['id'],
      label: s.def.label,
      summary: `${s.def.simple} ${tvlBit}${chgBit}${talkBit}`.trim(),
      impact: score >= 70 ? 'alto' : score >= 45 ? 'medio' : 'baixo',
      sentiment,
      relatedSymbols: related.slice(0, 8),
      mentionCount: s.mentionCount,
      intensity: score,
      adoptionScore: adopt,
      attentionScore: attention,
      tvlUsd: s.def.id === 'buybacks' ? holders?.total24h ?? null : s.llama.tvl > 0 ? s.llama.tvl : null,
      tvlChange7dPct: perform,
      marketCapChange24h: s.cg.change24h,
      volume24h: s.cg.volume24h,
      source: adopt >= attention + 8 ? 'adocao' : attention >= adopt + 15 ? 'atencao' : 'misto',
      simple: s.def.simple,
      spotlights,
    }
  })

  const ranked = rows
    .filter((r) => r.tvlChange7dPct != null)
    .sort((a, b) => (b.tvlChange7dPct ?? -999) - (a.tvlChange7dPct ?? -999))
    .slice(0, 5)
    .map((r, i) => {
      const chg = r.tvlChange7dPct ?? 0
      const rankWhy =
        i === 0
          ? `Nº 1 neste período: ${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% (TVL DefiLlama + sector CoinGecko).`
          : `${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% neste período — TVL travado, fluxo e preço do sector.`
      return { ...r, intensity: clamp(Math.round(50 + chg * 1.2), 0, 100), rankWhy }
    })

  return ranked
}
