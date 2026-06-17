export type GfTransactionType = 'income' | 'expense' | 'transfer'

export type GfCategoryType = 'income' | 'expense' | 'both'

export type GfDebtStatus = 'active' | 'paid' | 'overdue'

export type GfCryptoWalletType = 'hold' | 'trade' | 'long_term' | 'altcoins' | 'experimental'

export type GfCategory = {
  id: string
  name: string
  type: GfCategoryType
  icon: string | null
  isDefault: boolean
  createdAt: string
}

export type GfCashBox = {
  id: string
  name: string
  balance: number
  goal: number | null
  note: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type GfTransaction = {
  id: string
  type: GfTransactionType
  amount: number
  categoryId: string | null
  cashBoxId: string
  toCashBoxId: string | null
  description: string | null
  occurredAt: string
  createdAt: string
}

export type GfDebt = {
  id: string
  name: string
  totalAmount: number
  paidAmount: number
  installments: number | null
  paidInstallments: number
  dueDate: string | null
  status: GfDebtStatus
  createdAt: string
  updatedAt: string
}

export type GfCryptoWallet = {
  id: string
  name: string
  walletType: GfCryptoWalletType
  createdAt: string
}

export type GfCryptoHolding = {
  id: string
  walletId: string
  coinId: string
  symbol: string
  quantity: number
  avgPriceUsd: number
  createdAt: string
  updatedAt: string
}

export type GfInvestment = {
  id: string
  name: string
  amountInvested: number
  currentValue: number | null
  investmentType: string | null
  createdAt: string
  updatedAt: string
}

export type GfPatrimonySnapshot = {
  id: string
  totalAssets: number
  netWorth: number
  cashTotal: number
  investmentsTotal: number
  cryptoTotal: number
  debtsTotal: number
  recordedAt: string
}

export type GfDashboardStats = {
  totalPatrimony: number
  netWorth: number
  cashBalance: number
  monthIncome: number
  monthExpense: number
  monthSavings: number
  pendingDebts: number
  totalInvested: number
  totalCrypto: number
}

export type GfParsedVoiceEntry = {
  type: GfTransactionType
  amount: number
  categoryName: string | null
  /** Caixa de origem (despesa/transferência) ou destino (receita). */
  cashBoxName: string | null
  /** Caixa de destino em transferências. */
  toCashBoxName: string | null
  description: string
  occurredAt: string
  confidence: 'high' | 'medium' | 'low'
  /** Resumo legível para confirmação na UI. */
  summary: string
}

export type GfBackupPayload = {
  version: number
  exportedAt: string
  categories: GfCategory[]
  cashBoxes: GfCashBox[]
  transactions: GfTransaction[]
  debts: GfDebt[]
  cryptoWallets: GfCryptoWallet[]
  cryptoHoldings: GfCryptoHolding[]
  investments: GfInvestment[]
  patrimonySnapshots: GfPatrimonySnapshot[]
}
