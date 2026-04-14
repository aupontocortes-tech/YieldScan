import { Connection, PublicKey } from '@solana/web3.js'
import { calculatePnL, pnlPercent } from '@/lib/liquidity/business'
import { getSolanaRpcUrlCandidates } from '@/lib/solana'
import type { LiquidityPosition, LiquidityPositionsResult } from '@/lib/liquidity/types'

const WSOL = 'So11111111111111111111111111111111111111112'
const MAX_MINTS_TO_SCAN = 120
const DEXSCREEN_BATCH_SIZE = 6
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

async function getParsedTokenAccountsWithRetry(
  conn: Connection,
  owner: PublicKey,
  programId: PublicKey,
): Promise<Awaited<ReturnType<Connection['getParsedTokenAccountsByOwner']>>> {
  let last: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await conn.getParsedTokenAccountsByOwner(owner, { programId }, 'confirmed')
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
  let pk: PublicKey
  try {
    pk = new PublicKey(walletAddress)
  } catch {
    return {
      positions: [],
      meta: { source: 'solana-spl', warning: 'Endereço Solana inválido.' },
    }
  }

  type Row = { mint: string; ui: number; isNftLike: boolean }
  function rowsFromParsed(
    parsed: Awaited<ReturnType<Connection['getParsedTokenAccountsByOwner']>>,
  ): Row[] {
    const out: Row[] = []
    for (const { account } of parsed.value) {
      const data = account.data as {
        parsed?: {
          info?: {
            mint?: string
            tokenAmount?: { uiAmount?: number | null; amount?: string; decimals?: number }
          }
        }
      }
      const mint = data.parsed?.info?.mint
      const tokenAmount = data.parsed?.info?.tokenAmount
      const ui = tokenAmount?.uiAmount
      const amountRaw = tokenAmount?.amount
      const decimals = tokenAmount?.decimals
      if (!mint || ui == null || !Number.isFinite(ui) || ui <= 0) continue
      if (mint === WSOL) continue
      const isNftLike = decimals === 0 && amountRaw === '1'
      out.push({ mint, ui, isNftLike })
    }
    return out
  }

  const emptyParsed = { value: [] } as Awaited<
    ReturnType<Connection['getParsedTokenAccountsByOwner']>
  >
  const candidates = getSolanaRpcUrlCandidates()
  let workingUrl: string | undefined

  async function loadParsed(
    programId: PublicKey,
  ): Promise<Awaited<ReturnType<Connection['getParsedTokenAccountsByOwner']>>> {
    const order = workingUrl
      ? [workingUrl, ...candidates.filter((u) => u !== workingUrl)]
      : [...candidates]
    let last: unknown
    for (const url of order) {
      const conn = new Connection(url, { commitment: 'confirmed' })
      try {
        const out = await getParsedTokenAccountsWithRetry(conn, pk, programId)
        workingUrl = url
        return out
      } catch (e) {
        last = e
      }
    }
    throw last
  }

  /** Em sequência: reutiliza o mesmo RPC que funcionou no SPL Token, reduz rate-limit/timeouts na Vercel. */
  let classicParsed = emptyParsed
  let token22Parsed = emptyParsed
  let classicErr: unknown
  let token22Err: unknown
  try {
    classicParsed = await loadParsed(SPL_TOKEN_PROGRAM)
  } catch (e) {
    classicErr = e
  }
  try {
    token22Parsed = await loadParsed(TOKEN_2022_PROGRAM)
  } catch (e) {
    token22Err = e
  }
  if (classicErr != null && token22Err != null) {
    const a = classicErr instanceof Error ? classicErr.message : String(classicErr)
    const b = token22Err instanceof Error ? token22Err.message : String(token22Err)
    throw new Error(`RPC Solana: ${a} · ${b}`)
  }

  const byMint = new Map<string, { ui: number; isNftLike: boolean }>()
  for (const { mint, ui, isNftLike } of [...rowsFromParsed(classicParsed), ...rowsFromParsed(token22Parsed)]) {
    const prev = byMint.get(mint)
    if (!prev) {
      byMint.set(mint, { ui, isNftLike })
      continue
    }
    byMint.set(mint, { ui: prev.ui + ui, isNftLike: prev.isNftLike || isNftLike })
  }

  const rows: Row[] = [...byMint.entries()]
    .filter(([, v]) => v.ui > 0)
    .map(([mint, v]) => ({ mint, ui: v.ui, isNftLike: v.isNftLike }))

  rows.sort((a, b) => b.ui - a.ui)
  const top = rows.slice(0, MAX_MINTS_TO_SCAN)

  const positions: LiquidityPosition[] = []

  for (let start = 0; start < top.length; start += DEXSCREEN_BATCH_SIZE) {
    const batch = top.slice(start, start + DEXSCREEN_BATCH_SIZE)
    const tokenResponses = await Promise.all(batch.map(({ mint }) => fetchDexscreenerToken(mint)))
    for (let i = 0; i < batch.length; i++) {
      const { mint, ui } = batch[i]!
      const ds = tokenResponses[i]
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
    if (start + DEXSCREEN_BATCH_SIZE < top.length) {
      await new Promise((r) => setTimeout(r, 180))
    }
  }

  positions.sort((a, b) => b.valueUSD - a.valueUSD)

  if (positions.length === 0) {
    const nftCandidates = rows.filter((r) => r.isNftLike).slice(0, 6)
    for (const r of nftCandidates) {
      positions.push({
        id: `sol-clmm-nft-${r.mint}`,
        chain: 'solana',
        protocol: 'Solana CLMM',
        tokenA: 'CLMM',
        tokenB: 'NFT',
        amountA: 1,
        amountB: 0,
        valueUSD: 0,
        investedUSD: 0,
        feesEarnedUSD: 0,
        pnlUSD: 0,
        pnlPct: Number.NaN,
        impermanentLossUSD: null,
        poolAddress: r.mint,
        tokenAValuePct: 100,
        positionKind: 'concentrated',
        raw: { mint: r.mint, unindexedClmmNft: true },
      })
    }
  }

  const metaWarning =
    positions.length > 0 && positions.some((p) => (p.raw as { unindexedClmmNft?: boolean } | undefined)?.unindexedClmmNft)
      ? 'Detetámos NFTs que parecem posições CLMM em Solana. Mostramos estes itens como "CLMM NFT" sem valuation até ligar indexador dedicado (Orca/Raydium/Meteora).'
      : positions.length === 0 && rows.length > 0
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
