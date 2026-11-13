'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Globe2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { TendenciasL1Panel, TendenciasL1Token, TendenciasNetworkRow } from '@/lib/tendencias/types'
import { cn } from '@/lib/utils'

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function fmtCoins(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} mil milhões`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} milhões`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} mil`
  return n.toFixed(0)
}

type TokenFicha = {
  about: string | null
  homepage: string | null
  categories?: string[]
  circulating: number | null
  total: number | null
  max: number | null
  issuedPct: number | null
  leftPct: number | null
  inflation: 'baixa' | 'media' | 'alta' | 'desconhecida'
  headline: string
  detail: string
}

function TokenFichaPanel({ geckoId }: { geckoId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['token-ficha', geckoId],
    queryFn: async () => {
      const res = await fetch(`/api/token-about?id=${encodeURIComponent(geckoId)}`)
      if (!res.ok) return null
      return (await res.json()) as TokenFicha
    },
    staleTime: 30 * 60_000,
  })

  if (isLoading) {
    return <p className="mt-3 text-sm text-muted-foreground">A carregar ficha simples…</p>
  }
  if (!data) {
    return <p className="mt-3 text-sm text-muted-foreground">Sem dados desta moeda neste momento.</p>
  }

  const issued = data.issuedPct ?? 0
  const left = data.leftPct ?? 0
  const inflColor =
    data.inflation === 'baixa'
      ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
      : data.inflation === 'alta'
        ? 'border-rose-500/40 bg-rose-950/30 text-rose-200'
        : data.inflation === 'media'
          ? 'border-amber-500/40 bg-amber-950/30 text-amber-200'
          : 'border-slate-500/40 bg-slate-900/40 text-slate-200'

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300">O que esta moeda faz</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground/90">
          {data.about ?? 'Ainda não há um texto simples para esta moeda.'}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-300">Moedas no mercado</p>
        <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/10">
          <div className="flex h-full w-full">
            <div className="h-full bg-emerald-400" style={{ width: `${Math.max(4, issued)}%` }} />
            <div className="h-full bg-amber-400/80" style={{ width: `${Math.max(0, left)}%` }} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
          <span className="text-emerald-300">Verde = já no mercado ({fmtCoins(data.circulating)})</span>
          <span className="text-amber-300">Amarelo = ainda pode sair ({fmtCoins((data.max ?? data.total ?? 0) - (data.circulating ?? 0))})</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          No mercado: {fmtCoins(data.circulating)} · Tecto: {fmtCoins(data.max ?? data.total)}
        </p>
      </div>

      <div className={cn('rounded-lg border px-3 py-2.5', inflColor)}>
        <p className="text-sm font-bold">
          Inflação: {data.inflation === 'baixa' ? 'baixa' : data.inflation === 'alta' ? 'alta' : data.inflation === 'media' ? 'média' : 'não sabemos'}
        </p>
        <p className="mt-1 text-sm font-semibold">{data.headline}</p>
        <p className="mt-1 text-xs leading-relaxed opacity-90">{data.detail}</p>
        <p className="mt-2 text-[11px] opacity-80">
          Isto não diz se a moeda vai subir. Só diz se ainda vão aparecer muitas moedas novas.
        </p>
      </div>
    </div>
  )
}

function TokenCard({ token, chain }: { token: TendenciasL1Token; chain: string }) {
  const [open, setOpen] = useState(false)
  const up = (token.change7d ?? 0) >= 0

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full rounded-xl border px-3 py-3 text-left transition',
          open
            ? 'border-cyan-400/40 bg-cyan-950/25'
            : up
              ? 'border-emerald-500/25 bg-emerald-950/15 hover:border-emerald-400/40'
              : 'border-rose-500/25 bg-rose-950/10 hover:border-rose-400/40',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold tracking-tight">
              {token.symbol}{' '}
              <span className="font-medium text-muted-foreground">{token.name}</span>
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-foreground/75">{token.about}</p>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={cn(
                'rounded-md px-2 py-1 font-mono text-sm font-black tabular-nums',
                up ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300',
              )}
            >
              {fmtPct(token.change7d)}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">7 dias</p>
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-cyan-300">
          {open ? 'Fechar ficha' : 'Clica para ver o que faz e a inflação'}
          <ChevronDown className={cn('h-3.5 w-3.5', open && 'rotate-180')} />
        </p>
      </button>
      {open && token.geckoId && <TokenFichaPanel geckoId={token.geckoId} />}
      {open && !token.geckoId && (
        <p className="mt-2 px-1 text-sm text-muted-foreground">
          Sem ficha CoinGecko para {token.symbol} em {chain}. {token.about}
        </p>
      )}
    </li>
  )
}

export function L1RedesPanel({ l1 }: { l1: TendenciasL1Panel | null }) {
  const [onlyL1, setOnlyL1] = useState(true)
  const [selected, setSelected] = useState<string | null>(l1?.bestL1 ?? null)

  const networks = useMemo(() => {
    const rows = l1?.networks ?? []
    return onlyL1 ? rows.filter((n) => n.kind === 'l1') : rows
  }, [l1, onlyL1])

  const active = networks.find((n) => n.name === selected) ?? networks[0] ?? null

  if (!l1 || l1.networks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-muted/5 px-4 py-10 text-center">
        <Globe2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">Não foi possível carregar redes. Actualiza daqui a um minuto.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/70 via-teal-950/30 to-card px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Melhor fluxo agora</p>
          <p className="mt-1 text-3xl font-black text-emerald-200">{l1.bestL1 ?? '—'}</p>
          <p className="mt-2 text-sm text-foreground/85">
            Dinheiro a entrar nesta L1. Clica nela abaixo para ver os tokens que mais sobem.
          </p>
        </div>
        <div className="rounded-xl border border-slate-500/35 bg-gradient-to-br from-slate-900/80 to-card px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Maior cofre</p>
          <p className="mt-1 text-3xl font-black text-slate-100">{l1.biggestVault ?? '—'}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Tem mais dinheiro parado. Não é automaticamente a que está a performar melhor.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" size="sm" variant={onlyL1 ? 'default' : 'outline'} className="h-8" onClick={() => setOnlyL1(true)}>
          Só L1
        </Button>
        <Button type="button" size="sm" variant={!onlyL1 ? 'default' : 'outline'} className="h-8" onClick={() => setOnlyL1(false)}>
          Também L2
        </Button>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">1. Escolhe a rede</h3>
        <ul className="space-y-1.5">
          {networks.map((n: TendenciasNetworkRow) => {
            const on = active?.name === n.name
            return (
              <li key={n.name}>
                <button
                  type="button"
                  onClick={() => setSelected(n.name)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left',
                    on ? 'border-cyan-400/50 bg-cyan-500/15 ring-1 ring-cyan-400/30' : 'border-border/35 bg-muted/5',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{n.name}</span>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    {n.kind === 'l1' ? 'L1' : n.kind === 'l2' ? 'L2' : 'Outra'}
                  </Badge>
                  <span
                    className={cn(
                      'font-mono text-sm font-bold tabular-nums',
                      (n.tvlChange7dPct ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300',
                    )}
                  >
                    {fmtPct(n.tvlChange7dPct)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {active && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">2. Tokens a performar em {active.name}</h3>
          <p className="text-xs text-muted-foreground">
            Ordenados pelo que mais subiu em 7 dias. Clica no token para ver o que faz e se ainda vão sair muitas moedas.
          </p>
          <ul className="space-y-2">
            {active.tokens.map((t) => (
              <TokenCard key={`${active.name}-${t.symbol}-${t.protocol}`} token={t} chain={active.name} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
