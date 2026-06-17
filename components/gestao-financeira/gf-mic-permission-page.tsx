'use client'

import { GfBrowserVoiceButton } from '@/components/gestao-financeira/gf-browser-voice-button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/** Atalho: abre Gestão no navegador com voz e permissão de microfone. */
export function GfMicPermissionPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-4">
      <Link
        href="/news/gestao-financeira"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar à Gestão
      </Link>
      <div className="rounded-2xl border border-blue-500/30 bg-blue-950/25 p-6 text-center">
        <h2 className="text-xl font-bold">Ativar voz no navegador</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Toque abaixo para abrir o YieldScan no navegador do celular. Lá você permite o microfone e usa o comando de
          voz.
        </p>
        <div className="mt-6">
          <GfBrowserVoiceButton size="lg" />
        </div>
      </div>
    </div>
  )
}
