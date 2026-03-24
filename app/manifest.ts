import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'YieldScan — DeFi Intelligence',
    short_name: 'YieldScan',
    description:
      'Agregador DeFi em tempo real: APR de pools, TVL e oportunidades em varias chains.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'browser'],
    orientation: 'portrait-primary',
    background_color: '#07090f',
    theme_color: '#07090f',
    categories: ['finance', 'productivity'],
    lang: 'pt-BR',
    dir: 'ltr',
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
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
