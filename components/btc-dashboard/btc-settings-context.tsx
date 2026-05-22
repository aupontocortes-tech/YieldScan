'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  flushYieldscanSqlitePersist,
  kvGetJson,
  kvSetJson,
  openYieldscanSqlite,
} from '@/lib/client-db/sqlite-core'
import type {
  BollingerSettings,
  BullMarketSupportBandSettings,
  CandlestickSettings,
  Sma200DailySettings,
  Sma50WeeklySettings,
  MaConfig,
  MacdSettings,
  OnChainBundle,
  RsiSettings,
  StochSettings,
  TimeframePreset,
  ZonesSettings,
} from '@/lib/btc/types'
import {
  getDefaultIndicatorPair,
  getIndicatorPair,
  type IndicatorPair,
} from '@/lib/btc/indicator-pairs'
import { TIMEFRAME_PRESETS } from '@/lib/btc/types'

/** Intervalo inicial do gráfico de indicadores (antes da hidratação e após “Repor tudo”). */
const DEFAULT_TIMEFRAME_ID = '1d'

const DEFAULT_MAS: MaConfig[] = []

const DEFAULT_RSI: RsiSettings = {
  enabled: false,
  period: 14,
  oversold: 30,
  overbought: 70,
  showLevels: true,
  view: 'panel',
  lineWidth: 2,
  colors: { line: '#d4af37', oversold: '#22c55e', overbought: '#ef4444' },
}

const DEFAULT_MACD: MacdSettings = {
  enabled: false,
  fast: 12,
  slow: 26,
  signal: 9,
  view: 'panel',
  lineWidth: 2,
  colors: { line: '#d4af37', signal: '#94a3b8' },
}

const DEFAULT_STOCH: StochSettings = {
  enabled: false,
  kPeriod: 14,
  dPeriod: 3,
  smooth: 3,
  view: 'panel',
  lineWidth: 2,
  colors: { k: '#d4af37', d: '#a78bfa' },
}

const DEFAULT_BOLLINGER: BollingerSettings = {
  enabled: false,
  period: 20,
  stdDev: 2,
  showUpper: true,
  showMiddle: true,
  showLower: true,
  lineWidth: 2,
  colors: { upper: '#71717a', middle: '#d4af37', lower: '#52525b' },
}

const DEFAULT_ZONES: ZonesSettings = {
  enabled: false,
  showMaZones: true,
  showSupportResistance: true,
  showSmartMultipliers: false,
}

const DEFAULT_CANDLES: CandlestickSettings = {
  colors: { up: '#14b8a6', down: '#f43f5e', wickDown: '#f43f5e' },
}

const DEFAULT_ON_CHAIN: OnChainBundle = {
  mvrv: {
    enabled: false,
    color: '#22c55e',
    lineWidth: 2,
    style: 'line',
    smaPeriod: 200,
  },
  mvrvZ: {
    enabled: false,
    color: '#a78bfa',
    lineWidth: 2,
    style: 'line',
    window: 90,
  },
  sopr: {
    enabled: false,
    color: '#38bdf8',
    lineWidth: 2,
    style: 'line',
    emaPeriod: 14,
  },
  nupl: {
    enabled: false,
    color: '#fbbf24',
    lineWidth: 2,
    style: 'area',
    smaPeriod: 200,
  },
  sthLth: {
    enabled: false,
    rsiPeriod: 10,
    smaPeriod: 200,
    lineWidth: 2,
    colorSth: '#7dd3fc',
    colorLth: '#d4af37',
  },
}

const DEFAULT_BULL_MARKET_BAND: BullMarketSupportBandSettings = {
  enabled: false,
  lineWidth: 2,
  colorSma: '#22c55e',
  colorEma: '#ef4444',
  colorFill: '#a16207',
}

const DEFAULT_SMA_200_DAILY: Sma200DailySettings = {
  enabled: false,
  lineWidth: 2,
  color: '#fbbf24',
}

const DEFAULT_SMA_50_WEEKLY: Sma50WeeklySettings = {
  enabled: false,
  lineWidth: 2,
  color: '#38bdf8',
}

const BTC_KV = 'btc_dashboard_v2' as const
const LS_MIRROR = 'yieldscan_btc_layout_v2' as const

