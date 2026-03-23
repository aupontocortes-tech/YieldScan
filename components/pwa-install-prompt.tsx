'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'yieldscan-pwa-install-dismissed'
const DISMISS_MS = 1000 * 60 * 60 * 24 * 5

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    nav.standalone === true
  )
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPhone|iPod/.test(ua)) return true
  if (/iPad/.test(ua)) return true
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true
  return false
}

function readDismissedAt(): number {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0
  } catch {
    return 0
  }
}

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)
  const [open, setOpen] = useState(false)

  const dismiss = useCallback(() => {
    setOpen(false)
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandaloneDisplay()) return

    const dismissedAt = readDismissedAt()
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_MS) return

    let receivedBrowserInstall = false

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      receivedBrowserInstall = true
      setIosHint(false)
      setDeferred(e as BeforeInstallPromptEvent)
      setOpen(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    const timer = window.setTimeout(() => {
      if (receivedBrowserInstall) return
      if (isIosDevice() && !isStandaloneDisplay()) {
        setIosHint(true)
        setOpen(true)
      }
    }, 2800)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.clearTimeout(timer)
    }
  }, [])

  const install = async () => {
    if (!deferred) return
    try {
      await deferred.prompt()
      await deferred.userChoice
    } catch {
      /* ignore */
    }
    setDeferred(null)
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-[100] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
        'pointer-events-none flex justify-center'
      )}
      role="dialog"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-desc"
    >
      <div
        className={cn(
          'pointer-events-auto w-full max-w-md rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-md',
          'animate-in slide-in-from-bottom-4 fade-in duration-300'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2
              id="pwa-install-title"
              className="text-base font-semibold text-foreground"
            >
              Instalar YieldScan
            </h2>
            <p
              id="pwa-install-desc"
              className="mt-1 text-sm text-muted-foreground"
            >
              {iosHint ? (
                <>
                  No iPhone ou iPad: toque em{' '}
                  <Share className="mx-0.5 inline size-4 align-text-bottom text-cyan" />{' '}
                  <strong className="text-foreground">Compartilhar</strong> e depois em{' '}
                  <strong className="text-foreground">Adicionar à Tela de Início</strong>.
                  Assim o app abre como no celular, em tela cheia.
                </>
              ) : (
                <>
                  Instale no computador ou Android para abrir o YieldScan como aplicativo,
                  com ícone na área de trabalho ou na gaveta de apps.
                </>
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={dismiss}
            aria-label="Fechar"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!iosHint && deferred ? (
            <Button type="button" className="gap-2 bg-cyan text-background hover:bg-cyan/90" onClick={install}>
              <Download className="size-4" />
              Instalar agora
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={dismiss}>
            Agora não
          </Button>
        </div>
      </div>
    </div>
  )
}
