'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Calculator,
  Coins,
  Droplets,
  LayoutGrid,
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
import { useSwipeMainNavHandlers } from '@/hooks/use-swipe-main-nav'

const MAIN_NAV = [
  { name: 'Painel', href: '/dashboard', icon: Activity },
  { name: 'Notícias', href: '/news', icon: Newspaper },
  { name: 'Carteira', href: '/portfolio', icon: Wallet },
  { name: 'Pools', href: '/pools', icon: BarChart3 },
  { name: 'A minha liquidez', href: '/my-liquidity', icon: Droplets },
  { name: 'Rebalance Pro', href: '/rebalance-pro', icon: SlidersHorizontal },
  { name: 'Indicadores', href: '/indicator', icon: LineChart },
  { name: 'Calculadora', href: '/calculator', icon: Calculator },
  { name: 'DEX', href: '/dex', icon: LayoutGrid },
  { name: 'Trocas', href: '/swap', icon: ArrowLeftRight },
] as const

function pageTitle(pathname: string): string {
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return 'Painel'
  if (pathname === '/news' || pathname.startsWith('/news/')) return 'Notícias'
  if (pathname.startsWith('/portfolio')) return 'Carteira'
  if (pathname.startsWith('/pools')) return 'Pools'
  if (pathname.startsWith('/my-liquidity')) return 'A minha liquidez'
  if (pathname.startsWith('/rebalance-pro')) return 'Rebalance Pro'
  if (pathname.startsWith('/indicator')) return 'Indicadores'
  if (pathname.startsWith('/calculator')) return 'Calculadora'
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
  children,
}: {
  title: string
  swipeNav: ReturnType<typeof useSwipeMainNavHandlers>
  /** Usa mais largura útil (remove margem/arredondado do inset em desktop). */
  wideContent?: boolean
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
      <header className="relative z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background/90 px-3 backdrop-blur-md md:px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-6" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            YieldScan
          </span>
          <span className="truncate text-sm font-semibold text-foreground">{title}</span>
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
  const swipeNav = useSwipeMainNavHandlers()

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg border border-sidebar-primary/35 bg-sidebar-primary/10 text-sidebar-primary">
                    <Coins className="size-4" />
                  </div>
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      Yield<span className="text-sidebar-primary">Scan</span>
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/65">
                      Rendimentos e liquidez em DeFi
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
                                      : pathname === item.href
                      }
                      tooltip={item.name}
                    >
                      <Link href={item.href}>
                        <item.icon />
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
                    <a href="https://www.yldlab.xyz/" target="_blank" rel="noopener noreferrer">
                      <BookOpen />
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
                    <Link href="/dex">
                      <Sparkles />
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
