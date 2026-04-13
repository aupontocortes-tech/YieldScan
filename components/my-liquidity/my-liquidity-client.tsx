'use client'

import {
  AlertCircle,
  ChevronDown,
  Droplets,
  Inbox,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LiquidityPositionCard } from '@/components/my-liquidity/position-card'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { useMultiLiquidityPositions } from '@/hooks/use-liquidity-positions'
import { useMultiWallet, type SavedWallet } from '@/hooks/use-multi-wallet'
import type { WalletChain } from '@/hooks/use-wallet'
import {
  EVM_UNISWAP_CHAIN_LABEL,
  SUPPORTED_EVM_UNISWAP_CHAIN_IDS,
  type SupportedEvmUniswapChainId,
} from '@/lib/liquidity/ethereum/evm-chain-meta'
import { cn } from '@/lib/utils'

function evmChainUiLabel(chainId?: number): string {
  if (chainId == null) return EVM_UNISWAP_CHAIN_LABEL[1]
  return EVM_UNISWAP_CHAIN_LABEL[chainId as SupportedEvmUniswapChainId] ?? `EVM ${chainId}`
}

function WalletChip({
  wallet,
  onRemove,
}: {
  wallet: SavedWallet
  onRemove: (id: string) => void
}) {
  const short = `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`
  const netLabel =
    wallet.chain === 'ethereum' ? evmChainUiLabel(wallet.evmChainId) : 'Solana'
  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-lg border border-border/50 bg-muted/25 px-2.5 py-1.5 text-xs',
        'transition-colors hover:border-border hover:bg-muted/40',
      )}
    >
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          wallet.chain === 'ethereum' ? 'bg-emerald-500/90' : 'bg-violet-500/90',
        )}
      />
      <span className="font-mono text-foreground tabular-nums">{short}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">{netLabel}</span>
      <button
        type="button"
        aria-label={`Remover ${short}`}
        onClick={() => onRemove(wallet.id)}
        className="ml-0.5 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

