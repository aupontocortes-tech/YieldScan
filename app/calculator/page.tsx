import type { Metadata } from 'next'
import { CryptoCalculator } from '@/components/calculator/crypto-calculator'

export const metadata: Metadata = {
  title: 'Crypto Calculator | YieldScan',
  description:
    'Converta Bitcoin, Ethereum, Solana e USDT para USD ou BRL em tempo real com preços CoinGecko.',
}

export default function CalculatorPage() {
  return <CryptoCalculator />
}
