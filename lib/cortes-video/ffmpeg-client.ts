'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { CaptionStyle, ReframeSettings, TimelineClip } from '@/lib/cortes-video/types'
import type { ExportProfile } from '@/lib/cortes-video/platforms'

let ffmpegSingleton: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

export type FfmpegProgressCb = (ratio: number) => void

async function getFfmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegSingleton?.loaded) return ffmpegSingleton
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg()
    if (onLog) {
      ffmpeg.on('log', ({ message }) => onLog(message))
    }
    const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd'
    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    ffmpegSingleton = ffmpeg
    return ffmpeg
  })()

  try {
    return await loadPromise
  } catch (e) {
    loadPromise = null
    throw e
  }
}

export async function ensureFfmpegLoaded(
  onProgress?: FfmpegProgressCb,
  onLog?: (msg: string) => void,
): Promise<void> {
  const ff = await getFfmpeg(onLog)
  if (onProgress) {
    ff.on('progress', ({ progress }) => onProgress(Math.min(1, Math.max(0, progress))))
  }
}

function cropScaleFilter(
  srcW: number,
  srcH: number,
  profile: ExportProfile,
  reframe: ReframeSettings,
): string {
  const targetAspect = profile.aspect
  const srcAspect = srcW / Math.max(1, srcH)
  let cropW: number
  let cropH: number
  if (srcAspect > targetAspect) {
    cropH = srcH / reframe.zoom
    cropW = cropH * targetAspect
  } else {
    cropW = srcW / reframe.zoom
    cropH = cropW / targetAspect
  }
  cropW = Math.min(srcW, Math.max(2, Math.floor(cropW / 2) * 2))
  cropH = Math.min(srcH, Math.max(2, Math.floor(cropH / 2) * 2))
  const maxX = Math.max(0, srcW - cropW)
  const maxY = Math.max(0, srcH - cropH)
  const cx = srcW / 2 + reframe.offsetX * (maxX / 2)
  const cy = srcH / 2 + reframe.offsetY * (maxY / 2)
  let x = Math.floor(cx - cropW / 2)
  let y = Math.floor(cy - cropH / 2)
  x = Math.max(0, Math.min(maxX, x))
  y = Math.max(0, Math.min(maxY, y))
  x = Math.floor(x / 2) * 2
  y = Math.floor(y / 2) * 2
  return `crop=${cropW}:${cropH}:${x}:${y},scale=${profile.width}:${profile.height}`
}

