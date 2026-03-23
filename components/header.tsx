'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, BarChart3, ArrowLeftRight, Coins, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Activity },
  { name: 'Pools', href: '/pools', icon: BarChart3 },
  { name: 'DEX', href: '/dex', icon: LayoutGrid },
  { name: 'Swap', href: '/swap', icon: ArrowLeftRight },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan">
            <Coins className="h-5 w-5 text-background" />
          </div>
          <span className="text-xl font-bold text-foreground">
            Yield<span className="text-cyan">Scan</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-secondary text-cyan'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.name}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
