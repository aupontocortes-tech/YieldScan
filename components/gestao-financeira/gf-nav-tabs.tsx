'use client'

import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  ArrowLeftRight,
  Bitcoin,
  CalendarCheck,
  FileBarChart,
  LayoutDashboard,
  Landmark,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export type GfTabValue =
  | 'dashboard'
  | 'movimentos'
  | 'caixas'
  | 'dividas'
  | 'cripto'
  | 'afazeres'
  | 'relatorios'

type TabDef = {
  value: GfTabValue
  label: string
  shortLabel?: string
  icon: LucideIcon
  iconClass: string
  iconWrap: string
  iconWrapActive: string
  tabIdle: string
  tabHover: string
  tabActive: string
}

const GF_TABS: TabDef[] = [
  {
    value: 'dashboard',
    label: 'Painel',
    icon: LayoutDashboard,
    iconClass: 'text-cyan-300',
    iconWrap: 'bg-cyan-500/25 ring-cyan-400/25',
    iconWrapActive:
      'group-data-[state=active]:bg-cyan-400/40 group-data-[state=active]:ring-cyan-300/55 group-data-[state=active]:shadow-[0_0_14px_rgba(34,211,238,0.55)]',
    tabIdle: 'border-cyan-500/20 bg-cyan-950/25',
    tabHover: 'hover:border-cyan-400/50 hover:bg-cyan-500/20 hover:shadow-[0_4px_22px_-6px_rgba(34,211,238,0.4)]',
    tabActive:
      'data-[state=active]:border-cyan-400/65 data-[state=active]:bg-gradient-to-br data-[state=active]:from-cyan-500/35 data-[state=active]:via-cyan-500/18 data-[state=active]:to-teal-600/25 data-[state=active]:text-cyan-50 data-[state=active]:shadow-[0_8px_30px_-8px_rgba(34,211,238,0.6)]',
  },
  {
    value: 'movimentos',
    label: 'Receitas / Despesas',
    shortLabel: 'Movimentos',
    icon: ArrowLeftRight,
    iconClass: 'text-emerald-300',
    iconWrap: 'bg-emerald-500/25 ring-emerald-400/25',
    iconWrapActive:
      'group-data-[state=active]:bg-emerald-400/40 group-data-[state=active]:ring-emerald-300/55 group-data-[state=active]:shadow-[0_0_14px_rgba(16,185,129,0.55)]',
    tabIdle: 'border-emerald-500/20 bg-emerald-950/25',
    tabHover: 'hover:border-emerald-400/50 hover:bg-emerald-500/20 hover:shadow-[0_4px_22px_-6px_rgba(16,185,129,0.4)]',
    tabActive:
      'data-[state=active]:border-emerald-400/65 data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500/35 data-[state=active]:via-emerald-500/18 data-[state=active]:to-green-600/25 data-[state=active]:text-emerald-50 data-[state=active]:shadow-[0_8px_30px_-8px_rgba(16,185,129,0.55)]',
  },
  {
    value: 'caixas',
    label: 'Caixas',
    icon: Wallet,
    iconClass: 'text-sky-300',
    iconWrap: 'bg-sky-500/25 ring-sky-400/25',
    iconWrapActive:
      'group-data-[state=active]:bg-sky-400/40 group-data-[state=active]:ring-sky-300/55 group-data-[state=active]:shadow-[0_0_14px_rgba(14,165,233,0.55)]',
    tabIdle: 'border-sky-500/20 bg-sky-950/25',
    tabHover: 'hover:border-sky-400/50 hover:bg-sky-500/20 hover:shadow-[0_4px_22px_-6px_rgba(14,165,233,0.4)]',
    tabActive:
      'data-[state=active]:border-sky-400/65 data-[state=active]:bg-gradient-to-br data-[state=active]:from-sky-500/35 data-[state=active]:via-sky-500/18 data-[state=active]:to-blue-600/25 data-[state=active]:text-sky-50 data-[state=active]:shadow-[0_8px_30px_-8px_rgba(14,165,233,0.55)]',
  },
  {
    value: 'dividas',
    label: 'Dívidas',
    icon: Landmark,
    iconClass: 'text-rose-300',
    iconWrap: 'bg-rose-500/25 ring-rose-400/25',
    iconWrapActive:
      'group-data-[state=active]:bg-rose-400/40 group-data-[state=active]:ring-rose-300/55 group-data-[state=active]:shadow-[0_0_14px_rgba(244,63,94,0.5)]',
    tabIdle: 'border-rose-500/20 bg-rose-950/25',
    tabHover: 'hover:border-rose-400/50 hover:bg-rose-500/20 hover:shadow-[0_4px_22px_-6px_rgba(244,63,94,0.38)]',
    tabActive:
      'data-[state=active]:border-rose-400/65 data-[state=active]:bg-gradient-to-br data-[state=active]:from-rose-500/35 data-[state=active]:via-rose-500/18 data-[state=active]:to-red-600/25 data-[state=active]:text-rose-50 data-[state=active]:shadow-[0_8px_30px_-8px_rgba(244,63,94,0.5)]',
  },
  {
    value: 'cripto',
    label: 'Cripto',
    icon: Bitcoin,
    iconClass: 'text-amber-300',
    iconWrap: 'bg-amber-500/25 ring-amber-400/25',
    iconWrapActive:
      'group-data-[state=active]:bg-amber-400/40 group-data-[state=active]:ring-amber-300/55 group-data-[state=active]:shadow-[0_0_14px_rgba(245,158,11,0.55)]',
    tabIdle: 'border-amber-500/20 bg-amber-950/25',
    tabHover: 'hover:border-amber-400/50 hover:bg-amber-500/20 hover:shadow-[0_4px_22px_-6px_rgba(245,158,11,0.4)]',
    tabActive:
      'data-[state=active]:border-amber-400/65 data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-500/35 data-[state=active]:via-amber-500/18 data-[state=active]:to-orange-600/25 data-[state=active]:text-amber-50 data-[state=active]:shadow-[0_8px_30px_-8px_rgba(245,158,11,0.55)]',
  },
  {
    value: 'afazeres',
    label: 'Afazeres',
    icon: CalendarCheck,
    iconClass: 'text-violet-300',
    iconWrap: 'bg-violet-500/25 ring-violet-400/25',
    iconWrapActive:
      'group-data-[state=active]:bg-violet-400/40 group-data-[state=active]:ring-violet-300/55 group-data-[state=active]:shadow-[0_0_14px_rgba(139,92,246,0.6)]',
    tabIdle: 'border-violet-500/20 bg-violet-950/25',
    tabHover: 'hover:border-violet-400/50 hover:bg-violet-500/20 hover:shadow-[0_4px_22px_-6px_rgba(139,92,246,0.45)]',
    tabActive:
      'data-[state=active]:border-violet-400/65 data-[state=active]:bg-gradient-to-br data-[state=active]:from-violet-500/35 data-[state=active]:via-violet-500/18 data-[state=active]:to-purple-600/25 data-[state=active]:text-violet-50 data-[state=active]:shadow-[0_8px_30px_-8px_rgba(139,92,246,0.6)]',
  },
  {
    value: 'relatorios',
    label: 'Relatórios',
    icon: FileBarChart,
    iconClass: 'text-indigo-300',
    iconWrap: 'bg-indigo-500/25 ring-indigo-400/25',
    iconWrapActive:
      'group-data-[state=active]:bg-indigo-400/40 group-data-[state=active]:ring-indigo-300/55 group-data-[state=active]:shadow-[0_0_14px_rgba(99,102,241,0.55)]',
    tabIdle: 'border-indigo-500/20 bg-indigo-950/25',
    tabHover: 'hover:border-indigo-400/50 hover:bg-indigo-500/20 hover:shadow-[0_4px_22px_-6px_rgba(99,102,241,0.4)]',
    tabActive:
      'data-[state=active]:border-indigo-400/65 data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-500/35 data-[state=active]:via-indigo-500/18 data-[state=active]:to-blue-600/25 data-[state=active]:text-indigo-50 data-[state=active]:shadow-[0_8px_30px_-8px_rgba(99,102,241,0.55)]',
  },
]

