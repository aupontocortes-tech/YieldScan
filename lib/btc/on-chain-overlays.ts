/**
 * Converte proxies on-chain (só preço) em níveis USD no gráfico principal —
 * linhas horizontais com rótulo na escala (estilo “On-Chain Overlays”).
 */
import { ema, sma } from '@/lib/btc/indicators'
import {
  syntheticMvrv,
  syntheticNupl,
  syntheticSopr,
  nuplZoneLabel,
} from '@/lib/btc/on-chain-synthetic'
import type { OnChainBundle } from '@/lib/btc/types'

export type OnChainChartOverlay = {
  id: string
  label: string
  price: number
  color: string
  lineWidth: 1 | 2 | 3
  /** Valor da métrica no último fecho (ex. "1.43"). */
  metricDisplay: string
  /** WATCH, NORMAL, STRONG — opcional no título da linha. */
  tag?: string
}

const MVRV_CALIB = 0.92

function lastIndex(closes: number[]) {
  return closes.length - 1
}

function mayerTag(ratio: number): string | undefined {
  if (ratio >= 1.35) return 'WATCH'
  if (ratio <= 0.75) return 'WATCH'
  if (ratio >= 1.15) return 'STRONG'
  return 'NORMAL'
}

function mvrvTag(ratio: number): string | undefined {
  if (ratio >= 1.8) return 'WATCH'
  if (ratio <= 0.85) return 'WATCH'
  if (ratio >= 1.4) return 'STRONG'
  return 'NORMAL'
}

function avivTag(ratio: number): string | undefined {
  if (ratio >= 1.25) return 'WATCH'
  if (ratio <= 0.82) return 'WATCH'
  return 'NORMAL'
}

function nuplTag(v: number): string | undefined {
  if (v >= 65) return 'WATCH'
  if (v <= 25) return 'WATCH'
  return 'NORMAL'
}

/** Preço implícito onde Mayer Multiple = 1 (preço / SMA). */
function mayerFairPrice(closes: number[], period: number): { price: number; ratio: number } | null {
  const i = lastIndex(closes)
  const base = sma(closes, period)[i]
  const px = closes[i]
  if (base == null || base <= 0 || !Number.isFinite(px)) return null
  return { price: base, ratio: px / base }
}

/** AVIV proxy: preço / SMA (período configurável). Linha em “fair” = SMA. */
function avivFairPrice(closes: number[], period: number): { price: number; ratio: number } | null {
  const i = lastIndex(closes)
  const base = sma(closes, period)[i]
  const px = closes[i]
  if (base == null || base <= 0 || !Number.isFinite(px)) return null
  return { price: base, ratio: px / base }
}

function mvrvFairPrice(closes: number[], period: number): { price: number; ratio: number } | null {
  const i = lastIndex(closes)
  const base = sma(closes, period)[i]
  const series = syntheticMvrv(closes, period)
  const ratio = series[i]
  if (base == null || base <= 0 || ratio == null) return null
  const fair = base / MVRV_CALIB
  return { price: fair, ratio }
}

function nuplFairPrice(closes: number[], period: number): { price: number; nupl: number } | null {
  const i = lastIndex(closes)
  const base = sma(closes, period)[i]
  const series = syntheticNupl(closes, period)
  const nu = series[i]
  if (base == null || base <= 0 || nu == null) return null
  return { price: base, nupl: nu }
}

function soprFairPrice(closes: number[], emaPeriod: number): { price: number; ratio: number } | null {
  const i = lastIndex(closes)
  const e = ema(closes, emaPeriod)[i]
  const series = syntheticSopr(closes, emaPeriod)
  const ratio = series[i]
  if (e == null || e <= 0 || ratio == null) return null
  return { price: e, ratio }
}

