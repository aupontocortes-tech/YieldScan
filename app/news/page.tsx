'use client'

import dynamic from 'next/dynamic'

const DashbuddyNews = dynamic(
  () => import('@/components/dashboard/dashbuddy-news').then((m) => m.DashbuddyNews),
  { loading: () => <div className="min-h-[320px] animate-pulse rounded-xl bg-muted/15" aria-hidden /> }
)

export default function NewsPage() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <DashbuddyNews />
      </main>
    </div>
  )
}
