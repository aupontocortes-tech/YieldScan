const BRAZIL_TZ = 'America/Sao_Paulo'
const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000

function parseDateInput(value: string): Date {
  const trimmed = value.trim()
  if (!trimmed) return new Date(Number.NaN)
  const parsed = new Date(trimmed)
  if (Number.isFinite(parsed.getTime())) return parsed
  return new Date(trimmed.replace(' ', 'T'))
}

export function parseNewsPublishedAt(value: string | null | undefined, fallbackNowMs = Date.now()): number {
  if (!value) return fallbackNowMs
  const parsedMs = parseDateInput(value).getTime()
  return Number.isFinite(parsedMs) ? parsedMs : fallbackNowMs
}

export function normalizeNewsPublishedAt(value: string | null | undefined, fallbackNowMs = Date.now()): string {
  return new Date(parseNewsPublishedAt(value, fallbackNowMs)).toISOString()
}

export function toBrazilWallClockMs(utcMs: number): number {
  const date = new Date(utcMs)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0')
  const year = get('year')
  const month = get('month')
  const day = get('day')
  const hour = get('hour')
  const minute = get('minute')
  const second = get('second')
  return Date.UTC(year, month - 1, day, hour, minute, second)
}

/**
 * Data e hora de publicação no fuso de Brasília (ex.: "09/04/2026 às 14:32").
 */
export function formatNewsPublishedDateTimePt(
  publishedAt: string | null | undefined,
  nowMs = Date.now()
): string {
  if (!publishedAt?.trim()) return ''
  const pubMs = parseNewsPublishedAt(publishedAt, nowMs)
  if (!Number.isFinite(pubMs)) return ''
  try {
    const s = new Intl.DateTimeFormat('pt-BR', {
      timeZone: BRAZIL_TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(pubMs))
    return s.replace(/\s*,\s*/, ' às ')
  } catch {
    return ''
  }
}

export function formatRelativeNewsTime(
  publishedAt: string | null | undefined,
  nowMs = Date.now()
): string {
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now()
  const publishedUtcMs = parseNewsPublishedAt(publishedAt, safeNowMs)
  const nowBrazilMs = toBrazilWallClockMs(safeNowMs)
  const publishedBrazilMs = toBrazilWallClockMs(publishedUtcMs)
  const diffMs = Math.max(0, nowBrazilMs - publishedBrazilMs)

  if (diffMs < MS_PER_HOUR) {
    const min = Math.max(1, Math.floor(diffMs / MS_PER_MINUTE))
    return `há ${min} min`
  }
  if (diffMs < MS_PER_DAY) {
    const hours = Math.floor(diffMs / MS_PER_HOUR)
    return `há ${hours} h`
  }
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_TZ,
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(publishedUtcMs))
}

export function getNewsAgeHours(publishedAt: string | null | undefined, nowMs = Date.now()): number {
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now()
  const publishedUtcMs = parseNewsPublishedAt(publishedAt, safeNowMs)
  const nowBrazilMs = toBrazilWallClockMs(safeNowMs)
  const publishedBrazilMs = toBrazilWallClockMs(publishedUtcMs)
  return Math.max(0, (nowBrazilMs - publishedBrazilMs) / MS_PER_HOUR)
}

export function getNewsAgeMinutes(publishedAt: string | null | undefined, nowMs = Date.now()): number {
  return getNewsAgeHours(publishedAt, nowMs) * 60
}
