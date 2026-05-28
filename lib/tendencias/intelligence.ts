import type { NoticiaProcessada } from '@/lib/newsdata'
import type {
  MomentumClass,
  SentimentLevel,
  TendenciasAlert,
  TendenciasApiResponse,
  TendenciasMarketPanel,
  TendenciasNarrative,
  TendenciasNarrativeId,
  TendenciasNewsInsight,
  TendenciasTokenBuckets,
  TendenciasTokenRow,
} from '@/lib/tendencias/types'
import type { RawGlobal, RawMarketCoin, RawTrending } from '@/lib/tendencias/fetch-data'

const NARRATIVE_RULES: Array<{
  id: TendenciasNarrativeId
  label: string
  keywords: RegExp
  related: string[]
}> = [
  { id: 'etfs', label: 'ETFs', keywords: /\betf\b|blackrock|grayscale|spot etf/i, related: ['BTC', 'ETH'] },
  { id: 'ia', label: 'IA & compute', keywords: /\bia\b|artificial intelligence|gpu|compute|agent/i, related: ['RENDER', 'FET', 'TAO', 'NEAR'] },
  { id: 'memecoins', label: 'Memecoins', keywords: /meme|doge|pepe|shib|wif|bonk/i, related: ['DOGE', 'PEPE', 'SHIB', 'WIF'] },
  { id: 'defi', label: 'DeFi', keywords: /defi|dex|liquidity|yield|tvl|aave|uniswap/i, related: ['UNI', 'AAVE', 'MKR', 'CRV'] },
  { id: 'stablecoins', label: 'Stablecoins', keywords: /stablecoin|usdt|usdc|tether|circle|depeg/i, related: ['USDT', 'USDC', 'DAI'] },
  { id: 'regulacao', label: 'Regulamentação', keywords: /sec|cftc|regulat|law|ban|compliance|mica/i, related: ['BTC', 'ETH'] },
  { id: 'layer2', label: 'Layer 2', keywords: /layer 2|l2|rollup|arbitrum|optimism|base chain|zk/i, related: ['ARB', 'OP', 'MATIC', 'STRK'] },
  { id: 'hacks', label: 'Hacks & exploits', keywords: /hack|exploit|breach|stolen|drain|rug/i, related: [] },
  { id: 'institucionais', label: 'Institucionais', keywords: /institutional|microstrategy|treasury|sovereign|etf inflow|whale/i, related: ['BTC', 'ETH'] },
]

const SYMBOL_FROM_TEXT =
  /\b(BTC|ETH|SOL|XRP|BNB|DOGE|ADA|AVAX|LINK|DOT|MATIC|POL|UNI|AAVE|ARB|OP|PEPE|SHIB|HYPE|RENDER|FET|TAO|NEAR|USDT|USDC)\b/gi

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function scoreToSentiment(score: number): SentimentLevel {
  if (score >= 62) return 'optimista'
  if (score <= 38) return 'pessimista'
  return 'neutro'
}

function classifyMomentum(c: RawMarketCoin): { cls: MomentumClass; reason: string; score: number } {
  const c24 = c.price_change_percentage_24h ?? 0
  const c7 = c.price_change_percentage_7d_in_currency ?? c24
  const c30 = c.price_change_percentage_30d_in_currency ?? c7
  const vol = c.total_volume ?? 0
  const mcap = c.market_cap ?? 1
  const volRatio = vol / mcap

  let score = 50
  score += clamp(c24 * 1.2, -25, 25)
  score += clamp(c7 * 0.4, -15, 15)
  score += clamp((c7 - c30) * 0.3, -10, 10)
  if (volRatio > 0.15) score += 8
  if (volRatio > 0.25) score += 5
  score = clamp(score, 0, 100)

  if (c24 > 8 && c7 > 5 && c24 > c7 * 0.5) {
    return {
      cls: 'acelerando',
      score,
      reason: `${c.symbol.toUpperCase()} acelera com variação 24h de ${c24.toFixed(1)}% e volume elevado face à capitalização.`,
    }
  }
  if (c24 < -8 && c7 < -5) {
    return {
      cls: 'fraco',
      score,
      reason: `${c.symbol.toUpperCase()} perde força com queda de ${c24.toFixed(1)}% em 24h e tendência negativa na semana.`,
    }
  }
  if (c7 < -10 && c24 > 3) {
    return {
      cls: 'reversao',
      score,
      reason: `Possível reversão: ${c.symbol.toUpperCase()} recupera ${c24.toFixed(1)}% em 24h após semana fraca (${c7.toFixed(1)}%).`,
    }
  }
  return {
    cls: 'estavel',
    score,
    reason: `${c.symbol.toUpperCase()} mantém movimento lateral — 24h ${c24 >= 0 ? '+' : ''}${c24.toFixed(1)}%, 7d ${c7 >= 0 ? '+' : ''}${c7.toFixed(1)}%.`,
  }
}

