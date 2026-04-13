'use client'

import { BrowserProvider, getAddress, isAddress, type Eip1193Provider } from 'ethers'
import { useCallback, useEffect, useMemo, useState } from 'react'

export type WalletChain = 'ethereum' | 'solana'

export type UseWalletState = {
  chain: WalletChain | null
  address: string | null
  connected: boolean
  connecting: boolean
  error: string | null
  /** Conecta Ethereum (MetaMask / injetado EIP-1193) ou Solana (Phantom). */
  connect: (target?: WalletChain) => Promise<void>
  disconnect: () => void
  /** Rede EVM atual (ex.: 0x1); só preenchido quando chain === 'ethereum'. */
  evmChainId: number | null
}

function readPhantom(): Window['solana'] | undefined {
  if (typeof window === 'undefined') return undefined
  return window.solana?.isPhantom ? window.solana : window.phantom?.solana
}

export function useWallet(): UseWalletState {
  const [chain, setChain] = useState<WalletChain | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [evmChainId, setEvmChainId] = useState<number | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connected = Boolean(chain && address)

  const disconnect = useCallback(() => {
    setChain(null)
    setAddress(null)
    setEvmChainId(null)
    setError(null)
    try {
      const ph = readPhantom()
      void ph?.disconnect?.()
    } catch {
      /* read-only */
    }
  }, [])

  const connectEthereum = useCallback(async () => {
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
  }, [])

  const connectSolana = useCallback(async () => {
    const sol = readPhantom()
    if (!sol?.connect) {
      throw new Error('Phantom não encontrada. Instale a extensão Phantom.')
    }
    const { publicKey } = await sol.connect()
    const pk = publicKey?.toBase58?.()
    if (!pk) throw new Error('Phantom não devolveu uma chave pública.')
    setAddress(pk)
    setChain('solana')
    setEvmChainId(null)
  }, [])

  const connect = useCallback(
    async (target: WalletChain = 'ethereum') => {
      setConnecting(true)
      setError(null)
      try {
        if (target === 'ethereum') await connectEthereum()
        else await connectSolana()
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Falha ao conectar.'
        setError(msg)
        disconnect()
        throw e
      } finally {
        setConnecting(false)
      }
    },
    [connectEthereum, connectSolana, disconnect]
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

  // Memoizar objeto estável para consumidores (evita re-renders em deps)
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
    [chain, address, connected, connecting, error, connect, disconnect, evmChainId]
  )
}
