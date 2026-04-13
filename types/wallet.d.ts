declare global {
  interface Window {
    ethereum?: {
      /** Compatível com `ethers` `BrowserProvider` / EIP-1193. */
      request?: (args: {
        method: string
        params?: any[] | Record<string, any>
      }) => Promise<any>
      on?: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
    }
    /** Phantom injeta `window.solana`; alguns ambientes expõem `window.phantom.solana`. */
    solana?: {
      isPhantom?: boolean
      connect?: () => Promise<{ publicKey?: { toBase58(): string } }>
      disconnect?: () => Promise<void>
    }
    phantom?: { solana?: Window['solana'] }
  }
}

export {}
