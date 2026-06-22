import type { GfParsedVoiceEntry } from '@/lib/gestao-financeira/types'

export const GF_OPENAI_MODEL = 'gpt-4o-mini'

export function entryFromApi(raw: Record<string, unknown>): GfParsedVoiceEntry | null {
  const type = raw.type
  const amount = Number(raw.amount)
  if (type !== 'income' && type !== 'expense' && type !== 'transfer') return null
  if (!Number.isFinite(amount) || amount <= 0) return null

  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : ''
  if (!summary) return null

  return {
    type,
    amount,
    categoryName: typeof raw.categoryName === 'string' ? raw.categoryName : null,
    cashBoxName: typeof raw.cashBoxName === 'string' ? raw.cashBoxName : null,
    toCashBoxName: typeof raw.toCashBoxName === 'string' ? raw.toCashBoxName : null,
    description: typeof raw.description === 'string' ? raw.description : summary,
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
