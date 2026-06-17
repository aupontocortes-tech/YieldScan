import type { GfCategoryType } from '@/lib/gestao-financeira/types'

export const DEFAULT_GF_CATEGORIES: { name: string; type: GfCategoryType; icon: string }[] = [
  { name: 'Salário', type: 'income', icon: '💼' },
  { name: 'Freelance', type: 'income', icon: '💻' },
  { name: 'Mercado', type: 'expense', icon: '🛒' },
  { name: 'Alimentação', type: 'expense', icon: '🍽️' },
  { name: 'Combustível', type: 'expense', icon: '⛽' },
  { name: 'Transporte', type: 'expense', icon: '🚌' },
  { name: 'Moradia', type: 'expense', icon: '🏠' },
  { name: 'Internet', type: 'expense', icon: '📶' },
  { name: 'Água', type: 'expense', icon: '💧' },
  { name: 'Energia', type: 'expense', icon: '⚡' },
  { name: 'Saúde', type: 'expense', icon: '🏥' },
  { name: 'Educação', type: 'expense', icon: '📚' },
  { name: 'Lazer', type: 'expense', icon: '🎮' },
  { name: 'Investimentos', type: 'both', icon: '📈' },
  { name: 'Criptomoedas', type: 'both', icon: '₿' },
  { name: 'Outros', type: 'both', icon: '📌' },
]

export const DEFAULT_GF_CASH_BOXES: { name: string; note: string }[] = [
  { name: 'Caixa Principal', note: 'Despesas e receitas do dia a dia' },
  { name: 'Reserva de Emergência', note: 'Segurança financeira' },
  { name: 'Caixa de Trade', note: 'Operações de curto prazo' },
  { name: 'Caixa de Oportunidades', note: 'Capital para oportunidades' },
  { name: 'Caixa de Investimentos', note: 'Aportes em investimentos' },
  { name: 'Caixa Longo Prazo', note: 'Patrimônio de longo prazo' },
  { name: 'Caixa Viagem', note: 'Reservas para viagens' },
]

export const DEFAULT_GF_CRYPTO_WALLETS: { name: string; walletType: string }[] = [
  { name: 'Hold', walletType: 'hold' },
  { name: 'Trade', walletType: 'trade' },
  { name: 'Longo Prazo', walletType: 'long_term' },
  { name: 'Altcoins', walletType: 'altcoins' },
  { name: 'Experimental', walletType: 'experimental' },
]

export const GF_DEFAULT_CRYPTO_IDS = [
  'bitcoin',
  'ethereum',
  'solana',
  'ripple',
  'binancecoin',
  'sui',
  'tether',
  'usd-coin',
] as const
