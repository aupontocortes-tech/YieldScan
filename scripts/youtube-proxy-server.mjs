#!/usr/bin/env node
/**
 * Proxy YouTube para Cortes de Vídeo (correr num VPS / PC em casa).
 *
 * Porquê: na Vercel o YouTube bloqueia IPs de datacenter. Este processo
 * descarrega o vídeo do teu IP e o app YieldScan só fala contigo.
 *
 * Uso (na pasta do projecto):
 *   YOUTUBE_PROXY_SECRET=uma-frase-secreta npm run youtube-proxy
 *
 * Na Vercel (.env):
 *   YOUTUBE_PROXY_URL=http://TEU_IP:8787
 *   YOUTUBE_PROXY_SECRET=uma-frase-secreta
 *
 * Endpoints:
 *   GET  /health
 *   POST /download  { "url": "https://youtube.com/watch?v=…" }
 *        Header: Authorization: Bearer <YOUTUBE_PROXY_SECRET>
 */

import http from 'node:http'
import { createRequire } from 'node:module'
import { Readable } from 'node:stream'

const require = createRequire(import.meta.url)

const PORT = Number(process.env.PORT || process.env.YOUTUBE_PROXY_PORT || 8787)
const SECRET = (process.env.YOUTUBE_PROXY_SECRET || '').trim()
const MAX_BYTES = 450 * 1024 * 1024
const MAX_DURATION_SEC = 3 * 60 * 60
const DOWNLOAD_CLIENTS = ['ANDROID', 'IOS', 'TV', 'MWEB', 'WEB']

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])

function parseYouTubeVideoId(input) {
  const raw = String(input || '').trim()
  if (!raw) return null
  if (/^[\w-]{11}$/.test(raw)) return raw
  let url
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  if (!YOUTUBE_HOSTS.has(host) && !host.endsWith('.youtube.com')) return null
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0]
    return id && /^[\w-]{11}$/.test(id) ? id : null
  }
  const v = url.searchParams.get('v')
  if (v && /^[\w-]{11}$/.test(v)) return v
  const parts = url.pathname.split('/').filter(Boolean)
  const marker = parts.findIndex((p) => ['shorts', 'embed', 'live', 'v', 'watch'].includes(p))
  if (marker >= 0 && parts[marker] !== 'watch') {
    const id = parts[marker + 1]
    if (id && /^[\w-]{11}$/.test(id)) return id
  }
  return null
}

