'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Calculator,
  LockKeyhole,
  Droplets,
  LayoutGrid,
  Building2,
  LineChart,
  Newspaper,
  SlidersHorizontal,
  Sparkles,
  Wallet,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { MobileSidebarEdgeOpenStrip } from '@/components/mobile-sidebar-edge-strip'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useSwipeMainNavHandlers } from '@/hooks/use-swipe-main-nav'
import { useIsMobile } from '@/hooks/use-mobile'

type NavItem = {
  name: string
  href: string
  icon: typeof Activity
  /** Cor do ícone (sempre visível, inclusive no item activo). */
  iconClassName: string
}

const MAIN_NAV: NavItem[] = [
  { name: 'Painel', href: '/dashboard', icon: Activity, iconClassName: 'text-emerald-400' },
  { name: 'Gestão Financeira', href: '/news/gestao-financeira', icon: Building2, iconClassName: 'text-emerald-400' },
  { name: 'Notícias', href: '/news', icon: Newspaper, iconClassName: 'text-blue-400' },
  { name: 'Carteira', href: '/portfolio', icon: Wallet, iconClassName: 'text-amber-400' },
  { name: 'Pools', href: '/pools', icon: BarChart3, iconClassName: 'text-cyan-400' },
  { name: 'A minha liquidez', href: '/my-liquidity', icon: Droplets, iconClassName: 'text-sky-400' },
  {
    name: 'Rebalance Pro',
    href: '/rebalance-pro',
    icon: SlidersHorizontal,
    iconClassName: 'text-orange-400',
  },
  { name: 'Indicadores', href: '/indicator', icon: LineChart, iconClassName: 'text-yellow-400' },
  { name: 'Calculadora', href: '/calculator', icon: Calculator, iconClassName: 'text-violet-400' },
  { name: 'Unlocks', href: '/unlocks', icon: LockKeyhole, iconClassName: 'text-teal-400' },
  { name: 'DEX', href: '/dex', icon: LayoutGrid, iconClassName: 'text-fuchsia-400' },
  { name: 'Trocas', href: '/swap', icon: ArrowLeftRight, iconClassName: 'text-rose-400' },
]

const RESOURCE_NAV: NavItem[] = [
  { name: 'Aprender', href: 'https://www.yldlab.xyz/', icon: BookOpen, iconClassName: 'text-indigo-400' },
  { name: 'PRO', href: '/dex', icon: Sparkles, iconClassName: 'text-[#d4af37]' },
]

function pageTitle(pathname: string): string {
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return 'Painel'
  if (pathname === '/news' || pathname.startsWith('/news/')) {
    if (pathname.startsWith('/news/gestao-financeira')) return 'Gestão Financeira'
    return 'Notícias'
  }
  if (pathname.startsWith('/portfolio')) return 'Carteira'
  if (pathname.startsWith('/pools')) return 'Pools'
  if (pathname.startsWith('/my-liquidity')) return 'A minha liquidez'
  if (pathname.startsWith('/rebalance-pro')) return 'Rebalance Pro'
  if (pathname.startsWith('/indicator')) return 'Indicadores'
  if (pathname.startsWith('/calculator')) return 'Calculadora'
  if (pathname.startsWith('/unlocks')) return 'Unlocks'
  if (pathname.startsWith('/dex')) return 'DEX'
  if (pathname.startsWith('/swap')) return 'Trocas'
  if (pathname.startsWith('/token/')) {
    const sym = pathname.slice('/token/'.length)
    return sym ? `Token · ${decodeURIComponent(sym)}` : 'Token'
  }
  return 'YieldScan'
}

