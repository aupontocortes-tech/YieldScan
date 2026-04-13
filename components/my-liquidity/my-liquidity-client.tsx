'use client'

import { AlertCircle, Droplets, Inbox, Plus, RefreshCw, Trash2, Wallet, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LiquidityPositionCard } from '@/components/my-liquidity/position-card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { useMultiLiquidityPositions } from '@/hooks/use-liquidity-positions'
import { useMultiWallet, type SavedWallet } from '@/hooks/use-multi-wallet'
import type { WalletChain } from '@/hooks/use-wallet'
import { cn } from '@/lib/utils'

// ─── Wallet chip ─────────────────────────────────────────────────────────────

function WalletChip({
  wallet,
  onRemove,
}: {
  wallet: SavedWallet
  onRemove: (id: string) => void
}) {
  const short = `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`
  return (
    <div className="group flex items-center gap-1.5 rounded-full border border-border/60 bg-background/50 px-3 py-1 text-[11px] font-medium">
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          wallet.chain === 'ethereum' ? 'bg-[var(--chart-7)]' : 'bg-[var(--chart-5)]',
        )}
      />
      <span className="font-mono text-foreground">{short}</span>
      <span className="text-muted-foreground">·</span>
      <span className="uppercase text-muted-foreground">{wallet.chain === 'ethereum' ? 'ETH' : 'SOL'}</span>
      <button
        type="button"
        aria-label={`Remover ${short}`}
        onClick={() => onRemove(wallet.id)}
        className="ml-0.5 rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

// ─── Add wallet form (paste address) ─────────────────────────────────────────

