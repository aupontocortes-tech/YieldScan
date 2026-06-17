'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { dispatchGfVoiceOpen } from '@/lib/gestao-financeira/voice-bridge'

/** Redireciona para Gestão e abre o gravador (digitar funciona sem microfone). */
export function GfMicPermissionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const openVoiceAfter = searchParams.get('voz') === '1'

  useEffect(() => {
    dispatchGfVoiceOpen({ autoStart: false })
    router.replace('/news/gestao-financeira')
  }, [openVoiceAfter, router])

  return (
    <p className="py-8 text-center text-sm text-muted-foreground">Abrindo gravador…</p>
  )
}
