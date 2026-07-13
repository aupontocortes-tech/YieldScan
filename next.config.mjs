import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  /** Evita erro no Windows: Turbopack a assumir `app/` como raiz e não achar `next`. */
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: [
    '@orca-so/whirlpools',
    '@orca-so/whirlpools-client',
    '@orca-so/whirlpools-core',
    '@orca-so/tx-sender',
    '@solana/kit',
    'youtubei.js',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    /** Sem CSP global: o Next/React e integrações (Llama, Meteora, ícones) usam muitas origens; CSP fácil de quebrar o build. */
    return [
      {
        source: '/cortes-video',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), interest-cohort=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ]
  },
}

export default nextConfig
