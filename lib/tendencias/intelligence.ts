import type { NoticiaProcessada } from '@/lib/newsdata'
import type {
  AnalysisTone,
  MomentumClass,
  MomentumPeriod,
  SentimentLevel,
  TendenciasAlert,
  TendenciasApiResponse,
  TendenciasDefiPanel,
  TendenciasMarketPanel,
  TendenciasNarrative,
  TendenciasNarrativeId,
  TendenciasNewsInsight,
  TendenciasTokenBuckets,
  TendenciasTokenRow,
} from '@/lib/tendencias/types'
import type { RawGlobal, RawMarketCoin, RawTrending } from '@/lib/tendencias/fetch-data'
import { enrichTvlGlobalFromChains, type RawChainTvl, type RawYieldPool } from '@/lib/tendencias/fetch-defi'

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

const MOMENTUM_LABEL: Record<MomentumClass, string> = {
  acelerando: 'Acelerando',
  estavel: 'Estável',
  fraco: 'Fraco',
  reversao: 'Reversão possível',
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function scoreToSentiment(score: number): SentimentLevel {
  if (score >= 62) return 'optimista'
  if (score <= 38) return 'pessimista'
  return 'neutro'
}

function impactToSentiment(impacto: string): SentimentLevel {
  if (impacto === 'POSITIVO') return 'optimista'
  if (impacto === 'NEGATIVO') return 'pessimista'
  return 'neutro'
}

function periodChange(c: RawMarketCoin, period: MomentumPeriod): number {
  if (period === '24h') {
    return c.price_change_percentage_24h ?? 0
  }
  if (period === '7d') {
    return c.price_change_percentage_7d_in_currency ?? c.price_change_percentage_24h ?? 0
  }
  if (period === '30d') {
    return c.price_change_percentage_30d_in_currency ?? c.price_change_percentage_7d_in_currency ?? 0
  }
  return (
    c.price_change_percentage_200d_in_currency ??
    c.price_change_percentage_30d_in_currency ??
    c.price_change_percentage_7d_in_currency ??
    0
  )
}

function classifyMomentum(
  c: RawMarketCoin,
  period: MomentumPeriod,
  mentionBoost: number
): { cls: MomentumClass; reason: string; score: number; strength: number } {
  const c24 = c.price_change_percentage_24h ?? 0
  const cp = periodChange(c, period)
  const c7 = c.price_change_percentage_7d_in_currency ?? c24
  const c30 = c.price_change_percentage_30d_in_currency ?? c7
  const vol = c.total_volume ?? 0
  const mcap = c.market_cap ?? 1
  const volRatio = vol / mcap

  let score = 50
  score += clamp(cp * 1.1, -30, 30)
  score += clamp(c24 * 0.5, -12, 12)
  if (volRatio > 0.15) score += 8
  if (volRatio > 0.25) score += 5
  if (mentionBoost > 3) score += 6
  score = clamp(score, 0, 100)

  const strength = clamp(Math.abs(cp) + volRatio * 40 + mentionBoost * 2, 0, 100)
  const sym = c.symbol.toUpperCase()
  const periodLabel =
    period === '24h' ? '24 horas' : period === '90d' ? 'longo prazo (~200d)' : period

  if (cp > 6 && c24 > 2 && (period === '7d' ? c24 >= cp * 0.4 : cp > c7 * 0.5)) {
    return {
      cls: 'acelerando',
      score,
      strength,
      reason: `${sym} apresenta aceleração positiva em ${periodLabel} (+${cp.toFixed(1)}%) com volume ${volRatio > 0.15 ? 'elevado' : 'estável'}${mentionBoost > 2 ? ' e aumento de menções no feed' : ''}.`,
    }
  }
  if (cp < -6 && c24 < -2) {
    return {
      cls: 'fraco',
      score,
      strength,
      reason: `${sym} perde força em ${periodLabel} (${cp.toFixed(1)}%) com pressão vendedora nas últimas 24h.`,
    }
  }
  if (cp < -8 && c24 > 4) {
    return {
      cls: 'reversao',
      score,
      strength,
      reason: `Possível reversão em ${sym}: recuperação de 24h (+${c24.toFixed(1)}%) após queda de ${periodLabel} (${cp.toFixed(1)}%).`,
    }
  }
  return {
    cls: 'estavel',
    score,
    strength,
    reason: `${sym} mantém movimento lateral — ${periodLabel} ${cp >= 0 ? '+' : ''}${cp.toFixed(1)}%, 24h ${c24 >= 0 ? '+' : ''}${c24.toFixed(1)}%.`,
  }
}

function tokenRow(
  c: RawMarketCoin,
  period: MomentumPeriod,
  mentionCount = 0
): TendenciasTokenRow {
  const { cls, reason, score, strength } = classifyMomentum(c, period, mentionCount)
  const c24 = c.price_change_percentage_24h ?? 0
  const cp = periodChange(c, period)
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
    changePeriod: cp,
    volume24h: c.total_volume,
    marketCap: c.market_cap,
    sentiment,
    aiScore: Math.round(score),
    momentum: cls,
    momentumLabel: MOMENTUM_LABEL[cls],
    momentumReason: reason,
    strength: Math.round(strength),
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

  const headlines = noticias.slice(0, 8).map((n) => {
    const text = `${n.titulo} ${n.resumo}`
    const mentionCount = (text.match(SYMBOL_FROM_TEXT) ?? []).length
    const intensity = clamp(
      (n.isBreaking ? 40 : 0) + (n.confianca === 'ALTA' ? 25 : 12) + mentionCount * 8,
      0,
      100
    )
    const relevance = clamp(intensity + (n.impacto !== 'NEUTRO' ? 15 : 0), 0, 100)
    return {
      titulo: n.titulo,
      impacto: n.impacto,
      categoria: n.categoria,
      link: n.link,
      sentiment: impactToSentiment(n.impacto),
      relevance,
      intensity,
      mentionCount,
    }
  })

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
  return `${label} lidera o ciclo informativo com ${count} menção${count === 1 ? '' : 'ões'} recentes (${tone}; ${pos} positivas, ${neg} negativas).`
}

function buildMarketPanel(
  global: RawGlobal | null,
  markets: RawMarketCoin[],
  news: TendenciasNewsInsight,
  narratives: TendenciasNarrative[],
  tone: AnalysisTone
): TendenciasMarketPanel {
  const changes = markets.map((m) => m.price_change_percentage_24h ?? 0).filter(Number.isFinite)
  const avgChange = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : 0
  const gainers = changes.filter((c) => c > 1).length
  const losers = changes.filter((c) => c < -1).length

  const toneBias = tone === 'conservador' ? -4 : tone === 'agressivo' ? 4 : 0
  const newsScore = 50 + (news.positivo - news.negativo) * 4 + toneBias
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

function buildDefiPanel(
  chains: RawChainTvl[],
  pools: RawYieldPool[],
  tvlGlobalIn: { current: number | null; changePct: number | null }
): TendenciasDefiPanel {
  const tvlGlobal = enrichTvlGlobalFromChains(tvlGlobalIn, chains)
  const topProtocols = pools.map((p) => {
    const tvl = p.tvlUsd ?? null
    const apy = p.apy ?? null
    let interpretation = `${p.project} mantém presença relevante em ${p.chain ?? 'multi-chain'}.`
    if (tvl != null && tvl > 500_000_000 && apy != null && apy > 5) {
      interpretation = `${p.project} combina TVL elevado (${(tvl / 1e9).toFixed(2)}B USD) com yield activo (~${apy.toFixed(1)}% APY).`
    } else if (tvl != null && tvl > 1_000_000_000) {
      interpretation = `${p.project} concentra liquidez significativa — sinal de confiança estrutural no protocolo.`
    }
    return {
      name: p.project ?? 'Protocolo',
      chain: p.chain ?? '—',
      tvlUsd: tvl,
      apy: apy,
      symbol: p.symbol ?? null,
      interpretation,
    }
  })

  const chg = tvlGlobal.changePct
  let summary = 'Dados DeFi indisponíveis neste momento.'
  if (tvlGlobal.current != null) {
    summary =
      chg != null
        ? `TVL agregado DeFi ~${(tvlGlobal.current / 1e9).toFixed(2)}B USD (${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% em 7d).`
        : `TVL agregado DeFi ~${(tvlGlobal.current / 1e9).toFixed(2)}B USD.`
    if (topProtocols[0]) {
      summary += ` ${topProtocols[0].interpretation}`
    }
  }

  return {
    totalTvlUsd: tvlGlobal.current,
    tvlChange7dPct: tvlGlobal.changePct,
    topChains: chains.map((c) => ({ name: c.name, tvlUsd: c.tvl })),
    topProtocols,
    summary,
  }
}

function buildObserveToday(
  market: TendenciasMarketPanel,
  narratives: TendenciasNarrative[],
  buckets: TendenciasTokenBuckets,
  defi: TendenciasDefiPanel,
  period: MomentumPeriod
): string {
  const parts: string[] = []
  const mood =
    market.sentiment === 'optimista'
      ? 'O mercado apresenta tom construtivo'
      : market.sentiment === 'pessimista'
        ? 'O mercado opera em modo defensivo'
        : 'O mercado mantém-se equilibrado'

  parts.push(
    `${mood} (índice ${market.trendIndex}/100). ${market.gainersCount} ativos em alta vs ${market.losersCount} em queda (24h). Análise de momentum: janela ${period}.`
  )

  if (market.btcDominance != null) {
    parts.push(`Dominância BTC: ${market.btcDominance.toFixed(1)}%.`)
  }

  if (narratives[0]) {
    parts.push(`Narrativa dominante: ${narratives[0].label}.`)
  }

  const accel = buckets.acelerando[0]
  if (accel) {
    parts.push(accel.momentumReason)
  }

  if (defi.tvlChange7dPct != null && Math.abs(defi.tvlChange7dPct) > 2) {
    parts.push(
      `DeFi: TVL ${defi.tvlChange7dPct >= 0 ? 'expande' : 'contrai'} ${Math.abs(defi.tvlChange7dPct).toFixed(1)}% na semana.`
    )
  }

  return parts.join(' ')
}

function buildAlerts(
  markets: RawMarketCoin[],
  buckets: TendenciasTokenBuckets,
  news: TendenciasNewsInsight,
  defi: TendenciasDefiPanel
): TendenciasAlert[] {
  const alerts: TendenciasAlert[] = []

  const volSpike = [...markets]
    .filter((m) => m.market_cap && m.total_volume)
    .sort((a, b) => b.total_volume! / b.market_cap! - a.total_volume! / a.market_cap!)
    .slice(0, 1)[0]

  if (volSpike?.market_cap && volSpike.total_volume) {
    const ratio = volSpike.total_volume / volSpike.market_cap
    if (ratio > 0.2) {
      alerts.push({
        id: `vol-${volSpike.id}`,
        type: 'volume',
        title: `Volume elevado — ${volSpike.symbol.toUpperCase()}`,
        detail: `Rácio volume/cap ${(ratio * 100).toFixed(0)}% (24h).`,
        severity: ratio > 0.35 ? 'urgent' : 'watch',
        symbol: volSpike.symbol.toUpperCase(),
      })
    }
  }

  for (const m of markets.slice(0, 50)) {
    if (!m.current_price || !m.high_24h || m.high_24h <= 0) continue
    const dist = ((m.high_24h - m.current_price) / m.high_24h) * 100
    if (dist >= 0 && dist <= 1.5 && (m.price_change_percentage_24h ?? 0) > 3) {
      alerts.push({
        id: `breakout-${m.id}`,
        type: 'breakout',
        title: `Rompimento — ${m.symbol.toUpperCase()}`,
        detail: `Preço a testar máxima de 24h (${dist.toFixed(1)}% abaixo do topo).`,
        severity: 'watch',
        symbol: m.symbol.toUpperCase(),
      })
      break
    }
  }

  if (news.negativo > news.positivo * 1.5 && news.negativo >= 3) {
    alerts.push({
      id: 'sent-neg',
      type: 'sentimento',
      title: 'Sentimento de notícias mais negativo',
      detail: `${news.negativo} negativas vs ${news.positivo} positivas.`,
      severity: 'watch',
    })
  }

  const topMention = news.topMentions[0]
  if (topMention && topMention.count >= 3) {
    alerts.push({
      id: `mention-${topMention.symbol}`,
      type: 'mencoes',
      title: `${topMention.symbol} muito comentado`,
      detail: `${topMention.count} menções no feed.`,
      severity: 'info',
      symbol: topMention.symbol,
    })
  }

  for (const t of buckets.acelerando.slice(0, 2)) {
    alerts.push({
      id: `mom-${t.id}`,
      type: 'momentum',
      title: `${t.symbol} — ${t.momentumLabel}`,
      detail: t.momentumReason,
      severity: 'info',
      symbol: t.symbol,
    })
  }

  for (const u of buckets.proximosUnlocks.slice(0, 2)) {
    alerts.push({
      id: `unlock-${u.symbol}`,
      type: 'unlock',
      title: `Unlock — ${u.symbol}`,
      detail: u.unlockAt
        ? `Previsto ${new Date(u.unlockAt).toLocaleDateString('pt-PT')}.`
        : 'Supply pendente relevante.',
      severity: 'watch',
      symbol: u.symbol,
    })
  }

  if (defi.tvlChange7dPct != null && Math.abs(defi.tvlChange7dPct) > 4) {
    alerts.push({
      id: 'tvl-global',
      type: 'tvl',
      title: 'Movimento anormal de TVL DeFi',
      detail: `Variação de ${defi.tvlChange7dPct >= 0 ? '+' : ''}${defi.tvlChange7dPct.toFixed(1)}% em 7 dias.`,
      severity: Math.abs(defi.tvlChange7dPct) > 8 ? 'urgent' : 'watch',
    })
  }

  return alerts.slice(0, 10)
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

function periodSortKey(r: TendenciasTokenRow, dir: 'up' | 'down') {
  const v = r.changePeriod ?? r.change24h ?? 0
  return dir === 'up' ? -v : v
}

export function buildTendenciasPayload(input: {
  markets: RawMarketCoin[]
  global: RawGlobal | null
  trending: RawTrending[]
  noticias: NoticiaProcessada[]
  unlocks?: TendenciasTokenBuckets['proximosUnlocks']
  defiChains?: RawChainTvl[]
  defiPools?: RawYieldPool[]
  defiTvlGlobal?: { current: number | null; changePct: number | null }
  period?: MomentumPeriod
  tone?: AnalysisTone
  partial?: boolean
  error?: string | null
}): TendenciasApiResponse {
  const period = input.period ?? '7d'
  const tone = input.tone ?? 'neutro'
  const news = analyzeNews(input.noticias)
  const narratives = buildNarratives(input.noticias)
  if (narratives[0]) news.dominantNarrative = narratives[0].label

  const mentions = mergeMentions(input.markets, input.trending, news)
  const rows = input.markets.map((c) =>
    tokenRow(c, period, mentions.get(c.symbol.toUpperCase()) ?? 0)
  )

  const byPeriodChange = (dir: 'up' | 'down') =>
    [...rows]
      .filter((r) => r.changePeriod != null || r.change24h != null)
      .sort((a, b) => periodSortKey(a, dir) - periodSortKey(b, dir))

  const byVolume = [...rows]
    .filter((r) => r.volume24h != null)
    .sort((a, b) => b.volume24h! - a.volume24h!)

  const byMentions = [...rows].sort((a, b) => (b.mentionCount ?? 0) - (a.mentionCount ?? 0))

  const buckets: TendenciasTokenBuckets = {
    maisComentados: byMentions.slice(0, 8),
    maisPositivos: byPeriodChange('up').slice(0, 8),
    maisNegativos: byPeriodChange('down').slice(0, 8),
    maiorVolume: byVolume.slice(0, 8),
    acelerando: rows.filter((r) => r.momentum === 'acelerando').slice(0, 8),
    desacelerando: rows
      .filter((r) => r.momentum === 'fraco' || r.momentum === 'reversao')
      .slice(0, 8),
    proximosUnlocks: input.unlocks ?? [],
  }

  const defi = buildDefiPanel(
    input.defiChains ?? [],
    input.defiPools ?? [],
    input.defiTvlGlobal ?? { current: null, changePct: null }
  )

  const market = buildMarketPanel(input.global, input.markets, news, narratives, tone)

  return {
    updatedAt: new Date().toISOString(),
    meta: {
      momentumPeriod: period,
      analysisTone: tone,
      llmEnabled: Boolean(process.env.OPENAI_API_KEY?.trim()),
      llmUsed: false,
      fmpConfigured: Boolean(process.env.FMP_API_KEY?.trim()),
    },
    market,
    observeToday: buildObserveToday(market, narratives, buckets, defi, period),
    news,
    narratives,
    buckets,
    defi,
    alerts: buildAlerts(input.markets, buckets, news, defi),
    partial: input.partial ?? false,
    error: input.error ?? null,
  }
}
