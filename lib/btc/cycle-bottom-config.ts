import { TIMEFRAME_PRESETS, type TimeframePreset } from '@/lib/btc/types'

/** Intervalo do gráfico ao activar cada indicador de fundo de ciclo (Pompx). */
export type CycleBottomIndicatorId = 'goldenCross' | 'sma200' | 'bmsb' | 'sma50w'

export type CycleBottomIndicatorMeta = {
  id: CycleBottomIndicatorId
  label: string
  /** Rótulo curto na UI: Diário, Semanal, Mensal */
  timeframeLabel: string
  timeframeId: string
  hint: string
  bullMarketHint: string
  /** Ao activar, abre o gráfico em ecrã inteiro. */
  fullscreenOnActivate?: boolean
}

export const CYCLE_BOTTOM_INDICATORS: CycleBottomIndicatorMeta[] = [
  {
    id: 'goldenCross',
    label: 'Golden / Death Cross',
    timeframeLabel: 'Diário',
    timeframeId: '1d',
    hint: 'SMA 50 + SMA 200 no diário',
    bullMarketHint: '50 cruza acima de 200 → Golden Cross · abaixo → Death Cross',
    fullscreenOnActivate: true,
  },
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
    id: 'sma50w',
    label: 'SMA 50 Sem.',
    timeframeLabel: 'Semanal',
    timeframeId: '1w',
    hint: 'Média dos últimos 50 fechos semanais',
    bullMarketHint: 'Tendência de médio prazo no gráfico semanal',
  },
]

export function getCycleBottomTimeframe(id: CycleBottomIndicatorId): TimeframePreset | undefined {
  const meta = CYCLE_BOTTOM_INDICATORS.find((i) => i.id === id)
  if (!meta) return undefined
  return TIMEFRAME_PRESETS.find((t) => t.id === meta.timeframeId)
}
