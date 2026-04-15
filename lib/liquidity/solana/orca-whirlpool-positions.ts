import { address, createSolanaRpc } from '@solana/kit'
import { Connection, PublicKey } from '@solana/web3.js'
import {
  decreaseLiquidityInstructions,
  fetchPositionsForOwner,
  setWhirlpoolsConfig,
  type PositionData,
} from '@orca-so/whirlpools'
import { fetchWhirlpool, type Position } from '@orca-so/whirlpools-client'
import { calculatePnL, pnlPercent } from '@/lib/liquidity/business'
import { getSolanaRpcUrlCandidates } from '@/lib/solana'
import type { LiquidityPosition } from '@/lib/liquidity/types'

let mainnetConfig: Promise<void> | null = null

function ensureWhirlpoolsMainnet(): Promise<void> {
  if (!mainnetConfig) mainnetConfig = setWhirlpoolsConfig('solanaMainnet')
  return mainnetConfig
}

function shortMint(m: string): string {
  if (m.length <= 12) return m
  return `${m.slice(0, 4)}…${m.slice(-4)}`
}

async function mintSymbolDecimals(conn: Connection, mintStr: string): Promise<{ symbol: string; decimals: number }> {
  try {
    const ai = await conn.getParsedAccountInfo(new PublicKey(mintStr), 'confirmed')
    const parsed = ai.value?.data as {
      parsed?: { type?: string; info?: { symbol?: string; decimals?: number } }
    }
    const info = parsed?.parsed?.info
    const decimals = typeof info?.decimals === 'number' ? info.decimals : 9
    const sym = info?.symbol?.trim()
    return { symbol: sym && sym.length > 0 ? sym : shortMint(mintStr), decimals }
  } catch {
    return { symbol: shortMint(mintStr), decimals: 9 }
  }
}

async function dexPriceUsd(mint: string): Promise<number> {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { cache: 'no-store' })
  if (!res.ok) return 0
  const j = (await res.json()) as {
    pairs?: { chainId?: string; priceUsd?: string; liquidity?: { usd?: number } }[]
  }
  const sol = (j.pairs ?? []).filter((p) => {
    const c = (p.chainId ?? '').toLowerCase()
    return c === 'solana' || c === ''
  })
  sol.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
  const px = sol[0]?.priceUsd
  const n = px != null ? Number(px) : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : 0
}

type DexPoolRow = { liquidity?: { usd?: number }; volume?: { h24?: number } }

