export type MicPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported'

export type MicAccessResult = {
  ok: boolean
  state: MicPermissionState
}

export type MicPlatform = 'ios' | 'android' | 'desktop'

export function detectMicPlatform(): MicPlatform {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
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
    return { ok: false, state: 'unsupported' }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
    return { ok: true, state: 'granted' }
  } catch (err) {
    const denied =
      err instanceof DOMException &&
      (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
    return { ok: false, state: denied ? 'denied' : 'prompt' }
  }
}

/** @deprecated Use requestMicrophoneAccess — mantido para compatibilidade. */
export async function ensureMicrophoneAccess(): Promise<boolean> {
  return (await requestMicrophoneAccess()).ok
}

export function micPermissionHelpLines(platform: MicPlatform): string[] {
  if (platform === 'android') {
    return [
      'Toque em «Permitir microfone» acima — o celular deve mostrar um aviso.',
      'Se não aparecer: abra o Chrome, toque no cadeado ao lado do endereço do site → Microfone → Permitir.',
      'Ou: Ajustes do celular → Apps → Chrome → Permissões → Microfone → Permitir.',
      'Feche o YieldScan, abra de novo e toque em «Permitir microfone».',
    ]
  }
  if (platform === 'ios') {
    return [
      'Toque em «Permitir microfone» — se aparecer o aviso do iPhone, toque em Permitir.',
      'Ajustes → Safari (ou Chrome) → Microfone → Perguntar ou Permitir.',
      'Ou: Ajustes → Privacidade → Microfone → ative Safari ou Chrome.',
      'No iPhone, o Chrome costuma funcionar melhor que o app instalado.',
    ]
  }
  return [
    'Clique em «Permitir microfone» — o navegador deve mostrar um aviso.',
    'Se bloqueou antes: clique no cadeado na barra de endereço → Microfone → Permitir.',
    'Recarregue a página e tente novamente.',
  ]
}
