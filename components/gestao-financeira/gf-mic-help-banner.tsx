'use client'

import { Button } from '@/components/ui/button'
import { openVoiceInSystemBrowser } from '@/lib/mic-permission'
import { ExternalLink, Mic } from 'lucide-react'

type Props = {
  lines: string[]
  standalone?: boolean
  onRetry?: () => void
}

export function GfMicHelpBanner({ lines, standalone, onRetry }: Props) {
  return (
    <div className="mt-2 rounded-lg border border-sky-500/30 bg-sky-950/20 p-3 text-xs space-y-2">
      <p className="font-medium text-sky-200 flex items-center gap-1.5">
        <Mic className="h-3.5 w-3.5" />
        Microfone no celular
      </p>
      <ul className="space-y-1 text-muted-foreground">
        {lines.map((line, i) => (
          <li key={i}>• {line}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        {standalone ? (
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 bg-sky-600 hover:bg-sky-500"
            onClick={() => openVoiceInSystemBrowser()}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir no Chrome
          </Button>
        ) : null}
        {onRetry ? (
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={onRetry}>
            Tentar de novo
          </Button>
        ) : null}
      </div>
    </div>
  )
}
