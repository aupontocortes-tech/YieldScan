'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/** Erro só na rota /indicator — mensagem específica + voltar ao painel. */
export default function IndicatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Indicadores]', error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-4 bg-[#050505] px-4 text-center text-zinc-100">
      <p className="text-lg font-semibold">Não foi possível abrir os Indicadores.</p>
      <p className="max-w-md text-sm text-zinc-500">
        O gráfico falhou ao iniciar. Toca em «Tentar de novo» ou recarrega a página. Se persistir, reinicia o
        servidor local (<span className="font-mono text-zinc-400">npm run dev</span>).
      </p>
      {process.env.NODE_ENV === 'development' && error?.message ? (
        <p className="max-w-lg break-all rounded-md border border-red-500/30 bg-red-950/30 px-3 py-2 font-mono text-[11px] text-red-200/90">
          {error.message}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={reset} className="bg-[#d4af37] text-black hover:bg-[#d4af37]/90">
          Tentar de novo
        </Button>
        <Button type="button" variant="outline" className="border-zinc-700" onClick={() => (window.location.href = '/dashboard')}>
          Ir ao painel
        </Button>
      </div>
    </div>
  )
}
