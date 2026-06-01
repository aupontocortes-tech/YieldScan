'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LineChart, Newspaper, Sparkles } from 'lucide-react'

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
] as const

export function NewsHubHeader() {
  const pathname = usePathname()

  return (
    <header className="mb-8 border-b border-border/40 pb-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Cripto e mercado global</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Preços (cripto e ações US), notícias e análise inteligente — escolhe a secção abaixo.
      </p>

      <nav
        className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
        aria-label="Secções cripto"
      >
        {LINKS.map(({ href, label, shortLabel, description, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex min-h-[88px] flex-col justify-center gap-1 rounded-xl border px-4 py-3.5 text-left transition-all',
                active
                  ? 'border-yellow-500 bg-yellow-500 text-black shadow-md'
                  : 'border-border/60 bg-card/50 text-foreground hover:border-yellow-500/40 hover:bg-card',
              )}
            >
              <span className="flex items-center gap-2 font-semibold">
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-black' : 'text-yellow-500')} />
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </span>
              <span
                className={cn(
                  'line-clamp-2 text-xs leading-snug',
                  active ? 'text-black/75' : 'text-muted-foreground',
                )}
              >
                {description}
              </span>
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
