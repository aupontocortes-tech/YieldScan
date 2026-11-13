import {
  nomeRedeVisivel,
  narrativaCategoriaPt,
  sobreProtocoloPt,
  sobreTokenNativoPt,
} from '@/lib/tendencias/crypto-pt'
import { geckoIdFromSymbol } from '@/lib/tendencias/gecko-ids'
import type { RawMarketCoin } from '@/lib/tendencias/fetch-data'
import type { DexVolumeByChain, RawLlamaChain, RawLlamaProtocol } from '@/lib/tendencias/fetch-l1'
import type { TendenciasL1Panel, TendenciasL1Token, TendenciasNetworkRow } from '@/lib/tendencias/types'

const L1_NAMES = new Set(
  [
    'Ethereum',
    'Solana',
    'Bitcoin',
    'BSC',
    'Binance',
    'Avalanche',
    'Cardano',
    'Sui',
    'Aptos',
    'Near',
    'Tron',
    'TON',
    'Cosmos',
    'Polkadot',
    'Fantom',
    'Sonic',
    'Sei',
    'Injective',
    'Algorand',
    'Hedera',
    'ICP',
    'Internet Computer',
    'Cronos',
    'Hyperliquid',
    'Hyperliquid L1',
    'Monad',
    'Berachain',
    'Kaia',
    'Klaytn',
    'MultiversX',
    'Elrond',
    'Stellar',
    'Ripple',
    'Osmosis',
    'Celestia',
    'Stacks',
    'Core',
    'Flare',
    'Kava',
    'Celo',
    'Gnosis',
    'PulseChain',
    'Rootstock',
    'Bitcoin Cash',
    'Litecoin',
    'Dogecoin',
    'WEMIX',
    'OKTChain',
    'Harmony',
    'Neo',
    'Tezos',
    'EOS',
    'Flow',
    'Hedera Hashgraph',
  ].map((s) => s.toLowerCase()),
)

const L2_NAMES = new Set(
  [
    'Arbitrum',
    'Optimism',
    'Base',
    'Polygon',
    'Polygon zkEVM',
    'zkSync Era',
    'zkSync',
    'Scroll',
    'Linea',
    'Mantle',
    'Blast',
    'Mode',
    'Starknet',
    'Manta',
    'Fraxtal',
    'Unichain',
    'opBNB',
    'Immutable zkEVM',
    'World Chain',
    'Zora',
    'Taiko',
    'Scroll',
    'Metis',
    'Boba',
    'zkLink Nova',
    'Abstract',
    'Ink',
  ].map((s) => s.toLowerCase()),
)

function chainKey(name: string): string {
  return name.toLowerCase().replace(/\s+l1$/, '').trim()
}

function chainKind(name: string): 'l1' | 'l2' | 'outra' {
  const k = name.toLowerCase()
  const key = chainKey(name)
  if (L2_NAMES.has(k) || L2_NAMES.has(key)) return 'l2'
  if (L1_NAMES.has(k) || L1_NAMES.has(key)) return 'l1'
  return 'outra'
}

function dexVolumeFor(name: string, dexVolume: DexVolumeByChain): number {
  const aliases = [name, name.replace(/\s+L1$/i, ''), chainKey(name)]
  for (const a of aliases) {
    const v = dexVolume[a] ?? dexVolume[a.replace(/\b\w/g, (c) => c.toUpperCase())]
    if (typeof v === 'number' && v > 0) return v
  }
  if (/hyperliquid/i.test(name)) {
    for (const [k, v] of Object.entries(dexVolume)) {
      if (/hyperliquid/i.test(k) && v > 0) return v
    }
  }
  return 0
}

function pctChange(current: number, prev: number | null): number | null {
  if (prev == null || prev <= 0) return null
  return ((current - prev) / prev) * 100
}

function narrativeForCategory(category: string): string {
  return narrativaCategoriaPt(category)
}

function aboutForProtocol(p: RawLlamaProtocol): string {
  return sobreProtocoloPt(p.name, p.category)
}

