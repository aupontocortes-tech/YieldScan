import type { ExportProfile } from '@/lib/cortes-video/platforms'

export type CoverSource = 'frame' | 'upload' | 'ai'

export type CoverCandidate = {
  id: string
  source: CoverSource
  label: string
  dataUrl: string
  atSec?: number
}

export function newCoverId() {
  return `cover_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/** Captura o frame actual do elemento video. */
export function captureVideoFrame(video: HTMLVideoElement, maxWidth = 1280): string {
  const vw = video.videoWidth || 1280
  const vh = video.videoHeight || 720
  const scale = Math.min(1, maxWidth / vw)
  const w = Math.max(2, Math.floor((vw * scale) / 2) * 2)
  const h = Math.max(2, Math.floor((vh * scale) / 2) * 2)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível.')
  ctx.drawImage(video, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.92)
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'))
    img.src = src
  })
}

/** Compõe capa no aspect do perfil com título overlay. */
export async function composeCoverCard(opts: {
  baseDataUrl: string
  title: string
  subtitle?: string
  profile: ExportProfile
}): Promise<string> {
  const { baseDataUrl, title, subtitle, profile } = opts
  const img = await loadImage(baseDataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = profile.width
  canvas.height = profile.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível.')

  const scale = Math.max(canvas.width / img.width, canvas.height / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  const dx = (canvas.width - dw) / 2
  const dy = (canvas.height - dh) / 2
  ctx.drawImage(img, dx, dy, dw, dh)

  const grad = ctx.createLinearGradient(0, canvas.height * 0.35, 0, canvas.height)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.45, 'rgba(0,0,0,0.45)')
  grad.addColorStop(1, 'rgba(0,0,0,0.82)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const pad = Math.round(canvas.width * 0.06)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  const fontSize = Math.round(canvas.width * 0.055)
  ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`
  ctx.shadowColor = 'rgba(0,0,0,0.65)'
  ctx.shadowBlur = 12

  const lines = wrapText(ctx, title.trim() || 'Capa do vídeo', canvas.width - pad * 2, 3)
  let y = canvas.height - pad - (subtitle ? fontSize * 0.9 : 0)
  for (let i = lines.length - 1; i >= 0; i--) {
    ctx.fillText(lines[i]!, pad, y)
    y -= fontSize * 1.15
  }

  if (subtitle?.trim()) {
    ctx.font = `500 ${Math.round(fontSize * 0.45)}px Inter, system-ui, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.shadowBlur = 6
    ctx.fillText(subtitle.trim().slice(0, 80), pad, canvas.height - pad * 0.55)
  }

  return canvas.toDataURL('image/jpeg', 0.92)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
      if (lines.length >= maxLines) break
    } else {
      line = test
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length === maxLines && words.length) {
    const last = lines[maxLines - 1]!
    if (ctx.measureText(last).width > maxWidth * 0.95) {
      lines[maxLines - 1] = `${last.slice(0, Math.max(4, last.length - 3))}…`
    }
  }
  return lines
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Falha ao ler ficheiro.'))
    reader.readAsDataURL(file)
  })
}