function tokenRow(c: RawMarketCoin, mentionCount = 0): TendenciasTokenRow {
  const { cls, reason, score } = classifyMomentum(c)
  const c24 = c.price_change_percentage_24h ?? 0
  const sentiment = scoreToSentiment(score + (c24 > 0 ? 5 : c24 < -5 ? -5 : 0))
  return {
    id: c.id,
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    image: c.image,
    price: c.current_price,
    change24h: c.price_change_percentage_24h,
    change7d: c.price_change_percentage_7d_in_currency ?? null,
    change30d: c.price_change_percentage_30d_in_currency ?? null,
    volume24h: c.total_volume,
    marketCap: c.market_cap,
    sentiment,
    aiScore: Math.round(score),
    momentum: cls,
    momentumReason: reason,
    mentionCount: mentionCount || undefined,
  }
}

function analyzeNews(noticias: NoticiaProcessada[]): TendenciasNewsInsight {
  let positivo = 0
  let neutro = 0
  let negativo = 0
  const mentionMap = new Map<string, number>()

  for (const n of noticias.slice(0, 80)) {
    if (n.impacto === 'POSITIVO') positivo++
    else if (n.impacto === 'NEGATIVO') negativo++
    else neutro++

    const text = `${n.titulo} ${n.resumo}`
    const matches = text.match(SYMBOL_FROM_TEXT) ?? []
    for (const m of matches) {
      const sym = m.toUpperCase()
      mentionMap.set(sym, (mentionMap.get(sym) ?? 0) + 1)
    }
    for (const a of n.ativos ?? []) {
      if (a === 'ALTCOINS') continue
      const sym = a === 'MERCADO GLOBAL' ? 'MKT' : a
      mentionMap.set(sym, (mentionMap.get(sym) ?? 0) + 1)
    }
  }

  const topMentions = [...mentionMap.entries()]
    .filter(([s]) => s !== 'MKT')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([symbol, count]) => ({ symbol, count }))

  const headlines = noticias.slice(0, 6).map((n) => ({
    titulo: n.titulo,
    impacto: n.impacto,
    categoria: n.categoria,
    link: n.link,
  }))

  return {
    positivo,
    neutro,
    negativo,
    topMentions,
    dominantNarrative: null,
    headlines,
  }
}

function buildNarratives(noticias: NoticiaProcessada[]): TendenciasNarrative[] {
  const out: TendenciasNarrative[] = []
  const corpus = noticias.map((n) => `${n.titulo} ${n.resumo}`).join('\n')

  for (const rule of NARRATIVE_RULES) {
    const hits = noticias.filter((n) => rule.keywords.test(`${n.titulo} ${n.resumo}`))
    if (!hits.length) continue

    let pos = 0
    let neg = 0
    for (const h of hits) {
      if (h.impacto === 'POSITIVO') pos++
      else if (h.impacto === 'NEGATIVO') neg++
    }
    const sentiment = scoreToSentiment(50 + (pos - neg) * 12)
    const intensity = clamp(hits.length * 12 + (rule.keywords.test(corpus) ? 10 : 0), 0, 100)

    out.push({
      id: rule.id,
      label: rule.label,
      summary: buildNarrativeSummary(rule.label, hits.length, sentiment, pos, neg),
      impact: intensity >= 60 ? 'alto' : intensity >= 30 ? 'medio' : 'baixo',
      sentiment,
      relatedSymbols: rule.related,
      mentionCount: hits.length,
      intensity,
    })
  }

  return out.sort((a, b) => b.intensity - a.intensity).slice(0, 8)
}

