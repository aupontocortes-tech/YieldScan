import Link from 'next/link'
import { Header } from '@/components/header'
import { DEX_PLATFORMS } from '@/lib/dex'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink } from 'lucide-react'

export const metadata = {
  title: 'Corretoras descentralizadas | YieldScan',
  description:
    'Meteora, Hyperliquid, Jupiter, Uniswap e outras DEXs: links oficiais e resumo em português.',
}

export default function DexPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Corretoras descentralizadas
          </h1>
          <p className="mt-3 text-muted-foreground">
            Solana (Meteora, Jupiter, Raydium, Orca, Drift), Hyperliquid, EVM e perpétuos — atalhos
            para as apps oficiais. Em{' '}
            <Link href="/pools" className="text-cyan underline-offset-4 hover:underline">
              Pools
            </Link>{' '}
            podes filtrar por protocolo quando os dados existirem na DefiLlama.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEX_PLATFORMS.map((dex) => (
            <li key={dex.id}>
              <Card className="h-full border-border/80 bg-card/50 transition-colors hover:border-cyan/40">
                <CardHeader className="gap-1 pb-2">
                  <CardTitle className="text-lg">{dex.name}</CardTitle>
                  <CardDescription className="text-xs font-medium text-cyan/90">
                    {dex.chains}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4 px-6 pt-0 pb-6">
                  <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                    {dex.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="bg-cyan text-background hover:bg-cyan/90" asChild>
                      <a href={dex.href} target="_blank" rel="noopener noreferrer">
                        Abrir app
                        <ExternalLink className="size-3.5 opacity-80" />
                      </a>
                    </Button>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href="/pools">Ver pools</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
