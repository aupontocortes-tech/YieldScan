'use client'

import { Button } from '@/components/ui/button'
import { detectMicPlatform, isStandalonePwa, micPermissionHelpLines } from '@/lib/mic-permission'
import { Loader2, Mic, Settings2 } from 'lucide-react'

type Props = {
  requesting: boolean
  onRetry: () => void
}

/** Instruções corretas quando o microfone está bloqueado (Android Chrome ≠ cadeado/certificado). */
export function GfMicBlockedHelp({ requesting, onRetry }: Props) {
  const platform = detectMicPlatform()
  const standalone = typeof window !== 'undefined' && isStandalonePwa()
  const lines = micPermissionHelpLines(platform, standalone)

  return (
    <div className="rounded-lg border border-amber-500/35 bg-amber-950/20 px-3 py-3 text-xs text-muted-foreground">
      <p className="font-medium text-amber-200/95">Microfone bloqueado neste site</p>
      <p className="mt-1.5">
        O menu do <strong className="text-foreground">cadeado</strong> mostra só o certificado HTTPS — a permissão do
        microfone fica noutro sítio:
      </p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-4">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3 w-full gap-2 border-amber-500/40"
        disabled={requesting}
        onClick={onRetry}
      >
        {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
        Tentar permitir de novo
      </Button>
      <p className="mt-2 flex items-start gap-1.5 text-[11px]">
        <Settings2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/80" />
        Chrome Android: ⋮ (três pontos) → <strong className="text-foreground">Informações do site</strong> →{' '}
        <strong className="text-foreground">Microfone</strong> → Permitir → recarregue a página.
      </p>
    </div>
  )
}