function buildNarrativeSummary(
  label: string,
  count: number,
  sentiment: SentimentLevel,
  pos: number,
  neg: number
): string {
  const tone =
    sentiment === 'optimista'
      ? 'tom construtivo'
      : sentiment === 'pessimista'
        ? 'tom cauteloso'
        : 'tom misto'
  return `${label} aparece em ${count} notícia${count === 1 ? '' : 's'} recentes, com ${tone} (${pos} positivas, ${neg} negativas).`
}

function buildMarketPanel(
  global: RawGlobal | null,
  markets: RawMarketCoin[],
  news: TendenciasNewsInsight,
  narratives: TendenciasNarrative[]
): TendenciasMarketPanel {
  const changes = markets.map((m) => m.price_change_percentage_24h ?? 0).filter(Number.isFinite)
  const avgChange = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : 0
  const gainers = changes.filter((c) => c > 1).length
  const losers = changes.filter((c) => c < -1).length

  const newsScore = 50 + (news.positivo - news.negativo) * 4
  const marketScore = 50 + avgChange * 2
  const sentimentScore = clamp(Math.round(newsScore * 0.45 + marketScore * 0.55), 0, 100)

  const dominant = narratives[0]?.label ?? news.topMentions[0]?.symbol ?? null

  return {
    sentiment: scoreToSentiment(sentimentScore),
    sentimentScore,
    btcDominance: global?.market_cap_percentage?.btc ?? null,
    totalVolume24h: global?.total_volume?.usd ?? null,
    totalMarketCap: global?.total_market_cap?.usd ?? null,
    marketCapChange24h: global?.market_cap_change_percentage_24h_usd ?? null,
    trendIndex: clamp(Math.round(sentimentScore + avgChange * 3), 0, 100),
    dominantNarrative: dominant,
    gainersCount: gainers,
    losersCount: losers,
  }
}

function buildObserveToday(
  market: TendenciasMarketPanel,
  narratives: TendenciasNarrative[],
  buckets: TendenciasTokenBuckets
): string {
  const parts: string[] = []
  const mood =
    market.sentiment === 'optimista'
      ? 'O mercado apresenta tom construtivo'
      : market.sentiment === 'pessimista'
        ? 'O mercado opera em modo defensivo'
        : 'O mercado mantém-se equilibrado'

  parts.push(
    `${mood} (índice ${market.trendIndex}/100). ${market.gainersCount} ativos em alta vs ${market.losersCount} em queda nas últimas 24h.`
  )

  if (market.btcDominance != null) {
    parts.push(`Dominância do Bitcoin: ${market.btcDominance.toFixed(1)}%.`)
  }

  if (narratives[0]) {
    parts.push(`Narrativa dominante: ${narratives[0].label} — ${narratives[0].summary}`)
  }

  const accel = buckets.acelerando[0]
  if (accel) {
    parts.push(`Momentum: ${accel.symbol} destaca-se (${accel.momentumReason})`)
  }

  return parts.join(' ')
}

