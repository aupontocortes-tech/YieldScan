'use client'

export type AudioExtractProgress = (ratio: number) => void

/**
 * Extrai áudio do intervalo sem meter o MP4 inteiro no FFmpeg.wasm
 * (ficheiross grandes no WASM demoram dezenas de minutos / horas).
 * Corre aproximadamente em tempo real = duração do trecho.
 */
export async function extractAudioFromVideoUrl(
  objectUrl: string,
  range: { start: number; end: number },
  onProgress?: AudioExtractProgress,
): Promise<Blob> {
  const start = Math.max(0, range.start)
  const end = Math.max(start + 0.15, range.end)
  const duration = end - start

  const video = document.createElement('video')
  video.playsInline = true
  video.preload = 'auto'
  video.controls = false
  video.src = objectUrl
  video.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none'
  document.body.appendChild(video)

  const cleanupVideo = () => {
    try {
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.remove()
    } catch {
      /* ignore */
    }
  }

  try {
    await new Promise<void>((resolve, reject) => {
      if (video.readyState >= 1) {
        resolve()
        return
      }
      const ok = () => {
        video.removeEventListener('loadedmetadata', ok)
        resolve()
      }
      video.addEventListener('loadedmetadata', ok)
      video.onerror = () => reject(new Error('Não foi possível ler o vídeo para extrair áudio.'))
      setTimeout(() => reject(new Error('Timeout ao carregar metadados do vídeo.')), 30_000)
    })

    await seekVideo(video, start)

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) throw new Error('BROWSER_AUDIO_EXTRACT_UNSUPPORTED')

    const ctx = new AudioCtx()
    const source = ctx.createMediaElementSource(video)
    const dest = ctx.createMediaStreamDestination()
    const gain = ctx.createGain()
    // Silencia altifalantes mas mantém sinal para o MediaRecorder
    gain.gain.value = 0
    source.connect(dest)
    source.connect(gain)
    gain.connect(ctx.destination)

    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => undefined)
    }

    const mime = pickRecorderMime()
    const chunks: Blob[] = []
    const recorder = new MediaRecorder(dest.stream, {
      ...(mime ? { mimeType: mime } : {}),
      audioBitsPerSecond: 96_000,
    })

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    const stopped = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const type = mime || chunks[0]?.type || 'audio/webm'
        resolve(new Blob(chunks, { type }))
      }
      recorder.onerror = () => reject(new Error('Falha ao gravar o áudio do trecho.'))
    })

    recorder.start(400)
    video.muted = false
    video.volume = 1
    await video.play()

    await new Promise<void>((resolve, reject) => {
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        window.clearInterval(poll)
        window.clearTimeout(safety)
        try {
          video.pause()
        } catch {
          /* ignore */
        }
        if (recorder.state !== 'inactive') {
          try {
            recorder.requestData()
          } catch {
            /* ignore */
          }
          recorder.stop()
        }
        resolve()
      }

      const poll = window.setInterval(() => {
        const t = video.currentTime
        const ratio = Math.min(0.99, Math.max(0, (t - start) / duration))
        onProgress?.(ratio)
        if (t >= end - 0.05 || video.ended) finish()
      }, 200)

      const onEnded = () => finish()
      video.addEventListener('ended', onEnded)

      const safety = window.setTimeout(
        () => {
          video.removeEventListener('ended', onEnded)
          finish()
        },
        Math.ceil(duration * 1000) + 20_000,
      )

      // Also reject if play never advances
      window.setTimeout(() => {
        if (!finished && video.currentTime < start + 0.2 && recorder.state === 'recording') {
          window.clearInterval(poll)
          reject(new Error('A extracção de áudio não avançou (codec/browser).'))
        }
      }, 12_000)
    })

    const blob = await stopped
    await ctx.close().catch(() => undefined)
    onProgress?.(1)

    if (!blob.size) {
      throw new Error('Áudio extraído vazio — tenta outro trecho ou browser.')
    }
    return blob
  } finally {
    cleanupVideo()
  }
}

function pickRecorderMime(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
  }
  return undefined
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('seeked', done)
      resolve()
    }
    video.addEventListener('seeked', done)
    try {
      video.currentTime = time
    } catch {
      resolve()
      return
    }
    window.setTimeout(done, 2500)
  })
}

/** Ficheiros grandes no FFmpeg.wasm são o gargalo — preferir extracção nativa. */
export function shouldPreferNativeAudioExtract(fileSizeBytes: number): boolean {
  return fileSizeBytes >= 40 * 1024 * 1024
}
