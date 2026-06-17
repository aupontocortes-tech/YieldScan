'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { openGfVoiceFromUserGesture } from '@/lib/gestao-financeira/voice-bridge'
import {
  detectMicPlatform,
  micPermissionHelpLines,
  queryMicrophonePermission,
  requestMicrophoneAccess,
} from '@/lib/mic-permission'
import { ArrowLeft, Loader2, Mic, ShieldAlert } from 'lucide-react'

export function GfMicPermissionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const openVoiceAfter = searchParams.get('voz') === '1'
  const [requesting, setRequesting] = useState(false)
  const [denied, setDenied] = useState(false)
  const platform = detectMicPlatform()
  const helpLines = micPermissionHelpLines(platform)

  const goBackWithVoice = useCallback(() => {
    if (openVoiceAfter) openGfVoiceFromUserGesture({ autoStart: true })
    router.replace('/news/gestao-financeira')
  }, [openVoiceAfter, router])

  useEffect(() => {
    void queryMicrophonePermission().then((state) => {
      if (state === 'granted') goBackWithVoice()
    })
  }, [goBackWithVoice])

  const handleAllow = async () => {
    setRequesting(true)
    setDenied(false)
    try {
      const result = await requestMicrophoneAccess()
      if (result.ok) {
        goBackWithVoice()
      } else {
        setDenied(true)
      }
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-4">
      <Link
        href="/news/gestao-financeira"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar à Gestão
      </Link>

      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/30 to-background p-6 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg">
          <Mic className="h-8 w-8" />
        </span>
        <h2 className="mt-4 text-xl font-bold">Ativar microfone</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Toque no botão abaixo. O <strong>celular</strong> vai mostrar um aviso pedindo permissão — toque em{' '}
          <strong>Permitir</strong>. Não precisa instalar o Chrome.
        </p>
        <Button
          type="button"
          size="lg"
          className="mt-6 w-full gap-2 bg-emerald-600 text-base hover:bg-emerald-500"
          disabled={requesting}
          onClick={() => void handleAllow()}
        >
          {requesting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
          Permitir microfone
        </Button>
      </div>

      {denied ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-amber-200">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            O aviso não apareceu ou foi bloqueado
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
            {helpLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            disabled={requesting}
            onClick={() => void handleAllow()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : null}
    </div>
  )
}
