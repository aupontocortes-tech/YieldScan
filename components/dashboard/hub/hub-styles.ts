/** Tokens visuais partilhados do Centro de comando (painel premium). */
export type HubAccent = 'emerald' | 'amber' | 'blue' | 'yellow' | 'sky' | 'cyan' | 'violet'

export const HUB_ACCENT: Record<
  HubAccent,
  {
    panelBorder: string
    panelGlow: string
    icon: string
    iconBox: string
    headerLink: string
    shine: string
  }
> = {
  emerald: {
    panelBorder: 'border-emerald-500/15',
    panelGlow: 'from-emerald-500/10 via-transparent',
    icon: 'text-emerald-400',
    iconBox: 'border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_24px_-10px_rgba(52,211,153,0.55)]',
    headerLink:
      'border-emerald-500/20 bg-emerald-500/5 text-emerald-300/90 hover:border-emerald-500/35 hover:bg-emerald-500/10',
    shine: 'from-emerald-400/50',
  },
  amber: {
    panelBorder: 'border-amber-500/15',
    panelGlow: 'from-amber-500/10 via-transparent',
    icon: 'text-amber-400',
    iconBox: 'border-amber-500/30 bg-amber-500/10 shadow-[0_0_24px_-10px_rgba(251,191,36,0.45)]',
    headerLink:
      'border-amber-500/20 bg-amber-500/5 text-amber-300/90 hover:border-amber-500/35 hover:bg-amber-500/10',
    shine: 'from-amber-400/50',
  },
  blue: {
    panelBorder: 'border-blue-500/15',
    panelGlow: 'from-blue-500/10 via-transparent',
    icon: 'text-blue-400',
    iconBox: 'border-blue-500/30 bg-blue-500/10 shadow-[0_0_24px_-10px_rgba(96,165,250,0.45)]',
    headerLink:
      'border-blue-500/20 bg-blue-500/5 text-blue-300/90 hover:border-blue-500/35 hover:bg-blue-500/10',
    shine: 'from-blue-400/50',
  },
  yellow: {
    panelBorder: 'border-yellow-500/15',
    panelGlow: 'from-yellow-500/10 via-transparent',
    icon: 'text-yellow-400',
    iconBox: 'border-yellow-500/30 bg-yellow-500/10 shadow-[0_0_24px_-10px_rgba(250,204,21,0.4)]',
    headerLink:
      'border-yellow-500/20 bg-yellow-500/5 text-yellow-300/90 hover:border-yellow-500/35 hover:bg-yellow-500/10',
    shine: 'from-yellow-400/50',
  },
  sky: {
    panelBorder: 'border-sky-500/15',
    panelGlow: 'from-sky-500/10 via-transparent',
    icon: 'text-sky-400',
    iconBox: 'border-sky-500/30 bg-sky-500/10 shadow-[0_0_24px_-10px_rgba(56,189,248,0.45)]',
    headerLink:
      'border-sky-500/20 bg-sky-500/5 text-sky-300/90 hover:border-sky-500/35 hover:bg-sky-500/10',
    shine: 'from-sky-400/50',
  },
  cyan: {
    panelBorder: 'border-cyan-500/15',
    panelGlow: 'from-cyan-500/10 via-transparent',
    icon: 'text-cyan-400',
    iconBox: 'border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_24px_-10px_rgba(34,211,238,0.45)]',
    headerLink:
      'border-cyan-500/20 bg-cyan-500/5 text-cyan-300/90 hover:border-cyan-500/35 hover:bg-cyan-500/10',
    shine: 'from-cyan-400/50',
  },
  violet: {
    panelBorder: 'border-violet-500/15',
    panelGlow: 'from-violet-500/10 via-transparent',
    icon: 'text-violet-400',
    iconBox: 'border-violet-500/30 bg-violet-500/10 shadow-[0_0_24px_-10px_rgba(167,139,250,0.4)]',
    headerLink:
      'border-violet-500/20 bg-violet-500/5 text-violet-300/90 hover:border-violet-500/35 hover:bg-violet-500/10',
    shine: 'from-violet-400/50',
  },
}
