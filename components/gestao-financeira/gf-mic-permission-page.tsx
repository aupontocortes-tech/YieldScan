'use client'

import Link from 'next/link'
import { ArrowLeft, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
        <h2 className="text-xl font-bold">Registrar por frase</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Digite no campo ou use o microfone do teclado do celular para falar a frase.
        </p>
        <Button asChild className="mt-6 w-full gap-2 bg-emerald-600 hover:bg-emerald-500">
          <Link href="/news/gestao-financeira">
            <PenLine className="h-5 w-5" />
            Ir para Gestão Financeira
          </Link>
        </Button>
      </div>
    </div>
  )
}
