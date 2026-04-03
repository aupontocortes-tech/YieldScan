'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { PwaInstallPrompt } from '@/components/pwa-install-prompt'
import { SqliteBootstrap } from '@/components/sqlite-bootstrap'

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
    <QueryClientProvider client={queryClient}>
      <SqliteBootstrap />
      <AppShell>{children}</AppShell>
      <PwaInstallPrompt />
    </QueryClientProvider>
  )
}
