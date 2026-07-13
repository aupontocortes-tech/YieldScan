/**
 * Ganchos tipados para evoluções futuras — sem UI nesta entrega.
 * Importar isto ao acrescentar features novas.
 */
export type CortesFutureCapabilityId =
  | 'translation'
  | 'dubbing'
  | 'voiceClone'
  | 'denoise'
  | 'fillerRemoval'
  | 'autoZoom'
  | 'faceTrackingReframe'
  | 'effects'
  | 'emojis'
  | 'bgm'
  | 'templates'
  | 'socialPublish'

export type CortesFutureCapability = {
  id: CortesFutureCapabilityId
  label: string
  status: 'planned'
}

export const CORTES_FUTURE_CAPABILITIES: CortesFutureCapability[] = [
  { id: 'translation', label: 'Tradução automática', status: 'planned' },
  { id: 'dubbing', label: 'Dublagem por IA', status: 'planned' },
  { id: 'voiceClone', label: 'Clonagem de voz', status: 'planned' },
  { id: 'denoise', label: 'Remoção de ruído', status: 'planned' },
  { id: 'fillerRemoval', label: 'Remoção de palavras de preenchimento', status: 'planned' },
  { id: 'autoZoom', label: 'Zoom automático', status: 'planned' },
  { id: 'faceTrackingReframe', label: 'Auto Reframe com face tracking', status: 'planned' },
  { id: 'effects', label: 'Efeitos automáticos', status: 'planned' },
  { id: 'emojis', label: 'Inserção de emojis', status: 'planned' },
  { id: 'bgm', label: 'Música de fundo', status: 'planned' },
  { id: 'templates', label: 'Templates de edição', status: 'planned' },
  { id: 'socialPublish', label: 'Publicação directa nas redes', status: 'planned' },
]
