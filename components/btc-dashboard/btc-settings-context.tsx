'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type {
  BinanceInterval,
  BollingerSettings,
  MaConfig,
  MacdSettings,
  RsiSettings,
  StochSettings,
  ZonesSettings,
} from '@/lib/btc/types'

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
}

const DEFAULT_MACD: MacdSettings = { enabled: true, fast: 12, slow: 26, signal: 9 }
const DEFAULT_STOCH: StochSettings = { enabled: true, kPeriod: 14, dPeriod: 3, smooth: 3 }
const DEFAULT_BOLLINGER: BollingerSettings = {
  enabled: true,
  period: 20,
  stdDev: 2,
  showUpper: true,
  showMiddle: true,
  showLower: true,
}
const DEFAULT_ZONES: ZonesSettings = {
  enabled: true,
  showMaZones: true,
  showSupportResistance: true,
  showSmartMultipliers: true,
}

type Ctx = {
  timeframe: BinanceInterval
  setTimeframe: (t: BinanceInterval) => void
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
  resetDefaults: () => void
}

const BtcSettingsContext = createContext<Ctx | null>(null)

function newMaId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? `ma-${crypto.randomUUID()}`
    : `ma-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function BtcSettingsProvider({ children }: { children: ReactNode }) {
  const [timeframe, setTimeframe] = useState<BinanceInterval>('1h')
  const [mas, setMas] = useState<MaConfig[]>(() => DEFAULT_MAS.map((m) => ({ ...m })))
  const [rsi, setRsi] = useState<RsiSettings>(() => ({ ...DEFAULT_RSI }))
  const [macd, setMacd] = useState<MacdSettings>(() => ({ ...DEFAULT_MACD }))
  const [stoch, setStoch] = useState<StochSettings>(() => ({ ...DEFAULT_STOCH }))
  const [bollinger, setBollinger] = useState<BollingerSettings>(() => ({ ...DEFAULT_BOLLINGER }))
  const [zones, setZones] = useState<ZonesSettings>(() => ({ ...DEFAULT_ZONES }))

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
    setTimeframe('1h')
    setMas(DEFAULT_MAS.map((m) => ({ ...m })))
    setRsi({ ...DEFAULT_RSI })
    setMacd({ ...DEFAULT_MACD })
    setStoch({ ...DEFAULT_STOCH })
    setBollinger({ ...DEFAULT_BOLLINGER })
    setZones({ ...DEFAULT_ZONES })
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
      resetDefaults,
    }),
    [timeframe, mas, rsi, macd, stoch, bollinger, zones, addMa, updateMa, removeMa, resetDefaults]
  )

  return <BtcSettingsContext.Provider value={value}>{children}</BtcSettingsContext.Provider>
}

export function useBtcSettings() {
  const c = useContext(BtcSettingsContext)
  if (!c) throw new Error('useBtcSettings must be used within BtcSettingsProvider')
  return c
}
