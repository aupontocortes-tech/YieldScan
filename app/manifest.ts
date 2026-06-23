import type { MetadataRoute } from 'next'

function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000'
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, '')
  return `https://${raw.replace(/^\/+/, '')}`
}

export default function manifest(): MetadataRoute.Manifest {
  const origin = getSiteUrl()
  return {
    id: `${origin}/`,
    name: 'YieldScan DeFi',
    short_name: 'YieldScan',
    description:
      'Agregador DeFi em tempo real: APR de pools, TVL e oportunidades em varias chains.',
    start_url: `${origin}/`,
    scope: `${origin}/`,
    display: 'standalone',
    /** Permite rodar o telemóvel sem o PWA fechar ou forçar retrato. */
    orientation: 'any',
    background_color: '#07090f',
    theme_color: '#07090f',
    categories: ['finance', 'productivity'],
    lang: 'pt-BR',
    dir: 'ltr',
    prefer_related_applications: false,
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
