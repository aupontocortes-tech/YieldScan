/** Domínio — Cortes de Vídeo com IA */

export type CortesPipelinePhase =
  | 'idle'
  | 'upload'
  | 'probe'
  | 'extract_audio'
  | 'transcribe'
  | 'analyze'
  | 'render'
  | 'export'
  | 'copy'
  | 'done'
  | 'error'

export type CortesVideoMeta = {
  name: string
  sizeBytes: number
  durationSec: number
  width: number
  height: number
  fps: number | null
  mimeType: string
}

export type TranscriptWord = {
  word: string
  start: number
  end: number
}

export type TranscriptSegment = {
  id: string
  text: string
  start: number
  end: number
  words: TranscriptWord[]
}

export type CortesTranscript = {
  text: string
  language: string
  segments: TranscriptSegment[]
  srt: string
}

export type CutSuggestion = {
  id: string
  start: number
  end: number
  reason: string
  score: number
  kind: 'highlight' | 'viral' | 'silence' | 'pause' | 'suggested'
}

export type TimelineClip = {
  id: string
  /** Tempo no vídeo original */
  sourceStart: number
  sourceEnd: number
}

export type CaptionStyle = {
  fontFamily: string
  color: string
  fontSize: number
  shadow: boolean
  position: 'top' | 'center' | 'bottom'
  animation: 'none' | 'fade' | 'pop'
}

export type ReframeSettings = {
  /** Zoom 1 = encaixa no perfil; >1 aproxima */
  zoom: number
  /** Offset relativo ao centro (-1..1) */
  offsetX: number
  offsetY: number
}

export type CortesPlatformId =
  | 'tiktok'
  | 'reels'
  | 'shorts'
  | 'ig_feed'
  | 'ig_square'
  | 'youtube'
  | 'facebook'
  | 'linkedin'
  | 'x'

export type CortesCopyPack = {
  title: string
  description: string
  hashtags: string[]
  summary: string
  platformId: CortesPlatformId
}

export type CortesOpenAiSettings = {
  apiKey: string
  enabled: boolean
  monthlyBudgetUsd: number
  maxCallsPerDay: number
}

export type CortesHistoryItem = {
  id: string
  createdAt: number
  updatedAt: number
  title: string
  meta: CortesVideoMeta
  platformId: CortesPlatformId | null
  hasTranscript: boolean
  hasExport: boolean
  /** Object URL / blob keys — fileHandle stored separately in IDB */
  thumbnailDataUrl?: string
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: 'Inter, system-ui, sans-serif',
  color: '#ffffff',
  fontSize: 28,
  shadow: true,
  position: 'bottom',
  animation: 'pop',
}

export const DEFAULT_REFRAME: ReframeSettings = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
}

export const DEFAULT_CORTES_OPENAI: CortesOpenAiSettings = {
  apiKey: '',
  enabled: false,
  monthlyBudgetUsd: 5,
  maxCallsPerDay: 50,
}
