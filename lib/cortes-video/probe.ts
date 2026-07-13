import type { CortesVideoMeta } from '@/lib/cortes-video/types'

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

/** Lê duração/resolução via elemento video no browser. */
export function probeVideoFile(file: File): Promise<CortesVideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    const cleanup = () => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
    }
    video.onloadedmetadata = () => {
      const meta: CortesVideoMeta = {
        name: file.name,
        sizeBytes: file.size,
        durationSec: Number.isFinite(video.duration) ? video.duration : 0,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
        fps: null,
        mimeType: file.type || 'video/mp4',
      }
      cleanup()
      resolve(meta)
    }
    video.onerror = () => {
      cleanup()
      reject(new Error('Não foi possível ler o vídeo.'))
    }
    video.src = url
  })
}

export function videoThumbnailDataUrl(file: File, atSec = 0.5): Promise<string | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(atSec, Math.max(0, (video.duration || 1) * 0.1))
      } catch {
        resolve(undefined)
      }
    }
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        const w = Math.min(320, video.videoWidth || 320)
        const h = Math.round((w / (video.videoWidth || 1)) * (video.videoHeight || 180))
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          resolve(undefined)
          return
        }
        ctx.drawImage(video, 0, 0, w, h)
        const data = canvas.toDataURL('image/jpeg', 0.7)
        URL.revokeObjectURL(url)
        resolve(data)
      } catch {
        URL.revokeObjectURL(url)
        resolve(undefined)
      }
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(undefined)
    }
    video.src = url
  })
}
