'use client'

import Link from 'next/link'
import { ArrowLeft, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Atalho para Gestão — voz grátis (app, teclado ou digitar). */
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
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/25 p-6 text-center">
        <h2 className="text-xl font-bold">Falar grátis</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Use o microfone verde do app, o microfone do teclado do celular, ou digite a frase. Tudo sem custo.
        </p>
        <Button asChild className="mt-6 w-full gap-2 bg-emerald-600 hover:bg-emerald-500">
          <Link href="/news/gestao-financeira?voz=1">
            <Mic className="h-5 w-5" />
            Ir para Gestão Financeira
          </Link>
        </Button>
      </div>
    </div>
  )
}
