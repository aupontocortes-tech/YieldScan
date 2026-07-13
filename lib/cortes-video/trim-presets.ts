import type { TimelineClip } from '@/lib/cortes-video/types'

export type TrimPresetId =
  | 'full'
  | 'first_15'
  | 'last_15'
  | 'first_30'
  | 'last_30'
  | 'first_half'
  | 'last_half'
  | 'custom'

export type TimeRange = { start: number; end: number }

export const TRIM_PRESETS: Array<{
  id: Exclude<TrimPresetId, 'custom'>
  label: string
  hint: string
}> = [
  { id: 'full', label: 'Vídeo completo', hint: 'Todo o ficheiro' },
  { id: 'first_15', label: 'Primeiros 15 min', hint: 'Início' },
  { id: 'last_15', label: 'Últimos 15 min', hint: 'Final' },
  { id: 'first_30', label: 'Primeiros 30 min', hint: 'Início' },
  { id: 'last_30', label: 'Últimos 30 min', hint: 'Final' },
  { id: 'first_half', label: '1.ª metade', hint: '50% inicial' },
  { id: 'last_half', label: '2.ª metade', hint: '50% final' },
]

function clampRange(start: number, end: number, durationSec: number): TimeRange {
  const dur = Math.max(0.1, durationSec)
  let s = Math.max(0, Math.min(dur, start))
  let e = Math.max(0, Math.min(dur, end))
  if (e <= s) {
    e = Math.min(dur, s + 0.1)
  }
  if (e - s < 0.05) {
    e = Math.min(dur, s + 0.1)
  }
  return { start: s, end: e }
}

export function resolveTrimPreset(
  durationSec: number,
  preset: TrimPresetId,
  custom?: TimeRange | null,
): TimeRange {
  const dur = Math.max(0.1, durationSec)
  switch (preset) {
    case 'first_15':
      return clampRange(0, Math.min(15 * 60, dur), dur)
    case 'last_15':
      return clampRange(Math.max(0, dur - 15 * 60), dur, dur)
    case 'first_30':
      return clampRange(0, Math.min(30 * 60, dur), dur)
    case 'last_30':
      return clampRange(Math.max(0, dur - 30 * 60), dur, dur)
    case 'first_half':
      return clampRange(0, dur / 2, dur)
    case 'last_half':
      return clampRange(dur / 2, dur, dur)
    case 'custom':
      if (custom) return clampRange(custom.start, custom.end, dur)
      return clampRange(0, dur, dur)
    case 'full':
    default:
      return clampRange(0, dur, dur)
  }
}

export function rangeToClip(range: TimeRange, idFactory: () => string): TimelineClip {
  return {
    id: idFactory(),
    sourceStart: range.start,
    sourceEnd: range.end,
  }
}

export function rangeDuration(range: TimeRange): number {
  return Math.max(0, range.end - range.start)
}

/** Formata segundos → `H:MM:SS` ou `M:SS` (com décimas opcionais). */
export function formatTimecode(sec: number, withTenths = false): string {
  const s = Math.max(0, sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const whole = Math.floor(r)
  const tenths = Math.round((r - whole) * 10)
  const secPart =
    withTenths && tenths > 0
      ? `${String(whole).padStart(2, '0')}.${tenths}`
      : String(whole).padStart(2, '0')
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${secPart}`
  return `${m}:${secPart}`
}

/**
 * Aceita: `90` (segundos), `1:30`, `01:30`, `1:02:30`, `1:02:30.5`
 * Devolve segundos ou null se inválido.
 */
export function parseTimecode(input: string): number | null {
  const raw = input.trim().replace(',', '.')
  if (!raw) return null
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  const parts = raw.split(':')
  if (parts.length < 2 || parts.length > 3) return null
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null
  if (parts.length === 2) {
    const [m, s] = nums as [number, number]
    return m * 60 + s
  }
  const [h, m, s] = nums as [number, number, number]
  return h * 3600 + m * 60 + s
}

export function clampTimeRange(start: number, end: number, durationSec: number): TimeRange {
  return clampRange(start, end, durationSec)
}
