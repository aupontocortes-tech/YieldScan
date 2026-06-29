export type GfTransactionType = 'income' | 'expense' | 'transfer'

export type GfCategoryType = 'income' | 'expense' | 'both'

export type GfDebtStatus = 'active' | 'paid' | 'overdue'

export type GfCryptoWalletType =
  | 'hold'
  | 'trade'
  | 'long_term'
  | 'altcoins'
  | 'experimental'
  | 'portfolio'

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

/** Preset de relatório ou intervalo livre entre duas datas. */
export type GfPeriodPreset = 'week' | 'month' | 'quarter' | 'custom'

export type GfDateRange = {
  start: Date
  /** Fim exclusivo (meia-noite do dia seguinte ao último dia incluído). */
  end: Date
}

export type GfPeriodSummary = {
  income: number
  expense: number
  savings: number
  transactionCount: number
  label: string
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

/** Resultado da interpretação de frase (local ou OpenAI). */
export type GfVoiceParseResult =
  | {
      kind: 'transaction'
      entry: GfParsedVoiceEntry
      source: 'local' | 'openai'
    }
  | {
      kind: 'balance'
      answer: string
      source: 'local' | 'openai'
    }

export type GfOpenAiSettings = {
  /** Chave guardada só neste dispositivo (localStorage). */
  apiKey: string
  enabled: boolean
  /** Orçamento mensal estimado em USD (controlo de gastos). */
  monthlyBudgetUsd: number
  /** Máximo de chamadas por dia. */
  maxCallsPerDay: number
}

export type GfOpenAiUsageRecord = {
  id: string
  at: string
  feature: 'parse-voice' | 'transcribe' | 'parse-todos' | 'parse-phrase'
  model: string
  promptTokens: number
  completionTokens: number
  estimatedUsd: number
}

export type GfOpenAiUsageSummary = {
  totalCalls: number
  callsToday: number
  monthEstimatedUsd: number
  monthEstimatedBrl: number
  todayEstimatedUsd: number
  todayEstimatedBrl: number
  avgCallCostUsdToday: number
  avgCallCostBrlToday: number
  monthPromptTokens: number
  monthCompletionTokens: number
  remainingCallsToday: number
  remainingBudgetUsd: number
  remainingBudgetBrl: number
  records: GfOpenAiUsageRecord[]
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
  todos?: GfTodo[]
}

export type GfTodoPriority = 'low' | 'normal' | 'high'

export type GfTodo = {
  id: string
  title: string
  notes: string | null
  /** Data alvo YYYY-MM-DD (fuso local). */
  dueDate: string
  /** Hora opcional HH:mm */
  dueTime: string | null
  completed: boolean
  completedAt: string | null
  priority: GfTodoPriority
  createdAt: string
  updatedAt: string
}

export type GfParsedTodoEntry = {
  title: string
  notes: string | null
  dueDate: string
  dueTime: string | null
  priority: GfTodoPriority
  summary: string
}

export type GfTodoParseResult = {
  items: GfParsedTodoEntry[]
  source: 'local' | 'openai'
}

export type GfParsedDebtEntry = {
  name: string
  totalAmount: number
  dueDate: string | null
  installments: number | null
  summary: string
}

export type GfTodoActionType = 'complete' | 'pending' | 'reschedule'

export type GfParsedTodoAction = {
  action: GfTodoActionType
  /** Texto para encontrar o afazer existente (título parcial). */
  titleMatch: string
  dueDate?: string
  dueTime?: string | null
  summary: string
}

/** Resultado unificado — a IA ou o router local escolhe o destino. */
export type GfPhraseParseResult =
  | GfVoiceParseResult
  | { kind: 'todos'; items: GfParsedTodoEntry[]; source: 'local' | 'openai' }
  | { kind: 'debt'; entry: GfParsedDebtEntry; source: 'local' | 'openai' }
  | { kind: 'report'; answer: string; source: 'local' | 'openai' }
  | { kind: 'todo_action'; action: GfParsedTodoAction; source: 'local' | 'openai' }
