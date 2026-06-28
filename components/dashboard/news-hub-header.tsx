'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Building2, LineChart, Newspaper, Sparkles, type LucideIcon } from 'lucide-react'

type HubLinkTheme = {
  iconClass: string
  iconWrap: string
  iconWrapActive: string
  cardIdle: string
  cardHover: string
  cardActive: string
  descActive: string
}

type HubLink = {
  href: string
  label: string
  shortLabel: string
  description: string
  icon: LucideIcon
  theme: HubLinkTheme
}

const LINKS: HubLink[] = [
  {
    href: '/news/mercado',
    label: 'Preços e mercado',
    shortLabel: 'Mercado',
    description: 'Cripto, ações US tokenizadas (xStock) e top 10 em tempo real.',
    icon: LineChart,
    theme: {
      iconClass: 'text-cyan-300',
      iconWrap: 'bg-cyan-500/25 ring-cyan-400/25',
      iconWrapActive: 'bg-cyan-400/45 ring-cyan-300/60 shadow-[0_0_16px_rgba(34,211,238,0.55)]',
      cardIdle: 'border-cyan-500/20 bg-cyan-950/30',
      cardHover:
        'hover:border-cyan-400/50 hover:bg-cyan-500/15 hover:shadow-[0_6px_28px_-8px_rgba(34,211,238,0.4)] hover:-translate-y-0.5',
      cardActive:
        'border-cyan-400/70 bg-gradient-to-br from-cyan-500/40 via-cyan-500/20 to-teal-600/30 text-cyan-50 shadow-[0_10px_36px_-10px_rgba(34,211,238,0.65)] -translate-y-0.5',
      descActive: 'text-cyan-100/85',
    },
  },
  {
    href: '/news/noticias',
    label: 'Notícias',
    shortLabel: 'Notícias',
    description: 'Cripto, ações americanas, macro, geopolítica e IA — em português.',
    icon: Newspaper,
    theme: {
      iconClass: 'text-sky-300',
      iconWrap: 'bg-sky-500/25 ring-sky-400/25',
      iconWrapActive: 'bg-sky-400/45 ring-sky-300/60 shadow-[0_0_16px_rgba(14,165,233,0.55)]',
      cardIdle: 'border-sky-500/20 bg-sky-950/30',
      cardHover:
        'hover:border-sky-400/50 hover:bg-sky-500/15 hover:shadow-[0_6px_28px_-8px_rgba(14,165,233,0.4)] hover:-translate-y-0.5',
      cardActive:
        'border-sky-400/70 bg-gradient-to-br from-sky-500/40 via-sky-500/20 to-blue-600/30 text-sky-50 shadow-[0_10px_36px_-10px_rgba(14,165,233,0.6)] -translate-y-0.5',
      descActive: 'text-sky-100/85',
    },
  },
  {
    href: '/news/tendencias',
    label: 'Tendências',
    shortLabel: 'Tendências',
    description: 'Cripto + ações US em destaque, volume, IA/tech e alertas.',
    icon: Sparkles,
    theme: {
      iconClass: 'text-violet-300',
      iconWrap: 'bg-violet-500/25 ring-violet-400/25',
      iconWrapActive: 'bg-violet-400/45 ring-violet-300/60 shadow-[0_0_16px_rgba(139,92,246,0.6)]',
      cardIdle: 'border-violet-500/20 bg-violet-950/30',
      cardHover:
        'hover:border-violet-400/50 hover:bg-violet-500/15 hover:shadow-[0_6px_28px_-8px_rgba(139,92,246,0.45)] hover:-translate-y-0.5',
      cardActive:
        'border-violet-400/70 bg-gradient-to-br from-violet-500/40 via-violet-500/20 to-purple-600/30 text-violet-50 shadow-[0_10px_36px_-10px_rgba(139,92,246,0.65)] -translate-y-0.5',
      descActive: 'text-violet-100/85',
    },
  },
  {
    href: '/news/gestao-financeira',
    label: 'Gestão Financeira',
    shortLabel: 'Gestão',
    description: 'Patrimônio, receitas, despesas, caixas, dívidas e cripto.',
    icon: Building2,
    theme: {
      iconClass: 'text-emerald-300',
      iconWrap: 'bg-emerald-500/25 ring-emerald-400/25',
      iconWrapActive: 'bg-emerald-400/45 ring-emerald-300/60 shadow-[0_0_16px_rgba(16,185,129,0.55)]',
      cardIdle: 'border-emerald-500/20 bg-emerald-950/30',
      cardHover:
        'hover:border-emerald-400/50 hover:bg-emerald-500/15 hover:shadow-[0_6px_28px_-8px_rgba(16,185,129,0.4)] hover:-translate-y-0.5',
      cardActive:
        'border-emerald-400/70 bg-gradient-to-br from-emerald-500/40 via-emerald-500/20 to-green-600/30 text-emerald-50 shadow-[0_10px_36px_-10px_rgba(16,185,129,0.6)] -translate-y-0.5',
      descActive: 'text-emerald-100/85',
    },
  },
]

function HubNavLink({ link, active }: { link: HubLink; active: boolean }) {
  const Icon = link.icon
  const t = link.theme

  return (
    <Link
      href={link.href}
      title={link.description}
      className={cn(
        'group relative flex flex-col gap-2.5 rounded-2xl border p-3 text-left transition-all duration-300 ease-out active:scale-[0.98] select-none touch-manipulation',
        'sm:min-h-[104px] sm:p-4',
        'text-foreground/90',
        !active && t.cardIdle,
        !active && t.cardHover,
        active && t.cardActive,
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-all duration-300 group-hover:scale-110',
          t.iconWrap,
          active && t.iconWrapActive,
        )}
      >
        <Icon className={cn('size-5', active ? 'text-white' : t.iconClass)} aria-hidden />
      </span>
      <div className="min-w-0 space-y-1">
        <span className="block text-sm font-bold leading-tight sm:text-base">{link.label}</span>
        <span
          className={cn(
            'hidden text-xs leading-snug sm:line-clamp-2',
            active ? t.descActive : 'text-muted-foreground',
          )}
        >
          {link.description}
        </span>
        <span className={cn('text-[11px] font-semibold sm:hidden', active ? t.descActive : 'text-muted-foreground')}>
          {link.shortLabel}
        </span>
      </div>
    </Link>
  )
}

export function NewsHubHeader() {
  const pathname = usePathname()
  const onGestao = pathname.startsWith('/news/gestao-financeira')

  return (
    <header className="mb-5 border-b border-border/40 pb-5 sm:mb-8 sm:pb-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {onGestao ? 'Gestão Financeira' : 'Cripto e mercado global'}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {onGestao
          ? 'Registre receitas e despesas digitando ou falando pelo teclado.'
          : 'Preços (cripto e ações US), notícias e análise inteligente — escolhe a secção abaixo.'}
      </p>

      <nav
        className={cn(
          'mt-4 grid grid-cols-2 gap-2.5 rounded-2xl border border-white/10 p-2.5 sm:mt-6 sm:grid-cols-4 sm:gap-3 sm:p-3',
          'bg-gradient-to-br from-slate-900/95 via-[#0a1020] to-slate-950',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_40px_-14px_rgba(0,0,0,0.75)]',
        )}
        aria-label="Secções do hub"
      >
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
          return <HubNavLink key={link.href} link={link} active={active} />
        })}
      </nav>
    </header>
  )
}
