import type { Metadata } from 'next'
import { Suspense } from 'react'
import { UnlocksDashboard } from '@/components/unlocks/unlocks-dashboard'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'Unlocks | YieldScan',
  description: 'Próximos desbloqueios de tokens, impacto no mercado e inflação.',
}

export default function UnlocksPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-8 h-96 max-w-5xl rounded-xl" />}>
      <UnlocksDashboard />
    </Suspense>
  )
}