export function buildOnChainChartOverlays(
  closes: number[],
  onChain: OnChainBundle,
): OnChainChartOverlay[] {
  if (closes.length < 30) return []
  const out: OnChainChartOverlay[] = []

  if (onChain.mayer.enabled) {
    const m = mayerFairPrice(closes, onChain.mayer.smaPeriod)
    if (m) {
      const tag = mayerTag(m.ratio)
      out.push({
        id: 'mayer',
        label: 'Mayer Multiple',
        price: m.price,
        color: onChain.mayer.color,
        lineWidth: onChain.mayer.lineWidth,
        metricDisplay: m.ratio.toFixed(2),
        tag,
      })
    }
  }

  if (onChain.aviv.enabled) {
    const a = avivFairPrice(closes, onChain.aviv.smaPeriod)
    if (a) {
      out.push({
        id: 'aviv',
        label: 'AVIV (proxy)',
        price: a.price,
        color: onChain.aviv.color,
        lineWidth: onChain.aviv.lineWidth,
        metricDisplay: a.ratio.toFixed(2),
        tag: avivTag(a.ratio),
      })
    }
  }

  if (onChain.mvrv.enabled) {
    const m = mvrvFairPrice(closes, onChain.mvrv.smaPeriod)
    if (m) {
      out.push({
        id: 'mvrv',
        label: 'MVRV (proxy)',
        price: m.price,
        color: onChain.mvrv.color,
        lineWidth: onChain.mvrv.lineWidth,
        metricDisplay: m.ratio.toFixed(2),
        tag: mvrvTag(m.ratio),
      })
    }
  }

  if (onChain.nupl.enabled) {
    const n = nuplFairPrice(closes, onChain.nupl.smaPeriod)
    if (n) {
      out.push({
        id: 'nupl',
        label: 'NUPL (proxy)',
        price: n.price,
        color: onChain.nupl.color,
        lineWidth: onChain.nupl.lineWidth,
        metricDisplay: `${n.nupl.toFixed(0)}`,
        tag: nuplTag(n.nupl),
      })
    }
  }

  if (onChain.sopr.enabled) {
    const s = soprFairPrice(closes, onChain.sopr.emaPeriod)
    if (s) {
      const tag = s.ratio >= 1.05 || s.ratio <= 0.95 ? 'WATCH' : 'NORMAL'
      out.push({
        id: 'sopr',
        label: 'SOPR (proxy)',
        price: s.price,
        color: onChain.sopr.color,
        lineWidth: onChain.sopr.lineWidth,
        metricDisplay: s.ratio.toFixed(3),
        tag,
      })
    }
  }

  if (onChain.mvrvZ.enabled) {
    const mv = syntheticMvrv(closes, onChain.mvrv.smaPeriod)
    const i = lastIndex(closes)
    const base = sma(closes, onChain.mvrv.smaPeriod)[i]
    if (base != null && base > 0) {
      const slice = mv
        .slice(Math.max(0, i - onChain.mvrvZ.window + 1), i + 1)
        .filter((x): x is number => x != null)
      if (slice.length >= 5) {
        const mean = slice.reduce((a, b) => a + b, 0) / slice.length
        const variance = slice.reduce((s, x) => s + (x - mean) ** 2, 0) / slice.length
        const std = Math.sqrt(variance)
        const fairPrice = (mean / MVRV_CALIB) * base
        const cur = mv[i]
        const z = cur != null && std > 1e-12 ? (cur - mean) / std : null
        let tag: string | undefined = 'NORMAL'
        if (z != null && Math.abs(z) >= 2) tag = 'WATCH'
        out.push({
          id: 'mvrvZ',
          label: 'MVRV Z (proxy)',
          price: fairPrice,
          color: onChain.mvrvZ.color,
          lineWidth: onChain.mvrvZ.lineWidth,
          metricDisplay: z != null ? z.toFixed(2) : '—',
          tag,
        })
      }
    }
  }

  return out.filter((o) => o.price > 0 && Number.isFinite(o.price))
}

export function overlayAxisTitle(o: OnChainChartOverlay): string {
  const parts = [o.label, o.metricDisplay]
  if (o.tag) parts.push(o.tag)
  return parts.join(' · ')
}

export function nuplZoneForDisplay(closes: number[], period: number): string {
  const i = lastIndex(closes)
  const v = syntheticNupl(closes, period)[i]
  return nuplZoneLabel(v)
}
