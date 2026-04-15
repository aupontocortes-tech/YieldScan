'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { WalletNotReadyError, WalletReadyState } from '@solana/wallet-adapter-base'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useWallet, WalletNotSelectedError } from '@solana/wallet-adapter-react'
import { PhantomWalletName } from '@solana/wallet-adapter-wallets'
import { ChevronDown, RefreshCw, Wallet } from 'lucide-react'
import { useConnect, useDisconnect, useAccount } from 'wagmi'
import { LiquidityPositionCard } from '@/components/liquidity/PositionCard'
import { LiquiditySummary } from '@/components/liquidity/Summary'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useLiquidityPositions } from '@/hooks/useLiquidityPositions'
import { isValidEvmWalletAddress, normalizeSolanaAddressInput } from '@/lib/wallet-address'
import { cn } from '@/lib/utils'

function liquiditySolanaConnectErrorMessage(e: unknown): string {
  if (e instanceof WalletNotSelectedError) {
    return 'Carteira Solana não seleccionada. Usa "Lista de carteiras" ou tenta de novo.'
  }
  if (e instanceof WalletNotReadyError) {
    return 'Phantom não está pronta. Instala ou autoriza este site em phantom.app.'
  }
  if (e instanceof Error) {
    const m = e.message || e.name
    if (/user rejected|denied|cancel|rejeit/i.test(m)) {
      return 'Ligação à Phantom cancelada.'
    }
    if (/internal|interno|unexpected|unknown/i.test(m)) {
      return 'A Phantom não completou a ligação. Recarrega a página; em Phantom → Definições → Aplicações de confiança, permite este domínio; ou desliga temporariamente a carteira EVM se houver conflito. Podes usar "Lista de carteiras".'
    }
    return m
  }
  return 'Falha ao ligar à Phantom.'
}

function PositionSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-border/50 p-4">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  )
}

