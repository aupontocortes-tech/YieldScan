/**
 * OpenAI central do app (Configurações).
 * Uma chave partilhada; gastos registados por área (Gestão / Cortes / …).
 */

export type OpenAiAppArea = 'gestao_financeira' | 'cortes_video' | 'outro'

export type CentralOpenAiSettings = {
  apiKey: string
  enabled: boolean
  monthlyBudgetUsd: number
  maxCallsPerDay: number
}

export type CentralOpenAiUsageRecord = {
  id: string
  at: string
  area: OpenAiAppArea
  feature?: string
  model?: string
  estimatedUsd: number
}

export const DEFAULT_CENTRAL_OPENAI: CentralOpenAiSettings = {
  apiKey: '',
  enabled: false,
  monthlyBudgetUsd: 5,
  maxCallsPerDay: 80,
}

export const OPENAI_AREA_LABEL: Record<OpenAiAppArea, string> = {
  gestao_financeira: 'Gestão Financeira',
  cortes_video: 'Cortes de Vídeo',
  outro: 'Outro',
}

const SETTINGS_KEY = 'ys_openai_central_v1'
const USAGE_KEY = 'ys_openai_usage_by_area_v1'

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

function todayIsoDay() {
  return new Date().toISOString().slice(0, 10)
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

/** Migra chave antiga da Gestão / Cortes se o central ainda estiver vazio. */
function migrateKeyFromLegacy(): string {
  try {
    const gf = readJson<{ apiKey?: string }>('gf_openai_settings_v1', {})
    if (typeof gf.apiKey === 'string' && gf.apiKey.trim()) return gf.apiKey.trim()
    const cortes = readJson<{ apiKey?: string }>('cortes_openai_settings_v1', {})
    if (typeof cortes.apiKey === 'string' && cortes.apiKey.trim()) return cortes.apiKey.trim()
  } catch {
    /* ignore */
  }
  return ''
}

export function loadCentralOpenAiSettings(): CentralOpenAiSettings {
  const stored = readJson<Partial<CentralOpenAiSettings>>(SETTINGS_KEY, {})
  let apiKey = typeof stored.apiKey === 'string' ? stored.apiKey.trim() : ''
  if (!apiKey) apiKey = migrateKeyFromLegacy()
  return {
    ...DEFAULT_CENTRAL_OPENAI,
    ...stored,
    apiKey,
    enabled:
      typeof stored.enabled === 'boolean'
        ? stored.enabled
        : Boolean(apiKey),
    monthlyBudgetUsd:
      typeof stored.monthlyBudgetUsd === 'number'
        ? stored.monthlyBudgetUsd
        : DEFAULT_CENTRAL_OPENAI.monthlyBudgetUsd,
    maxCallsPerDay:
      typeof stored.maxCallsPerDay === 'number'
        ? stored.maxCallsPerDay
        : DEFAULT_CENTRAL_OPENAI.maxCallsPerDay,
  }
}

/**
 * Guarda a chave central e sincroniza com os módulos (GF + Cortes)
 * para as rotas existentes continuarem a funcionar.
 */
export function saveCentralOpenAiSettings(settings: CentralOpenAiSettings) {
  const next: CentralOpenAiSettings = {
    ...settings,
    apiKey: settings.apiKey.trim(),
    monthlyBudgetUsd: Math.max(0.1, settings.monthlyBudgetUsd),
    maxCallsPerDay: Math.max(1, Math.floor(settings.maxCallsPerDay)),
  }
  writeJson(SETTINGS_KEY, next)

  // Sync Gestão
  const gf = readJson<Record<string, unknown>>('gf_openai_settings_v1', {})
  writeJson('gf_openai_settings_v1', {
    ...gf,
    apiKey: next.apiKey,
    enabled: next.enabled,
    monthlyBudgetUsd: next.monthlyBudgetUsd,
    maxCallsPerDay: next.maxCallsPerDay,
  })

  // Sync Cortes
  const cortes = readJson<Record<string, unknown>>('cortes_openai_settings_v1', {})
  writeJson('cortes_openai_settings_v1', {
    ...cortes,
    apiKey: next.apiKey,
    enabled: next.enabled,
    monthlyBudgetUsd: next.monthlyBudgetUsd,
    maxCallsPerDay: next.maxCallsPerDay,
  })

  try {
    window.dispatchEvent(new CustomEvent('ys-openai-central-updated'))
  } catch {
    /* ignore */
  }
}

export function maskOpenAiKey(key: string): string {
  const k = key.trim()
  if (k.length <= 8) return k ? '••••••••' : ''
  return `${k.slice(0, 3)}…${k.slice(-4)}`
}

export function listCentralOpenAiUsage(): CentralOpenAiUsageRecord[] {
  return readJson<CentralOpenAiUsageRecord[]>(USAGE_KEY, [])
}

export function registerOpenAiAreaUsage(input: {
  area: OpenAiAppArea
  estimatedUsd: number
  feature?: string
  model?: string
}): CentralOpenAiUsageRecord {
  const full: CentralOpenAiUsageRecord = {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `oa-${Date.now()}`,
    at: new Date().toISOString(),
    area: input.area,
    estimatedUsd: Math.max(0, input.estimatedUsd),
    feature: input.feature,
    model: input.model,
  }
  const list = listCentralOpenAiUsage()
  list.unshift(full)
  writeJson(USAGE_KEY, list.slice(0, 800))
  return full
}

export function clearCentralOpenAiUsage(): void {
  writeJson(USAGE_KEY, [])
}

export type AreaSpendRow = {
  area: OpenAiAppArea
  label: string
  monthUsd: number
  todayUsd: number
  monthCalls: number
  todayCalls: number
}

export type CentralOpenAiSpendSummary = {
  monthUsd: number
  todayUsd: number
  monthCalls: number
  todayCalls: number
  byArea: AreaSpendRow[]
  remainingBudgetUsd: number
  remainingCallsToday: number
}

/**
 * Migra uso legado GF / Cortes uma vez para o store central (evita duplicar somas).
 */
function migrateLegacyUsageOnce() {
  const flag = 'ys_openai_usage_migrated_v1'
  if (typeof window === 'undefined') return
  if (localStorage.getItem(flag) === '1') return

  if (listCentralOpenAiUsage().length > 0) {
    localStorage.setItem(flag, '1')
    return
  }

  const merged: CentralOpenAiUsageRecord[] = []
  const mkId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `oa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const gfUsage = readJson<
    Array<{ at: string; estimatedUsd: number; feature?: string; model?: string }>
  >('gf_openai_usage_v1', [])
  for (const r of gfUsage) {
    if (typeof r.at !== 'string' || typeof r.estimatedUsd !== 'number') continue
    merged.push({
      id: mkId(),
      at: r.at,
      area: 'gestao_financeira',
      estimatedUsd: Math.max(0, r.estimatedUsd),
      feature: r.feature,
      model: r.model,
    })
  }

  const cortesDays = readJson<Array<{ day: string; calls: number; costUsd: number }>>(
    'cortes_openai_usage_v1',
    [],
  )
  for (const d of cortesDays) {
    if (!d.day) continue
    merged.push({
      id: mkId(),
      at: `${d.day}T12:00:00.000Z`,
      area: 'cortes_video',
      estimatedUsd: Math.max(0, d.costUsd || 0),
      feature: `calls:${d.calls || 1}`,
    })
  }

  merged.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  writeJson(USAGE_KEY, merged.slice(0, 800))
  localStorage.setItem(flag, '1')
}

export function summarizeOpenAiSpendByArea(
  settings: CentralOpenAiSettings,
): CentralOpenAiSpendSummary {
  migrateLegacyUsageOnce()

  const now = new Date()
  const rows: AreaSpendRow[] = (
    ['gestao_financeira', 'cortes_video', 'outro'] as OpenAiAppArea[]
  ).map((area) => ({
    area,
    label: OPENAI_AREA_LABEL[area],
    monthUsd: 0,
    todayUsd: 0,
    monthCalls: 0,
    todayCalls: 0,
  }))
  const byArea = new Map(rows.map((r) => [r.area, r]))

  const add = (area: OpenAiAppArea, at: string, usd: number) => {
    const row = byArea.get(area) ?? byArea.get('outro')!
    const d = new Date(at)
    if (isSameMonth(d, now)) {
      row.monthUsd += usd
      row.monthCalls += 1
    }
    if (isSameDay(d, now)) {
      row.todayUsd += usd
      row.todayCalls += 1
    }
  }

  for (const r of listCentralOpenAiUsage()) {
    add(r.area, r.at, r.estimatedUsd)
  }

  const byAreaList = [...byArea.values()].sort((a, b) => b.monthUsd - a.monthUsd)
  const monthUsd = byAreaList.reduce((s, r) => s + r.monthUsd, 0)
  const todayUsd = byAreaList.reduce((s, r) => s + r.todayUsd, 0)
  const monthCalls = byAreaList.reduce((s, r) => s + r.monthCalls, 0)
  const todayCalls = byAreaList.reduce((s, r) => s + r.todayCalls, 0)

  return {
    monthUsd,
    todayUsd,
    monthCalls,
    todayCalls,
    byArea: byAreaList,
    remainingBudgetUsd: Math.max(0, settings.monthlyBudgetUsd - monthUsd),
    remainingCallsToday: Math.max(0, settings.maxCallsPerDay - todayCalls),
  }
}

export function openaiHeadersFromCentral(): HeadersInit {
  const s = loadCentralOpenAiSettings()
  const h: Record<string, string> = {}
  if (s.apiKey.trim()) h['X-OpenAI-Key'] = s.apiKey.trim()
  return h
}

export { todayIsoDay }
