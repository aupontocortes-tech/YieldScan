'use client'

import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useWallet, type WalletChain } from '@/hooks/use-wallet'

const STORAGE_KEY = 'ys_ml_wallets_v1'

export type SavedWallet = {
  /** `chain-address` */
  id: string
  chain: WalletChain
  address: string
  addedAt: number
}

type State = { wallets: SavedWallet[] }

type Action =
  | { type: 'add'; wallet: SavedWallet }
  | { type: 'remove'; id: string }
  | { type: 'load'; wallets: SavedWallet[] }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'load':
      return { wallets: action.wallets }
    case 'add': {
      const exists = state.wallets.some(
        (w) =>
          w.chain === action.wallet.chain &&
          w.address.toLowerCase() === action.wallet.address.toLowerCase(),
      )
      if (exists) return state
      return { wallets: [...state.wallets, action.wallet] }
    }
    case 'remove':
      return { wallets: state.wallets.filter((w) => w.id !== action.id) }
    default:
      return state
  }
}

function makeId(chain: WalletChain, address: string) {
  return `${chain}-${address.toLowerCase()}`
}

export function useMultiWallet() {
  const singleWallet = useWallet()
  const [state, dispatch] = useReducer(reducer, { wallets: [] })

  /** Carrega carteiras guardadas do localStorage ao montar. */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as SavedWallet[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          dispatch({ type: 'load', wallets: parsed })
        }
      }
    } catch {
      /* ignore */
    }
  }, [])

  /** Persiste carteiras no localStorage sempre que mudam. */
  useEffect(() => {
    if (state.wallets.length === 0) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.wallets))
    } catch {
      /* ignore */
    }
  }, [state.wallets])

  /** Adiciona automaticamente a carteira activa (connect via extensão). */
  useEffect(() => {
    if (!singleWallet.connected || !singleWallet.address || !singleWallet.chain) return
    dispatch({
      type: 'add',
      wallet: {
        id: makeId(singleWallet.chain, singleWallet.address),
        chain: singleWallet.chain,
        address: singleWallet.address,
        addedAt: Date.now(),
      },
    })
  }, [singleWallet.connected, singleWallet.address, singleWallet.chain])

  const addWallet = useCallback((chain: WalletChain, address: string) => {
    const trimmed = address.trim()
    if (!trimmed) return
    dispatch({
      type: 'add',
      wallet: { id: makeId(chain, trimmed), chain, address: trimmed, addedAt: Date.now() },
    })
  }, [])

  const removeWallet = useCallback((id: string) => {
    dispatch({ type: 'remove', id })
    try {
      const updated = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as SavedWallet[]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.filter((w) => w.id !== id)))
    } catch {
      /* ignore */
    }
  }, [])

  const connectAndAdd = useCallback(
    async (target: WalletChain = 'ethereum') => {
      await singleWallet.connect(target)
    },
    [singleWallet],
  )

  return useMemo(
    () => ({
      wallets: state.wallets,
      singleWallet,
      addWallet,
      removeWallet,
      connectAndAdd,
      connecting: singleWallet.connecting,
      connectionError: singleWallet.error,
    }),
    [state.wallets, singleWallet, addWallet, removeWallet, connectAndAdd],
  )
}
