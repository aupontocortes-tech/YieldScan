import type {
  GfOpenAiSettings,
  GfOpenAiUsageRecord,
  GfOpenAiUsageSummary,
} from '@/lib/gestao-financeira/types'
import { scheduleNeonPush } from '@/lib/neon/sync-schedule'

const SETTINGS_KEY = 'gf_openai_settings_v1'
const USAGE_KEY = 'gf_openai_usage_v1'

export const DEFAULT_GF_OPENAI_SETTINGS: GfOpenAiSettings = {
  apiKey: '',
  enabled: false,
  monthlyBudgetUsd: 2,
  maxCallsPerDay: 100,
}

/** Preços aproximados gpt-4o-mini (USD por 1M tokens). */
const PRICE_INPUT_PER_M = 0.15
const PRICE_OUTPUT_PER_M = 0.6
/** Whisper-1: ~USD 0.006 por minuto de áudio. */
const WHISPER_USD_PER_MINUTE = 0.006

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

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

export function loadGfOpenAiSettings(): GfOpenAiSettings {
  const stored = readJson<Partial<GfOpenAiSettings>>(SETTINGS_KEY, {})
  return {
    ...DEFAULT_GF_OPENAI_SETTINGS,
    ...stored,
    apiKey: typeof stored.apiKey === 'string' ? stored.apiKey.trim() : '',
    monthlyBudgetUsd:
      typeof stored.monthlyBudgetUsd === 'number'
        ? stored.monthlyBudgetUsd
        : DEFAULT_GF_OPENAI_SETTINGS.monthlyBudgetUsd,
    maxCallsPerDay:
      typeof stored.maxCallsPerDay === 'number'
        ? stored.maxCallsPerDay
        : DEFAULT_GF_OPENAI_SETTINGS.maxCallsPerDay,
  }
}

export function saveGfOpenAiSettings(settings: GfOpenAiSettings, opts?: { skipNeon?: boolean }): void {
  writeJson(SETTINGS_KEY, {
    ...settings,
    apiKey: settings.apiKey.trim(),
  })
  if (!opts?.skipNeon) scheduleNeonPush('gf_prefs')
}

export function maskOpenAiKey(key: string): string {
  const k = key.trim()
  if (k.length <= 8) return k ? '••••••••' : ''
  return `${k.slice(0, 3)}…${k.slice(-4)}`
}

export function estimateOpenAiCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  if (model.includes('gpt-4o-mini')) {
    return (promptTokens * PRICE_INPUT_PER_M + completionTokens * PRICE_OUTPUT_PER_M) / 1_000_000
  }
  return (promptTokens * 2.5 + completionTokens * 10) / 1_000_000
}

export function estimateWhisperCostUsd(durationSeconds: number): number {
  const minutes = Math.max(durationSeconds, 1) / 60
  return minutes * WHISPER_USD_PER_MINUTE
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export function listGfOpenAiUsageRecords(): GfOpenAiUsageRecord[] {
  return readJson<GfOpenAiUsageRecord[]>(USAGE_KEY, [])
}

export function appendGfOpenAiUsage(record: Omit<GfOpenAiUsageRecord, 'id'>): GfOpenAiUsageRecord {
  const full: GfOpenAiUsageRecord = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `usage-${Date.now()}`,
    ...record,
  }
  const list = listGfOpenAiUsageRecords()
  list.unshift(full)
  writeJson(USAGE_KEY, list.slice(0, 500))
  return full
}

export function clearGfOpenAiUsage(): void {
  writeJson(USAGE_KEY, [])
}

/** Remove só as chamadas de hoje — libera o limite diário sem apagar o histórico do mês. */
export function clearGfOpenAiUsageToday(): number {
  const now = new Date()
  const records = listGfOpenAiUsageRecords()
  const kept = records.filter((r) => !isSameDay(new Date(r.at), now))
  const removed = records.length - kept.length
  writeJson(USAGE_KEY, kept)
  return removed
}

/** Regista uma chamada fictícia mínima (só neste dispositivo) para testar o contador. */
export function registerGfOpenAiTestCall(): void {
  appendGfOpenAiUsage({
    at: new Date().toISOString(),
    feature: 'parse-voice',
    model: 'gpt-4o-mini',
    promptTokens: 80,
    completionTokens: 40,
    estimatedUsd: 0.00004,
  })
}

export function usdToBrl(usd: number, brlPerUsd: number): number {
  return usd * brlPerUsd
}

export function summarizeGfOpenAiUsage(
  settings: GfOpenAiSettings,
  brlPerUsd = 5.1,
): GfOpenAiUsageSummary {
  const now = new Date()
  const records = listGfOpenAiUsageRecords()
  const monthRecords = records.filter((r) => isSameMonth(new Date(r.at), now))
  const todayRecords = records.filter((r) => isSameDay(new Date(r.at), now))

  const monthEstimatedUsd = monthRecords.reduce((s, r) => s + r.estimatedUsd, 0)
  const todayEstimatedUsd = todayRecords.reduce((s, r) => s + r.estimatedUsd, 0)
  const monthPromptTokens = monthRecords.reduce((s, r) => s + r.promptTokens, 0)
  const monthCompletionTokens = monthRecords.reduce((s, r) => s + r.completionTokens, 0)
  const avgCallCostUsdToday =
    todayRecords.length > 0 ? todayEstimatedUsd / todayRecords.length : 0

  return {
    totalCalls: records.length,
    callsToday: todayRecords.length,
    monthEstimatedUsd,
    monthEstimatedBrl: usdToBrl(monthEstimatedUsd, brlPerUsd),
    todayEstimatedUsd,
    todayEstimatedBrl: usdToBrl(todayEstimatedUsd, brlPerUsd),
    avgCallCostUsdToday,
    avgCallCostBrlToday: usdToBrl(avgCallCostUsdToday, brlPerUsd),
    monthPromptTokens,
    monthCompletionTokens,
    remainingCallsToday: Math.max(0, settings.maxCallsPerDay - todayRecords.length),
    remainingBudgetUsd: Math.max(0, settings.monthlyBudgetUsd - monthEstimatedUsd),
    remainingBudgetBrl: usdToBrl(
      Math.max(0, settings.monthlyBudgetUsd - monthEstimatedUsd),
      brlPerUsd,
    ),
    records: records.slice(0, 30),
  }
}

export type GfOpenAiLimitCheck =
  | { ok: true }
  | { ok: false; reason: string }

export function checkGfOpenAiLimits(settings: GfOpenAiSettings): GfOpenAiLimitCheck {
  if (!settings.enabled) {
    return { ok: false, reason: 'Ative a interpretação com OpenAI nas configurações.' }
  }
  if (!settings.apiKey.trim()) {
    return { ok: false, reason: 'Informe sua chave da OpenAI nas configurações.' }
  }
  const summary = summarizeGfOpenAiUsage(settings)
  if (summary.callsToday >= settings.maxCallsPerDay) {
    return {
      ok: false,
      reason: `Limite diário atingido (${summary.callsToday}/${settings.maxCallsPerDay} chamadas). Abra «Uso da API» para aumentar o limite ou zerar o contador de hoje.`,
    }
  }
  if (summary.monthEstimatedUsd >= settings.monthlyBudgetUsd) {
    return {
      ok: false,
      reason: `Orçamento mensal estimado esgotado (US$ ${settings.monthlyBudgetUsd.toFixed(2)}).`,
    }
  }
  return { ok: true }
}
