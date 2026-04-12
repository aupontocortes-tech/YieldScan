'use client'

import Link from 'next/link'
import { ArrowLeft, Wallet } from 'lucide-react'
import { usePortfolioStore } from '@/hooks/use-portfolio'
import { PortfolioTransactionRow } from '@/components/portfolio/transaction-row'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const CARD =
  'rounded-2xl border border-white/[0.06] bg-[#111827] text-card-foreground shadow-lg shadow-black/30'
const PAGE_BG = 'bg-[#0B0F14]'

export function PortfolioHistoricoClient() {
  const { data, ready } = usePortfolioStore()

  if (!ready) {
    return (
      <div className={cn('flex flex-1 flex-col', PAGE_BG)}>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <Skeleton className="mb-6 h-10 w-48 rounded-lg bg-white/5" />
          <Skeleton className="h-96 rounded-2xl bg-white/5" />
        </main>
      </div>
    )
  }

  const txs = data.transactions

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', PAGE_BG)}>
      <main className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-4 h-9 gap-2 text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href="/portfolio">
              <ArrowLeft className="size-4" />
              Voltar ao portfólio
            </Link>
          </Button>
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-[#3b82f6]">
              <Wallet className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Histórico de transações
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {txs.length === 0
                  ? 'Ainda não há movimentos registados.'
                  : `${txs.length} ${txs.length === 1 ? 'transação' : 'transações'} · ${data.name}`}
              </p>
            </div>
          </div>
        </div>

        {txs.length === 0 ? (
          <div className={cn('flex flex-col items-center justify-center gap-4 py-16 text-center', CARD)}>
            <p className="max-w-sm text-sm text-muted-foreground">
              As tuas compras e vendas aparecem aqui. Adiciona uma transação no portfólio para começar.
            </p>
            <Button className="bg-[#3b82f6] text-white hover:bg-[#2563eb]" asChild>
              <Link href="/portfolio">Ir para o portfólio</Link>
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {txs.map((tx) => (
              <li key={tx.id}>
                <PortfolioTransactionRow tx={tx} holdings={data.holdings} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
