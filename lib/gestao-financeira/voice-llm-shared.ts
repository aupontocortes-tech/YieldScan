import type { GfParsedVoiceEntry } from '@/lib/gestao-financeira/types'
import { normalizeMoneyToken } from '@/lib/gestao-financeira/time-vs-amount'

export const GF_OPENAI_MODEL = 'gpt-4o-mini'

function parseApiAmount(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  if (typeof raw === 'string') {
    const token = raw.replace(/r\$\s*/gi, '').trim()
    const pt = normalizeMoneyToken(token)
    if (pt != null && pt > 0) return pt
    const n = Number(token.replace(',', '.'))
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

function buildApiSummary(
  type: GfParsedVoiceEntry['type'],
  amount: number,
  categoryName: string | null,
  description: string,
): string {
  const brl = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const cat = categoryName ? ` · ${categoryName}` : ''
  const desc = description && description !== categoryName ? ` · ${description}` : ''
  if (type === 'income') return `Receita ${brl}${cat} → Caixa Principal`
  if (type === 'transfer') return `Transferir ${brl}${desc}`
  return `Despesa ${brl}${cat}${desc}`
}

export function entryFromApi(raw: Record<string, unknown>): GfParsedVoiceEntry | null {
  const type = raw.type
  const amount = parseApiAmount(raw.amount)
  if (type !== 'income' && type !== 'expense' && type !== 'transfer') return null
  if (amount == null) return null

  const categoryName = typeof raw.categoryName === 'string' ? raw.categoryName.trim() || null : null
  const description =
    typeof raw.description === 'string' ? raw.description.trim() : categoryName ?? ''
  const summaryRaw = typeof raw.summary === 'string' ? raw.summary.trim() : ''
  const summary = summaryRaw || buildApiSummary(type, amount, categoryName, description)

  return {
    type,
    amount,
    categoryName,
    cashBoxName: typeof raw.cashBoxName === 'string' ? raw.cashBoxName : null,
    toCashBoxName: typeof raw.toCashBoxName === 'string' ? raw.toCashBoxName : null,
    description: description || summary,
    occurredAt: typeof raw.occurredAt === 'string' ? raw.occurredAt : new Date().toISOString(),
    confidence: 'high',
    summary,
  }
}

export function buildGfVoiceSystemPrompt(): string {
  return `És assistente de gestão financeira pessoal em português (Brasil).
Analisa a frase do utilizador e responde SOMENTE com JSON válido (sem markdown).

Intents:
- "transaction": registar receita, despesa ou transferência (gastei, ganhei, adicionei, transferi, guardei…)
- "balance": consulta de saldo (quanto tenho no caixa, quanto tenho de cripto, saldo…)

Campos JSON:
{
  "intent": "transaction" | "balance",
  "type": "income" | "expense" | "transfer" | null,
  "amount": number | null,
  "categoryName": string | null,
  "cashBoxName": string | null,
  "toCashBoxName": string | null,
  "description": string,
  "occurredAt": string ISO-8601 | null,
  "summary": string,
  "answer": string | null
}

Regras:
- Use os nomes exactos das caixas fornecidas no contexto quando possível.
- Para transferências: cashBoxName = origem, toCashBoxName = destino.
- Para receitas/despesas sem caixa explícita, use "Caixa Principal".
- Para consultas de saldo, preencha "answer" em português claro com valores do contexto.
- occurredAt: se não houver data na frase, use todayIso do contexto.
- summary: frase curta para confirmação (transacções) ou repetir answer (consultas).
- Valores monetários em reais (BRL) salvo indicação de USD em cripto.`
}