function buildAlerts(
  markets: RawMarketCoin[],
  buckets: TendenciasTokenBuckets,
  news: TendenciasNewsInsight
): TendenciasAlert[] {
  const alerts: TendenciasAlert[] = []

  const volSpike = [...markets]
    .filter((m) => m.market_cap && m.total_volume)
    .sort((a, b) => (b.total_volume! / b.market_cap!) - (a.total_volume! / a.market_cap!))
    .slice(0, 1)[0]

  if (volSpike && volSpike.market_cap! > 0) {
    const ratio = volSpike.total_volume! / volSpike.market_cap!
    if (ratio > 0.2) {
      alerts.push({
        id: `vol-${volSpike.id}`,
        type: 'volume',
        title: `Volume elevado — ${volSpike.symbol.toUpperCase()}`,
        detail: `Rácio volume/cap de ${(ratio * 100).toFixed(0)}% nas últimas 24h.`,
        severity: ratio > 0.35 ? 'urgent' : 'watch',
        symbol: volSpike.symbol.toUpperCase(),
      })
    }
  }

  if (news.negativo > news.positivo * 1.5 && news.negativo >= 3) {
    alerts.push({
      id: 'sent-neg',
      type: 'sentimento',
      title: 'Sentimento de notícias mais negativo',
      detail: `${news.negativo} notícias negativas vs ${news.positivo} positivas no recorte recente.`,
      severity: 'watch',
    })
  }

  const topMention = news.topMentions[0]
  if (topMention && topMention.count >= 3) {
    alerts.push({
      id: `mention-${topMention.symbol}`,
      type: 'mencoes',
      title: `${topMention.symbol} muito comentado`,
      detail: `${topMention.count} menções no feed de notícias analisado.`,
      severity: 'info',
      symbol: topMention.symbol,
    })
  }

  for (const t of buckets.acelerando.slice(0, 2)) {
    alerts.push({
      id: `mom-${t.id}`,
      type: 'momentum',
      title: `Tendência acelerando — ${t.symbol}`,
      detail: t.momentumReason,
      severity: 'info',
      symbol: t.symbol,
    })
  }

  for (const u of buckets.proximosUnlocks.slice(0, 2)) {
    alerts.push({
      id: `unlock-${u.symbol}`,
      type: 'unlock',
      title: `Unlock próximo — ${u.symbol}`,
      detail: u.unlockAt
        ? `Desbloqueio previsto em ${new Date(u.unlockAt).toLocaleDateString('pt-PT')}.`
        : 'Token com supply pendente relevante.',
      severity: 'watch',
      symbol: u.symbol,
    })
  }

  return alerts.slice(0, 8)
}

function mergeMentions(
  markets: RawMarketCoin[],
  trending: RawTrending[],
  news: TendenciasNewsInsight
): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of trending) {
    map.set(t.symbol, (map.get(t.symbol) ?? 0) + t.score * 2)
  }
  for (const m of news.topMentions) {
    map.set(m.symbol, (map.get(m.symbol) ?? 0) + m.count * 3)
  }
  for (const c of markets.slice(0, 30)) {
    map.set(c.symbol.toUpperCase(), map.get(c.symbol.toUpperCase()) ?? 0)
  }
  return map
}

export function buildTendenciasPayload(input: {
  markets: RawMarketCoin[]
  global: RawGlobal | null
  trending: RawTrending[]
  noticias: NoticiaProcessada[]
  unlocks?: TendenciasTokenBuckets['proximosUnlocks']
  partial?: boolean
  error?: string | null
}): TendenciasApiResponse {
  const news = analyzeNews(input.noticias)
  const narratives = buildNarratives(input.noticias)
  if (narratives[0]) news.dominantNarrative = narratives[0].label

  const mentions = mergeMentions(input.markets, input.trending, news)
  const rows = input.markets.map((c) =>
    tokenRow(c, mentions.get(c.symbol.toUpperCase()) ?? 0)
  )

  const byChange = (dir: 'up' | 'down') =>
    [...rows]
      .filter((r) => r.change24h != null)
      .sort((a, b) => (dir === 'up' ? b.change24h! - a.change24h! : a.change24h! - b.change24h!))

  const byVolume = [...rows]
    .filter((r) => r.volume24h != null)
    .sort((a, b) => b.volume24h! - a.volume24h!)

  const byMentions = [...rows]
    .sort((a, b) => (b.mentionCount ?? 0) - (a.mentionCount ?? 0))

  const buckets: TendenciasTokenBuckets = {
    maisComentados: byMentions.slice(0, 8),
    maisPositivos: byChange('up').slice(0, 8),
    maisNegativos: byChange('down').slice(0, 8),
    maiorVolume: byVolume.slice(0, 8),
    acelerando: rows.filter((r) => r.momentum === 'acelerando').slice(0, 8),
    desacelerando: rows.filter((r) => r.momentum === 'fraco').slice(0, 8),
    proximosUnlocks: input.unlocks ?? [],
  }

  const market = buildMarketPanel(input.global, input.markets, news, narratives)

  return {
    updatedAt: new Date().toISOString(),
    market,
    observeToday: buildObserveToday(market, narratives, buckets),
    news,
    narratives,
    buckets,
    alerts: buildAlerts(input.markets, buckets, news),
    partial: input.partial ?? false,
    error: input.error ?? null,
  }
}