type BtcPersistV2 = {
  v: 2
  timeframeId: string
  /** Par do gráfico (ex. binance-btcusdt, coingecko-tesla-xstock). */
  pairId?: string
  mas: MaConfig[]
  rsi: RsiSettings
  macd: MacdSettings
  stoch: StochSettings
  bollinger: BollingerSettings
  zones: ZonesSettings
  candles: CandlestickSettings
  onChain: OnChainBundle
  bullMarketBand?: BullMarketSupportBandSettings
  sma200Daily?: Sma200DailySettings
  sma50Weekly?: Sma50WeeklySettings
  /** Legado: migrado para sma50Weekly se estiver ligado. */
  cycleBottomAlerts?: { enabled?: boolean }
}

/** Migração de estado antigo (v1 em btc_dashboard_v1). */
type BtcPersistV1 = {
  v: 1
  timeframeId: string
  mas: MaConfig[]
  rsi: RsiSettings
  macd: MacdSettings
  stoch: StochSettings
  bollinger: BollingerSettings
  zones: ZonesSettings
  candles: CandlestickSettings
}

function normalizeMa(m: MaConfig): MaConfig {
  const lw = m.lineWidth
  return {
    ...m,
    lineWidth: lw === 1 || lw === 2 || lw === 3 ? lw : 2,
  }
}

function validMasList(x: unknown): x is MaConfig[] {
  if (!Array.isArray(x)) return false
  if (x.length === 0) return true
  return x.every(
    (m) =>
      m &&
      typeof m === 'object' &&
      typeof (m as MaConfig).id === 'string' &&
      typeof (m as MaConfig).period === 'number' &&
      ((m as MaConfig).type === 'SMA' || (m as MaConfig).type === 'EMA') &&
      typeof (m as MaConfig).color === 'string',
  )
}

function mergeRsi(r: Partial<RsiSettings> | undefined): RsiSettings {
  return {
    ...DEFAULT_RSI,
    ...r,
    colors: { ...DEFAULT_RSI.colors, ...r?.colors },
    view: r?.view === 'overlay' ? 'overlay' : 'panel',
    lineWidth: r?.lineWidth === 1 || r?.lineWidth === 3 ? r.lineWidth : r?.lineWidth === 2 ? 2 : DEFAULT_RSI.lineWidth,
  }
}

function mergeMacd(m: Partial<MacdSettings> | undefined): MacdSettings {
  return {
    ...DEFAULT_MACD,
    ...m,
    colors: { ...DEFAULT_MACD.colors, ...m?.colors },
    view: m?.view === 'overlay' ? 'overlay' : 'panel',
    lineWidth: m?.lineWidth === 1 || m?.lineWidth === 3 ? m.lineWidth : m?.lineWidth === 2 ? 2 : DEFAULT_MACD.lineWidth,
  }
}

function mergeStoch(st: Partial<StochSettings> | undefined): StochSettings {
  return {
    ...DEFAULT_STOCH,
    ...st,
    colors: { ...DEFAULT_STOCH.colors, ...st?.colors },
    view: st?.view === 'overlay' ? 'overlay' : 'panel',
    lineWidth: st?.lineWidth === 1 || st?.lineWidth === 3 ? st.lineWidth : st?.lineWidth === 2 ? 2 : DEFAULT_STOCH.lineWidth,
  }
}

function mergeBollinger(b: Partial<BollingerSettings> | undefined): BollingerSettings {
  return {
    ...DEFAULT_BOLLINGER,
    ...b,
    colors: { ...DEFAULT_BOLLINGER.colors, ...b?.colors },
    lineWidth: b?.lineWidth === 1 || b?.lineWidth === 3 ? b.lineWidth : b?.lineWidth === 2 ? 2 : DEFAULT_BOLLINGER.lineWidth,
  }
}

function mergeOnChain(o: Partial<OnChainBundle> | undefined): OnChainBundle {
  return {
    mvrv: { ...DEFAULT_ON_CHAIN.mvrv, ...o?.mvrv },
    mvrvZ: { ...DEFAULT_ON_CHAIN.mvrvZ, ...o?.mvrvZ },
    sopr: { ...DEFAULT_ON_CHAIN.sopr, ...o?.sopr },
    nupl: { ...DEFAULT_ON_CHAIN.nupl, ...o?.nupl },
    sthLth: { ...DEFAULT_ON_CHAIN.sthLth, ...o?.sthLth },
  }
}

