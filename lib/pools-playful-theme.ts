/** Paleta pastel para o Explorador de Pools — alegre, sem laranja/amarelo forte. */
export const POOL_CARD_THEMES = [
  {
    bg: 'bg-gradient-to-br from-pink-500/22 via-fuchsia-500/8 to-transparent',
    border: 'border-pink-400/40',
    apr: 'text-pink-300',
    chain: 'bg-pink-500/20 text-pink-100 border-pink-400/30',
    rank: 'bg-pink-500/30 text-pink-100',
  },
  {
    bg: 'bg-gradient-to-br from-violet-500/22 via-purple-500/8 to-transparent',
    border: 'border-violet-400/40',
    apr: 'text-violet-300',
    chain: 'bg-violet-500/20 text-violet-100 border-violet-400/30',
    rank: 'bg-violet-500/30 text-violet-100',
  },
  {
    bg: 'bg-gradient-to-br from-cyan-500/22 via-sky-500/8 to-transparent',
    border: 'border-cyan-400/40',
    apr: 'text-cyan-300',
    chain: 'bg-cyan-500/20 text-cyan-100 border-cyan-400/30',
    rank: 'bg-cyan-500/30 text-cyan-100',
  },
  {
    bg: 'bg-gradient-to-br from-emerald-500/22 via-teal-500/8 to-transparent',
    border: 'border-emerald-400/40',
    apr: 'text-emerald-300',
    chain: 'bg-emerald-500/20 text-emerald-100 border-emerald-400/30',
    rank: 'bg-emerald-500/30 text-emerald-100',
  },
  {
    bg: 'bg-gradient-to-br from-blue-500/22 via-indigo-500/8 to-transparent',
    border: 'border-blue-400/40',
    apr: 'text-blue-300',
    chain: 'bg-blue-500/20 text-blue-100 border-blue-400/30',
    rank: 'bg-blue-500/30 text-blue-100',
  },
] as const

export const POOL_FLOW_STEPS = [
  { n: 1, label: 'Destaques', pill: 'pools-flow-pill-pink', dot: 'pools-step-dot-pink' },
  { n: 2, label: 'Filtrar', pill: 'pools-flow-pill-violet', dot: 'pools-step-dot-violet' },
  { n: 3, label: 'Comparar', pill: 'pools-flow-pill-cyan', dot: 'pools-step-dot-cyan' },
] as const