async function fetchDexPoolRow(poolPk: string): Promise<DexPoolRow | null> {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${poolPk}`, { cache: 'no-store' })
  if (!res.ok) return null
  const j = (await res.json()) as { pairs?: DexPoolRow[] }
  return j.pairs?.[0] ?? null
}

function poolAprEstimate(pair: DexPoolRow | null, feeRateBps: number): number | undefined {
  const vol = pair?.volume?.h24
  const liq = pair?.liquidity?.usd
  if (vol == null || liq == null || liq < 1 || vol < 0) return undefined
  const fee = feeRateBps / 10_000
  const apr = ((vol * fee) / liq) * 365 * 100
  if (!Number.isFinite(apr) || apr < 0) return undefined
  return Math.min(9999, apr)
}

function quoteTokenAmounts(quote: unknown): { a: bigint; b: bigint } {
  const q = quote as Record<string, unknown>
  const pick = (keys: string[]): bigint => {
    for (const k of keys) {
      const v = q[k]
      if (typeof v === 'bigint') return v
      if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v))
    }
    return 0n
  }
  return {
    a: pick(['tokenEstA', 'tokenMinA']),
    b: pick(['tokenEstB', 'tokenMinB']),
  }
}

function* eachWhirlpoolPosition(row: PositionData): Generator<{ data: Position; positionMint: string }> {
  if (row.isPositionBundle) {
    for (const acc of row.positions) {
      yield { data: acc.data, positionMint: String(acc.data.positionMint) }
    }
  } else {
    yield { data: row.data, positionMint: String(row.data.positionMint) }
  }
}

/**
 * Posições Orca Whirlpool (CLMM) via SDK — valores em USD aproximados (DexScreener) + fees on-chain (feeOwed).
 */
export async function fetchOrcaWhirlpoolPositions(walletAddress: string): Promise<LiquidityPosition[]> {
  await ensureWhirlpoolsMainnet()
  const urls = getSolanaRpcUrlCandidates()
  let lastErr: unknown

  for (const url of urls) {
    try {
      const rpc = createSolanaRpc(url)
      const conn = new Connection(url, { commitment: 'confirmed' })
      const rows = await fetchPositionsForOwner(rpc, address(walletAddress))
      const out: LiquidityPosition[] = []

      for (const row of rows) {
        for (const { data: pos, positionMint } of eachWhirlpoolPosition(row)) {
          if (pos.liquidity === 0n && pos.feeOwedA === 0n && pos.feeOwedB === 0n) continue

          const whirlpoolPk = String(pos.whirlpool)
          const poolAcc = await fetchWhirlpool(rpc, address(whirlpoolPk))
          const pool = poolAcc.data
          const tickCurrent = pool.tickCurrentIndex
          const tickLower = pos.tickLowerIndex
          const tickUpper = pos.tickUpperIndex
          const inRange = tickCurrent >= tickLower && tickCurrent <= tickUpper

          const feeTierBps = Math.max(0, Math.round(pool.feeRate / 100))

          const [metaA, metaB] = await Promise.all([
            mintSymbolDecimals(conn, String(pool.tokenMintA)),
            mintSymbolDecimals(conn, String(pool.tokenMintB)),
          ])

          let amountRawA = 0n
          let amountRawB = 0n
          if (pos.liquidity > 0n) {
            try {
              const { quote } = await decreaseLiquidityInstructions(
                rpc,
                address(positionMint),
                { liquidity: pos.liquidity },
                150,
              )
              const q = quoteTokenAmounts(quote)
              amountRawA = q.a
              amountRawB = q.b
            } catch {
              amountRawA = 0n
              amountRawB = 0n
            }
          }

          const humanA = Number(amountRawA) / 10 ** metaA.decimals
          const humanB = Number(amountRawB) / 10 ** metaB.decimals

          const feeHumanA = Number(pos.feeOwedA) / 10 ** metaA.decimals
          const feeHumanB = Number(pos.feeOwedB) / 10 ** metaB.decimals

          const [priceA, priceB, dexRow] = await Promise.all([
            dexPriceUsd(String(pool.tokenMintA)),
            dexPriceUsd(String(pool.tokenMintB)),
            fetchDexPoolRow(whirlpoolPk),
          ])

          const legUsdA = humanA * priceA
          const legUsdB = humanB * priceB
          const valueUSD = legUsdA + legUsdB
          const feesUSD = feeHumanA * priceA + feeHumanB * priceB

          const investedUSD = valueUSD
          const pnlUSD = calculatePnL({ valueUSD, investedUSD, feesEarnedUSD: feesUSD })
          const pctA = valueUSD > 0 ? (legUsdA / valueUSD) * 100 : 50

          const apr = poolAprEstimate(dexRow, feeTierBps)

          out.push({
            id: `orca-${positionMint}`,
            chain: 'solana',
            protocol: 'Orca Whirlpool',
            tokenA: metaA.symbol,
            tokenB: metaB.symbol,
            amountA: humanA,
            amountB: humanB,
            valueUSD,
            investedUSD,
            feesEarnedUSD: feesUSD,
            pnlUSD: valueUSD > 0 ? pnlUSD : 0,
            pnlPct: valueUSD > 0 ? pnlPercent(pnlUSD, investedUSD) : Number.NaN,
            impermanentLossUSD: null,
            poolAddress: whirlpoolPk,
            feeTierBps,
            inRange,
            tickLower,
            tickUpper,
            currentTick: tickCurrent,
            decimalsA: metaA.decimals,
            decimalsB: metaB.decimals,
            tokenAValuePct: pctA,
            estimatedAprPct: apr,
            positionKind: 'concentrated',
            raw: {
              orca: true,
              positionMint,
              whirlpool: whirlpoolPk,
              feeOwedA: pos.feeOwedA.toString(),
              feeOwedB: pos.feeOwedB.toString(),
            },
          })
        }
      }

      out.sort((a, b) => b.valueUSD - a.valueUSD)
      return out
    } catch (e) {
      lastErr = e
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}
