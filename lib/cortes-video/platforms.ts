import type { CortesPlatformId } from '@/lib/cortes-video/types'

export type ExportProfile = {
  id: CortesPlatformId
  label: string
  aspectLabel: string
  width: number
  height: number
  aspect: number
}

export const EXPORT_PROFILES: ExportProfile[] = [
  { id: 'tiktok', label: 'TikTok', aspectLabel: '9:16', width: 1080, height: 1920, aspect: 9 / 16 },
  { id: 'reels', label: 'Instagram Reels', aspectLabel: '9:16', width: 1080, height: 1920, aspect: 9 / 16 },
  { id: 'shorts', label: 'YouTube Shorts', aspectLabel: '9:16', width: 1080, height: 1920, aspect: 9 / 16 },
  { id: 'ig_feed', label: 'Instagram Feed', aspectLabel: '4:5', width: 1080, height: 1350, aspect: 4 / 5 },
  { id: 'ig_square', label: 'Instagram Quadrado', aspectLabel: '1:1', width: 1080, height: 1080, aspect: 1 },
  { id: 'youtube', label: 'YouTube', aspectLabel: '16:9', width: 1920, height: 1080, aspect: 16 / 9 },
  { id: 'facebook', label: 'Facebook', aspectLabel: '16:9', width: 1920, height: 1080, aspect: 16 / 9 },
  { id: 'linkedin', label: 'LinkedIn', aspectLabel: '16:9', width: 1920, height: 1080, aspect: 16 / 9 },
  { id: 'x', label: 'X (Twitter)', aspectLabel: '16:9', width: 1920, height: 1080, aspect: 16 / 9 },
]

export function getExportProfile(id: CortesPlatformId): ExportProfile {
  return EXPORT_PROFILES.find((p) => p.id === id) ?? EXPORT_PROFILES[0]!
}
