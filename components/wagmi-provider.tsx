'use client'

import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from '@/lib/wagmi/config'
import type { ReactNode } from 'react'

export function AppWagmiProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount>
      {children}
    </WagmiProvider>
  )
}
