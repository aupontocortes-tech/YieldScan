import { NextRequest, NextResponse } from 'next/server'

const MAX_BYTES = 5_000_000
const TIMEOUT_MS = 10_000

function isSafeRemoteImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const h = u.hostname.toLowerCase()
    if (h === 'localhost' || h.endsWith('.local')) return false
    if (
      /^127\./.test(h) ||
      /^10\./.test(h) ||
      /^192\.168\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}

/** Proxy de imagens de artigos (hotlink / referrer). */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')?.trim()
  if (!url || !isSafeRemoteImageUrl(url)) {
    return new NextResponse(null, { status: 400 })
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (compatible; YieldScan/1; +https://github.com/aupontocortes-tech/YieldScan)',
      },
    })
    clearTimeout(timer)

    if (!res.ok) {
      return new NextResponse(null, { status: 502 })
    }

    const contentType = (res.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? ''
    if (!contentType.startsWith('image/')) {
      return new NextResponse(null, { status: 415 })
    }

    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_BYTES) {
      return new NextResponse(null, { status: 413 })
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    })
  } catch {
    clearTimeout(timer)
    return new NextResponse(null, { status: 502 })
  }
}
