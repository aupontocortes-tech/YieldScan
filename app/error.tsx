'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground">
      <p className="text-lg font-semibold">Não foi possível carregar esta parte do app.</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Tente novamente. Se estiver no celular com internet lenta, aguarde alguns segundos antes de recarregar.
      </p>
      <Button type="button" onClick={reset} className="bg-gold text-background hover:bg-gold/90">
        Tentar de novo
      </Button>
    </div>
  )
}
