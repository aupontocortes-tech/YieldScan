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
  const path = `/news/gestao-financeira/microfone${openVoice ? '?voz=1' : ''}`
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

/**
 * Abre o site no navegador do sistema (fora do app instalado).
 * No Android instalado, isto é o método mais fiável para o aviso de microfone aparecer.
 */
export function openSiteInSystemBrowser(path: string): void {
  if (typeof window === 'undefined') return
  const url = path.startsWith('http') ? path : `${window.location.origin}${path}`

  if (detectMicPlatform() === 'android' && isStandalonePwa()) {
    const hostPath = url.replace(/^https?:\/\//, '')
    const intent = `intent://${hostPath}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`
    window.location.assign(intent)
    window.setTimeout(() => {
      window.open(url, '_blank', 'noopener,noreferrer')
    }, 700)
    return
  }

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
      'Toque em «Abrir no navegador» (botão azul acima) — é o jeito mais fácil no app instalado.',
      'No navegador, toque outra vez em «Permitir microfone» e depois em Permitir no aviso do celular.',
      'Se preferir manual: Ajustes → Apps → YieldScan → Permissões → Microfone → Permitir.',
      'Também pode: Ajustes → Apps → Samsung Internet (ou seu navegador) → Microfone → Permitir.',
    ]
  }
  if (platform === 'android') {
    return [
      'Toque em «Permitir microfone» — o celular deve mostrar «Permitir microfone?».',
      'Se não aparecer: toque no cadeado na barra do site → Microfone → Permitir.',
      'Ou: Ajustes → Apps → seu navegador → Permissões → Microfone → Permitir.',
      'Feche o app, abra de novo e tente outra vez.',
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