function AddWalletForm({
  onAdd,
}: {
  onAdd: (chain: WalletChain, address: string, evmChainId?: number) => boolean
}) {
  const [open, setOpen] = useState(false)
  const [chain, setChain] = useState<WalletChain>('ethereum')
  const [evmChainId, setEvmChainId] = useState<number>(1)
  const [addr, setAddr] = useState('')
  const [formErr, setFormErr] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const submit = () => {
    const t = addr.trim()
    if (!t) return
    setFormErr(null)
    const ok = onAdd(chain, t, chain === 'ethereum' ? evmChainId : undefined)
    if (!ok) {
      setFormErr(
        chain === 'ethereum'
          ? 'Endereço EVM inválido. Usa 0x… (MetaMask). Endereços Solana vão em “Solana”.'
          : 'Endereço Solana inválido.',
      )
      return
    }
    setAddr('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/20 hover:text-foreground"
      >
        <Plus className="size-3.5" />
        Adicionar por endereço
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-muted/15 p-3">
      {formErr && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {formErr}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={chain}
          onChange={(e) => {
            setChain(e.target.value as WalletChain)
            setFormErr(null)
          }}
          className="h-9 rounded-md border border-border/60 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="ethereum">EVM · Uniswap v3</option>
          <option value="solana">Solana</option>
        </select>
        {chain === 'ethereum' && (
          <select
            value={evmChainId}
            onChange={(e) => setEvmChainId(Number(e.target.value))}
            className="h-9 max-w-[160px] rounded-md border border-border/60 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            title="Rede para este endereço"
          >
            {SUPPORTED_EVM_UNISWAP_CHAIN_IDS.map((id) => (
              <option key={id} value={id}>
                {EVM_UNISWAP_CHAIN_LABEL[id]}
              </option>
            ))}
          </select>
        )}
        <input
          ref={inputRef}
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          placeholder="0x… ou endereço Solana"
          className="h-9 min-w-[200px] flex-1 rounded-md border border-border/60 bg-background px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') setOpen(false)
          }}
        />
        <Button type="button" size="sm" className="h-9" onClick={submit}>
          Guardar
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}

function shortAddr(a: string) {
  if (a.length <= 12) return a
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function SummaryStrip({
  positions,
}: {
  positions: { valueUSD: number; feesEarnedUSD: number; inRange?: boolean }[]
}) {
  const totalValue = positions.reduce((s, p) => s + (Number.isFinite(p.valueUSD) ? p.valueUSD : 0), 0)
  const totalFees = positions.reduce((s, p) => s + (Number.isFinite(p.feesEarnedUSD) ? p.feesEarnedUSD : 0), 0)
  const inRangeCount = positions.filter((p) => p.inRange === true).length
  const outCount = positions.filter((p) => p.inRange === false).length

  function fmtUsd(n: number) {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
  }

  return (
    <div className="grid gap-4 rounded-xl border border-border/40 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Valor estimado
        </p>
        <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{fmtUsd(totalValue)}</p>
      </div>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Fees (est.)
        </p>
        <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{fmtUsd(totalFees)}</p>
      </div>
      {(inRangeCount > 0 || outCount > 0) && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Range</p>
          <p className="mt-1 text-sm font-medium">
            {inRangeCount > 0 && <span className="text-emerald-500">{inRangeCount} no intervalo</span>}
            {inRangeCount > 0 && outCount > 0 && <span className="text-muted-foreground"> · </span>}
            {outCount > 0 && <span className="text-amber-600 dark:text-amber-500">{outCount} fora</span>}
          </p>
        </div>
      )}
      <div className="flex items-end justify-start lg:justify-end">
        <p className="text-xs text-muted-foreground">{positions.length} posição(ões)</p>
      </div>
    </div>
  )
}

function ServerWarningsPanel({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null
  return (
    <details className="group rounded-lg border border-border/50 bg-muted/10 open:bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span>Avisos técnicos ({warnings.length})</span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 border-t border-border/40 px-3 py-3">
        {warnings.map((w, i) => (
          <p key={i} className="text-xs leading-relaxed text-muted-foreground">
            {w}
          </p>
        ))}
        <p className="text-[11px] leading-relaxed text-muted-foreground/80">
          Em Solana, posições Orca/Raydium/Meteora em NFT (CLMM) aparecem sem valor até haver indexer dedicado.
          Pancake ou outras DEX na BNB não são Uniswap v3.
        </p>
      </div>
    </details>
  )
}

export function MyLiquidityClient() {
  const mw = useMultiWallet()
  const data = useMultiLiquidityPositions(mw.wallets)
  const [pickOpen, setPickOpen] = useState(false)
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  useEffect(() => {
    if (!data.isFetching && banner?.msg === 'A actualizar posições…') setBanner(null)
  }, [data.isFetching, banner])

  const onConnect = async (c: WalletChain) => {
    try {
      await mw.connectAndAdd(c)
      setBanner({
        kind: 'ok',
        msg: c === 'ethereum' ? 'Carteira de browser ligada.' : 'Phantom ligada.',
      })
    } catch (e) {
      setBanner({ kind: 'err', msg: e instanceof Error ? e.message : 'Erro ao conectar.' })
    }
    setPickOpen(false)
  }

  const hasWallets = mw.wallets.length > 0
  const hasPositions = data.positions.length > 0
  const fetchErrs = data.fetchErrors

  const rpcHelp = (
    <p className="text-xs leading-relaxed text-muted-foreground">
      Se vires falhas de RPC, define no servidor variáveis como{' '}
      <span className="rounded bg-muted px-1 font-mono text-[11px] text-foreground/90">ETH_RPC_URL</span>,{' '}
      <span className="rounded bg-muted px-1 font-mono text-[11px] text-foreground/90">BASE_RPC_URL</span>,{' '}
      <span className="rounded bg-muted px-1 font-mono text-[11px] text-foreground/90">BSC_RPC_URL</span>,{' '}
      <span className="rounded bg-muted px-1 font-mono text-[11px] text-foreground/90">SOLANA_RPC_URL</span>…
    </p>
  )

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-muted/30 to-transparent"
        aria-hidden
      />
      <main className="relative z-[1] mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 lg:py-8">
        <Card className="border-border/50 shadow-lg shadow-black/20">
          <CardHeader className="gap-4 space-y-0 border-b border-border/40 pb-6 sm:flex sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted/50">
                  <Droplets className="size-4 text-foreground/80" />
                </span>
                <CardTitle className="text-xl font-semibold tracking-tight sm:text-2xl">My Liquidity</CardTitle>
              </div>
              <CardDescription className="max-w-lg text-sm leading-relaxed">
                Painel só de leitura: posições Uniswap v3 (várias EVM) e tokens LP em Solana quando detectáveis. A rede
                activa vem da tua carteira; também podes colar endereços e escolher a cadeia no formulário.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:pt-0.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-2"
                disabled={!hasWallets || data.isFetching}
                onClick={() => {
                  data.refetchAll()
                  setBanner({ kind: 'ok', msg: 'A actualizar posições…' })
                }}
              >
                {data.isFetching ? <Spinner className="size-4" /> : <RefreshCw className="size-4" />}
                Actualizar
              </Button>
              <DropdownMenu open={pickOpen} onOpenChange={setPickOpen}>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" className="h-9 gap-2" disabled={mw.connecting}>
                    {mw.connecting ? <Spinner className="size-4" /> : <Wallet className="size-4" />}
                    Conectar carteira
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => void onConnect('ethereum')}>
                    Carteira no browser (EIP-1193)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void onConnect('solana')}>Phantom</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {banner && (
              <div
                role="status"
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-sm',
                  banner.kind === 'err'
                    ? 'border-destructive/35 bg-destructive/10 text-destructive'
                    : 'border-border/50 bg-muted/30 text-foreground',
                )}
              >
                {banner.msg}
              </div>
            )}
            {mw.connectionError && (
              <p className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {mw.connectionError}
              </p>
            )}

            {hasWallets ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Endereços seguidos
                  </h2>
                  <button
                    type="button"
                    onClick={() => mw.wallets.forEach((w) => mw.removeWallet(w.id))}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                    Limpar tudo
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mw.wallets.map((w) => (
                    <WalletChip key={w.id} wallet={w} onRemove={mw.removeWallet} />
                  ))}
                </div>
                <AddWalletForm onAdd={mw.addWallet} />
              </section>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 py-16 text-center">
                <Wallet className="mb-3 size-10 text-muted-foreground/40" />
                <p className="font-medium text-foreground">Nenhum endereço a seguir</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Conecta uma carteira ou adiciona um endereço para começar.
                </p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="sm" className="h-9">
                        Conectar carteira
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center">
                      <DropdownMenuItem onClick={() => void onConnect('ethereum')}>
                        Carteira no browser
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void onConnect('solana')}>Phantom</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-6 w-full max-w-md px-4">
                  <AddWalletForm onAdd={mw.addWallet} />
                </div>
              </div>
            )}

            {hasWallets && <Separator className="opacity-50" />}

            {hasWallets && data.isLoading && (
              <div className="flex flex-col items-center gap-3 py-16">
                <Spinner className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">A carregar posições…</p>
              </div>
            )}

            <ServerWarningsPanel warnings={data.warnings} />

            {hasWallets && hasPositions && fetchErrs.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <p className="flex items-center gap-2 font-medium">
                  <AlertCircle className="size-4 shrink-0" aria-hidden />
                  Parte dos endereços falhou ao carregar
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs opacity-95">
                  {fetchErrs.map((e) => (
                    <li key={e.walletId}>
                      <span className="font-mono">{shortAddr(e.walletAddress)}</span> ·{' '}
                      {e.walletChain === 'ethereum' ? evmChainUiLabel(e.walletEvmChainId) : 'Solana'} — {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasWallets && !data.isLoading && hasPositions && (
              <div className="space-y-5">
                <SummaryStrip positions={data.positions} />
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {data.positions.map((p) => (
                    <LiquidityPositionCard key={p.id} p={p} />
                  ))}
                </div>
              </div>
            )}

            {hasWallets && !data.isLoading && !hasPositions && !data.isFetching && fetchErrs.length > 0 && (
              <div className="flex flex-col items-center rounded-xl border border-destructive/25 bg-destructive/5 px-6 py-12 text-center">
                <AlertCircle className="mb-3 size-12 text-destructive/70" aria-hidden />
                <p className="text-base font-semibold text-destructive">Não foi possível carregar as posições</p>
                <ul className="mt-3 max-w-xl list-inside list-disc space-y-1 text-left text-sm text-destructive/90">
                  {fetchErrs.map((e) => (
                    <li key={e.walletId}>
                      <span className="font-mono">{shortAddr(e.walletAddress)}</span> ·{' '}
                      {e.walletChain === 'ethereum' ? evmChainUiLabel(e.walletEvmChainId) : 'Solana'} — {e.message}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 max-w-lg">{rpcHelp}</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-5 border-destructive/40"
                  onClick={() => {
                    data.refetchAll()
                    setBanner({ kind: 'ok', msg: 'A actualizar…' })
                  }}
                >
                  Voltar a tentar
                </Button>
              </div>
            )}

            {hasWallets && !data.isLoading && !hasPositions && !data.isFetching && fetchErrs.length === 0 && (
              <div className="flex flex-col items-center rounded-xl border border-border/50 bg-muted/10 px-6 py-14 text-center">
                <Inbox className="mb-3 size-12 text-muted-foreground/35" aria-hidden />
                <p className="text-base font-semibold text-foreground">Nenhuma posição listada</p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Uniswap v3: Ethereum, Arbitrum, Base, Polygon e{' '}
                  <span className="font-medium text-foreground">BNB Chain</span> (contratos oficiais). Em Solana,
                  mostramos tokens LP quando o DexScreener os reconhece; NFT CLMM (Orca, Raydium, Meteora) ainda sem
                  valorização automática.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-5"
                  onClick={() => {
                    data.refetchAll()
                    setBanner({ kind: 'ok', msg: 'A actualizar…' })
                  }}
                >
                  Voltar a tentar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
