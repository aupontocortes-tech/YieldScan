import { Connection, PublicKey } from '@solana/web3.js'
import { calculatePnL, pnlPercent } from '@/lib/liquidity/business'
import type { LiquidityPosition, LiquidityPositionsResult } from '@/lib/liquidity/types'

const WSOL = 'So11111111111111111111111111111111111111112'
/** SPL Token (classic) */
const SPL_TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
/** Token-2022 — muitos LP mints novos; sem isto a carteira parece “vazia”. */
const TOKEN_2022_PROGRAM = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')

type DexPair = {
  dexId?: string
  chainId?: string
  pairAddress?: string
  priceUsd?: string
  baseToken?: { address?: string; symbol?: string }
  quoteToken?: { address?: string; symbol?: string }
  liquidity?: { usd?: number }
  volume?: { h24?: number }
}

type DexTokenResponse = { pairs?: DexPair[] }

function solanaRpcUrl(): string {
  return (
    process.env.SOLANA_RPC_URL?.trim() ||
    process.env.HELIUS_RPC_URL?.trim() ||
    'https://api.mainnet-beta.solana.com'
  )
}

async function getParsedTokenAccountsWithRetry(
  conn: Connection,
  owner: PublicKey,
  programId: PublicKey,
): Promise<Awaited<ReturnType<Connection['getParsedTokenAccountsByOwner']>>> {
  let last: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await conn.getParsedTokenAccountsByOwner(owner, { programId })
    } catch (e) {
      last = e
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }
  }
  throw last
}

async function fetchDexscreenerToken(mint: string): Promise<DexTokenResponse | null> {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as DexTokenResponse
}

/**
 * Só consideramos LP real: o mint da carteira NÃO pode ser o base nem o quote do par.
 * Se for igual a base ou quote, é holding spot (ex.: só HYPE), não posição de pool.
 */
function pickLpMintPair(pairs: DexPair[] | undefined, mint: string): DexPair | null {
  if (!pairs?.length) return null
  const sol = pairs.filter((p) => {
    const c = (p.chainId ?? '').toLowerCase()
    return c === 'solana' || c === ''
  })
  const candidates = sol.filter((p) => {
    const b = p.baseToken?.address?.trim()
    const q = p.quoteToken?.address?.trim()
    if (!b || !q) return false
    return mint !== b && mint !== q
  })
  if (!candidates.length) return null
  candidates.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
  return candidates[0] ?? null
}

/** APR bruto estimado: volume24h × feeGuess / TVL × 365 (ordem de grandeza). */
function estimateAprFromDexPair(pair: DexPair, feeGuess = 0.0025): number | undefined {
  const vol = pair.volume?.h24
  const liq = pair.liquidity?.usd
  if (vol == null || liq == null || liq < 1 || vol < 0) return undefined
  const dailyFeeShare = (vol * feeGuess) / liq
  const apr = dailyFeeShare * 365 * 100
  if (!Number.isFinite(apr) || apr < 0) return undefined
  return Math.min(9999, apr)
}

/**
 * Só posições que parecem **token LP** (mint ≠ base e ≠ quote do par no DexScreener).
 * Holdings normais (ex.: só HYPE ou só USDC) deixam de aparecer como “pool”.
 */