function sanitizeFilename(title, videoId) {
  const base = (title || `youtube-${videoId}`)
    .normalize('NFKD')
    .replace(/[^\w\s\-àáâãäåæçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ().]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return `${base || `youtube-${videoId}`}.mp4`
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function checkAuth(req) {
  if (!SECRET) return true
  const h = req.headers.authorization || ''
  const m = /^Bearer\s+(.+)$/i.exec(h)
  return Boolean(m && m[1].trim() === SECRET)
}

async function loadYoutubei() {
  // Prefer ESM package; fall back to require from project node_modules
  try {
    return await import('youtubei.js')
  } catch {
    return require('youtubei.js')
  }
}

async function downloadVideo(videoId) {
  const ytMod = await loadYoutubei()
  const { Innertube, Platform, UniversalCache } = ytMod

  Platform.shim.eval = async (data) => {
    // eslint-disable-next-line no-new-func
    return new Function(data.output)()
  }

  const yt = await Innertube.create({
    cache: new UniversalCache(false),
    generate_session_locally: true,
  })

  const errors = []
  let title = `youtube-${videoId}`
  let duration = 0

  for (const client of DOWNLOAD_CLIENTS) {
    try {
      const info = await yt.getBasicInfo(videoId, { client })
      const basic = info.basic_info
      title = (basic?.title || title).trim()
      duration = Number(basic?.duration) || duration

      const playability = info.playability_status
      if (playability?.status && playability.status !== 'OK') {
        errors.push(`${client}: ${playability.reason || playability.status}`)
        continue
      }
      if (basic?.is_live) {
        return { ok: false, status: 400, error: 'Lives em directo não são suportadas.' }
      }
      if (duration > MAX_DURATION_SEC) {
        return {
          ok: false,
          status: 400,
          error: `Vídeo demasiado longo (${Math.round(duration / 60)} min).`,
        }
      }

      for (const quality of ['best', '360p']) {
        try {
          const webStream = await yt.download(videoId, {
            client,
            type: 'video+audio',
            quality,
          })
          return {
            ok: true,
            webStream,
            title,
            duration,
            filename: sanitizeFilename(title, videoId),
          }
        } catch (dlErr) {
          errors.push(`${client}/${quality}: ${dlErr?.message || dlErr}`)
        }
      }
    } catch (infoErr) {
      errors.push(`${client}/info: ${infoErr?.message || infoErr}`)
    }
  }

  return {
    ok: false,
    status: 502,
    error: 'Não foi possível importar do YouTube neste proxy.',
    detail: errors.slice(-3).join(' | '),
  }
}

/** Pipe Web ReadableStream → Node res, com limite de tamanho. */
async function pipeLimited(webStream, res, maxBytes) {
  const nodeReadable = Readable.fromWeb(webStream)
  let total = 0

  return new Promise((resolve, reject) => {
    nodeReadable.on('data', (chunk) => {
      total += chunk.length
      if (total > maxBytes) {
        nodeReadable.destroy()
        reject(new Error(`Ficheiro demasiado grande (>${Math.round(maxBytes / (1024 * 1024))} MB).`))
        return
      }
      const ok = res.write(chunk)
      if (!ok) nodeReadable.pause()
    })
    res.on('drain', () => nodeReadable.resume())
    nodeReadable.on('end', () => {
      res.end()
      resolve()
    })
    nodeReadable.on('error', reject)
    res.on('close', () => {
      nodeReadable.destroy()
    })
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    sendJson(res, 200, {
      ok: true,
      service: 'yieldscan-youtube-proxy',
      authRequired: Boolean(SECRET),
    })
    return
  }

  if (req.method === 'POST' && url.pathname === '/download') {
    if (!checkAuth(req)) {
      sendJson(res, 401, { error: 'Não autorizado. Envia Authorization: Bearer <secret>.' })
      return
    }

    let body
    try {
      body = await readJson(req)
    } catch {
      sendJson(res, 400, { error: 'JSON inválido.' })
      return
    }

    const youtubeUrl = typeof body.url === 'string' ? body.url.trim() : ''
    const videoId = parseYouTubeVideoId(youtubeUrl)
    if (!videoId) {
      sendJson(res, 400, { error: 'URL do YouTube inválida.' })
      return
    }

    console.log('[youtube-proxy] download', videoId)
    try {
      const result = await downloadVideo(videoId)
      if (!result.ok) {
        console.error('[youtube-proxy] fail', videoId, result.detail || result.error)
        sendJson(res, result.status || 502, {
          error: result.error,
          hint: 'Tenta outro vídeo ou faz upload manual do MP4 no app.',
          detail: result.detail,
        })
        return
      }

      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
        'X-Video-Title': encodeURIComponent(result.title),
        'X-Video-Id': videoId,
        'X-Video-Duration': String(result.duration || 0),
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-store',
      })

      await pipeLimited(result.webStream, res, MAX_BYTES)
      console.log('[youtube-proxy] ok', videoId, result.title)
    } catch (err) {
      const message = err?.message || String(err)
      console.error('[youtube-proxy] error', videoId, message)
      if (!res.headersSent) {
        sendJson(res, 502, {
          error: message,
          hint: 'Proxy falhou a descarregar. Confirma o link e tenta de novo.',
        })
      } else {
        res.destroy()
      }
    }
    return
  }

  sendJson(res, 404, { error: 'Not found. Use GET /health ou POST /download.' })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[youtube-proxy] a escuta em http://0.0.0.0:${PORT}`)
  if (!SECRET) {
    console.warn('[youtube-proxy] AVISO: YOUTUBE_PROXY_SECRET não definido — qualquer um pode usar o proxy.')
  } else {
    console.log('[youtube-proxy] auth Bearer activo')
  }
})
