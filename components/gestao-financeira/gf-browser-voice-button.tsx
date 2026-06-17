'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { copyBrowserVoiceLink, openVoiceInSystemBrowser } from '@/lib/mic-permission'
import { ExternalLink, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  size?: 'default' | 'lg'
  className?: string
  showCopy?: boolean
}

/** Abre o YieldScan no navegador do celular — único jeito fiável de ativar voz no app instalado. */
export function GfBrowserVoiceButton({ size = 'default', className, showCopy = true }: Props) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    const ok = await copyBrowserVoiceLink()
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Button
        type="button"
        size={size}
        className="w-full gap-2 bg-blue-600 hover:bg-blue-500"
        onClick={() => openVoiceInSystemBrowser()}
      >
        <ExternalLink className="h-5 w-5 shrink-0" />
        Abrir no navegador para usar voz
      </Button>
      {showCopy ? (
        <Button type="button" variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => void onCopy()}>
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Link copiado — cole no navegador' : 'Copiar link do navegador'}
        </Button>
      ) : null}
    </div>
  )
}
