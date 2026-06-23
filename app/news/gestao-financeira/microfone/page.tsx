'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const GfVoiceHelpPage = dynamic(
  () =>
    import('@/components/gestao-financeira/gf-voice-help-page').then((m) => ({
      default: m.GfVoiceHelpPage,
    })),
  {
    loading: () => <div className="h-48 animate-pulse rounded-2xl bg-muted/15" aria-hidden />,
    ssr: false,
  },
)

export default function GfMicPermissionRoutePage() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-muted/15" aria-hidden />}>
      <GfVoiceHelpPage />
    </Suspense>
  )
}