function AppShellInset({
  title,
  swipeNav,
  wideContent,
  compactHeader,
  children,
}: {
  title: string
  swipeNav: ReturnType<typeof useSwipeMainNavHandlers>
  /** Usa mais largura útil (remove margem/arredondado do inset em desktop). */
  wideContent?: boolean
  /** Indicadores no telemóvel — menos chrome, mais gráfico. */
  compactHeader?: boolean
  children: React.ReactNode
}) {
  return (
    <SidebarInset
      className={
        wideContent
          ? 'md:!m-0 md:!rounded-none md:!shadow-none md:peer-data-[state=collapsed]:!ml-0'
          : undefined
      }
    >
      <header
        className={cn(
          'relative z-40 flex shrink-0 items-center gap-2 border-b border-border/70 bg-background/90 backdrop-blur-md',
          compactHeader ? 'h-10 px-2' : 'h-14 px-3 md:px-4',
        )}
      >
        <SidebarTrigger className={cn('-ml-1', compactHeader && 'h-9 w-9')} />
        {!compactHeader ? <Separator orientation="vertical" className="mr-1 h-6" /> : null}
        <div className="flex min-w-0 flex-1 flex-col">
          {!compactHeader ? (
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              YieldScan
            </span>
          ) : null}
          <span className={cn('truncate font-semibold text-foreground', compactHeader ? 'text-xs' : 'text-sm')}>
            {title}
          </span>
        </div>
      </header>
      <div
        className="flex min-h-0 flex-1 flex-col"
        onTouchStart={swipeNav.onTouchStart}
        onTouchEnd={swipeNav.onTouchEnd}
      >
        {children}
      </div>
    </SidebarInset>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const title = pageTitle(pathname)
  const swipeNavRaw = useSwipeMainNavHandlers()
  const swipeNav = pathname.startsWith('/indicator')
    ? { onTouchStart: () => undefined, onTouchEnd: () => undefined }
    : swipeNavRaw
  const isPhone = useIsMobile()
  const compactHeader = isPhone && pathname.startsWith('/indicator')

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/news/mercado">
                  <div className="relative aspect-square size-10 shrink-0 overflow-hidden rounded-lg border border-sidebar-primary/35 bg-black">
                    <Image
                      src="/icon-192.png"
                      alt="YieldScan"
                      width={40}
                      height={40}
                      className="size-full object-cover"
                      priority
                    />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <span className="truncate text-base font-bold tracking-tight">
                      Yield<span className="text-sidebar-primary">Scan</span>
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navegação</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {MAIN_NAV.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        item.href === '/news'
                          ? pathname === '/news' || pathname.startsWith('/news/')
                          : item.href === '/portfolio'
                            ? pathname.startsWith('/portfolio')
                            : item.href === '/pools'
                              ? pathname.startsWith('/pools')
                              : item.href === '/my-liquidity'
                                ? pathname.startsWith('/my-liquidity')
                                : item.href === '/rebalance-pro'
                                  ? pathname.startsWith('/rebalance-pro')
                                  : item.href === '/indicator'
                                    ? pathname.startsWith('/indicator')
                                    : item.href === '/calculator'
                                      ? pathname.startsWith('/calculator')
                                      : item.href === '/unlocks'
                                        ? pathname.startsWith('/unlocks')
                                        : pathname === item.href
                      }
                      tooltip={item.name}
                    >
                      <Link href={item.href}>
                        <item.icon className={cn('size-4 shrink-0', item.iconClassName)} />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Recursos</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Aprender (site externo)">
                    <a href={RESOURCE_NAV[0].href} target="_blank" rel="noopener noreferrer">
                      <BookOpen className={cn('size-4 shrink-0', RESOURCE_NAV[0].iconClassName)} />
                      <span>Aprender</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === '/dex' || pathname.startsWith('/dex/')}
                    tooltip="Destaques PRO"
                  >
                    <Link href={RESOURCE_NAV[1].href}>
                      <Sparkles className={cn('size-4 shrink-0', RESOURCE_NAV[1].iconClassName)} />
                      <span>PRO</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-2">
          <p className="px-2 text-[10px] leading-snug text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden">
            Pools agregadas via DeFi Llama + Meteora. APR pode diferir do app de cada DEX.
          </p>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <MobileSidebarEdgeOpenStrip />

      <AppShellInset
        title={title}
        swipeNav={swipeNav}
        compactHeader={compactHeader}
        wideContent={
          pathname.startsWith('/my-liquidity') ||
          pathname.startsWith('/rebalance-pro') ||
          pathname.startsWith('/indicator')
        }
      >
        {children}
      </AppShellInset>
    </SidebarProvider>
  )
}
