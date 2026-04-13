'use client'

import { getAddress } from 'ethers'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useWallet, type WalletChain } from '@/hooks/use-wallet'
import { isValidSavedWalletAddress, normalizeSolanaAddressInput } from '@/lib/wallet-address'

const STORAGE_KEY = 'ys_ml_wallets_v2'
const LEGACY_STORAGE_KEY = 'ys_ml_wallets_v1'

export type SavedWallet = {
  /** `solana-addr` ou `ethereum-{chainId}-addr` */
  id: string
  chain: WalletChain
  /** Rede EVM (1, 42161, 8453, 137). Ignorado em Solana. */
  evmChainId?: number
  address: string
  addedAt: number
  /** `extension` = ligada via MetaMask; actualiza com chainChanged. */
  origin?: 'extension' | 'manual'
}

type State = { wallets: SavedWallet[] }

type Action =
  | { type: 'add'; wallet: SavedWallet }
  | { type: 'remove'; id: string }
  | { type: 'load'; wallets: SavedWallet[] }
  | { type: 'syncExtensionEvm'; address: string; evmChainId: number }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'load':
      return { wallets: action.wallets }
    case 'add': {
      const exists = state.wallets.some((w) => walletKey(w) === walletKey(action.wallet))
      if (exists) return state
      return { wallets: [...state.wallets, action.wallet] }
    }
    case 'remove':
      return { wallets: state.wallets.filter((w) => w.id !== action.id) }
    case 'syncExtensionEvm': {
      const addr = action.address.toLowerCase()
      let changed = false
      const wallets = state.wallets.map((w) => {
        if (
          w.origin !== 'extension' ||
          w.chain !== 'ethereum' ||
          w.address.toLowerCase() !== addr
        ) {
          return w
        }
        if (w.evmChainId === action.evmChainId) return w
        changed = true
        return {
          ...w,
          evmChainId: action.evmChainId,
          id: makeId('ethereum', w.address, action.evmChainId),
        }
      })
      return changed ? { wallets } : state
    }
    default:
      return state
  }
}

function walletKey(w: SavedWallet): string {
  if (w.chain === 'solana') return `solana:${w.address.toLowerCase()}`
  return `ethereum:${w.evmChainId ?? 1}:${w.address.toLowerCase()}`
}

function makeId(chain: WalletChain, address: string, evmChainId?: number): string {
  const a = address.trim().toLowerCase()
  if (chain === 'solana') return `solana-${a}`
  return `ethereum-${evmChainId ?? 1}-${a}`
}

function normalizeLoadedWallet(row: unknown): SavedWallet | null {
  if (!row || typeof row !== 'object') return null
  const w = row as Partial<SavedWallet>
  if (w.chain !== 'ethereum' && w.chain !== 'solana') return null
  if (typeof w.address !== 'string' || !w.address.trim()) return null
  const evmChainId =
    w.chain === 'ethereum' ? (typeof w.evmChainId === 'number' ? w.evmChainId : 1) : undefined
  const origin = w.origin === 'extension' || w.origin === 'manual' ? w.origin : 'manual'
  const trimmed = w.address.trim()
  if (!isValidSavedWalletAddress(w.chain, trimmed)) return null
  const address =
    w.chain === 'ethereum'
      ? getAddress(trimmed)
      : (normalizeSolanaAddressInput(trimmed) ?? trimmed)
  return {
    id: makeId(w.chain, address, evmChainId),
    chain: w.chain,
    evmChainId,
    address,
    addedAt: typeof w.addedAt === 'number' ? w.addedAt : Date.now(),
    origin,
  }
}

export function useMultiWallet() {
  const singleWallet = useWallet()
  const [state, dispatch] = useReducer(reducer, { wallets: [] })

  /** Carrega carteiras guardadas (v2 ou migra v1). */
  useEffect(() => {
    try {
      const tryParse = (key: string): SavedWallet[] | null => {
        const stored = localStorage.getItem(key)
        if (!stored) return null
        const parsed = JSON.parse(stored) as unknown
        if (!Array.isArray(parsed) || parsed.length === 0) return null
        const out: SavedWallet[] = []
        for (const row of parsed) {
          const w = normalizeLoadedWallet(row)
          if (w) out.push(w)
        }
        if (parsed.length > 0 && out.length === 0) {
          try {
            localStorage.setItem(key, '[]')
          } catch {
            /* ignore */
          }
          return null
        }
        if (out.length > 0 && out.length !== parsed.length) {
          try {
            localStorage.setItem(key, JSON.stringify(out))
          } catch {
            /* ignore */
          }
        }
        return out.length ? out : null
      }

      const v2 = tryParse(STORAGE_KEY)
      if (v2) {
        dispatch({ type: 'load', wallets: v2 })
        return
      }
      const v1 = tryParse(LEGACY_STORAGE_KEY)
      if (v1) {
        dispatch({ type: 'load', wallets: v1 })
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(v1))
        } catch {
          /* ignore */
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

  /** Adiciona ou actualiza carteira ligada via extensão (MetaMask / Phantom). */
  useEffect(() => {
    if (!singleWallet.connected || !singleWallet.address || !singleWallet.chain) return
    if (singleWallet.chain === 'ethereum') {
      const cid = singleWallet.evmChainId ?? 1
      dispatch({
        type: 'add',
        wallet: {
          id: makeId('ethereum', singleWallet.address, cid),
          chain: 'ethereum',
          evmChainId: cid,
          address: singleWallet.address,
          addedAt: Date.now(),
          origin: 'extension',
        },
      })
    } else {
      dispatch({
        type: 'add',
        wallet: {
          id: makeId('solana', singleWallet.address),
          chain: 'solana',
          address: singleWallet.address,
          addedAt: Date.now(),
          origin: 'extension',
        },
      })
    }
  }, [singleWallet.connected, singleWallet.address, singleWallet.chain, singleWallet.evmChainId])

  /** MetaMask mudou de rede: actualiza entrada `extension` com o mesmo endereço. */
  useEffect(() => {
    if (!singleWallet.connected || singleWallet.chain !== 'ethereum' || !singleWallet.address) return
    if (singleWallet.evmChainId == null) return
    dispatch({
      type: 'syncExtensionEvm',
      address: singleWallet.address,
      evmChainId: singleWallet.evmChainId,
    })
  }, [singleWallet.connected, singleWallet.chain, singleWallet.address, singleWallet.evmChainId])

  const addWallet = useCallback((chain: WalletChain, address: string, evmChainId?: number): boolean => {
    const trimmed = address.trim()
    if (!trimmed) return false
    if (!isValidSavedWalletAddress(chain, trimmed)) return false
    const cid = chain === 'ethereum' ? evmChainId ?? 1 : undefined
    const normalized =
      chain === 'ethereum' ? getAddress(trimmed) : (normalizeSolanaAddressInput(trimmed) ?? trimmed)
    dispatch({
      type: 'add',
      wallet: {
        id: makeId(chain, normalized, cid),
        chain,
        evmChainId: cid,
        address: normalized,
        addedAt: Date.now(),
        origin: 'manual',
      },
    })
    return true
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
