'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type {
  BollingerSettings,
  CandlestickSettings,
  MaConfig,
  MacdSettings,
  RsiSettings,
  StochSettings,
  TimeframePreset,
  ZonesSettings,
} from '@/lib/btc/types'
import { TIMEFRAME_PRESETS } from '@/lib/btc/types'

const DEFAULT_MAS: MaConfig[] = [
  { id: 'ma-9', period: 9, type: 'EMA', color: '#D4AF37' },
  { id: 'ma-21', period: 21, type: 'EMA', color: '#E8C547' },
  { id: 'ma-50', period: 50, type: 'SMA', color: '#78716c' },
  { id: 'ma-200', period: 200, type: 'SMA', color: '#fafafa' },
]

const DEFAULT_RSI: RsiSettings = {
  enabled: true,
  period: 14,
  oversold: 30,
  overbought: 70,
  showLevels: true,
  colors: { line: '#D4AF37', oversold: '#22c55e', overbought: '#ef4444' },
}

const DEFAULT_MACD: MacdSettings = {
  enabled: true,
  fast: 12,
  slow: 26,
  signal: 9,
  colors: { line: '#D4AF37', signal: '#94a3b8' },
}

const DEFAULT_STOCH: StochSettings = {
  enabled: true,
  kPeriod: 14,
  dPeriod: 3,
  smooth: 3,
  colors: { k: '#D4AF37', d: '#a78bfa' },
}

const DEFAULT_BOLLINGER: BollingerSettings = {
  enabled: true,
  period: 20,
  stdDev: 2,
  showUpper: true,
  showMiddle: true,
  showLower: true,
  colors: { upper: '#94a3b8', middle: '#D4AF37', lower: '#64748b' },
}
const DEFAULT_ZONES: ZonesSettings = {
  enabled: true,
  showMaZones: true,
  showSupportResistance: true,
  showSmartMultipliers: true,
}

const DEFAULT_CANDLES: CandlestickSettings = {
  colors: { up: '#D4AF37', down: '#991b1b', wickDown: '#b91c1c' },
}

type Ctx = {
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
  resetDefaults: () => void
}

const BtcSettingsContext = createContext<Ctx | null>(null)

function newMaId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? `ma-${crypto.randomUUID()}`
    : `ma-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function BtcSettingsProvider({ children }: { children: ReactNode }) {
  const [timeframe, setTimeframe] = useState<TimeframePreset>(
    () => TIMEFRAME_PRESETS.find((t) => t.id === '1h') ?? TIMEFRAME_PRESETS[3]
  )
  const [mas, setMas] = useState<MaConfig[]>(() => DEFAULT_MAS.map((m) => ({ ...m })))
  const [rsi, setRsi] = useState<RsiSettings>(() => ({ ...DEFAULT_RSI }))
  const [macd, setMacd] = useState<MacdSettings>(() => ({ ...DEFAULT_MACD }))
  const [stoch, setStoch] = useState<StochSettings>(() => ({ ...DEFAULT_STOCH }))
  const [bollinger, setBollinger] = useState<BollingerSettings>(() => ({ ...DEFAULT_BOLLINGER }))
  const [zones, setZones] = useState<ZonesSettings>(() => ({ ...DEFAULT_ZONES }))
  const [candles, setCandles] = useState<CandlestickSettings>(() => ({ ...DEFAULT_CANDLES }))

  const addMa = useCallback(() => {
    setMas((prev) => [...prev, { id: newMaId(), period: 20, type: 'EMA', color: '#D4AF37' }])
  }, [])

  const updateMa = useCallback((id: string, patch: Partial<MaConfig>) => {
    setMas((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }, [])

  const removeMa = useCallback((id: string) => {
    setMas((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const resetDefaults = useCallback(() => {
    setTimeframe(TIMEFRAME_PRESETS.find((t) => t.id === '1h') ?? TIMEFRAME_PRESETS[3])
    setMas(DEFAULT_MAS.map((m) => ({ ...m })))
    setRsi({ ...DEFAULT_RSI })
    setMacd({ ...DEFAULT_MACD })
    setStoch({ ...DEFAULT_STOCH })
    setBollinger({ ...DEFAULT_BOLLINGER })
    setZones({ ...DEFAULT_ZONES })
    setCandles({ ...DEFAULT_CANDLES })
  }, [])

  const value = useMemo(
    () => ({
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
      resetDefaults,
    }),
    [timeframe, mas, rsi, macd, stoch, bollinger, zones, candles, addMa, updateMa, removeMa, resetDefaults]
  )

  return <BtcSettingsContext.Provider value={value}>{children}</BtcSettingsContext.Provider>
}

export function useBtcSettings() {
  const c = useContext(BtcSettingsContext)
  if (!c) throw new Error('useBtcSettings must be used within BtcSettingsProvider')
  return c
}
