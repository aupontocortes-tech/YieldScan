'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  copyBrowserVoiceLink,
  detectMicPlatform,
  getBrowserVoiceUrl,
  isStandalonePwa,
  micPermissionHelpLines,
  openVoiceInSystemBrowser,
  requestMicrophoneAccess,
} from '@/lib/mic-permission'
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Gauge,
  Keyboard,
  Mic,
  Monitor,
  PenLine,
  Sparkles,
} from 'lucide-react'

export function GfVoiceHelpPage() {
  const platform = detectMicPlatform()
  const standalone = isStandalonePwa()
  const helpLines = micPermissionHelpLines(platform, standalone)
  const [copied, setCopied] = useState(false)
  const [permMsg, setPermMsg] = useState<string | null>(null)
  const url = getBrowserVoiceUrl()

  const handleCopy = async () => {
    const ok = await copyBrowserVoiceLink()
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 2500)
  }

  const handleAllowMic = async () => {
    setPermMsg(null)
    const result = await requestMicrophoneAccess()
    if (result.ok) {
      setPermMsg('Microfone permitido. Volte à Gestão e toque no 🎤 para gravar.')
    } else if (result.state === 'denied') {
      setPermMsg('Bloqueado. Siga os passos de navegador abaixo ou abra no Chrome.')
    } else {
      setPermMsg('O aviso não apareceu. Tente abrir no Chrome ou ajustar permissões.')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 py-4">
      <Link
        href="/news/gestao-financeira"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar à Gestão
      </Link>

      <div>
        <h2 className="text-xl font-bold">Ajuda · voz no celular</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Como falar frases, permitir o microfone e configurar o navegador.
        </p>
      </div>

      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-sm space-y-2">
        <h3 className="flex items-center gap-2 font-semibold text-emerald-100">
          <Keyboard className="h-4 w-4" />
          Microfone do teclado
        </h3>
        <ol className="ml-4 list-decimal space-y-1 text-muted-foreground text-xs">
          <li>Toque no <strong className="text-foreground">campo de texto</strong> na Gestão</li>
          <li>No teclado (Gboard / Samsung), toque no <strong className="text-foreground">🎤 do teclado</strong></li>
          <li>Fale — ex.: «Gastei 50 no mercado»</li>
          <li>
            Toque <strong className="text-foreground">Interpretar</strong> → confira →{' '}
            <strong className="text-foreground">Salvar</strong>
          </li>
        </ol>
        <p className="text-[11px] text-emerald-300/80">Alternativa fiável quando o 🎤 do app não grava.</p>
      </section>

      <section className="rounded-2xl border border-violet-500/25 bg-violet-950/15 p-4 text-sm space-y-2">
        <h3 className="flex items-center gap-2 font-semibold text-violet-100">
          <Gauge className="h-4 w-4" />
          Chave OpenAI (Uso da API)
        </h3>
        <p className="text-xs text-muted-foreground">
          A chave <strong className="text-foreground">não substitui</strong> a permissão do microfone. Ela serve para
          transcrever e interpretar frases no celular.
        </p>
        <ol className="ml-4 list-decimal space-y-1 text-muted-foreground text-xs">
          <li>Na Gestão, toque <strong className="text-foreground">Uso da API</strong></li>
          <li>Cole a chave → <strong className="text-foreground">Ativar IA</strong> → <strong className="text-foreground">Guardar</strong></li>
          <li>Configure de novo em cada aparelho (fica só neste celular)</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-sky-500/30 bg-sky-950/20 p-4 text-sm space-y-3">
        <h3 className="flex items-center gap-2 font-semibold text-sky-100">
          <Mic className="h-4 w-4" />
          Microfone do app (botão 🎤)
        </h3>
        <p className="text-xs text-muted-foreground">
          Toque no 🎤 ao lado do campo — o navegador deve pedir permissão. Fale e toque de novo para parar.
        </p>
        {permMsg ? <p className="text-xs text-emerald-300">{permMsg}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 bg-emerald-700 hover:bg-emerald-600"
            onClick={() => void handleAllowMic()}
          >
            <Mic className="h-3.5 w-3.5" />
            Permitir microfone
          </Button>
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
        </div>
      </section>

      <section className="rounded-2xl border border-border/50 bg-card/40 p-4 text-sm space-y-2">
        <h3 className="font-semibold">Configurar o navegador</h3>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          {helpLines.map((line, i) => (
            <li key={i}>• {line}</li>
          ))}
        </ul>
        {standalone ? (
          <p className="break-all rounded bg-muted/30 px-2 py-1 font-mono text-[10px] text-foreground">
            {url.replace(/^https:\/\//, '')}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border/40 bg-muted/10 p-4 text-xs text-muted-foreground space-y-2">
        <p className="flex items-center gap-2 font-medium text-foreground/90">
          <PenLine className="h-3.5 w-3.5" />
          Digitar a frase
        </p>
        <p>Escreva no campo → Interpretar → Salvar. Frases simples não gastam API.</p>
        <p className="flex items-center gap-2 font-medium text-foreground/90 pt-1">
          <Monitor className="h-3.5 w-3.5" />
          Computador
        </p>
        <p>No PC o 🎤 do app costuma pedir permissão e funcionar de imediato.</p>
      </section>

      <Button asChild className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500">
        <Link href="/news/gestao-financeira">
          <Sparkles className="h-4 w-4" />
          Ir para Gestão Financeira
        </Link>
      </Button>
    </div>
  )
}
