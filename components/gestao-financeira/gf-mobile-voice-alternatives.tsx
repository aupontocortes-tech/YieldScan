'use client'

import { Keyboard, Monitor, Mic, PenLine } from 'lucide-react'

/** Alternativas quando o botão 🎤 do app falha no celular (comum no Android/PWA). */
export function GfMobileVoiceAlternatives() {
  return (
    <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs space-y-3">
      <p className="font-semibold text-emerald-200">No celular — formas de registrar por voz</p>

      <div className="space-y-1.5 rounded-lg bg-emerald-950/30 p-2.5 ring-1 ring-emerald-500/25">
        <p className="flex items-center gap-1.5 font-medium text-emerald-100">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px]">1</span>
          <Keyboard className="h-3.5 w-3.5" />
          Microfone do teclado (recomendado)
        </p>
        <ol className="ml-7 list-decimal space-y-0.5 text-muted-foreground">
          <li>Toque no <strong className="text-foreground">campo de texto</strong> abaixo</li>
          <li>No teclado (Gboard / Samsung), toque no <strong className="text-foreground">🎤 do teclado</strong></li>
          <li>Fale — ex.: «Gastei 50 no mercado»</li>
          <li>Toque <strong className="text-foreground">Interpretar</strong> → confira → <strong className="text-foreground">Salvar</strong></li>
        </ol>
        <p className="ml-7 text-[10px] text-emerald-300/80">Não usa gravação do app · funciona com permissões normais do teclado.</p>
      </div>

      <div className="space-y-1 text-muted-foreground">
        <p className="flex items-center gap-1.5 font-medium text-foreground/90">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px]">2</span>
          <PenLine className="h-3.5 w-3.5" />
          Digitar a frase
        </p>
        <p className="ml-7">Mesmo fluxo: escreva → Interpretar → Salvar.</p>
      </div>

      <div className="space-y-1 text-muted-foreground">
        <p className="flex items-center gap-1.5 font-medium text-foreground/90">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px]">3</span>
          <Monitor className="h-3.5 w-3.5" />
          Usar no computador
        </p>
        <p className="ml-7">No PC o 🎤 do app costuma pedir permissão e funcionar de imediato.</p>
      </div>

      <details className="text-muted-foreground">
        <summary className="cursor-pointer text-[11px] text-muted-foreground select-none">
          <Mic className="mr-1 inline h-3 w-3" />
          Tentar o 🎤 do app (experimental no celular)
        </summary>
        <p className="mt-1.5 pl-1 text-[11px] leading-relaxed">
          OpenAI activa + «Permitir microfone» na caixa azul. Toque 🎤 duas vezes (gravar e parar).
          Se falhar, use a opção 1 (teclado) — o resultado é o mesmo.
        </p>
      </details>
    </div>
  )
}
