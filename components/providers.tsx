'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { PwaInstallPrompt } from '@/components/pwa-install-prompt'
import { SolanaWalletProviders } from '@/components/solana-wallet-providers'
import { MarketApiWarm } from '@/components/market-api-warm'
import { SqliteBootstrap } from '@/components/sqlite-bootstrap'
import { AppWagmiProvider } from '@/components/wagmi-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes — menos “refetch” pesado ao navegar
            gcTime: 20 * 60 * 1000, // mantém cache no cliente mais tempo ao trocar de página
            refetchInterval: 8 * 60 * 1000, // background refresh menos agressivo
            refetchOnWindowFocus: false,
            retry: 1,
            retryDelay: 4000,
          },
        },
      })
  )

  return (
    <AppWagmiProvider>
      <QueryClientProvider client={queryClient}>
        <SolanaWalletProviders>
          <SqliteBootstrap />
          <MarketApiWarm />
          <AppShell>{children}</AppShell>
          <PwaInstallPrompt />
        </SolanaWalletProviders>
      </QueryClientProvider>
    </AppWagmiProvider>
  )
}
