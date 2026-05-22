import { TIMEFRAME_PRESETS, type TimeframePreset } from '@/lib/btc/types'

/** Intervalo do gráfico ao activar cada indicador de fundo de ciclo (Pompx). */
export type CycleBottomIndicatorId = 'sma200' | 'bmsb' | 'alerts'

export type CycleBottomIndicatorMeta = {
  id: CycleBottomIndicatorId
  label: string
  /** Rótulo curto na UI: Diário, Semanal, Mensal */
  timeframeLabel: string
  timeframeId: string
  hint: string
  bullMarketHint: string
}

export const CYCLE_BOTTOM_INDICATORS: CycleBottomIndicatorMeta[] = [
  {
    id: 'sma200',
    label: 'SMA 200',
    timeframeLabel: 'Diário',
    timeframeId: '1d',
    hint: 'Média dos últimos 200 fechos diários',
    bullMarketHint: 'Preço fecha acima → possível fim do fundo (Sinal 1)',
  },
  {
    id: 'bmsb',
    label: 'Bull Market Band',
    timeframeLabel: 'Mensal',
    timeframeId: '1M',
    hint: 'Velas Heikin Ashi mensais + EMA 20w / SMA 21w',
    bullMarketHint: 'Duas linhas (médias semanais) no gráfico mensal',
  },
  {
    id: 'alerts',
    label: 'Sinais bull market',
    timeframeLabel: 'Mensal',
    timeframeId: '1M',
    hint: 'Vela Heikin Ashi mensal vs topo da banda',
    bullMarketHint: 'Corpo verde acima da banda → início de bull (Sinal 2)',
  },
]

export function getCycleBottomTimeframe(id: CycleBottomIndicatorId): TimeframePreset | undefined {
  const meta = CYCLE_BOTTOM_INDICATORS.find((i) => i.id === id)
  if (!meta) return undefined
  return TIMEFRAME_PRESETS.find((t) => t.id === meta.timeframeId)
}
