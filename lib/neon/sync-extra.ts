import { readCalculatorPersist, writeCalculatorPersist, type CalculatorPersistV3 } from '@/lib/calculator/persist'
import {
  DEFAULT_GF_OPENAI_SETTINGS,
  loadGfOpenAiSettings,
  saveGfOpenAiSettings,
} from '@/lib/gestao-financeira/openai-config'
import {
  dismissTodoNotifyPrompt,
  isTodoNotifyEnabled,
  isTodoNotifyPromptDismissed,
  setTodoNotifyEnabled,
} from '@/lib/gestao-financeira/todo-notifications'
import type { GfOpenAiSettings } from '@/lib/gestao-financeira/types'
import { kvSetJson, openYieldscanSqlite } from '@/lib/client-db/sqlite-core'
import {
  DEFAULT_MERCADO_DISPLAY_PREFS,
  readMercadoDisplayPrefs,
  writeMercadoDisplayPrefs,
  type MercadoDisplayPrefs,
} from '@/lib/mercado-display-prefs'
import { readStoredHighlightIds, writeStoredHighlightIds } from '@/lib/mercado-highlight-ids'
import {
  readHighlightIconMap,
  writeHighlightIconMap,
  type HighlightIconMap,
} from '@/lib/mercado-highlight-icons-store'
import { getNewsSeenMap } from '@/lib/news/news-seen'
import { getNewsTtsHeardMap } from '@/lib/news/news-tts-heard'
import { isRemoteNewer, pullNeonSync, pushNeonSync } from '@/lib/neon/sync-client'
import { registerNeonPushHandler } from '@/lib/neon/sync-schedule'
import { writeSyncMeta } from '@/lib/neon/sync-meta'
import { readTendenciasPrefs, writeTendenciasPrefs } from '@/lib/tendencias/prefs'
import { DEFAULT_TENDENCIAS_PREFS, type TendenciasPrefs } from '@/lib/tendencias/types'
import { readUnlocksRecent, type UnlocksRecentCoin } from '@/lib/unlocks-recent'
import { readSavedWallets, writeSavedWallets, type SavedWalletRecord } from '@/lib/wallet-saved-storage'

export const NEON_MERCADO_CHANGED = 'yieldscan-neon-mercado-changed'
export const NEON_TENDENCIAS_CHANGED = 'yieldscan-neon-tendencias-changed'
export const NEON_WALLETS_CHANGED = 'yieldscan-neon-wallets-changed'
export const NEON_CALCULATOR_CHANGED = 'yieldscan-neon-calculator-changed'
export const NEON_NEWS_STATE_CHANGED = 'yieldscan-neon-news-state-changed'
export const NEON_GF_PREFS_CHANGED = 'yieldscan-neon-gf-prefs-changed'

type MercadoNeonPayload = {
  v: 1
  display: MercadoDisplayPrefs
  highlightIds: string[]
  highlightIcons: HighlightIconMap
  exportedAt: string
}

type TendenciasNeonPayload = {
  v: 1
  prefs: TendenciasPrefs
  exportedAt: string
}

type WalletsNeonPayload = {
  v: 1
  wallets: SavedWalletRecord[]
  exportedAt: string
}

type CalculatorNeonPayload = {
  v: 1
  state: CalculatorPersistV3
  exportedAt: string
}

type NewsStateNeonPayload = {
  v: 1
  seen: Record<string, number>
  ttsHeard: Record<string, number>
  exportedAt: string
}

type UnlocksNeonPayload = {
  v: 1
  recent: UnlocksRecentCoin[]
  exportedAt: string
}

type PoolsNeonPayload = {
  v: 1
  seenChains: string[]
  exportedAt: string
}

export type GfPrefsNeonPayload = {
  v: 1
  openAi: Pick<GfOpenAiSettings, 'enabled' | 'monthlyBudgetUsd' | 'maxCallsPerDay'>
  todoNotifyEnabled: boolean
  todoNotifyPromptDismissed: boolean
  exportedAt: string
}

function dispatch(name: string): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name))
}