/** Extrai áudio MP3 para Whisper (≤25 MB ideal). Opcionalmente só um intervalo. */
export async function extractAudioMp3(
  videoFile: File,
  onProgress?: FfmpegProgressCb,
  range?: { start: number; end: number } | null,
): Promise<Blob> {
  const ff = await getFfmpeg()
  if (onProgress) {
    ff.on('progress', ({ progress }) => onProgress(Math.min(1, Math.max(0, progress))))
  }
  const inName = 'input_video'
  const outName = 'audio_out.mp3'

  // Progresso durante a cópia para o WASM (antes não havia % → ETA absurdo)
  onProgress?.(0.02)
  const bytes = await readFileInChunks(videoFile, (ratio) => {
    onProgress?.(0.02 + ratio * 0.35)
  })
  await ff.writeFile(inName, bytes)
  onProgress?.(0.4)

  const args: string[] = []
  if (range && range.end > range.start) {
    const start = Math.max(0, range.start)
    const dur = Math.max(0.1, range.end - range.start)
    // -ss ANTES de -i: seek rápido (não descodifica o vídeo inteiro)
    args.push('-ss', String(start), '-t', String(dur))
  }
  args.push('-i', inName, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', '-y', outName)

  await ff.exec(args)
  const data = await ff.readFile(outName)
  await ff.deleteFile(inName).catch(() => undefined)
  await ff.deleteFile(outName).catch(() => undefined)
  const out = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
  onProgress?.(1)
  return new Blob([Uint8Array.from(out)], { type: 'audio/mpeg' })
}

async function readFileInChunks(
  file: File,
  onRatio?: (ratio: number) => void,
): Promise<Uint8Array> {
  const total = file.size
  if (total <= 8 * 1024 * 1024) {
    onRatio?.(1)
    return new Uint8Array(await file.arrayBuffer())
  }
  const buf = new Uint8Array(total)
  const chunkSize = 4 * 1024 * 1024
  let offset = 0
  while (offset < total) {
    const end = Math.min(total, offset + chunkSize)
    const chunk = new Uint8Array(await file.slice(offset, end).arrayBuffer())
    buf.set(chunk, offset)
    offset = end
    onRatio?.(offset / total)
  }
  return buf
}

/** Exporta timeline (clips) para o perfil, com crop/scale. */
export async function exportEditedVideo(opts: {
  videoFile: File
  clips: TimelineClip[]
  profile: ExportProfile
  reframe: ReframeSettings
  srcWidth: number
  srcHeight: number
  burnSrt?: string | null
  onProgress?: FfmpegProgressCb
}): Promise<Blob> {
  const {
    videoFile,
    clips,
    profile,
    reframe,
    srcWidth,
    srcHeight,
    burnSrt,
    onProgress,
  } = opts
  if (!clips.length) throw new Error('Nenhum clip na timeline.')

  const ff = await getFfmpeg()
  if (onProgress) {
    ff.on('progress', ({ progress }) => onProgress(Math.min(1, Math.max(0, progress))))
  }

  const inName = 'src.mp4'
  await ff.writeFile(inName, await fetchFile(videoFile))

  const vf = cropScaleFilter(srcWidth, srcHeight, profile, reframe)
  const partNames: string[] = []

  for (let i = 0; i < clips.length; i++) {
    const c = clips[i]!
    const part = `part_${i}.mp4`
    const dur = Math.max(0.05, c.sourceEnd - c.sourceStart)
    await ff.exec([
      '-ss',
      String(c.sourceStart),
      '-i',
      inName,
      '-t',
      String(dur),
      '-vf',
      vf,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      part,
    ])
    partNames.push(part)
  }

  let outName = 'export_out.mp4'
  if (partNames.length === 1) {
    outName = partNames[0]!
  } else {
    const listBody = partNames.map((n) => `file '${n}'`).join('\n')
    await ff.writeFile('concat.txt', listBody)
    await ff.exec([
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      'concat.txt',
      '-c',
      'copy',
      outName,
    ])
  }

  if (burnSrt?.trim()) {
    await ff.writeFile('subs.srt', burnSrt)
    const burned = 'burned.mp4'
    // Nota: subtitles filter pode falhar em builds mínimos; fallback = ficheiro sem burn-in
    try {
      await ff.exec([
        '-i',
        outName,
        '-vf',
        `subtitles=subs.srt:force_style='Fontsize=22,PrimaryColour=&H00FFFFFF,Outline=1'`,
        '-c:a',
        'copy',
        burned,
      ])
      outName = burned
    } catch {
      /* keep without burn-in */
    }
  }

  const data = await ff.readFile(outName)
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))

  for (const n of [...partNames, inName, 'concat.txt', 'subs.srt', 'burned.mp4', 'export_out.mp4']) {
    await ff.deleteFile(n).catch(() => undefined)
  }

  return new Blob([Uint8Array.from(bytes)], { type: 'video/mp4' })
}

export function captionCss(style: CaptionStyle): Record<string, string | number | undefined> {
  const pos =
    style.position === 'top'
      ? { top: '8%', bottom: 'auto', transform: undefined }
      : style.position === 'center'
        ? { top: '50%', bottom: 'auto', transform: 'translateY(-50%)' }
        : { bottom: '10%', top: 'auto', transform: undefined }
  return {
    ...pos,
    left: '5%',
    right: '5%',
    textAlign: 'center',
    fontFamily: style.fontFamily,
    color: style.color,
    fontSize: style.fontSize,
    fontWeight: 700,
    textShadow: style.shadow ? '0 2px 8px rgba(0,0,0,0.85), 0 0 2px #000' : undefined,
    pointerEvents: 'none',
    position: 'absolute',
    lineHeight: 1.25,
  }
}
