'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Building2, LineChart, Newspaper, Sparkles } from 'lucide-react'

const LINKS = [
  {
    href: '/news/mercado',
    label: 'Preços e mercado',
    shortLabel: 'Mercado',
    description: 'Cripto, ações US tokenizadas (xStock) e top 10 em tempo real.',
    icon: LineChart,
  },
  {
    href: '/news/noticias',
    label: 'Notícias',
    shortLabel: 'Notícias',
    description: 'Cripto, ações americanas, macro, geopolítica e IA — em português.',
    icon: Newspaper,
  },
  {
    href: '/news/tendencias',
    label: 'Tendências',
    shortLabel: 'Tendências',
    description: 'Cripto + ações US em destaque, volume, IA/tech e alertas.',
    icon: Sparkles,
  },
  {
    href: '/news/gestao-financeira',
    label: 'Gestão Financeira',
    shortLabel: 'Gestão',
    description: 'Patrimônio, receitas, despesas, caixas, dívidas e cripto.',
    icon: Building2,
  },
] as const

function HubNavLink({
  href,
  label,
  shortLabel,
  description,
  icon: Icon,
  active,
}: (typeof LINKS)[number] & { active: boolean }) {
  return (
    <Link
      href={href}
      title={description}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-center transition-all select-none touch-manipulation',
        'sm:min-h-[88px] sm:items-start sm:justify-center sm:gap-1 sm:px-4 sm:py-3.5 sm:text-left',
        active
          ? 'border-yellow-500 bg-yellow-500 text-black shadow-md'
          : 'border-border/60 bg-card/50 text-foreground hover:border-yellow-500/40 hover:bg-card',
      )}
    >
      <Icon
        className={cn('h-5 w-5 shrink-0 sm:h-4 sm:w-4', active ? 'text-black' : 'text-yellow-500')}
        aria-hidden
      />
      <span className="text-[10px] font-semibold leading-tight sm:hidden">{shortLabel}</span>
      <span className="hidden items-center gap-2 font-semibold sm:flex">
        <span>{label}</span>
      </span>
      <span
        className={cn(
          'hidden text-xs leading-snug sm:line-clamp-2',
          active ? 'text-black/75' : 'text-muted-foreground',
        )}
      >
        {description}
      </span>
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
        className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-4 sm:gap-3"
        aria-label="Secções do hub"
      >
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
          return <HubNavLink key={link.href} {...link} active={active} />
        })}
      </nav>
    </header>
  )
}
