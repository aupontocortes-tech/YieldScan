/**
 * Presets para «Moedas em destaque» no Mercado (ações/índices tokenizados xStock).
 * O utilizador adiciona pelo ícone de definições (⚙) como bitcoin / solana.
 */

export type MercadoHighlightPreset = {
  /** Slug CoinGecko (campo «Ativo» nas definições). */
  id: string
  name: string
  symbol: string
  hint: string
}

/** Sugestões rápidas — um clique preenche uma linha vazia (nomes em inglês). */
export const MERCADO_HIGHLIGHT_QUICK_PRESETS: MercadoHighlightPreset[] = [
  { id: 'nasdaq-xstock', name: 'Nasdaq', symbol: 'QQQX', hint: 'Nasdaq index' },
  { id: 'sp500-xstock', name: 'S&P 500', symbol: 'SPYX', hint: 'S&P 500 index' },
  { id: 'nvidia-xstock', name: 'NVIDIA', symbol: 'NVDAX', hint: 'NVIDIA stock' },
  { id: 'tesla-xstock', name: 'Tesla', symbol: 'TSLAX', hint: 'Tesla stock' },
  { id: 'microsoft-xstock', name: 'Microsoft', symbol: 'MSFTX', hint: 'Microsoft stock' },
  { id: 'alphabet-xstock', name: 'Google', symbol: 'GOOGLX', hint: 'Alphabet / Google' },
  { id: 'meta-xstock', name: 'Meta', symbol: 'METAX', hint: 'Facebook · Meta' },
  { id: 'amazon-xstock', name: 'Amazon', symbol: 'AMZNX', hint: 'Amazon stock' },
  {
    id: 'microstrategy-xstock',
    name: 'MicroStrategy',
    symbol: 'MSTRX',
    hint: 'Michael Saylor · MSTR',
  },
  {
    id: 'exxon-mobil-xstock',
    name: 'Exxon Mobil',
    symbol: 'XOMX',
    hint: 'Oil · petroleum',
  },
]

/** @deprecated Use MERCADO_HIGHLIGHT_QUICK_PRESETS */
export const MERCADO_RWA_HIGHLIGHT_PRESETS = MERCADO_HIGHLIGHT_QUICK_PRESETS

/** Ticker ou nome alternativo → slug CoinGecko. */
export const MERCADO_HIGHLIGHT_EXTRA_ALIASES: Record<string, string> = {
  nasdaq: 'nasdaq-xstock',
  qqqx: 'nasdaq-xstock',
  ndx: 'nasdaq-xstock',
  nvda: 'nvidia-xstock',
  nvdax: 'nvidia-xstock',
  nvidia: 'nvidia-xstock',
  sp500: 'sp500-xstock',
  spyx: 'sp500-xstock',
  spx: 'sp500-xstock',
  's-and-p-500': 'sp500-xstock',
  's-p-500': 'sp500-xstock',
  tsla: 'tesla-xstock',
  tslax: 'tesla-xstock',
  tesla: 'tesla-xstock',
  msft: 'microsoft-xstock',
  msftx: 'microsoft-xstock',
  microsoft: 'microsoft-xstock',
  googl: 'alphabet-xstock',
  googlx: 'alphabet-xstock',
  google: 'alphabet-xstock',
  alphabet: 'alphabet-xstock',
  meta: 'meta-xstock',
  metax: 'meta-xstock',
  facebook: 'meta-xstock',
  fb: 'meta-xstock',
  amzn: 'amazon-xstock',
  amznx: 'amazon-xstock',
  amazon: 'amazon-xstock',
  mstr: 'microstrategy-xstock',
  mstrx: 'microstrategy-xstock',
  microstrategy: 'microstrategy-xstock',
  strategy: 'microstrategy-xstock',
  xom: 'exxon-mobil-xstock',
  xomx: 'exxon-mobil-xstock',
  exxon: 'exxon-mobil-xstock',
  oil: 'exxon-mobil-xstock',
  petroleum: 'exxon-mobil-xstock',
  petroleo: 'exxon-mobil-xstock',
  theter: 'tether',
}

const PRESET_BY_ID = new Map(MERCADO_HIGHLIGHT_QUICK_PRESETS.map((p) => [p.id, p]))

export function getMercadoHighlightPreset(id: string): MercadoHighlightPreset | undefined {
  return PRESET_BY_ID.get(id.trim().toLowerCase())
}

export function highlightMetaFromPresetOrId(id: string): { name: string; symbol: string } {
  const key = id.trim().toLowerCase()
  const preset = getMercadoHighlightPreset(key)
  if (preset) return { name: preset.name, symbol: preset.symbol }
  const name = key
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  const symbol = key.replace(/-/g, '').slice(0, 8).toUpperCase()
  return { name: name || key, symbol: symbol || key.toUpperCase().slice(0, 6) }
}