function mergeBullMarketBand(b: Partial<BullMarketSupportBandSettings> | undefined): BullMarketSupportBandSettings {
  const lw = b?.lineWidth
  return {
    ...DEFAULT_BULL_MARKET_BAND,
    ...b,
    lineWidth: lw === 1 || lw === 2 || lw === 3 ? lw : DEFAULT_BULL_MARKET_BAND.lineWidth,
  }
}

type Ctx = {
  pair: IndicatorPair
  setPair: (p: IndicatorPair) => void
  timeframe: TimeframePreset
  setTimeframe: (t: TimeframePreset) => void
  mas: MaConfig[]
  setMas: (m: MaConfig[]) => void
  addMa: () => void
  updateMa: (id: string, patch: Partial<MaConfig>) => void
  removeMa: (id: string) => void
  rsi: RsiSettings
  setRsi: (r: RsiSettings) => void
  macd: MacdSettings
  setMacd: (m: MacdSettings) => void
  stoch: StochSettings
  setStoch: (s: StochSettings) => void
  bollinger: BollingerSettings
  setBollinger: (b: BollingerSettings) => void
  zones: ZonesSettings
  setZones: (z: ZonesSettings) => void
  candles: CandlestickSettings
  setCandles: (c: CandlestickSettings) => void
  onChain: OnChainBundle
  setOnChain: (o: OnChainBundle | ((prev: OnChainBundle) => OnChainBundle)) => void
  bullMarketBand: BullMarketSupportBandSettings
  setBullMarketBand: (b: BullMarketSupportBandSettings) => void
  sma200Daily: Sma200DailySettings
  setSma200Daily: (s: Sma200DailySettings) => void
  sma50Weekly: Sma50WeeklySettings
  setSma50Weekly: (s: Sma50WeeklySettings) => void
  resetDefaults: () => void
}

const BtcSettingsContext = createContext<Ctx | null>(null)