function hasMercadoLocal(): boolean {
  const display = readMercadoDisplayPrefs()
  const ids = readStoredHighlightIds()
  const icons = readHighlightIconMap()
  const displayChanged =
    display.displayFiat !== DEFAULT_MERCADO_DISPLAY_PREFS.displayFiat ||
    Object.keys(display.displayFiatByCoinId).length > 0 ||
    Object.keys(display.priceOverrides).length > 0
  return displayChanged || ids != null || Object.keys(icons).length > 0
}

function readMercadoPayload(): MercadoNeonPayload {
  return {
    v: 1,
    display: readMercadoDisplayPrefs(),
    highlightIds: readStoredHighlightIds() ?? [],
    highlightIcons: readHighlightIconMap(),
    exportedAt: new Date().toISOString(),
  }
}

function applyMercadoPayload(payload: MercadoNeonPayload): void {
  writeMercadoDisplayPrefs(payload.display, { skipNeon: true })
  if (payload.highlightIds.length > 0) writeStoredHighlightIds(payload.highlightIds, { skipNeon: true })
  writeHighlightIconMap(payload.highlightIcons, { skipNeon: true })
  dispatch(NEON_MERCADO_CHANGED)
}

function hasTendenciasLocal(): boolean {
  const p = readTendenciasPrefs()
  return (
    p.momentumPeriod !== DEFAULT_TENDENCIAS_PREFS.momentumPeriod ||
    p.analysisTone !== DEFAULT_TENDENCIAS_PREFS.analysisTone
  )
}

function hasWalletsLocal(): boolean {
  return readSavedWallets().length > 0
}

function hasCalculatorLocal(): boolean {
  return readCalculatorPersist() != null
}

function hasNewsStateLocal(): boolean {
  return Object.keys(getNewsSeenMap()).length > 0 || Object.keys(getNewsTtsHeardMap()).length > 0
}

function hasUnlocksLocal(): boolean {
  return readUnlocksRecent().length > 0
}

function readPoolsSeenChains(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('yieldscan_seen_chains_v1')
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function writePoolsSeenChains(chains: string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('yieldscan_seen_chains_v1', JSON.stringify(chains))
  } catch {
    /* ignore */
  }
}

function hasPoolsLocal(): boolean {
  return readPoolsSeenChains().length > 0
}

function hasGfPrefsLocal(): boolean {
  const s = loadGfOpenAiSettings()
  return (
    s.enabled !== DEFAULT_GF_OPENAI_SETTINGS.enabled ||
    s.monthlyBudgetUsd !== DEFAULT_GF_OPENAI_SETTINGS.monthlyBudgetUsd ||
    s.maxCallsPerDay !== DEFAULT_GF_OPENAI_SETTINGS.maxCallsPerDay ||
    isTodoNotifyEnabled() ||
    isTodoNotifyPromptDismissed()
  )
}

async function pullDomain<T>(
  domain:
    | 'mercado'
    | 'tendencias'
    | 'wallets'
    | 'calculator'
    | 'news_state'
    | 'unlocks'
    | 'pools'
    | 'gf_prefs',
  isPayload: (v: unknown) => v is T,
  hasLocal: () => boolean,
  apply: (payload: T) => void,
): Promise<boolean> {
  const remote = await pullNeonSync(domain)
  if (!remote.configured || !remote.ok || !remote.payload) return false
  if (!isPayload(remote.payload)) return false
  const shouldImport = isRemoteNewer(domain, remote.updatedAt) || !hasLocal()
  if (!shouldImport) return false
  apply(remote.payload)
  if (remote.updatedAt) writeSyncMeta(domain, remote.updatedAt)
  return true
}

export async function pullMercadoFromNeon(): Promise<boolean> {
  return pullDomain(
    'mercado',
    (v): v is MercadoNeonPayload => Boolean(v && typeof v === 'object' && (v as MercadoNeonPayload).v === 1),
    hasMercadoLocal,
    applyMercadoPayload,
  )
}

export async function pushMercadoToNeonNow(): Promise<void> {
  if (!hasMercadoLocal()) return
  await pushNeonSync('mercado', readMercadoPayload())
}

