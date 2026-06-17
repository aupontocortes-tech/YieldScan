'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const GfMicPermissionPage = dynamic(
  () =>
    import('@/components/gestao-financeira/gf-mic-permission-page').then((m) => ({
      default: m.GfMicPermissionPage,
    })),
  {
    loading: () => <div className="h-48 animate-pulse rounded-2xl bg-muted/15" aria-hidden />,
    ssr: false,
  },
)

export default function GfMicPermissionRoutePage() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-muted/15" aria-hidden />}>
      <GfMicPermissionPage />
    </Suspense>
  )
}
