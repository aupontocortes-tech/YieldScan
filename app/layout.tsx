import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from '@/components/providers'
import './globals.css'

const geist = Geist({ 
  subsets: ['latin'],
  variable: '--font-geist',
})

function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000'
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw.replace(/^\/+/, '')}`
}

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'YieldScan - DeFi Intelligence Dashboard',
  description:
    'Agregador DeFi em tempo real. Compare APR de pools de liquidez, TVL e oportunidades em varias chains.',
  keywords: ['DeFi', 'yield farming', 'APR', 'liquidez', 'TVL', 'crypto', 'Ethereum', 'Solana'],
  applicationName: 'YieldScan',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'YieldScan',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#050505',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${geist.variable} font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
