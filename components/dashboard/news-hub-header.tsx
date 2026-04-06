'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LineChart, Newspaper } from 'lucide-react'

const LINKS = [
  {
    href: '/news/mercado',
    label: 'Preços e mercado',
    shortLabel: 'Mercado',
    description: 'BTC, ETH, SOL, Hyperliquid, top 10 e tendências (CoinGecko).',
    icon: LineChart,
  },
  {
    href: '/news/noticias',
    label: 'Notícias',
    shortLabel: 'Notícias',
    description: 'Cripto, geopolítica, macro, economia e IA — em português quando a fonte é noutro idioma.',
    icon: Newspaper,
  },
] as const

export function NewsHubHeader() {
  const pathname = usePathname()

  return (
    <header className="mb-8 border-b border-border/40 pb-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Cripto e mercado</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Escolhe abaixo: preços em tempo real ou feed de notícias. Menos scroll, mesma informação.
      </p>

      <nav className="mt-6 flex flex-col gap-3 sm:flex-row" aria-label="Secções cripto">
        {LINKS.map(({ href, label, shortLabel, description, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col gap-1 rounded-xl border px-4 py-3.5 text-left transition-all',
                active
                  ? 'border-yellow-500 bg-yellow-500 text-black shadow-md'
                  : 'border-border/60 bg-card/50 text-foreground hover:border-yellow-500/40 hover:bg-card'
              )}
            >
              <span className="flex items-center gap-2 font-semibold">
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-black' : 'text-yellow-500')} />
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </span>
              <span
                className={cn(
                  'text-xs leading-snug',
                  active ? 'text-black/75' : 'text-muted-foreground'
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