export async function pullTendenciasFromNeon(): Promise<boolean> {
  return pullDomain(
    'tendencias',
    (v): v is TendenciasNeonPayload =>
      Boolean(v && typeof v === 'object' && (v as TendenciasNeonPayload).v === 1),
    hasTendenciasLocal,
    (p) => {
      writeTendenciasPrefs(p.prefs, { skipNeon: true })
      dispatch(NEON_TENDENCIAS_CHANGED)
    },
  )
}

export async function pushTendenciasToNeonNow(): Promise<void> {
  if (!hasTendenciasLocal()) return
  await pushNeonSync('tendencias', {
    v: 1,
    prefs: readTendenciasPrefs(),
    exportedAt: new Date().toISOString(),
  } satisfies TendenciasNeonPayload)
}

export async function pullWalletsFromNeon(): Promise<boolean> {
  return pullDomain(
    'wallets',
    (v): v is WalletsNeonPayload =>
      Boolean(v && typeof v === 'object' && Array.isArray((v as WalletsNeonPayload).wallets)),
    hasWalletsLocal,
    (p) => {
      writeSavedWallets(p.wallets, { skipNeon: true })
      dispatch(NEON_WALLETS_CHANGED)
    },
  )
}

export async function pushWalletsToNeonNow(): Promise<void> {
  const wallets = readSavedWallets()
  if (wallets.length === 0) return
  await pushNeonSync('wallets', {
    v: 1,
    wallets,
    exportedAt: new Date().toISOString(),
  } satisfies WalletsNeonPayload)
}

export async function pullCalculatorFromNeon(): Promise<boolean> {
  return pullDomain(
    'calculator',
    (v): v is CalculatorNeonPayload =>
      Boolean(v && typeof v === 'object' && (v as CalculatorNeonPayload).state?.v === 3),
    hasCalculatorLocal,
    (p) => {
      writeCalculatorPersist(p.state, { skipNeon: true })
      dispatch(NEON_CALCULATOR_CHANGED)
    },
  )
}

export async function pushCalculatorToNeonNow(): Promise<void> {
  const state = readCalculatorPersist()
  if (!state) return
  await pushNeonSync('calculator', {
    v: 1,
    state,
    exportedAt: new Date().toISOString(),
  } satisfies CalculatorNeonPayload)
}

function importNewsStatePayload(p: NewsStateNeonPayload): void {
  kvSetJson('news_seen_v1', p.seen)
  kvSetJson('news_tts_heard_v1', p.ttsHeard)
}

export async function pullNewsStateFromNeon(): Promise<boolean> {
  return pullDomain(
    'news_state',
    (v): v is NewsStateNeonPayload =>
      Boolean(v && typeof v === 'object' && (v as NewsStateNeonPayload).v === 1),
    hasNewsStateLocal,
    (p) => {
      importNewsStatePayload(p)
      dispatch(NEON_NEWS_STATE_CHANGED)
    },
  )
}

export async function pushNewsStateToNeonNow(): Promise<void> {
  if (!hasNewsStateLocal()) return
  await pushNeonSync('news_state', {
    v: 1,
    seen: getNewsSeenMap(),
    ttsHeard: getNewsTtsHeardMap(),
    exportedAt: new Date().toISOString(),
  } satisfies NewsStateNeonPayload)
}

export async function pullUnlocksFromNeon(): Promise<boolean> {
  return pullDomain(
    'unlocks',
    (v): v is UnlocksNeonPayload =>
      Boolean(v && typeof v === 'object' && Array.isArray((v as UnlocksNeonPayload).recent)),
    hasUnlocksLocal,
    (p) => {
      if (typeof window === 'undefined') return
      try {
        localStorage.setItem('yieldscan_unlocks_recent_v1', JSON.stringify(p.recent))
      } catch {
        /* ignore */
      }
    },
  )
}

export async function pushUnlocksToNeonNow(): Promise<void> {
  const recent = readUnlocksRecent()
  if (recent.length === 0) return
  await pushNeonSync('unlocks', {
    v: 1,
    recent,
    exportedAt: new Date().toISOString(),
  } satisfies UnlocksNeonPayload)
}

