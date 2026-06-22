export type MicPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported'

export type MicAccessResult = {
  ok: boolean
  state: MicPermissionState
  /** Nome do erro do navegador, se houver. */
  errorName?: string
}

export type MicPlatform = 'ios' | 'android' | 'desktop'

export function detectMicPlatform(): MicPlatform {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

/** App instalado na tela inicial (PWA) — microfone costuma falhar aqui no Android. */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  )
}

export function getMicPermissionPageUrl(openVoice = false): string {
  return getBrowserVoiceUrl(openVoice)
}

/** URL para abrir Gestão no navegador com voz e pedido de microfone. */
export function getBrowserVoiceUrl(openVoice = true): string {
  const qs = openVoice ? '?voz=1&mic=1' : '?mic=1'
  const path = `/news/gestao-financeira${qs}`
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

export async function copyBrowserVoiceLink(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false
  try {
    await navigator.clipboard.writeText(getBrowserVoiceUrl())
    return true
  } catch {
    return false
  }
}

/**
 * Abre o YieldScan no navegador externo (Chrome) para o microfone funcionar no PWA.
 * Não usa intent:// Android — isso gera erro «APP/APT não encontrado» em muitos telemóveis.
 */
export function openVoiceInSystemBrowser(): void {
  if (typeof window === 'undefined') return
  const url = getBrowserVoiceUrl()
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** @deprecated use openVoiceInSystemBrowser */
export function openSiteInSystemBrowser(path: string): void {
  if (path.includes('gestao-financeira')) {
    openVoiceInSystemBrowser()
    return
  }
  if (typeof window === 'undefined') return
  const url = path.startsWith('http') ? path : `${window.location.origin}${path}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** Consulta estado atual sem abrir popup (quando o browser suporta). */
export async function queryMicrophonePermission(): Promise<MicPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'unsupported'
  }
  if (!navigator.permissions?.query) return 'prompt'
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    return result.state as MicPermissionState
  } catch {
    return 'prompt'
  }
}

/** Pede permissão de microfone — abre o popup do sistema quando possível. */
export async function requestMicrophoneAccess(): Promise<MicAccessResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, state: 'unsupported', errorName: 'NoMediaDevices' }
  }
  if (!window.isSecureContext) {
    return { ok: false, state: 'unsupported', errorName: 'InsecureContext' }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    })
    stream.getTracks().forEach((track) => track.stop())
    return { ok: true, state: 'granted' }
  } catch (err) {
    const errorName = err instanceof DOMException ? err.name : 'UnknownError'
    const denied =
      err instanceof DOMException &&
      (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
    return { ok: false, state: denied ? 'denied' : 'prompt', errorName }
  }
}

/** @deprecated Use requestMicrophoneAccess — mantido para compatibilidade. */
export async function ensureMicrophoneAccess(): Promise<boolean> {
  return (await requestMicrophoneAccess()).ok
}

export function micPermissionHelpLines(platform: MicPlatform, standalone: boolean): string[] {
  if (platform === 'android' && standalone) {
    return [
      'Feche o ícone do app e abra o Chrome manualmente (não use «Abrir no Chrome» se der erro).',
      'No Chrome, digite: yield-scan.vercel.app/news/gestao-financeira',
      'Toque no cadeado (ou ⓘ) ao lado do endereço → Microfone → Permitir.',
      'Ou: Ajustes → Apps → Chrome → Permissões → Microfone → Permitir.',
    ]
  }
  if (platform === 'android') {
    return [
      'Toque em «Tentar de novo» abaixo — se aparecer o aviso, escolha Permitir.',
      'Toque no cadeado (ou ⓘ) à esquerda do endereço → Microfone → Permitir.',
      'Recarregue a página depois de permitir.',
      'Ou: Ajustes do Android → Apps → Chrome → Permissões → Microfone → Permitir.',
    ]
  }
  if (platform === 'ios') {
    return [
      'No app instalado o microfone pode não funcionar — abra o site pelo Safari.',
      'Ajustes → Safari → Microfone → Perguntar ou Permitir.',
      'Ou: Ajustes → Privacidade → Microfone → ative o Safari.',
      'No Safari, toque em Permitir microfone e depois Permitir no aviso.',
    ]
  }
  return [
    'Clique em «Permitir microfone» — o navegador deve mostrar um aviso.',
    'Se bloqueou antes: cadeado na barra de endereço → Microfone → Permitir.',
    'Recarregue a página e tente novamente.',
  ]
}

export function micFailureMessage(result: MicAccessResult, standalone: boolean): string {
  if (result.state === 'unsupported') {
    return 'Microfone indisponível neste modo. Use o botão «Abrir no navegador».'
  }
  if (standalone && detectMicPlatform() === 'android') {
    return 'No app instalado o aviso pode não aparecer. Use «Abrir no navegador» abaixo.'
  }
  if (result.state === 'denied') {
    return 'Microfone bloqueado. Siga os passos abaixo ou abra no navegador.'
  }
  return 'O aviso não apareceu. Tente «Abrir no navegador» ou os passos abaixo.'
}
