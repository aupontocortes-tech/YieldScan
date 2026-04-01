'use client'

import dynamic from 'next/dynamic'

const DashbuddyCryptoMarket = dynamic(
  () =>
    import('@/components/dashboard/dashbuddy-crypto-market').then((m) => m.DashbuddyCryptoMarket),
  { loading: () => <div className="min-h-[200px] animate-pulse rounded-xl bg-muted/15" aria-hidden /> }
)

const DashbuddyNews = dynamic(
  () => import('@/components/dashboard/dashbuddy-news').then((m) => m.DashbuddyNews),
  { loading: () => <div className="min-h-[320px] animate-pulse rounded-xl bg-muted/15" aria-hidden /> }
)

export default function NewsPage() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-10 border-b border-border/40 pb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Cripto e mercado</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Preços e tendências (CoinGecko) junto de notícias classificadas — criptomoedas, geopolítica e macro —
            com tradução para português quando a fonte está doutro idioma.
          </p>
        </header>

        <DashbuddyCryptoMarket />

        <div className="my-12 border-t border-border/50 pt-12" />

        <DashbuddyNews />
      </main>
    </div>
  )
}