function percentile(value: number, all: number[]): number {
  if (!all.length) return 50
  const sorted = [...all].sort((a, b) => a - b)
  let below = 0
  for (const v of sorted) {
    if (v < value) below++
  }
  return Math.round((below / sorted.length) * 100)
}

function nativeAbout(chain: string, symbol: string | null): string {
  return sobreTokenNativoPt(chain, symbol)
}

function buyable(token: TendenciasL1Token): boolean {
  if (token.tvlUsd < 5_000_000) return false
  if (token.change7d != null && Math.abs(token.change7d) > 120) return false
  if (token.category === 'Bridge' || token.category === 'CEX') return false
  if (!token.about || token.about.length < 24) return false
  return true
}

function resolveGeckoId(
  p: { geckoId: string | null; symbol: string | null },
  market: RawMarketCoin | undefined,
): string | null {
  if (market?.id) return market.id
  const fromSym = geckoIdFromSymbol(p.symbol) ?? geckoIdFromSymbol(market?.symbol)
  if (fromSym) return fromSym
  return p.geckoId
}

function nichesFor(category: string, buyback: boolean): string[] {
  const cat = narrativaCategoriaPt(category)
  const out: string[] = []
  if (buyback) out.push('Recompra')
  if (cat && !out.includes(cat)) out.push(cat)
  return out.slice(0, 3)
}