const TRIGGER_RESET =
  'group relative flex min-h-[3.25rem] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-semibold sm:min-h-[3.5rem] sm:flex-row sm:gap-2.5 sm:px-3 sm:text-sm transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[0.98] data-[state=active]:-translate-y-0.5 data-[state=active]:font-bold focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:outline-none !shadow-none dark:!bg-transparent dark:data-[state=active]:!bg-transparent text-foreground/80'

type Props = {
  pendingToday?: number
}

export function GfNavTabs({ pendingToday = 0 }: Props) {
  return (
    <TabsList
      className={cn(
        'grid h-auto w-full grid-cols-2 gap-2 rounded-2xl border border-white/10 p-2.5 sm:p-3',
        'bg-gradient-to-br from-slate-900/95 via-[#0a1020] to-slate-950',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_10px_40px_-14px_rgba(0,0,0,0.75)]',
        'sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7',
      )}
    >
      {GF_TABS.map((tab) => {
        const Icon = tab.icon
        return (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={cn(TRIGGER_RESET, tab.tabIdle, tab.tabHover, tab.tabActive)}
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 transition-all duration-300 group-hover:scale-110',
                tab.iconWrap,
                'group-data-[state=active]:scale-110',
                tab.iconWrapActive,
              )}
            >
              <Icon className={cn('size-[1.125rem]', tab.iconClass)} />
            </span>
            <span className="max-w-full truncate text-center leading-tight">
              <span className="sm:hidden">{tab.shortLabel ?? tab.label}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </span>
            {tab.value === 'afazeres' && pendingToday > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 animate-pulse items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white shadow-[0_0_12px_rgba(139,92,246,0.85)] ring-2 ring-[#0a1020]">
                {pendingToday > 9 ? '9+' : pendingToday}
              </span>
            ) : null}
          </TabsTrigger>
        )
      })}
    </TabsList>
  )
}
