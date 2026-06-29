'use client'

import dynamic from 'next/dynamic'
import { LayoutDashboard } from 'lucide-react'
import { HubAreas } from '@/components/dashboard/hub/hub-areas'
import { HubFinance } from '@/components/dashboard/hub/hub-finance'
import { HubLiquidity } from '@/components/dashboard/hub/hub-liquidity'
import { HubMarketStrip } from '@/components/dashboard/hub/hub-market-strip'
import { HubNews } from '@/components/dashboard/hub/hub-news'
import { HubSectionTitle } from '@/components/dashboard/hub/hub-panel'
import { HubTendencias } from '@/components/dashboard/hub/hub-tendencias'

const TvlChart = dynamic(
  () => import('@/components/dashboard/tvl-chart').then((m) => m.TvlChart),
  {
    loading: () => (
      <div
        className="h-[248px] animate-pulse rounded-2xl border border-cyan-500/10 bg-muted/10 ring-1 ring-white/[0.04]"
        aria-hidden
      />
    ),
  },
)

export function DashboardHub() {
  return (
    <section className="mb-12 space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-card/80 via-background/90 to-emerald-950/20 px-5 py-6 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.04] backdrop-blur-sm sm:px-7 sm:py-7">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-cyan-500/8 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/35 bg-emerald-500/10 shadow-[0_0_40px_-12px_rgba(52,211,153,0.55)] ring-1 ring-emerald-400/10">
            <LayoutDashboard className="h-6 w-6 text-emerald-400" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400/80">
              YieldScan
            </p>
            <h2 className="mt-0.5 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Centro de comando
            </h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Mercado, finanças pessoais, afazeres e liquidez LP — visão geral antes de mergulhares em
              cada área.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] font-medium tracking-wide text-emerald-300/95">Ao vivo</span>
          </div>
        </div>
      </div>

      <div>
        <HubSectionTitle>Mercado</HubSectionTitle>
        <HubMarketStrip />
      </div>

      <div>
        <HubSectionTitle>Finanças pessoais</HubSectionTitle>
        <HubFinance />
      </div>

      <div>
        <HubSectionTitle>Insights</HubSectionTitle>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 xl:items-stretch">
          <HubTendencias />
          <HubNews />
          <HubLiquidity className="md:col-span-2 xl:col-span-1" />
        </div>
      </div>

      <div>
        <HubSectionTitle>Dados &amp; atalhos</HubSectionTitle>
        <div className="grid gap-5 lg:grid-cols-12 lg:items-stretch">
          <div className="overflow-hidden rounded-2xl border border-cyan-500/15 bg-gradient-to-b from-card/90 to-background/80 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.04] backdrop-blur-sm lg:col-span-7">
            <TvlChart compact className="border-0 bg-transparent shadow-none" />
          </div>
          <div className="lg:col-span-5">
            <HubAreas />
          </div>
        </div>
      </div>
    </section>
  )
}
