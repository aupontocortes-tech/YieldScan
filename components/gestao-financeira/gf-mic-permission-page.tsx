'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { openGfVoiceFromUserGesture } from '@/lib/gestao-financeira/voice-bridge'
import {
  detectMicPlatform,
  getMicPermissionPageUrl,
  isStandalonePwa,
  micFailureMessage,
  micPermissionHelpLines,
  openSiteInSystemBrowser,
  queryMicrophonePermission,
  requestMicrophoneAccess,
  type MicAccessResult,
} from '@/lib/mic-permission'
import { ArrowLeft, ExternalLink, Loader2, Mic, ShieldAlert } from 'lucide-react'

export function GfMicPermissionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const openVoiceAfter = searchParams.get('voz') === '1'
  const [requesting, setRequesting] = useState(false)
  const [failure, setFailure] = useState<MicAccessResult | null>(null)
  const [standalone, setStandalone] = useState(false)
  const platform = detectMicPlatform()
  const helpLines = useMemo(() => micPermissionHelpLines(platform, standalone), [platform, standalone])

  const goBackWithVoice = useCallback(() => {
    if (openVoiceAfter) openGfVoiceFromUserGesture({ autoStart: true })
    router.replace('/news/gestao-financeira')
  }, [openVoiceAfter, router])

  useEffect(() => {
    setStandalone(isStandalonePwa())
  }, [])

  useEffect(() => {
    void queryMicrophonePermission().then((state) => {
      if (state === 'granted') goBackWithVoice()
    })
  }, [goBackWithVoice])

  const handleAllow = async () => {
    setRequesting(true)
    setFailure(null)
    try {
      const result = await requestMicrophoneAccess()
      if (result.ok) {
        goBackWithVoice()
      } else {
        setFailure(result)
      }
    } finally {
      setRequesting(false)
    }
  }

  const openInBrowser = () => {
    openSiteInSystemBrowser(getMicPermissionPageUrl(openVoiceAfter))
  }

  const showHelp = Boolean(failure) || standalone

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-4">
      <Link
        href="/news/gestao-financeira"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar à Gestão
      </Link>

      {standalone ? (
        <div className="rounded-2xl border border-blue-500/35 bg-blue-950/25 p-4 text-sm">
          <p className="font-semibold text-blue-200">App instalado na tela inicial</p>
          <p className="mt-1 text-muted-foreground">
            No Android, o aviso de microfone muitas vezes <strong>só aparece no navegador</strong>, não no ícone
            instalado. Use o botão azul abaixo.
          </p>
          <Button
            type="button"
            size="lg"
            className="mt-4 w-full gap-2 bg-blue-600 hover:bg-blue-500"
            onClick={openInBrowser}
          >
            <ExternalLink className="h-5 w-5" />
            Abrir no navegador (recomendado)
          </Button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/30 to-background p-6 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg">
          <Mic className="h-8 w-8" />
        </span>
        <h2 className="mt-4 text-xl font-bold">Ativar microfone</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Toque no botão verde. O <strong>celular</strong> deve mostrar um aviso — toque em <strong>Permitir</strong>.
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
        {!standalone ? (
          <Button type="button" variant="ghost" size="sm" className="mt-2 gap-2 text-muted-foreground" onClick={openInBrowser}>
            <ExternalLink className="h-4 w-4" />
            Ou abrir no navegador
          </Button>
        ) : null}
      </div>

      {showHelp ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-amber-200">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            {failure ? micFailureMessage(failure, standalone) : 'Se o aviso não aparecer'}
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
            {helpLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <div className="mt-4 flex flex-col gap-2">
            {standalone ? (
              <Button type="button" className="w-full gap-2 bg-blue-600 hover:bg-blue-500" onClick={openInBrowser}>
                <ExternalLink className="h-4 w-4" />
                Abrir no navegador
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={requesting}
              onClick={() => void handleAllow()}
            >
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
