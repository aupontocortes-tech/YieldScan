'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { WalletNotReadyError, WalletReadyState } from '@solana/wallet-adapter-base'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useWallet, WalletNotSelectedError } from '@solana/wallet-adapter-react'
import { PhantomWalletName } from '@solana/wallet-adapter-wallets'
import { RefreshCw, Wallet } from 'lucide-react'
import { useConnect, useDisconnect, useAccount } from 'wagmi'
import { LiquidityPositionCard } from '@/components/liquidity/PositionCard'
import { LiquiditySummary } from '@/components/liquidity/Summary'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useLiquidityPositions } from '@/hooks/useLiquidityPositions'
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

  const { positions, warnings, errors, isLoading, isFetching, hasWallet, refetch } = useLiquidityPositions()

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
          <CardHeader className="border-b border-border/40 space-y-4 sm:flex sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
            <div>
              <CardTitle className="text-2xl font-semibold tracking-tight">Liquidity</CardTitle>
              <CardDescription className="mt-1.5 max-w-xl text-sm leading-relaxed">
                Agregador multichain — Uniswap v3 (Ethereum, Arbitrum, Polygon, Base) e liquidez Solana detectável
                on-chain. Dados calculados a partir de pools e oráculos; APR e fees são estimativas.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex flex-wrap gap-2">
                {!isConnected ? (
                  <>
                    {injected && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={evmPending}
                        onClick={() => {
                          resetEvmConnect?.()
                          connect({ connector: injected })
                        }}
                        className="gap-2"
                      >
                        <Wallet className="size-4" />
                        EVM (browser)
                      </Button>
                    )}
                    {walletConnect && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={evmPending}
                        onClick={() => connect({ connector: walletConnect })}
                      >
                        WalletConnect
                      </Button>
                    )}
                  </>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => disconnectEvm()}>
                    Desligar EVM
                  </Button>
                )}
                {!solConnected ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={solConnecting}
                      className="gap-2"
                      onClick={() => void handleSolanaConnect()}
                    >
                      {solConnecting ? <Spinner className="size-4" /> : null}
                      Phantom / Solana
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => openSolModal(true)}
                    >
                      Lista de carteiras
                    </Button>
                  </>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => disconnectSol()}>
                    Desligar Solana
                  </Button>
                )}
              </div>
              {evmConnectError && (
                <p className="max-w-sm text-right text-xs text-destructive" role="alert">
                  {evmConnectError.message}
                </p>
              )}
              {solConnectError && (
                <p className="max-w-sm text-right text-xs text-amber-600 dark:text-amber-500" role="status">
                  {solConnectError}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {isConnected && address && (
                  <span className="rounded-md bg-muted/50 px-2 py-0.5 font-mono">{address.slice(0, 6)}…{address.slice(-4)}</span>
                )}
                {solConnected && publicKey && (
                  <span className="rounded-md bg-muted/50 px-2 py-0.5 font-mono">
                    {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={!hasWallet || isFetching}
                onClick={() => refetch()}
              >
                <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
                Atualizar posições
              </Button>
            </div>

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
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 py-16 text-center">
                <p className="font-medium text-foreground">Conecta uma carteira</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Usa EVM (todas as cadeias suportadas em paralelo) ou Solana para carregar posições.
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
                  Não há posições com valor em USD (Uniswap v3 nas redes EVM, ou tokens LP no DexScreener em Solana). CLMM
                  em Solana pode existir como NFT sem valuation nesta app. Confirma RPCs em{' '}
                  <span className="font-mono text-[11px] text-foreground/80">/api/liquidity/diagnostics</span>.
                </p>
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
                  Atualizar posições
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
