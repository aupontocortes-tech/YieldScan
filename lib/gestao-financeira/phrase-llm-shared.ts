import type { GfParsedDebtEntry, GfParsedTodoAction, GfParsedTodoEntry, GfPhraseParseResult } from '@/lib/gestao-financeira/types'
import { entryFromApi, GF_OPENAI_MODEL } from '@/lib/gestao-financeira/voice-llm-shared'
import { todosFromApi } from '@/lib/gestao-financeira/todos-llm-shared'

export { GF_OPENAI_MODEL }

export function buildGfPhraseSystemPrompt(): string {
  return `És assistente de gestão financeira pessoal em português (Brasil).
Analisa a frase e responde SOMENTE com JSON válido (sem markdown).

Intents (campo "intent"):
- "transaction": receita, despesa ou transferência entre caixas (gastei, ganhei, guardei, transferi…)
- "balance": consulta de saldo em caixa ou cripto
- "todos": novos lembretes / afazeres com data (amanhã dentista, sexta pagar luz…)
- "debt": nova dívida ou empréstimo com valor total
- "report": resumo de receitas/despesas/economia do período
- "todo_action": alterar afazer existente (concluir, voltar pendente, remarcar data)

JSON:
{
  "intent": "transaction" | "balance" | "todos" | "debt" | "report" | "todo_action",
  "type": "income" | "expense" | "transfer" | null,
  "amount": number | null,
  "categoryName": string | null,
  "cashBoxName": string | null,
  "toCashBoxName": string | null,
  "description": string | null,
  "occurredAt": string ISO | null,
  "summary": string | null,
  "answer": string | null,
  "items": [ { "title", "notes", "dueDate", "dueTime", "priority", "summary" } ] | null,
  "debt": { "name", "totalAmount", "dueDate", "installments" } | null,
  "todoAction": {
    "action": "complete" | "pending" | "reschedule",
    "titleMatch": "texto para achar o afazer",
    "dueDate": "YYYY-MM-DD" | null,
    "dueTime": "HH:mm" | null,
    "summary": string
  } | null
}

Regras:
- Escolha UM intent principal. Se a frase misturar assuntos, priorize movimentação com valor > afazer > dívida > relatório.
- Para todo_action: use existingTodos do contexto; titleMatch deve bater com parte do título.
- reschedule: preencha dueDate/dueTime; action pending = desmarcar concluído.
- Para todos: pode haver vários items numa frase.
- Para debt: totalAmount obrigatório; name curto (ex.: "Carro", "Cartão").
- Para report: answer em português com números do contexto (monthIncome, monthExpense…).
- Caixas: use nomes exactos do contexto quando possível.
- todayIso do contexto é a referência de datas.`
}

function debtFromApi(raw: Record<string, unknown>): GfParsedDebtEntry | null {
  const debt = raw.debt
  if (!debt || typeof debt !== 'object') return null
  const row = debt as Record<string, unknown>
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  const totalAmount = Number(row.totalAmount)
  if (!name || !Number.isFinite(totalAmount) || totalAmount <= 0) return null
  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : `Dívida ${name}`
  return {
    name,
    totalAmount,
    dueDate: typeof row.dueDate === 'string' ? row.dueDate.slice(0, 10) : null,
    installments: typeof row.installments === 'number' ? row.installments : null,
    summary,
  }
}

function todoActionFromApi(raw: Record<string, unknown>): GfParsedTodoAction | null {
  const ta = raw.todoAction
  if (!ta || typeof ta !== 'object') return null
  const row = ta as Record<string, unknown>
  const action = row.action
  if (action !== 'complete' && action !== 'pending' && action !== 'reschedule') return null
  const titleMatch = typeof row.titleMatch === 'string' ? row.titleMatch.trim() : ''
  if (!titleMatch) return null
  const summary = typeof row.summary === 'string' ? row.summary.trim() : titleMatch
  return {
    action,
    titleMatch,
    dueDate: typeof row.dueDate === 'string' ? row.dueDate.slice(0, 10) : undefined,
    dueTime: typeof row.dueTime === 'string' ? row.dueTime : null,
    summary,
  }
}

export function phraseResultFromApi(parsed: Record<string, unknown>, todayIso: string): GfPhraseParseResult | null {
  const intent = parsed.intent

  if (intent === 'balance') {
    const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : ''
    if (answer) return { kind: 'balance', answer, source: 'openai' }
  }

  if (intent === 'report') {
    const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : ''
    if (answer) return { kind: 'report', answer, source: 'openai' }
  }

  if (intent === 'todos') {
    const items = todosFromApi(parsed, todayIso)
    if (items.length) return { kind: 'todos', items, source: 'openai' }
  }

  if (intent === 'debt') {
    const entry = debtFromApi(parsed)
    if (entry) return { kind: 'debt', entry, source: 'openai' }
  }

  if (intent === 'todo_action') {
    const action = todoActionFromApi(parsed)
    if (action) return { kind: 'todo_action', action, source: 'openai' }
  }

  if (intent === 'transaction' || intent == null) {
    const entry = entryFromApi(parsed)
    if (entry) {
      if (!entry.occurredAt) entry.occurredAt = todayIso
      return { kind: 'transaction', entry, source: 'openai' }
    }
  }

  return null
}