export function LiquidityDashboard() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: evmPending, error: evmConnectError, reset: resetEvmConnect } =
    useConnect()
  const { disconnect: disconnectEvm } = useDisconnect()
  const { setVisible: openSolModal } = useWalletModal()
  const solWallet = useWallet()
  const {
    connected: solConnected,
    publicKey,
    disconnect: disconnectSol,
    wallets: solWallets,
    connecting: solConnecting,
  } = solWallet

  const solWalletRef = useRef(solWallet)
  solWalletRef.current = solWallet

  const [manualEvmAddress, setManualEvmAddress] = useState('')
  const [manualSolanaAddress, setManualSolanaAddress] = useState('')
  const [manualMode, setManualMode] = useState(false)
  const manualEvmValid = manualEvmAddress.trim() ? isValidEvmWalletAddress(manualEvmAddress) : false
  const manualSolValid = manualSolanaAddress.trim()
    ? Boolean(normalizeSolanaAddressInput(manualSolanaAddress))
    : false
  const manualActive = manualMode && (manualEvmValid || manualSolValid)

  const { positions, warnings, errors, isLoading, isFetching, hasWallet, refetch } = useLiquidityPositions({
    manualEvmAddress: manualActive ? manualEvmAddress : null,
    manualSolanaAddress: manualActive ? manualSolanaAddress : null,
  })

  const [solConnectError, setSolConnectError] = useState<string | null>(null)

  useEffect(() => {
    if (solConnected) setSolConnectError(null)
  }, [solConnected])

  const handleSolanaConnect = useCallback(async () => {
    setSolConnectError(null)
    const phantom = solWallets.find((w) => w.adapter.name === PhantomWalletName)
    const ready =
      phantom &&
      (phantom.readyState === WalletReadyState.Installed ||
        phantom.readyState === WalletReadyState.Loadable)
    if (!ready) {
      setSolConnectError('Phantom não detetada neste browser. Abre o modal para opções ou instala phantom.app.')
      openSolModal(true)
      return
    }
    try {
      flushSync(() => {
        solWalletRef.current.select(PhantomWalletName)
      })
      await solWalletRef.current.connect()
    } catch (e) {
      setSolConnectError(liquiditySolanaConnectErrorMessage(e))
      openSolModal(true)
    }
  }, [solWallets, openSolModal])

  /** Wagmi v2+ pode não expor `id === 'injected'`; o primeiro connector do config é o injected. */
  const injected =
    connectors.find((c) => String(c.id).toLowerCase().includes('metamask')) ??
    connectors.find((c) => c.id === 'injected' || (c as { type?: string }).type === 'injected') ??
    connectors.find((c) => !String(c.id).toLowerCase().includes('walletconnect')) ??
    connectors[0]
  const walletConnect = connectors.find((c) => String(c.id).toLowerCase().includes('walletconnect'))

  return (
    <div className="relative min-h-0 flex-1 bg-background">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-muted/25 to-transparent"
        aria-hidden
      />
      <div className="relative z-[1] mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <Card className="border-border/50 shadow-xl shadow-black/10">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-2xl font-semibold tracking-tight">As tuas pools</CardTitle>
            <CardDescription className="mt-1 max-w-2xl text-sm leading-relaxed">
              Vista só de leitura: valores, intervalo de preço, fees acumuladas na posição e APR estimado do pool. Ethereum
              (Uniswap v3/v4) e Solana (Orca Whirlpool on-chain + outros LP via DexScreener).
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            <section
              className="rounded-xl border border-border/45 bg-gradient-to-br from-muted/25 via-background to-background p-4 sm:p-5"
              aria-label="Ligar carteira"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/20">
                    <Wallet className="size-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Conectar carteira</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Não pedimos assinatura de transação — só endereço público para consultar a blockchain.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  disabled={!hasWallet || isFetching}
                  onClick={() => refetch()}
                >
                  <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
                  Atualizar
                </Button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/40 bg-card/60 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">Ethereum / L2</span>
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-muted-foreground/35',
                      )}
                      aria-hidden
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">MetaMask ou carteira de browser (EVM).</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!isConnected ? (
                      <>
                        {injected && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={evmPending}
                            className="font-medium"
                            onClick={() => {
                              resetEvmConnect?.()
                              connect({ connector: injected })
                            }}
                          >
                            Ligar MetaMask
                          </Button>
                        )}
                        {walletConnect && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={evmPending}
                            onClick={() => connect({ connector: walletConnect })}
                          >
                            WalletConnect
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button type="button" size="sm" variant="outline" onClick={() => disconnectEvm()}>
                        Desligar
                      </Button>
                    )}
                  </div>
                  {isConnected && address && (
                    <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground" title={address}>
                      {address.slice(0, 10)}…{address.slice(-8)}
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-border/40 bg-card/60 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">Solana</span>
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        solConnected
                          ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                          : 'bg-muted-foreground/35',
                      )}
                      aria-hidden
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Phantom ou outra carteira da lista.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!solConnected ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="font-medium"
                          disabled={solConnecting}
                          onClick={() => void handleSolanaConnect()}
                        >
                          {solConnecting ? <Spinner className="size-4" /> : null}
                          Ligar Phantom
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => openSolModal(true)}>
                          Outras carteiras
                        </Button>
                      </>
                    ) : (
                      <Button type="button" size="sm" variant="outline" onClick={() => disconnectSol()}>
                        Desligar
                      </Button>
                    )}
                  </div>
                  {solConnected && publicKey && (
                    <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground" title={publicKey.toBase58()}>
                      {publicKey.toBase58().slice(0, 12)}…{publicKey.toBase58().slice(-8)}
                    </p>
                  )}
                </div>
              </div>

              {(evmConnectError || solConnectError) && (
                <div className="mt-3 space-y-1 text-xs">
                  {evmConnectError && (
                    <p className="text-destructive" role="alert">
                      {evmConnectError.message}
                    </p>
                  )}
                  {solConnectError && (
                    <p className="text-amber-600 dark:text-amber-400" role="status">
                      {solConnectError}
                    </p>
                  )}
                </div>
              )}
            </section>

            <details className="group rounded-lg border border-border/50 bg-muted/15 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/30">
                <span>Sem extensão? Colar endereço</span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
              </summary>
              <div className="border-t border-border/40 px-3 py-3">
                <p className="text-[11px] text-muted-foreground">
                  Útil em mobile ou quando a ligação falha. Cola o endereço e carrega em Consultar.
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <input
                    value={manualEvmAddress}
                    onChange={(e) => setManualEvmAddress(e.target.value)}
                    placeholder="EVM (0x…)"
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <input
                    value={manualSolanaAddress}
                    onChange={(e) => setManualSolanaAddress(e.target.value)}
                    placeholder="Solana (base58)"
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={manualActive ? 'default' : 'secondary'}
                    onClick={() => {
                      setManualMode(true)
                      void refetch()
                    }}
                    disabled={!manualEvmValid && !manualSolValid}
                  >
                    Consultar
                  </Button>
                  {manualMode && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => {
                        setManualMode(false)
                        setManualEvmAddress('')
                        setManualSolanaAddress('')
                      }}
                    >
                      Usar só extensão
                    </Button>
                  )}
                  {!manualEvmValid && manualEvmAddress.trim().length > 0 && (
                    <span className="text-[11px] text-amber-600">EVM inválido</span>
                  )}
                  {!manualSolValid && manualSolanaAddress.trim().length > 0 && (
                    <span className="text-[11px] text-amber-600">Solana inválido</span>
                  )}
                </div>
              </div>
            </details>

            {errors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <p className="font-medium">Erros parciais</p>
                <ul className="mt-1 list-inside list-disc text-xs">
                  {errors.map((e, i) => (
                    <li key={i}>
                      {e.chain}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {warnings.length > 0 && (
              <details className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium text-foreground">Avisos</summary>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}

            {!hasWallet && (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 py-14 text-center">
                <p className="font-medium text-foreground">Escolhe uma rede acima</p>
                <p className="mt-1 max-w-md mx-auto text-sm text-muted-foreground">
                  Liga Ethereum ou Solana, ou abre “Colar endereço”. Depois vês valor estimado, range, fees na posição e
                  APR do pool.
                </p>
              </div>
            )}

            {hasWallet && isLoading && (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-xl" />
                <div className="grid gap-4 md:grid-cols-2">
                  <PositionSkeleton />
                  <PositionSkeleton />
                </div>
              </div>
            )}

            {hasWallet && !isLoading && positions.length > 0 && (
              <>
                <LiquiditySummary positions={positions} />
                <div className="grid gap-4 md:grid-cols-2">
                  {positions.map((p) => (
                    <LiquidityPositionCard key={p.id} position={p} />
                  ))}
                </div>
              </>
            )}

            {hasWallet && !isLoading && positions.length === 0 && (
              <div className="rounded-xl border border-border/50 bg-muted/10 py-14 text-center">
                <p className="font-medium text-foreground">Nenhuma posição encontrada</p>
                <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
                  Em Solana, Orca Whirlpool é lido on-chain (precisa de RPC estável). Outras DEX concentradas ainda não
                  entram. Em EVM, confirma Uniswap v3/v4 nas redes suportadas.
                </p>
                <Button type="button" variant="outline" size="sm" className="mt-4 gap-2" onClick={() => refetch()}>
                  <RefreshCw className="size-3.5" />
                  Tentar de novo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