export function buildL1Panel(input: {
  chains: RawLlamaChain[]
  protocols: RawLlamaProtocol[]
  dexVolume: DexVolumeByChain
  markets: RawMarketCoin[]
  newsNarrative: string | null
  buybackGeckoIds?: string[]
  buybackSymbols?: string[]
}): TendenciasL1Panel {
  const { chains, protocols, dexVolume, markets, newsNarrative } = input
  const marketByGecko = new Map(markets.map((m) => [m.id, m]))
  const marketBySymbol = new Map(markets.map((m) => [m.symbol.toUpperCase(), m]))
  const buyGecko = new Set((input.buybackGeckoIds ?? []).filter(Boolean))
  const buySym = new Set((input.buybackSymbols ?? []).map((s) => s.toUpperCase()))

  const MIN_TVL_FLOW = 80_000_000
  const tvlVals = chains.map((c) => c.tvl)
  const volVals = chains.map((c) => dexVolume[c.name] ?? 0)
  const chg7Vals = chains.map((c) => pctChange(c.tvl, c.tvlPrevWeek) ?? 0)
  const chg1Vals = chains.map((c) => pctChange(c.tvl, c.tvlPrevDay) ?? 0)
  const turnoverVals = chains.map((c) => {
    const vol = dexVolume[c.name] ?? 0
    return c.tvl > 0 ? vol / c.tvl : 0
  })

  const networks: TendenciasNetworkRow[] = chains.map((c) => {
    const kind = chainKind(c.name)
    const volume24h = dexVolumeFor(c.name, dexVolume)
    const tvlChange7dPct = pctChange(c.tvl, c.tvlPrevWeek)
    const tvlChange1dPct = pctChange(c.tvl, c.tvlPrevDay)
    const nativeMarket =
      (c.geckoId ? marketByGecko.get(c.geckoId) : undefined) ??
      (c.tokenSymbol ? marketBySymbol.get(c.tokenSymbol.toUpperCase()) : undefined)
    const nativeChange7d =
      nativeMarket?.price_change_percentage_7d_in_currency ??
      nativeMarket?.price_change_percentage_24h ??
      null

    const tvlFlow7dUsd =
      c.tvlPrevWeek != null && c.tvlPrevWeek > 0 ? c.tvl - c.tvlPrevWeek : null
    const turnover = c.tvl > 0 ? volume24h / c.tvl : 0
    const tvlP = percentile(c.tvl, tvlVals)
    const volP = percentile(volume24h, volVals)
    const chg7P = percentile(tvlChange7dPct ?? 0, chg7Vals)
    const chg1P = percentile(tvlChange1dPct ?? 0, chg1Vals)
    const turnP = percentile(turnover, turnoverVals)
    const tokP = nativeChange7d == null ? 50 : Math.max(0, Math.min(100, 50 + nativeChange7d))
    /** Tamanho do cofre — só contexto, não decide o vencedor. */
    const adoptionScore = Math.round(tvlP * 0.55 + volP * 0.45)
    /** Fluxo: TVL a entrar/sair + actividade + token nativo. Ignora o tamanho. */
    const tooSmall = c.tvl < MIN_TVL_FLOW
    const flowScore = tooSmall
      ? 0
      : Math.round(chg7P * 0.45 + chg1P * 0.2 + turnP * 0.2 + tokP * 0.15)

    const chainAliases = [c.name, c.name.replace(/\s+L1$/i, ''), chainKey(c.name)]
    const onChain = protocols.filter((p) => {
      if (chainAliases.some((a) => p.chains.includes(a))) return true
      if (chainAliases.some((a) => (p.chainTvls[a] ?? 0) > 0)) return true
      if (/hyperliquid/i.test(c.name)) {
        return (
          p.chains.some((ch) => /hyperliquid/i.test(ch)) ||
          Object.entries(p.chainTvls).some(([k, v]) => /hyperliquid/i.test(k) && v > 0)
        )
      }
      return false
    })
    const narrativeCount = new Map<string, number>()
    for (const p of onChain) {
      const n = narrativeForCategory(p.category)
      narrativeCount.set(n, (narrativeCount.get(n) ?? 0) + p.tvl)
    }
    const chainNarratives = [...narrativeCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label]) => label)
    if (newsNarrative && kind === 'l1') {
      const already = chainNarratives.some((n) => n.toLowerCase() === newsNarrative.toLowerCase())
      if (!already) chainNarratives.unshift(newsNarrative)
    }

    const tokens: TendenciasL1Token[] = []
    if (nativeMarket || c.tokenSymbol) {
      const nativeSym = (nativeMarket?.symbol ?? c.tokenSymbol ?? c.name).toUpperCase()
      tokens.push({
        name: nativeMarket?.name ?? nomeRedeVisivel(c.name),
        symbol: nativeSym,
        geckoId: nativeMarket?.id ?? c.geckoId ?? geckoIdFromSymbol(nativeSym),
        protocol: c.name,
        category: 'Chain',
        narrative: 'Camada 1',
        niches: nichesFor('Chain', buyGecko.has(nativeMarket?.id ?? c.geckoId ?? '') || buySym.has(nativeSym)),
        tvlUsd: c.tvl,
        change7d: nativeChange7d,
        volume24h: nativeMarket?.total_volume ?? volume24h,
        about: nativeAbout(c.name, c.tokenSymbol),
        url: null,
        buyWatch: nativeChange7d != null && nativeChange7d > 0 && c.tvl >= MIN_TVL_FLOW,
      })
    }

    const seen = new Set(tokens.map((t) => t.symbol))
    const rankedProtocols = [...onChain]
      .map((p) => {
        const tvlOnChain =
          chainAliases.reduce((best, a) => Math.max(best, p.chainTvls[a] ?? 0), 0) ||
          (p.chains.length === 1 ? p.tvl : 0)
        return { p, tvlOnChain }
      })
      .filter((x) => x.tvlOnChain >= 400_000)
      .sort((a, b) => b.tvlOnChain - a.tvlOnChain)
      .slice(0, 12)
    for (const { p, tvlOnChain } of rankedProtocols) {
      const m =
        (p.geckoId ? marketByGecko.get(p.geckoId) : undefined) ??
        (p.symbol ? marketBySymbol.get(p.symbol.toUpperCase()) : undefined)
      const symbol = (m?.symbol ?? p.symbol ?? '').toUpperCase().slice(0, 16)
      if (!symbol || symbol === '-') continue
      if (seen.has(symbol)) continue
      if (/validator|\blst\b|sanctum/i.test(p.name) && !geckoIdFromSymbol(symbol) && !m) continue
      const geckoId = resolveGeckoId(p, m)
      if (!m && !geckoIdFromSymbol(symbol)) continue
      seen.add(symbol)
      const change7d =
        m?.price_change_percentage_7d_in_currency ?? p.change7d ?? m?.price_change_percentage_24h ?? null
      const isBuyback = Boolean(
        (geckoId && buyGecko.has(geckoId)) || buySym.has(symbol) || (p.geckoId && buyGecko.has(p.geckoId)),
      )
      const row: TendenciasL1Token = {
        name: p.name,
        symbol,
        geckoId,
        protocol: p.name,
        category: p.category,
        narrative: narrativeForCategory(p.category),
        niches: nichesFor(p.category, isBuyback),
        tvlUsd: tvlOnChain,
        change7d,
        volume24h: m?.total_volume ?? null,
        about: aboutForProtocol(p),
        url: p.url,
        buyWatch: false,
      }
      row.buyWatch = buyable(row)
      tokens.push(row)
    }

    tokens.sort((a, b) => {
      const pa = (a.tvlUsd ?? 0) + (a.volume24h ?? 0) * 0.35
      const pb = (b.tvlUsd ?? 0) + (b.volume24h ?? 0) * 0.35
      return pb - pa
    })

    return {
      name: nomeRedeVisivel(c.name),
      kind,
      tvlUsd: c.tvl,
      tvlChange7dPct,
      tvlChange1dPct,
      tvlFlow7dUsd,
      volume24h: volume24h > 0 ? volume24h : null,
      nativeSymbol: c.tokenSymbol,
      nativeGeckoId: nativeMarket?.id ?? c.geckoId,
      nativeChange7d,
      adoptionScore: Math.max(0, Math.min(100, adoptionScore)),
      flowScore: Math.max(0, Math.min(100, flowScore)),
      narratives: chainNarratives.slice(0, 4),
      tokens: tokens.slice(0, 10),
    }
  })

  networks.sort((a, b) => {
    if (a.kind === 'l1' && b.kind !== 'l1') return -1
    if (a.kind !== 'l1' && b.kind === 'l1') return 1
    if (b.flowScore !== a.flowScore) return b.flowScore - a.flowScore
    return (b.tvlChange7dPct ?? -999) - (a.tvlChange7dPct ?? -999)
  })

  const l1s = networks.filter((n) => n.kind === 'l1')
  const best = [...l1s].sort((a, b) => b.flowScore - a.flowScore)[0] ?? networks[0] ?? null
  const biggestVault = [...l1s].sort((a, b) => b.tvlUsd - a.tvlUsd)[0] ?? null
  const watchSeen = new Set<string>()
  const watch = networks
    .flatMap((n) => n.tokens.filter((t) => t.buyWatch).map((t) => ({ ...t, chain: n.name })))
    .sort((a, b) => (b.change7d ?? -999) - (a.change7d ?? -999))
    .filter((t) => {
      if (watchSeen.has(t.symbol)) return false
      watchSeen.add(t.symbol)
      return true
    })
    .slice(0, 8)

  let summary = 'Ainda não há dados de redes (DefiLlama).'
  if (best) {
    const chg =
      best.tvlChange7dPct != null
        ? ` O TVL ${best.tvlChange7dPct >= 0 ? 'está a entrar' : 'está a sair'}: ${best.tvlChange7dPct >= 0 ? '+' : ''}${best.tvlChange7dPct.toFixed(1)}% em 7 dias.`
        : ''
    const vault =
      biggestVault && biggestVault.name !== best.name
        ? ` ${biggestVault.name} continua a ser o maior cofre, mas não é a que mais cresce esta semana.`
        : biggestVault
          ? ` Também é o maior cofre (mais dinheiro parado).`
          : ''
    const tok =
      best.nativeSymbol && best.nativeChange7d != null
        ? ` Token nativo ${best.nativeSymbol}: ${best.nativeChange7d >= 0 ? '+' : ''}${best.nativeChange7d.toFixed(1)}% em 7d.`
        : ''
    summary = `${best.name} lidera o fluxo.${chg}${vault}${tok}`
  }

  return {
    summary,
    bestL1: best?.name ?? null,
    biggestVault: biggestVault?.name ?? null,
    newsNarrative,
    networks: networks.slice(0, 18),
    buyWatch: watch,
  }
}
