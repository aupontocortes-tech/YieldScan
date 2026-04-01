'use client'

import dynamic from 'next/dynamic'

const DashbuddyNews = dynamic(
  () => import('@/components/dashboard/dashbuddy-news').then((m) => m.DashbuddyNews),
  { loading: () => <div className="min-h-[320px] animate-pulse rounded-xl bg-muted/15" aria-hidden /> }
)

export default function NewsNoticiasPage() {
  return <DashbuddyNews />
}
