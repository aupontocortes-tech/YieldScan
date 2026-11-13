export type ThemeTone = {
  label: string
  text: string
  muted: string
  border: string
  bg: string
  chip: string
  bar: string
}

const TONES: Record<string, ThemeTone> = {
  ia: {
    label: 'IA',
    text: 'text-violet-300',
    muted: 'text-violet-200/80',
    border: 'border-violet-500/40',
    bg: 'from-violet-950/70 via-fuchsia-950/30 to-card',
    chip: 'border-violet-500/40 bg-violet-500/15 text-violet-200',
    bar: 'bg-violet-400',
  },
  rwa: {
    label: 'RWA',
    text: 'text-teal-300',
    muted: 'text-teal-200/80',
    border: 'border-teal-500/40',
    bg: 'from-teal-950/70 via-emerald-950/25 to-card',
    chip: 'border-teal-500/40 bg-teal-500/15 text-teal-200',
    bar: 'bg-teal-400',
  },
  defi: {
    label: 'DeFi',
    text: 'text-cyan-300',
    muted: 'text-cyan-200/80',
    border: 'border-cyan-500/40',
    bg: 'from-cyan-950/70 via-sky-950/25 to-card',
    chip: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200',
    bar: 'bg-cyan-400',
  },
  layer1: {
    label: 'Camada 1',
    text: 'text-sky-300',
    muted: 'text-sky-200/80',
    border: 'border-sky-500/40',
    bg: 'from-sky-950/70 via-blue-950/25 to-card',
    chip: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
    bar: 'bg-sky-400',
  },
  layer2: {
    label: 'Camada 2',
    text: 'text-indigo-300',
    muted: 'text-indigo-200/80',
    border: 'border-indigo-500/40',
    bg: 'from-indigo-950/70 via-blue-950/25 to-card',
    chip: 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200',
    bar: 'bg-indigo-400',
  },
  memecoins: {
    label: 'Memecoins',
    text: 'text-pink-300',
    muted: 'text-pink-200/80',
    border: 'border-pink-500/40',
    bg: 'from-pink-950/70 via-rose-950/25 to-card',
    chip: 'border-pink-500/40 bg-pink-500/15 text-pink-200',
    bar: 'bg-pink-400',
  },
  gaming: {
    label: 'Jogos',
    text: 'text-lime-300',
    muted: 'text-lime-200/80',
    border: 'border-lime-500/40',
    bg: 'from-lime-950/60 via-green-950/25 to-card',
    chip: 'border-lime-500/40 bg-lime-500/15 text-lime-200',
    bar: 'bg-lime-400',
  },
  restaking: {
    label: 'Staking',
    text: 'text-amber-300',
    muted: 'text-amber-200/80',
    border: 'border-amber-500/40',
    bg: 'from-amber-950/50 via-orange-950/20 to-card',
    chip: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
    bar: 'bg-amber-400',
  },
  depin: {
    label: 'DePIN',
    text: 'text-orange-300',
    muted: 'text-orange-200/80',
    border: 'border-orange-500/40',
    bg: 'from-orange-950/60 via-red-950/20 to-card',
    chip: 'border-orange-500/40 bg-orange-500/15 text-orange-200',
    bar: 'bg-orange-400',
  },
  etfs: {
    label: 'ETFs',
    text: 'text-blue-300',
    muted: 'text-blue-200/80',
    border: 'border-blue-500/40',
    bg: 'from-blue-950/70 to-card',
    chip: 'border-blue-500/40 bg-blue-500/15 text-blue-200',
    bar: 'bg-blue-400',
  },
  buybacks: {
    label: 'Recompra e queima',
    text: 'text-orange-300',
    muted: 'text-orange-200/80',
    border: 'border-orange-500/45',
    bg: 'from-orange-950/70 via-red-950/30 to-card',
    chip: 'border-orange-500/40 bg-orange-500/15 text-orange-200',
    bar: 'bg-orange-400',
  },
  regulacao: {
    label: 'Regulamentação',
    text: 'text-slate-300',
    muted: 'text-slate-200/80',
    border: 'border-slate-500/40',
    bg: 'from-slate-900/80 to-card',
    chip: 'border-slate-500/40 bg-slate-500/15 text-slate-200',
    bar: 'bg-slate-400',
  },
}

const BY_LABEL: Record<string, string> = {
  IA: 'ia',
  RWA: 'rwa',
  DeFi: 'defi',
  'Layer 1': 'layer1',
  'Layer 2': 'layer2',
  'Camada 1': 'layer1',
  'Camada 2': 'layer2',
  L1: 'layer1',
  L2: 'layer2',
  Memecoins: 'memecoins',
  Gaming: 'gaming',
  Jogos: 'gaming',
  Staking: 'restaking',
  Restaking: 'restaking',
  DePIN: 'depin',
  ETFs: 'etfs',
  Regulamentação: 'regulacao',
  'Recompra e queima': 'buybacks',
  Recompra: 'buybacks',
  Queima: 'buybacks',
  DEX: 'defi',
  Empréstimos: 'defi',
  'Staking líquido': 'restaking',
  Bridges: 'layer2',
  Derivativos: 'defi',
}

const FALLBACK: ThemeTone = {
  label: 'Tema',
  text: 'text-fuchsia-300',
  muted: 'text-fuchsia-200/80',
  border: 'border-fuchsia-500/40',
  bg: 'from-fuchsia-950/50 via-violet-950/20 to-card',
  chip: 'border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200',
  bar: 'bg-fuchsia-400',
}

export function toneForNarrative(idOrLabel: string | null | undefined): ThemeTone {
  if (!idOrLabel) return FALLBACK
  const key = idOrLabel.trim()
  if (TONES[key.toLowerCase()]) return TONES[key.toLowerCase()]
  const mapped = BY_LABEL[key]
  if (mapped && TONES[mapped]) return TONES[mapped]
  return FALLBACK
}
