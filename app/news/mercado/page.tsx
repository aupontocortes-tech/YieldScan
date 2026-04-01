'use client'

import dynamic from 'next/dynamic'

const DashbuddyCryptoMarket = dynamic(
  () =>
    import('@/components/dashboard/dashbuddy-crypto-market').then((m) => m.DashbuddyCryptoMarket),
  { loading: () => <div className="min-h-[200px] animate-pulse rounded-xl bg-muted/15" aria-hidden /> }
)

export default function NewsMercadoPage() {
  return <DashbuddyCryptoMarket />
}