function AddWalletForm({ onAdd }: { onAdd: (chain: WalletChain, address: string) => void }) {
  const [open, setOpen] = useState(false)
  const [chain, setChain] = useState<WalletChain>('ethereum')
  const [addr, setAddr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const submit = () => {
    const t = addr.trim()
    if (!t) return
    onAdd(chain, t)
    setAddr('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-dashed border-border/60 bg-transparent px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
      >
        <Plus className="size-3" />
        Adicionar endereço
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/40 p-2">
      <select
        value={chain}
        onChange={(e) => setChain(e.target.value as WalletChain)}
        className="h-8 rounded-lg border border-border/50 bg-background px-2 text-xs text-foreground focus:outline-none"
      >
        <option value="ethereum">Ethereum</option>
        <option value="solana">Solana</option>
      </select>
      <input
        ref={inputRef}
        value={addr}
        onChange={(e) => setAddr(e.target.value)}
        placeholder="Cole o endereço da carteira…"
        className="h-8 min-w-[220px] flex-1 rounded-lg border border-border/50 bg-background px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-gold/40"
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false) }}
      />
      <Button type="button" size="sm" className="h-8 bg-gold text-primary-foreground hover:bg-gold/90" onClick={submit}>
        Adicionar
      </Button>
      <button type="button" onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
        <X className="size-4" />
      </button>
    </div>
  )
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function shortAddr(a: string) {
  if (a.length <= 12) return a
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function SummaryStrip({ positions }: { positions: { valueUSD: number; feesEarnedUSD: number; inRange?: boolean }[] }) {
  const totalValue = positions.reduce((s, p) => s + (Number.isFinite(p.valueUSD) ? p.valueUSD : 0), 0)
  const totalFees = positions.reduce((s, p) => s + (Number.isFinite(p.feesEarnedUSD) ? p.feesEarnedUSD : 0), 0)
  const inRangeCount = positions.filter((p) => p.inRange === true).length
  const outCount = positions.filter((p) => p.inRange === false).length

  function fmtUsd(n: number) {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
  }

  return (
    <div className="flex flex-wrap gap-4 rounded-xl border border-border/50 bg-background/30 px-4 py-3">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total nas pools</p>
        <p className="font-mono text-lg font-bold text-foreground">{fmtUsd(totalValue)}</p>
      </div>
      <div className="w-px self-stretch bg-border/50" />
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fees acumuladas</p>
        <p className="font-mono text-lg font-bold text-foreground">{fmtUsd(totalFees)}</p>
      </div>
      {(inRangeCount > 0 || outCount > 0) && (
        <>
          <div className="w-px self-stretch bg-border/50" />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Intervalo</p>
            <p className="text-sm font-semibold">
              {inRangeCount > 0 && (
                <span className="text-success">{inRangeCount} dentro</span>
              )}
              {inRangeCount > 0 && outCount > 0 && <span className="text-muted-foreground"> · </span>}
              {outCount > 0 && (
                <span className="text-destructive">{outCount} fora</span>
              )}
            </p>
          </div>
        </>
      )}
      <div className="ml-auto self-center text-xs text-muted-foreground">
        {positions.length} posição(ões)
      </div>
    </div>
  )
}

// ─── Main page component ──────────────────────────────────────────────────────

export function MyLiquidityClient() {
  const mw = useMultiWallet()
  const data = useMultiLiquidityPositions(mw.wallets)
  const [pickOpen, setPickOpen] = useState(false)
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  useEffect(() => {
    if (!data.isFetching && banner?.msg === 'A atualizar posições…') setBanner(null)
  }, [data.isFetching, banner])

  const onConnect = async (c: WalletChain) => {
    try {
      await mw.connectAndAdd(c)
      setBanner({ kind: 'ok', msg: `${c === 'ethereum' ? 'MetaMask' : 'Phantom'} ligada.` })
    } catch (e) {
      setBanner({ kind: 'err', msg: e instanceof Error ? e.message : 'Erro ao conectar.' })
    }
    setPickOpen(false)
  }

  const hasWallets = mw.wallets.length > 0
  const hasPositions = data.positions.length > 0
  const fetchErrs = data.fetchErrors

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <main className="flex w-full min-w-0 flex-1 flex-col px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-7 xl:px-10 2xl:px-12">
        <article
          className={cn(
            'flex w-full min-w-0 flex-1 flex-col gap-6 rounded-2xl border border-gold/20 bg-card/35 p-4 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.65)] backdrop-blur-md sm:p-6 lg:p-8',
          )}
        >

          {/* ── Topo ── */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <Droplets className="size-6 text-gold" />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  My Liquidity
                </h1>
                <p className="text-xs text-muted-foreground">
                  Só as tuas pools — leitura directa da carteira, sem seed.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 border-border/70"
                disabled={!hasWallets || data.isFetching}
                onClick={() => {
                  data.refetchAll()
                  setBanner({ kind: 'ok', msg: 'A atualizar posições…' })
                }}
              >
                {data.isFetching ? <Spinner className="size-4" /> : <RefreshCw className="size-4" />}
                Actualizar
              </Button>
              <DropdownMenu open={pickOpen} onOpenChange={setPickOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    disabled={mw.connecting}
                    className="gap-2 bg-gold text-primary-foreground hover:bg-gold/90"
                  >
                    {mw.connecting ? <Spinner className="size-4" /> : <Wallet className="size-4" />}
                    Conectar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => void onConnect('ethereum')}>
                    MetaMask / EIP-1193
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void onConnect('solana')}>
                    Phantom (Solana)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* ── Banners ── */}
          {banner && (
            <p
              className={cn(
                'rounded-lg border px-3 py-2 text-sm',
                banner.kind === 'err'
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : 'border-border/50 bg-background/40 text-foreground',
              )}
            >
              {banner.msg}
            </p>
          )}
          {mw.connectionError && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {mw.connectionError}
            </p>
          )}

          {/* ── Carteiras ── */}
          {hasWallets ? (
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Carteiras a observar
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {mw.wallets.map((w) => (
                  <WalletChip key={w.id} wallet={w} onRemove={mw.removeWallet} />
                ))}
                <button
                  type="button"
                  title="Remover todas"
                  onClick={() => mw.wallets.forEach((w) => mw.removeWallet(w.id))}
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                  Limpar
                </button>
              </div>
              <AddWalletForm onAdd={mw.addWallet} />
            </div>
          ) : (
            /* ── Estado vazio (sem carteiras) ── */
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/60 bg-background/20 py-20 text-center">
              <Wallet className="size-12 text-muted-foreground/50" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Nenhuma carteira ligada</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Conecta MetaMask ou Phantom para ver as tuas pools, ou cola um endereço para leitura.
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" className="bg-gold text-primary-foreground hover:bg-gold/90">
                    Conectar Carteira
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  <DropdownMenuItem onClick={() => void onConnect('ethereum')}>
                    MetaMask / EIP-1193
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void onConnect('solana')}>
                    Phantom (Solana)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <AddWalletForm onAdd={mw.addWallet} />
            </div>
          )}

          {/* ── Loading ── */}
          {hasWallets && data.isLoading && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Spinner className="size-8 text-gold" />
              <p className="text-sm text-muted-foreground">A carregar posições…</p>
            </div>
          )}

          {/* ── Erro de API/RPC (antes parecia “lista vazia”) ── */}
          {hasWallets && hasPositions && fetchErrs.length > 0 && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <p className="flex items-center gap-2 font-semibold">
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                Falha ao carregar uma ou mais carteiras
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed opacity-95">
                {fetchErrs.map((e) => (
                  <li key={e.walletId}>
                    <span className="font-mono">{shortAddr(e.walletAddress)}</span> ·{' '}
                    {e.walletChain === 'ethereum' ? 'ETH' : 'SOL'} — {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Warnings ── */}
          {data.warnings.length > 0 && (
            <div className="space-y-1">
              {data.warnings.map((w, i) => (
                <p
                  key={i}
                  className="rounded-lg border border-gold/25 bg-gold/[0.06] px-3 py-2 text-xs leading-relaxed text-foreground"
                >
                  {w}
                </p>
              ))}
            </div>
          )}

          {/* ── Summary + posições ── */}
          {hasWallets && !data.isLoading && hasPositions && (
            <>
              <SummaryStrip positions={data.positions} />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {data.positions.map((p) => (
                  <LiquidityPositionCard key={p.id} p={p} />
                ))}
              </div>
            </>
          )}

          {/* ── Falha total ao carregar (RPC/API) ── */}
          {hasWallets && !data.isLoading && !hasPositions && !data.isFetching && fetchErrs.length > 0 && (
            <div className="flex w-full flex-col items-center justify-center gap-4 rounded-xl border border-destructive/45 bg-destructive/10 px-6 py-14 text-center sm:py-16">
              <AlertCircle className="size-14 text-destructive/80" aria-hidden />
              <div className="max-w-2xl space-y-3">
                <p className="text-lg font-semibold text-destructive">Erro ao carregar posições</p>
                <ul className="list-inside list-disc space-y-2 text-left text-sm text-destructive/95">
                  {fetchErrs.map((e) => (
                    <li key={e.walletId}>
                      <span className="font-mono">{shortAddr(e.walletAddress)}</span> ·{' '}
                      {e.walletChain === 'ethereum' ? 'ETH' : 'SOL'} — {e.message}
                    </li>
                  ))}
                </ul>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Em Solana, o RPC público limita pedidos. Se puderes, configura{' '}
                  <span className="font-mono text-foreground/90">HELIUS_RPC_URL</span> ou{' '}
                  <span className="font-mono text-foreground/90">SOLANA_RPC_URL</span> no servidor (.env).
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive/50 text-destructive hover:bg-destructive/15"
                onClick={() => {
                  data.refetchAll()
                  setBanner({ kind: 'ok', msg: 'A atualizar…' })
                }}
              >
                Voltar a tentar
              </Button>
            </div>
          )}

          {/* ── Sem posições (leitura OK — sem LP detectado neste recorte) ── */}
          {hasWallets && !data.isLoading && !hasPositions && !data.isFetching && fetchErrs.length === 0 && (
            <div className="flex w-full flex-col items-center justify-center gap-4 rounded-xl border border-border/60 bg-background/30 px-6 py-16 text-center sm:py-20">
              <Inbox className="size-14 text-muted-foreground/40" aria-hidden />
              <div className="max-w-2xl space-y-2">
                <p className="text-lg font-semibold text-foreground">Nenhuma posição listada</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  A leitura da carteira correu bem, mas neste momento só mostramos{' '}
                  <span className="font-medium text-foreground">Uniswap v3 (Ethereum)</span> e, em Solana,{' '}
                  <span className="font-medium text-foreground">tokens LP</span> (SPL + Token-2022) que o DexScreener
                  associa a um par onde o teu mint não é o base nem o quote. Moedas “só na carteira” não entram.
                  Posições Orca/Raydium em NFT (CLMM) ainda não.
                </p>
                <p className="text-xs text-muted-foreground">
                  Se a liquidez estiver em Ethereum, usa <span className="font-medium text-foreground">MetaMask</span>.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  data.refetchAll()
                  setBanner({ kind: 'ok', msg: 'A atualizar…' })
                }}
              >
                Voltar a tentar
              </Button>
            </div>
          )}
        </article>
      </main>
    </div>
  )
}
