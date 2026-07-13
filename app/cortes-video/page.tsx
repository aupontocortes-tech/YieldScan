import type { Metadata } from 'next'
import { CortesVideoPage } from '@/components/cortes-video/cortes-video-page'

export const metadata: Metadata = {
  title: 'Cortes de Vídeo com IA | YieldScan',
  description:
    'Edita vídeos para redes sociais: transcrição Whisper, legendas, cortes IA e exportação TikTok, Reels e Shorts.',
}

export default function CortesVideoRoutePage() {
  return <CortesVideoPage />
}
