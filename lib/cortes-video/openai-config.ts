import {
  DEFAULT_CORTES_OPENAI,
  type CortesOpenAiSettings,
} from '@/lib/cortes-video/types'
import {
  loadCentralOpenAiSettings,
  registerOpenAiAreaUsage,
  saveCentralOpenAiSettings,
} from '@/lib/openai/central-openai'

const SETTINGS_KEY = 'cortes_openai_settings_v1'
const USAGE_KEY = 'cortes_openai_usage_v1'

type UsageDay = { day: string; calls: number; costUsd: number }

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

export function loadCortesOpenAiSettings(): CortesOpenAiSettings {
  const central = loadCentralOpenAiSettings()
  const stored = readJson<Partial<CortesOpenAiSettings>>(SETTINGS_KEY, {})
  return {
    ...DEFAULT_CORTES_OPENAI,
    ...stored,
    apiKey: central.apiKey || (typeof stored.apiKey === 'string' ? stored.apiKey.trim() : ''),
    enabled: central.apiKey ? central.enabled : Boolean(stored.enabled),
    monthlyBudgetUsd: central.monthlyBudgetUsd || DEFAULT_CORTES_OPENAI.monthlyBudgetUsd,
    maxCallsPerDay: central.maxCallsPerDay || DEFAULT_CORTES_OPENAI.maxCallsPerDay,
  }
}

export function saveCortesOpenAiSettings(settings: CortesOpenAiSettings) {
  writeJson(SETTINGS_KEY, { ...settings, apiKey: settings.apiKey.trim() })
  const central = loadCentralOpenAiSettings()
  saveCentralOpenAiSettings({
    ...central,
    apiKey: settings.apiKey.trim() || central.apiKey,
    enabled: settings.enabled,
    monthlyBudgetUsd: settings.monthlyBudgetUsd,
    maxCallsPerDay: settings.maxCallsPerDay,
  })
}

export function maskOpenAiKey(key: string): string {
  const k = key.trim()
  if (k.length <= 8) return k ? '••••••••' : ''
  return `${k.slice(0, 3)}…${k.slice(-4)}`
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function registerCortesOpenAiCall(costUsd: number, feature = 'cortes') {
  const list = readJson<UsageDay[]>(USAGE_KEY, [])
  const day = todayKey()
  const idx = list.findIndex((d) => d.day === day)
  if (idx >= 0) {
    list[idx]!.calls += 1
    list[idx]!.costUsd += costUsd
  } else {
    list.push({ day, calls: 1, costUsd })
  }
  writeJson(USAGE_KEY, list.slice(-60))
  registerOpenAiAreaUsage({
    area: 'cortes_video',
    estimatedUsd: costUsd,
    feature,
    model: 'openai',
  })
}

export function cortesOpenAiUsageToday(): { calls: number; costUsd: number } {
  const list = readJson<UsageDay[]>(USAGE_KEY, [])
  const row = list.find((d) => d.day === todayKey())
  return { calls: row?.calls ?? 0, costUsd: row?.costUsd ?? 0 }
}

export function canCallCortesOpenAi(settings: CortesOpenAiSettings): {
  ok: boolean
  reason?: string
} {
  if (!settings.enabled) {
    return {
      ok: false,
      reason: 'OpenAI desactivada. Activa em Configurações ou no painel OpenAI.',
    }
  }
  const u = cortesOpenAiUsageToday()
  if (u.calls >= settings.maxCallsPerDay) {
    return { ok: false, reason: 'Limite diário de chamadas atingido.' }
  }
  return { ok: true }
}

export function openaiHeaders(settings: CortesOpenAiSettings): HeadersInit {
  const h: Record<string, string> = {}
  const key = settings.apiKey.trim() || loadCentralOpenAiSettings().apiKey.trim()
  if (key) h['X-OpenAI-Key'] = key
  return h
}
