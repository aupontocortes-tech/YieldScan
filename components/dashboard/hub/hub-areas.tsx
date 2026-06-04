'use client'

import Link from 'next/link'
import { ArrowUpRight, LayoutGrid } from 'lucide-react'
import { DASHBOARD_HUB_SECTIONS } from '@/lib/dashboard-hub-sections'
import { HubPanel } from '@/components/dashboard/hub/hub-panel'
import { cn } from '@/lib/utils'

export function HubAreas() {
  return (
    <HubPanel
      title="Áreas do app"
      subtitle="Atalhos para cada módulo"
      icon={LayoutGrid}
      accent="emerald"
      bodyClassName="!py-3.5"
    >
      <div className="grid grid-cols-2 gap-2.5">
        {DASHBOARD_HUB_SECTIONS.map((section) => {
          const Icon = section.icon
          return (
            <Link
              key={section.id}
              href={section.href}
              className={cn(
                'group relative flex flex-col overflow-hidden rounded-xl border border-white/[0.06]',
                'bg-background/40 p-3.5 transition-all duration-300',
                'hover:border-white/10 hover:bg-muted/15 hover:shadow-[0_8px_28px_-14px_rgba(0,0,0,0.75)]',
              )}
            >
              <div
                className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
              <div className="flex items-start justify-between gap-1">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-muted/25',
                    section.iconClassName,
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-muted-foreground" />
              </div>
              <span className="mt-2.5 text-xs font-semibold tracking-tight text-foreground">
                {section.title}
              </span>
              <span className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                {section.description}
              </span>
              {section.links?.[0] && (
                <span className="mt-2 text-[10px] font-medium text-muted-foreground/70 group-hover:text-foreground/90">
                  {section.links[0].label} →
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </HubPanel>
  )
}
