'use client'

import { Button } from '@/components/ui/button'

export function DataLoadError({
  message,
  onRetry,
}: {
  message?: string
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-4 text-center"
    >
      <p className="text-sm text-foreground">
        {message ??
          'Não foi possível carregar os dados. Pode ser internet lenta ou o servidor ainda processando — toque abaixo para tentar de novo.'}
      </p>
      <Button
        type="button"
        className="mt-4 bg-gold text-background hover:bg-gold/90"
        onClick={onRetry}
      >
        Tentar novamente
      </Button>
    </div>
  )
}
