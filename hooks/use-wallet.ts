'use client'

import {
  WalletNotReadyError,
  WalletReadyState,
} from '@solana/wallet-adapter-base'
import {
  useWallet as useSolanaWallet,
  WalletNotSelectedError,
} from '@solana/wallet-adapter-react'
import { PhantomWalletName } from '@solana/wallet-adapter-wallets'
import { BrowserProvider, getAddress, isAddress, type Eip1193Provider } from 'ethers'
import { flushSync } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type WalletChain = 'ethereum' | 'solana'

export type UseWalletState = {
  chain: WalletChain | null
  address: string | null
  connected: boolean
  connecting: boolean
  error: string | null
  /** Conecta Ethereum (MetaMask / injetado EIP-1193) ou Solana (Phantom via wallet-adapter). */
  connect: (target?: WalletChain) => Promise<void>
  disconnect: () => void
  /** Rede EVM atual (ex.: 0x1); só preenchido quando chain === 'ethereum'. */
  evmChainId: number | null
}

function solanaConnectErrorMessage(e: unknown): string {
  if (e instanceof WalletNotSelectedError) {
    return 'Carteira Solana não seleccionada. Tenta de novo.'
  }
  if (e instanceof WalletNotReadyError) {
    return 'Phantom não está disponível. Instala a extensão ou autoriza este site na Phantom.'
  }
  if (e instanceof Error) {
    const m = e.message || e.name
    if (/user rejected|denied|cancel/i.test(m)) {
      return 'Ligação à Phantom cancelada.'
    }
    return m
  }
  return 'Falha ao conectar à Phantom.'
}

export function useWallet(): UseWalletState {
  const solana = useSolanaWallet()
  const solanaRef = useRef(solana)
  solanaRef.current = solana
  const [chain, setChain] = useState<WalletChain | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [evmChainId, setEvmChainId] = useState<number | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connected = Boolean(chain && address)

  const clearSession = useCallback(() => {
    setChain(null)
    setAddress(null)
    setEvmChainId(null)
    void solana.disconnect()
  }, [solana])

  const disconnect = useCallback(() => {
    clearSession()
    setError(null)
  }, [clearSession])

  const connectEthereum = useCallback(async () => {
    if (solana.connected) {
      await solana.disconnect()
    }
    const eth = typeof window !== 'undefined' ? window.ethereum : undefined
    if (!eth?.request) {
      throw new Error('Carteira Ethereum (ex.: MetaMask) não encontrada.')
    }
    const provider = new BrowserProvider(eth as Eip1193Provider)
    const accounts = (await provider.send('eth_requestAccounts', [])) as string[]
    const raw = accounts[0]
    if (!raw || !isAddress(raw)) {
      throw new Error('Nenhuma conta Ethereum autorizada.')
    }
    const net = await provider.getNetwork()
    setEvmChainId(Number(net.chainId))
    setAddress(getAddress(raw))
    setChain('ethereum')
  }, [solana])

  const connectSolana = useCallback(async () => {
    const phantomEntry = solana.wallets.find((w) => w.adapter.name === PhantomWalletName)
    if (!phantomEntry) {
      throw new Error(
        'Phantom não está na lista de carteiras. Recarrega a página com a extensão activa.',
      )
    }
    if (
      phantomEntry.readyState !== WalletReadyState.Installed &&
      phantomEntry.readyState !== WalletReadyState.Loadable
    ) {
      throw new Error(
        'Phantom não está pronta. Instala https://phantom.app ou permite a extensão neste site.',
      )
    }

    flushSync(() => {
      solanaRef.current.select(PhantomWalletName)
    })

    try {
      await solanaRef.current.connect()
    } catch (e) {
      throw new Error(solanaConnectErrorMessage(e))
    }

    const pk = phantomEntry.adapter.publicKey?.toBase58?.()
    if (!pk) {
      throw new Error(
        'Phantom não devolveu uma chave pública. Tenta aprovar a ligação na extensão.',
      )
    }
    setAddress(pk)
    setChain('solana')
    setEvmChainId(null)
  }, [solana])

  const connect = useCallback(
    async (target: WalletChain = 'ethereum') => {
      setConnecting(true)
      setError(null)
      try {
        if (target === 'ethereum') await connectEthereum()
        else await connectSolana()
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Falha ao conectar.'
        clearSession()
        setError(msg)
        throw e
      } finally {
        setConnecting(false)
      }
    },
    [connectEthereum, connectSolana, clearSession],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const eth = window.ethereum
    if (!eth?.on) return

    const onAccounts = (accs: unknown) => {
      if (chain !== 'ethereum') return
      const list = accs as string[]
      const next = list?.[0]
      if (next && isAddress(next)) {
        setAddress(getAddress(next))
      } else {
        disconnect()
      }
    }

    const onChain = (hexId: unknown) => {
      if (chain !== 'ethereum') return
      const id = typeof hexId === 'string' ? Number.parseInt(hexId, 16) : Number.NaN
      if (Number.isFinite(id)) setEvmChainId(id)
    }

    eth.on('accountsChanged', onAccounts)
    eth.on('chainChanged', onChain)
    return () => {
      eth.removeListener?.('accountsChanged', onAccounts)
      eth.removeListener?.('chainChanged', onChain)
    }
  }, [chain, disconnect])

  return useMemo(
    () => ({
      chain,
      address,
      connected,
      connecting,
      error,
      connect,
      disconnect,
      evmChainId,
    }),
    [chain, address, connected, connecting, error, connect, disconnect, evmChainId],
  )
}
