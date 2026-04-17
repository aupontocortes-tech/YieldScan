import type { Metadata } from 'next'
import { RebalanceProPage } from '@/components/rebalance-pro/rebalance-pro-page'

export const metadata: Metadata = {
  title: 'Rebalance Pro · YieldScan',
  description:
    'Assistente simples para liquidez concentrada: par em duas moedas, faixa de preço e sugestão clara — rebalancear, esperar ou um token só. CoinGecko.',
}

export default function RebalanceProRoute() {
  return <RebalanceProPage />
}
