'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowUpRight } from 'lucide-react'
import { HUB_ACCENT, type HubAccent } from '@/components/dashboard/hub/hub-styles'
import { cn } from '@/lib/utils'

type HubPanelProps = {
  title: string
  subtitle?: string
  icon: LucideIcon
  iconClassName?: string
  accent?: HubAccent
  href?: string
  linkLabel?: string
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  noPadding?: boolean
}

export function HubPanel({
  title,
  subtitle,
  icon: Icon,
  iconClassName,
  accent = 'emerald',
  href,
  linkLabel = 'Abrir',
  children,
  className,
  bodyClassName,
  noPadding,
}: HubPanelProps) {
  const a = HUB_ACCENT[accent]

  return (
    <section
      className={cn(
        'group/panel relative flex h-full flex-col overflow-hidden rounded-2xl',
        'border bg-gradient-to-b from-card/95 via-card/55 to-background/90',
        'shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_12px_40px_-24px_rgba(0,0,0,0.65)]',
        'backdrop-blur-sm ring-1 ring-white/[0.04]',
        a.panelBorder,
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent',
        )}
        aria-hidden
      />
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-60',
          a.panelGlow,
        )}
        aria-hidden
      />

      <header className="relative flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
              a.iconBox,
            )}
          >
            <Icon className={cn('h-4 w-4', iconClassName ?? a.icon)} aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {href && (
          <Link
            href={href}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all',
              a.headerLink,
            )}
          >
            {linkLabel}
            <ArrowUpRight className="h-3 w-3 opacity-80" />
          </Link>
        )}
      </header>
      <div
        className={cn(
          'relative',
          !noPadding && 'flex flex-1 flex-col px-4 py-4 sm:px-5 sm:py-4',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  )
}

export function HubSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
      {children}
    </p>
  )
}
