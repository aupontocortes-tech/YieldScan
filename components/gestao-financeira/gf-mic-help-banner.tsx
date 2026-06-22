'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  copyBrowserVoiceLink,
  getBrowserVoiceUrl,
  openVoiceInSystemBrowser,
} from '@/lib/mic-permission'
import { Check, Copy, ExternalLink, Mic } from 'lucide-react'

type Props = {
  lines: string[]
  standalone?: boolean
  onRetry?: () => void
}

export function GfMicHelpBanner({ lines, standalone, onRetry }: Props) {
  const [copied, setCopied] = useState(false)
  const url = getBrowserVoiceUrl()

  const handleCopy = async () => {
    const ok = await copyBrowserVoiceLink()
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 2500)
  }

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
      {standalone ? (
        <p className="break-all rounded bg-muted/30 px-2 py-1 font-mono text-[10px] text-foreground">
          {url.replace(/^https:\/\//, '')}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        {standalone ? (
          <>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 bg-sky-600 hover:bg-sky-500"
              onClick={() => openVoiceInSystemBrowser()}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir no Chrome
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => void handleCopy()}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar endereço'}
            </Button>
          </>
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