export async function getSolanaPositions(walletAddress: string): Promise<LiquidityPositionsResult> {
  const conn = new Connection(solanaRpcUrl(), 'confirmed')
  let pk: PublicKey
  try {
    pk = new PublicKey(walletAddress)
  } catch {
    return {
      positions: [],
      meta: { source: 'solana-spl', warning: 'Endereço Solana inválido.' },
    }
  }

  type Row = { mint: string; ui: number }
  function rowsFromParsed(
    parsed: Awaited<ReturnType<Connection['getParsedTokenAccountsByOwner']>>,
  ): Row[] {
    const out: Row[] = []
    for (const { account } of parsed.value) {
      const data = account.data as {
        parsed?: { info?: { mint?: string; tokenAmount?: { uiAmount?: number | null } } }
      }
      const mint = data.parsed?.info?.mint
      const ui = data.parsed?.info?.tokenAmount?.uiAmount
      if (!mint || ui == null || !Number.isFinite(ui) || ui <= 0) continue
      if (mint === WSOL) continue
      out.push({ mint, ui })
    }
    return out
  }

  const [classicSettled, token22Settled] = await Promise.allSettled([
    getParsedTokenAccountsWithRetry(conn, pk, SPL_TOKEN_PROGRAM),
    getParsedTokenAccountsWithRetry(conn, pk, TOKEN_2022_PROGRAM),
  ])
  const emptyParsed = { value: [] } as Awaited<
    ReturnType<Connection['getParsedTokenAccountsByOwner']>
  >
  const classicParsed =
    classicSettled.status === 'fulfilled' ? classicSettled.value : emptyParsed
  const token22Parsed =
    token22Settled.status === 'fulfilled' ? token22Settled.value : emptyParsed
  if (classicSettled.status === 'rejected' && token22Settled.status === 'rejected') {
    const a =
      classicSettled.reason instanceof Error
        ? classicSettled.reason.message
        : String(classicSettled.reason)
    const b =
      token22Settled.reason instanceof Error
        ? token22Settled.reason.message
        : String(token22Settled.reason)
    throw new Error(`RPC Solana: ${a} · ${b}`)
  }

  const byMint = new Map<string, number>()
  for (const { mint, ui } of [...rowsFromParsed(classicParsed), ...rowsFromParsed(token22Parsed)]) {
    byMint.set(mint, (byMint.get(mint) ?? 0) + ui)
  }

  const rows: Row[] = [...byMint.entries()]
    .filter(([, ui]) => ui > 0)
    .map(([mint, ui]) => ({ mint, ui }))

  rows.sort((a, b) => b.ui - a.ui)
  const top = rows.slice(0, 24)

  const positions: LiquidityPosition[] = []

  for (let i = 0; i < top.length; i++) {
    const { mint, ui } = top[i]!
    if (i > 0 && i % 4 === 0) {
      await new Promise((r) => setTimeout(r, 220))
    }
    const ds = await fetchDexscreenerToken(mint)
    const pair = pickLpMintPair(ds?.pairs, mint)
    if (!pair) continue

    const price = pair.priceUsd != null ? Number(pair.priceUsd) : Number.NaN
    const valueUSD = Number.isFinite(price) && price > 0 ? price * ui : 0
    if (valueUSD <= 0) continue

    const dex = pair.dexId ?? 'Solana DEX'
    const base = pair.baseToken?.symbol ?? 'Base'
    const quote = pair.quoteToken?.symbol ?? 'Quote'
    const protocol = `${dex}`

    const investedUSD = valueUSD
    const feesEarnedUSD = 0
    const pnlUSD = calculatePnL({ valueUSD, investedUSD, feesEarnedUSD })
    const apr = estimateAprFromDexPair(pair)

    positions.push({
      id: `sol-lp-${mint}`,
      chain: 'solana',
      protocol,
      tokenA: base,
      tokenB: quote,
      amountA: ui,
      amountB: 0,
      valueUSD,
      investedUSD,
      feesEarnedUSD,
      pnlUSD: valueUSD > 0 ? pnlUSD : 0,
      pnlPct: valueUSD > 0 ? pnlPercent(pnlUSD, investedUSD) : Number.NaN,
      impermanentLossUSD: null,
      poolAddress: pair.pairAddress ?? mint,
      tokenAValuePct: 100,
      estimatedAprPct: apr,
      positionKind: 'lp_token',
      raw: { mint, pairAddress: pair.pairAddress, dexPair: pair },
    })
  }

  positions.sort((a, b) => b.valueUSD - a.valueUSD)

  const metaWarning =
    positions.length === 0 && rows.length > 0
      ? 'Só listamos tokens LP (mint diferente do base e do quote no DexScreener). Holdings spot não aparecem aqui. NFTs CLMM (Orca/Raydium) precisam de indexer dedicado.'
      : positions.length === 0
        ? 'Nenhum token LP detectado nesta carteira no DexScreener.'
        : 'Solana: só tokens LP (não confundimos com moedas que só tens na carteira). APR é estimativa a partir de volume 24h / TVL.'

  return {
    positions,
    meta: {
      source: 'solana-lp-filtered',
      warning: metaWarning,
    },
  }
}
