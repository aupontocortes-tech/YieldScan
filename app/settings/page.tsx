import type { Metadata } from 'next'
import { SyncAccountPanel } from '@/components/settings/sync-account-panel'

export const metadata: Metadata = {
  title: 'Configurações | YieldScan',
  description: 'Preferências e sincronização do YieldScan.',
}

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Configurações</h1>
          <p className="mt-3 text-muted-foreground">
            Sincronize as finanças entre telemóvel e computador com uma senha.
          </p>
        </div>

        <SyncAccountPanel />
      </main>
    </div>
  )
}
