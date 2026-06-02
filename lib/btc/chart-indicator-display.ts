import type { ChartIndicatorDisplaySettings, ChartIndicatorLabelMode } from '@/lib/btc/types'

export function resolveIndicatorLabelMode(
  id: string,
  display: ChartIndicatorDisplaySettings,
): ChartIndicatorLabelMode {
  return display.labelModes[id] ?? display.defaultLabelMode
}

/** Título curto no eixo direito (menos largura). */
export function compactIndicatorTitle(fullTitle: string): string {
  return fullTitle
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s·\s.+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14)
}

export function seriesLabelFromMode(
  mode: ChartIndicatorLabelMode,
  fullTitle: string,
  isPhone: boolean,
): { title: string; lastValueVisible: boolean; priceLineVisible: boolean } {
  switch (mode) {
    case 'hidden':
      return { title: '', lastValueVisible: false, priceLineVisible: false }
    case 'compact':
      return {
        title: compactIndicatorTitle(fullTitle),
        lastValueVisible: false,
        priceLineVisible: false,
      }
    default:
      return {
        title: fullTitle,
        lastValueVisible: !isPhone,
        priceLineVisible: false,
      }
  }
}

export const CHART_LABEL_MODE_LABELS: Record<ChartIndicatorLabelMode, string> = {
  full: 'Completo',
  compact: 'Compacto',
  hidden: 'Oculto',
}