function newMaId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? `ma-${crypto.randomUUID()}`
    : `ma-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function BtcSettingsProvider({ children }: { children: ReactNode }) {
  const [pair, setPair] = useState<IndicatorPair>(() => getDefaultIndicatorPair())
  const [timeframe, setTimeframe] = useState<TimeframePreset>(
    () => TIMEFRAME_PRESETS.find((t) => t.id === DEFAULT_TIMEFRAME_ID) ?? TIMEFRAME_PRESETS[3],
  )
  const [mas, setMas] = useState<MaConfig[]>(() => [])
  const [rsi, setRsi] = useState<RsiSettings>(() => ({ ...DEFAULT_RSI }))
  const [macd, setMacd] = useState<MacdSettings>(() => ({ ...DEFAULT_MACD }))
  const [stoch, setStoch] = useState<StochSettings>(() => ({ ...DEFAULT_STOCH }))
  const [bollinger, setBollinger] = useState<BollingerSettings>(() => ({ ...DEFAULT_BOLLINGER }))
  const [zones, setZones] = useState<ZonesSettings>(() => ({ ...DEFAULT_ZONES }))
  const [candles, setCandles] = useState<CandlestickSettings>(() => ({ ...DEFAULT_CANDLES }))
  const [onChain, setOnChainState] = useState<OnChainBundle>(() => mergeOnChain(undefined))
  const [bullMarketBand, setBullMarketBand] = useState<BullMarketSupportBandSettings>(() => ({
    ...DEFAULT_BULL_MARKET_BAND,
  }))
  const [sma200Daily, setSma200Daily] = useState<Sma200DailySettings>(() => ({ ...DEFAULT_SMA_200_DAILY }))
  const [sma50Weekly, setSma50Weekly] = useState<Sma50WeeklySettings>(() => ({ ...DEFAULT_SMA_50_WEEKLY }))
  const [hydrated, setHydrated] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistRef = useRef<BtcPersistV2 | null>(null)

  const setOnChain = useCallback((o: OnChainBundle | ((prev: OnChainBundle) => OnChainBundle)) => {
    setOnChainState((prev) => (typeof o === 'function' ? o(prev) : o))
  }, [])

  persistRef.current = {
    v: 2,
    timeframeId: timeframe.id,
    pairId: pair.id,
    mas,
    rsi,
    macd,
    stoch,
    bollinger,
    zones,
    candles,
    onChain,
    bullMarketBand,
    sma200Daily,
    sma50Weekly,
  }

  useEffect(() => {
    let cancel = false

    const applyV2 = (v2: BtcPersistV2) => {
      const tf = TIMEFRAME_PRESETS.find((t) => t.id === v2.timeframeId)
      if (tf) setTimeframe(tf)
      if (v2.pairId) {
        const p = getIndicatorPair(v2.pairId)
        if (p) setPair(p)
      }
      if (validMasList(v2.mas)) setMas(v2.mas.map((m) => normalizeMa({ ...m })))
      setRsi(mergeRsi(v2.rsi))
      setMacd(mergeMacd(v2.macd))
      setStoch(mergeStoch(v2.stoch))
      setBollinger(mergeBollinger(v2.bollinger))
      if (v2.zones && typeof v2.zones === 'object') setZones({ ...DEFAULT_ZONES, ...v2.zones })
      if (v2.candles && typeof v2.candles === 'object') {
        const c = v2.candles
        setCandles({
          ...DEFAULT_CANDLES,
          ...c,
          colors: { ...DEFAULT_CANDLES.colors, ...c.colors },
        })
      }
      setOnChainState(mergeOnChain(v2.onChain))
      if (v2.bullMarketBand && typeof v2.bullMarketBand === 'object') {
        setBullMarketBand(mergeBullMarketBand(v2.bullMarketBand))
      }
      if (v2.sma200Daily && typeof v2.sma200Daily === 'object') {
        const s = v2.sma200Daily
        setSma200Daily({
          ...DEFAULT_SMA_200_DAILY,
          ...s,
          lineWidth: s.lineWidth === 1 || s.lineWidth === 3 ? s.lineWidth : 2,
        })
      }
      if (v2.sma50Weekly && typeof v2.sma50Weekly === 'object') {
        const s = v2.sma50Weekly
        setSma50Weekly({
          ...DEFAULT_SMA_50_WEEKLY,
          ...s,
          lineWidth: s.lineWidth === 1 || s.lineWidth === 3 ? s.lineWidth : 2,
        })
      } else if (v2.cycleBottomAlerts?.enabled) {
        setSma50Weekly({ ...DEFAULT_SMA_50_WEEKLY, enabled: true })
      }
    }

    const applyV1 = (s: BtcPersistV1) => {
      const tf = TIMEFRAME_PRESETS.find((t) => t.id === s.timeframeId)
      if (tf) setTimeframe(tf)
      if (validMasList(s.mas)) setMas(s.mas.map((m) => normalizeMa({ ...m, lineWidth: 2 })))
      setRsi(mergeRsi(s.rsi as RsiSettings))
      setMacd(mergeMacd(s.macd as MacdSettings))
      setStoch(mergeStoch(s.stoch as StochSettings))
      setBollinger(mergeBollinger(s.bollinger as BollingerSettings))
      if (s.zones && typeof s.zones === 'object') setZones({ ...DEFAULT_ZONES, ...s.zones })
      if (s.candles && typeof s.candles === 'object') {
        const c = s.candles as CandlestickSettings
        setCandles({
          ...DEFAULT_CANDLES,
          ...c,
          colors: { ...DEFAULT_CANDLES.colors, ...c.colors },
        })
      }
    }

    const loadFromMirror = () => {
      try {
        if (typeof localStorage === 'undefined') return
        const raw = localStorage.getItem(LS_MIRROR)
        if (!raw?.trim()) return
        const parsed = JSON.parse(raw) as BtcPersistV2
        if (parsed?.v === 2) applyV2(parsed)
      } catch {
        /* ignore */
      }
    }

    loadFromMirror()
    if (!cancel) setHydrated(true)

    void openYieldscanSqlite()
      .then(() => {
        if (cancel) return
        const v2 = kvGetJson<BtcPersistV2>(BTC_KV)
        if (v2?.v === 2) {
          applyV2(v2)
          return
        }
        const s = kvGetJson<BtcPersistV1>('btc_dashboard_v1')
        if (s?.v === 1) applyV1(s)
      })
      .catch(() => {
        /* WASM/IDB indisponível — prefs já vindas do mirror ou defaults */
      })

    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      const snap = persistRef.current
      if (snap) {
        kvSetJson(BTC_KV, snap)
        try {
          if (typeof localStorage !== 'undefined') localStorage.setItem(LS_MIRROR, JSON.stringify(snap))
        } catch {
          /* ignore */
        }
      }
    }, 450)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [
    hydrated,
    pair.id,
    timeframe.id,
    mas,
    rsi,
    macd,
    stoch,
    bollinger,
    zones,
    candles,
    onChain,
    bullMarketBand,
    sma200Daily,
    sma50Weekly,
  ])

  useEffect(() => {
    if (!hydrated) return
    const persistNow = () => {
      const snap = persistRef.current
      if (!snap) return
      kvSetJson(BTC_KV, snap)
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(LS_MIRROR, JSON.stringify(snap))
      } catch {
        /* ignore */
      }
      void flushYieldscanSqlitePersist()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persistNow()
    }
    window.addEventListener('pagehide', persistNow)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', persistNow)
      document.removeEventListener('visibilitychange', onVisibility)
      persistNow()
    }
  }, [hydrated])

  const addMa = useCallback(() => {
    setMas((prev) => [...prev, { id: newMaId(), period: 20, type: 'EMA', color: '#d4af37', lineWidth: 2 }])
  }, [])

  const updateMa = useCallback((id: string, patch: Partial<MaConfig>) => {
    setMas((prev) => prev.map((m) => (m.id === id ? normalizeMa({ ...m, ...patch }) : m)))
  }, [])

  const removeMa = useCallback((id: string) => {
    setMas((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const resetDefaults = useCallback(() => {
    setPair(getDefaultIndicatorPair())
    setTimeframe(TIMEFRAME_PRESETS.find((t) => t.id === DEFAULT_TIMEFRAME_ID) ?? TIMEFRAME_PRESETS[3])
    setMas(DEFAULT_MAS.map((m) => ({ ...m })))
    setRsi({ ...DEFAULT_RSI })
    setMacd({ ...DEFAULT_MACD })
    setStoch({ ...DEFAULT_STOCH })
    setBollinger({ ...DEFAULT_BOLLINGER })
    setZones({ ...DEFAULT_ZONES })
    setCandles({ ...DEFAULT_CANDLES })
    setOnChainState(mergeOnChain(undefined))
    setBullMarketBand({ ...DEFAULT_BULL_MARKET_BAND })
    setSma200Daily({ ...DEFAULT_SMA_200_DAILY })
    setSma50Weekly({ ...DEFAULT_SMA_50_WEEKLY })
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_MIRROR)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(
    () => ({
      pair,
      setPair,
      timeframe,
      setTimeframe,
      mas,
      setMas,
      addMa,
      updateMa,
      removeMa,
      rsi,
      setRsi,
      macd,
      setMacd,
      stoch,
      setStoch,
      bollinger,
      setBollinger,
      zones,
      setZones,
      candles,
      setCandles,
      onChain,
      setOnChain,
      bullMarketBand,
      setBullMarketBand,
      sma200Daily,
      setSma200Daily,
      sma50Weekly,
      setSma50Weekly,
      resetDefaults,
    }),
    [
      pair,
      timeframe,
      mas,
      rsi,
      macd,
      stoch,
      bollinger,
      zones,
      candles,
      onChain,
      bullMarketBand,
      sma200Daily,
      sma50Weekly,
      addMa,
      updateMa,
      removeMa,
      setOnChain,
      resetDefaults,
    ],
  )

  return <BtcSettingsContext.Provider value={value}>{children}</BtcSettingsContext.Provider>
}

export function useBtcSettings() {
  const c = useContext(BtcSettingsContext)
  if (!c) throw new Error('useBtcSettings must be used within BtcSettingsProvider')
  return c
}
