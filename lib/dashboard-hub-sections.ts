import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Calculator,
  Droplets,
  LineChart,
  LockKeyhole,
  Wallet,
} from 'lucide-react'

export type DashboardHubSection = {
  id: string
  title: string
  description: string
  href: string
  icon: LucideIcon
  iconClassName: string
  links?: Array<{ label: string; href: string }>
}

export const DASHBOARD_HUB_SECTIONS: DashboardHubSection[] = [
  {
    id: 'pools',
    title: 'Pools',
    description: 'Yield por protocolo e rede',
    href: '/pools',
    icon: BarChart3,
    iconClassName: 'text-cyan-400',
    links: [{ label: 'Blue chips', href: '/pools/blue-chips' }],
  },
  {
    id: 'portfolio',
    title: 'Carteira',
    description: 'Posições e histórico',
    href: '/portfolio',
    icon: Wallet,
    iconClassName: 'text-amber-400',
    links: [{ label: 'Histórico', href: '/portfolio/historico' }],
  },
  {
    id: 'liquidity',
    title: 'A minha liquidez',
    description: 'Posições LP',
    href: '/my-liquidity',
    icon: Droplets,
    iconClassName: 'text-sky-400',
    links: [{ label: 'Rebalance Pro', href: '/rebalance-pro' }],
  },
  {
    id: 'indicators',
    title: 'Indicadores',
    description: 'Gráficos e análise técnica',
    href: '/indicator',
    icon: LineChart,
    iconClassName: 'text-yellow-400',
  },
  {
    id: 'calculator',
    title: 'Calculadora',
    description: 'Simular retornos',
    href: '/calculator',
    icon: Calculator,
    iconClassName: 'text-violet-400',
  },
  {
    id: 'unlocks',
    title: 'Unlocks',
    description: 'Desbloqueios de tokens',
    href: '/unlocks',
    icon: LockKeyhole,
    iconClassName: 'text-teal-400',
  },
]
