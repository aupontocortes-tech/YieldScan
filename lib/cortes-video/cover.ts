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

/**
 * Capa estilo thumbnail viral: contraste alto, título enorme com contorno,
 * barra de destaque e badge de urgência.
 */
export async function composeCoverCard(opts: {
  baseDataUrl: string
  title: string
  subtitle?: string
  profile: ExportProfile
  /** Badge no topo (ex.: "EM ALTA", "AGORA"). */
  badge?: string
}): Promise<string> {
  const { baseDataUrl, title, subtitle, profile } = opts
  const badge = (opts.badge || 'EM ALTA').trim().toUpperCase().slice(0, 18)
  const img = await loadImage(baseDataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = profile.width
  canvas.height = profile.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível.')

  // Cover fill + ligeiro zoom para sensação de “close-up”
  const zoom = 1.08
  const scale = Math.max(canvas.width / img.width, canvas.height / img.height) * zoom
  const dw = img.width * scale
  const dh = img.height * scale
  const dx = (canvas.width - dw) / 2
  const dy = (canvas.height - dh) / 2
  ctx.drawImage(img, dx, dy, dw, dh)

  // Vinheta + gradiente forte (legibilidade em feed)
  const vignette = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.4,
    canvas.width * 0.15,
    canvas.width * 0.5,
    canvas.height * 0.55,
    canvas.width * 0.85,
  )
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const grad = ctx.createLinearGradient(0, canvas.height * 0.28, 0, canvas.height)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.4, 'rgba(0,0,0,0.55)')
  grad.addColorStop(1, 'rgba(0,0,0,0.92)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const pad = Math.round(canvas.width * 0.055)

  // Badge tendência
  if (badge) {
    const badgeFs = Math.round(canvas.width * 0.032)
    ctx.font = `800 ${badgeFs}px "Arial Black", Impact, Haettenschweiler, sans-serif`
    const badgeText = `🔥 ${badge}`
    const bw = ctx.measureText(badgeText).width + badgeFs * 1.2
    const bh = badgeFs * 1.85
    const bx = pad
    const by = pad
    roundRect(ctx, bx, by, bw, bh, bh * 0.35)
    ctx.fillStyle = '#FF2D55'
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'transparent'
    ctx.fillText(badgeText, bx + badgeFs * 0.45, by + bh * 0.52)
  }

  // Barra amarela de impacto
  const barH = Math.max(6, Math.round(canvas.width * 0.012))
  ctx.fillStyle = '#F5C518'
  ctx.fillRect(pad, canvas.height - pad - barH, Math.round(canvas.width * 0.28), barH)

  const fontSize = Math.round(canvas.width * 0.078)
  const fontStack = '"Arial Black", Impact, Haettenschweiler, "Franklin Gothic Bold", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.font = `900 ${fontSize}px ${fontStack}`

  const lines = wrapText(ctx, title.trim().toUpperCase() || 'CAPA DO VÍDEO', canvas.width - pad * 2, 3)
  let y = canvas.height - pad - (subtitle ? Math.round(fontSize * 0.7) : barH + 8)

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!
    // Contorno preto grosso (estilo thumbnail)
    ctx.lineWidth = Math.max(6, Math.round(fontSize * 0.14))
    ctx.strokeStyle = 'rgba(0,0,0,0.92)'
    ctx.lineJoin = 'round'
    ctx.miterLimit = 2
    ctx.strokeText(line, pad, y)
    ctx.fillStyle = '#FFFFFF'
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 10
    ctx.fillText(line, pad, y)
    ctx.shadowBlur = 0
    y -= fontSize * 1.05
  }

  if (subtitle?.trim()) {
    const subFs = Math.round(fontSize * 0.38)
    ctx.font = `700 ${subFs}px Arial, Helvetica, sans-serif`
    ctx.lineWidth = Math.max(3, Math.round(subFs * 0.18))
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'
    const sub = subtitle.trim().slice(0, 72)
    ctx.strokeText(sub, pad, canvas.height - pad * 0.35)
    ctx.fillStyle = '#F5C518'
    ctx.fillText(sub, pad, canvas.height - pad * 0.35)
  }

  return canvas.toDataURL('image/jpeg', 0.93)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
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
