'use client'

import { useCallback, useEffect, useState } from 'react'
import { GfVoiceDialog } from '@/components/gestao-financeira/gf-voice-dialog'
import { saveGfParsedVoiceEntry } from '@/lib/gestao-financeira/save-parsed-voice'
import { GF_VOICE_EVENT, type GfVoiceOpenDetail } from '@/lib/gestao-financeira/voice-bridge'
import type { GfParsedVoiceEntry } from '@/lib/gestao-financeira/types'

/**
 * Diálogo de voz global no hub /news — funciona ao segurar Gestão em qualquer aba
 * e ao tocar em Falar agora dentro de Gestão Financeira.
 */
export function GfVoiceHost() {
  const [open, setOpen] = useState(false)
  const [autoStart, setAutoStart] = useState(false)
  const [setupMic, setSetupMic] = useState(false)

  useEffect(() => {
    const onVoice = (e: Event) => {
      const detail = (e as CustomEvent<GfVoiceOpenDetail>).detail
      setAutoStart(Boolean(detail?.autoStart))
      setSetupMic(Boolean(detail?.setupMic))
      setOpen(true)
    }
    window.addEventListener(GF_VOICE_EVENT, onVoice)
    return () => window.removeEventListener(GF_VOICE_EVENT, onVoice)
  }, [])

  const onConfirm = useCallback(async (parsed: GfParsedVoiceEntry) => {
    const ok = await saveGfParsedVoiceEntry(parsed)
    if (!ok) throw new Error('Não foi possível salvar. Confira caixa e valor.')
  }, [])

  return (
    <GfVoiceDialog
      open={open}
      onOpenChange={setOpen}
      onConfirm={onConfirm}
      autoStartMic={autoStart}
      setupMic={setupMic}
    />
  )
}