export async function pullPoolsFromNeon(): Promise<boolean> {
  return pullDomain(
    'pools',
    (v): v is PoolsNeonPayload =>
      Boolean(v && typeof v === 'object' && Array.isArray((v as PoolsNeonPayload).seenChains)),
    hasPoolsLocal,
    (p) => writePoolsSeenChains(p.seenChains),
  )
}

export async function pushPoolsToNeonNow(): Promise<void> {
  const seenChains = readPoolsSeenChains()
  if (seenChains.length === 0) return
  await pushNeonSync('pools', {
    v: 1,
    seenChains,
    exportedAt: new Date().toISOString(),
  } satisfies PoolsNeonPayload)
}

export async function pullGfPrefsFromNeon(): Promise<boolean> {
  return pullDomain(
    'gf_prefs',
    (v): v is GfPrefsNeonPayload =>
      Boolean(v && typeof v === 'object' && (v as GfPrefsNeonPayload).v === 1),
    hasGfPrefsLocal,
    (p) => {
      const local = loadGfOpenAiSettings()
      saveGfOpenAiSettings(
        {
          ...local,
          enabled: p.openAi.enabled,
          monthlyBudgetUsd: p.openAi.monthlyBudgetUsd,
          maxCallsPerDay: p.openAi.maxCallsPerDay,
        },
        { skipNeon: true },
      )
      setTodoNotifyEnabled(p.todoNotifyEnabled, { skipNeon: true })
      if (p.todoNotifyPromptDismissed) dismissTodoNotifyPrompt({ skipNeon: true })
      dispatch(NEON_GF_PREFS_CHANGED)
    },
  )
}

export async function pushGfPrefsToNeonNow(): Promise<void> {
  if (!hasGfPrefsLocal()) return
  const s = loadGfOpenAiSettings()
  await pushNeonSync('gf_prefs', {
    v: 1,
    openAi: {
      enabled: s.enabled,
      monthlyBudgetUsd: s.monthlyBudgetUsd,
      maxCallsPerDay: s.maxCallsPerDay,
    },
    todoNotifyEnabled: isTodoNotifyEnabled(),
    todoNotifyPromptDismissed: isTodoNotifyPromptDismissed(),
    exportedAt: new Date().toISOString(),
  } satisfies GfPrefsNeonPayload)
}

async function pullAllExtraFromNeon(): Promise<void> {
  await openYieldscanSqlite().catch(() => {})
  await pullMercadoFromNeon()
  await pullTendenciasFromNeon()
  await pullWalletsFromNeon()
  await pullCalculatorFromNeon()
  await pullNewsStateFromNeon()
  await pullUnlocksFromNeon()
  await pullPoolsFromNeon()
  await pullGfPrefsFromNeon()
}

function registerHandlers(): void {
  registerNeonPushHandler('mercado', () => pushMercadoToNeonNow())
  registerNeonPushHandler('tendencias', () => pushTendenciasToNeonNow())
  registerNeonPushHandler('wallets', () => pushWalletsToNeonNow())
  registerNeonPushHandler('calculator', () => pushCalculatorToNeonNow())
  registerNeonPushHandler('news_state', () => pushNewsStateToNeonNow())
  registerNeonPushHandler('unlocks', () => pushUnlocksToNeonNow())
  registerNeonPushHandler('pools', () => pushPoolsToNeonNow())
  registerNeonPushHandler('gf_prefs', () => pushGfPrefsToNeonNow())
}

let handlersRegistered = false

export function initExtraNeonSync(): () => void {
  if (typeof window === 'undefined') return () => {}

  if (!handlersRegistered) {
    registerHandlers()
    handlersRegistered = true
  }

  void pullAllExtraFromNeon()

  const poll = window.setInterval(() => {
    void pushNewsStateToNeonNow()
    void pushPoolsToNeonNow()
  }, 120_000)

  return () => {
    window.clearInterval(poll)
  }
}
