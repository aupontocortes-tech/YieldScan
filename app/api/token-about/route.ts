import { NextRequest, NextResponse } from 'next/server'
import { fetchCoingecko } from '@/lib/coingecko-server'
import { categoriaCoinGeckoPt } from '@/lib/tendencias/crypto-pt'
import { geckoIdFromSymbol } from '@/lib/tendencias/gecko-ids'
import { pareceIngles } from '@/lib/news-lang'
import { traduzirParaPortugues } from '@/lib/translate'

export const revalidate = 1800

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstSentences(text: string, maxChars = 420): string {
  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  let out = ''
  for (const p of parts) {
    if (out && out.length + p.length > maxChars) break
    out = out ? `${out} ${p}` : p
    if (out.length >= 220) break
  }
  return out || text.slice(0, maxChars)
}

async function pickAbout(desc: Record<string, string> | undefined): Promise<string | null> {
  if (!desc) return null
  const pt = stripHtml(desc.pt || desc['pt-br'] || '')
  if (pt) return firstSentences(pt)
  const en = stripHtml(desc.en || '')
  if (!en) return null
  const short = firstSentences(en)
  if (!pareceIngles(short)) return short
  const tr = await traduzirParaPortugues(short, 'en')
  return tr || short
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
}

function explainSupply(circ: number | null, total: number | null, max: number | null) {
  const cap = max ?? total
  if (circ == null) {
    return {
      issuedPct: null as number | null,
      leftPct: null as number | null,
      inflation: 'desconhecida' as const,
      headline: 'Não há dados de quantas moedas já existem.',
      detail: 'Sem este número não dá para julgar se ainda vão sair muitas moedas.',
    }
  }
  if (cap == null) {
    return {
      issuedPct: null,
      leftPct: null,
      inflation: 'alta' as const,
      headline: 'Não há tecto máximo.',
      detail:
        'Podem criar moedas novas para sempre. Isso é inflação: as tuas moedas podem valer menos se a oferta crescer depressa.',
    }
  }
  const issuedPct = Math.min(100, (circ / cap) * 100)
  const leftPct = Math.max(0, 100 - issuedPct)
  if (issuedPct >= 85) {
    return {
      issuedPct,
      leftPct,
      inflation: 'baixa' as const,
      headline: 'Quase todas as moedas já estão no mercado.',
      detail: `Já saíram cerca de ${issuedPct.toFixed(0)}%. Falta pouco para sair. Inflação futura tende a ser baixa.`,
    }
  }
  if (issuedPct >= 55) {
    return {
      issuedPct,
      leftPct,
      inflation: 'media' as const,
      headline: 'Ainda vai sair uma parte das moedas.',
      detail: `Já saíram cerca de ${issuedPct.toFixed(0)}%. Faltam ~${leftPct.toFixed(0)}%. Inflação média — vê se o projecto justifica as novas emissões.`,
    }
  }
  return {
    issuedPct,
    leftPct,
    inflation: 'alta' as const,
    headline: 'Ainda vão sair muitas moedas.',
    detail: `Só cerca de ${issuedPct.toFixed(0)}% está no mercado. Faltam ~${leftPct.toFixed(0)}%. Inflação alta: o preço pode diluir quando essas moedas forem libertadas.`,
  }
}

async function resolveCoinId(idRaw: string, symbolRaw: string): Promise<string | null> {
  const id = idRaw.trim().toLowerCase()
  if (id && /^[a-z0-9-]{2,80}$/.test(id)) return id
  const mapped = geckoIdFromSymbol(symbolRaw)
  if (mapped) return mapped
  const q = (symbolRaw || idRaw).trim()
  if (q.length < 2) return null
  const search = await fetchCoingecko(`/search?query=${encodeURIComponent(q.slice(0, 48))}`, {
    timeoutMs: 10_000,
  })
  if (!search.ok) return null
  const data = (await search.json()) as {
    coins?: Array<{ id?: string; symbol?: string; market_cap_rank?: number | null }>
  }
  const want = q.toUpperCase()
  const coins = data.coins ?? []
  const exact = coins.filter((c) => (c.symbol ?? '').toUpperCase() === want)
  const pick = [...exact].sort((a, b) => (a.market_cap_rank ?? 9_999) - (b.market_cap_rank ?? 9_999))[0] ?? coins[0]
  const found = pick?.id?.trim().toLowerCase()
  return found && /^[a-z0-9-]{2,80}$/.test(found) ? found : null
}

export async function GET(req: NextRequest) {
  const idRaw = req.nextUrl.searchParams.get('id') ?? ''
  const symbolRaw = req.nextUrl.searchParams.get('symbol') ?? ''

  try {
    let id = await resolveCoinId(idRaw, symbolRaw)
    if (!id) {
      return NextResponse.json({ about: null, error: 'moeda não encontrada' }, { status: 200 })
    }
    const coinUrl = (coinId: string) =>
      `/coins/${encodeURIComponent(coinId)}?localization=true&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`
    let res = await fetchCoingecko(coinUrl(id), { timeoutMs: 14_000 })
    if (!res.ok && symbolRaw) {
      const alt = geckoIdFromSymbol(symbolRaw) ?? (await resolveCoinId('', symbolRaw))
      if (alt && alt !== id) {
        id = alt
        res = await fetchCoingecko(coinUrl(id), { timeoutMs: 14_000 })
      }
    }
    if (!res.ok) {
      return NextResponse.json({ about: null, error: `CoinGecko ${res.status}` }, { status: 200 })
    }
    const data = (await res.json()) as {
      id?: string
      name?: string
      symbol?: string
      description?: Record<string, string>
      links?: { homepage?: string[] }
      categories?: string[]
      genesis_date?: string | null
      market_data?: {
        circulating_supply?: number
        total_supply?: number
        max_supply?: number
        market_cap?: { usd?: number }
        fully_diluted_valuation?: { usd?: number }
      }
    }
    const md = data.market_data
    const circulating = num(md?.circulating_supply)
    const total = num(md?.total_supply)
    const max = num(md?.max_supply)
    const supply = explainSupply(circulating, total, max)
    const about = await pickAbout(data.description)
    const categories = (data.categories ?? [])
      .filter(Boolean)
      .slice(0, 4)
      .map((c) => categoriaCoinGeckoPt(c))

    return NextResponse.json(
      {
        id: data.id ?? id,
        name: data.name ?? null,
        symbol: data.symbol?.toUpperCase() ?? null,
        about,
        homepage: data.links?.homepage?.find((u) => u && u.startsWith('http')) ?? null,
        categories,
        circulating,
        total,
        max,
        marketCap: num(md?.market_cap?.usd),
        fdv: num(md?.fully_diluted_valuation?.usd),
        ...supply,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' } },
    )
  } catch {
    return NextResponse.json({ about: null }, { status: 200 })
  }
}
