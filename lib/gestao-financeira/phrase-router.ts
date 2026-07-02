import { buildPeriodSummary, filterTransactionsByRange, resolvePeriodRange } from '@/lib/gestao-financeira/calculations'
import { tryLocalBalanceQuery, type GfParseVoiceContext } from '@/lib/gestao-financeira/parse-with-openai'
import { parseGfTodoActionText, parseGfTodosText } from '@/lib/gestao-financeira/todos-parser'
import { groupGfTodos } from '@/lib/gestao-financeira/todos-utils'
import type {
  GfParsedDebtEntry,
  GfPhraseParseResult,
  GfTodo,
  GfTransaction,
} from '@/lib/gestao-financeira/types'
import { parseGfVoiceText } from '@/lib/gestao-financeira/voice-parser'

export type GfPhraseRouteContext = GfParseVoiceContext & {
  existingTodos: GfTodo[]
  transactions: GfTransaction[]
  monthIncome: number
  monthExpense: number
  monthSavings: number
}

const TODO_HINT =
  /\b(amanh[ãa]|depois de amanh[ãa]|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|às\s+\d|lembrete|lembrar|preciso|tenho que|devo|marcar|reunião|reuniao|dentista|consulta|pagar\s+luz|ir ao|ligar para)\b/i
const DEBT_HINT = /\b(dívida|divida|empréstimo|emprestimo|financiamento|parcela do|devo ao|devo para)\b/i
const REPORT_HINT =
  /\b(relatório|relatorio|quanto\s+gastei|quanto\s+recebi|quanto\s+economizei|resumo\s+do\s+m[eê]s|resumo\s+da\s+semana|balanço|balanco)\b/i
const TODO_QUERY_HINT =
  /\b(o\s+que|quais?).{0,24}(afazer|tarefa|pendente|falta\s+fazer)|\bafazeres?\s+(de\s+)?hoje\b|\btenho\s+pra\s+hoje\b/i

function tryLocalTodosQuery(text: string, ctx: GfPhraseRouteContext): GfPhraseParseResult | null {
  if (!TODO_QUERY_HINT.test(text)) return null
  const groups = groupGfTodos(ctx.existingTodos, new Date(ctx.todayIso))
  const overdue = groups.find((g) => g.key === 'overdue')?.items ?? []
  const today = groups.find((g) => g.key === 'today')?.items ?? []
  const pending = [...overdue, ...today]

  if (pending.length === 0) {
    return {
      kind: 'todo_query',
      answer: 'Não há afazeres urgentes para hoje. Aproveite para planear a semana.',
      source: 'local',
    }
  }

  const list = pending.slice(0, 5).map((t) => t.title).join(', ')
  const extra = pending.length > 5 ? ` e mais ${pending.length - 5}.` : '.'
  let intro = 'Para hoje você tem: '
  if (overdue.length > 0) {
    intro = `Tem ${overdue.length} atrasado${overdue.length > 1 ? 's' : ''}`
    if (today.length > 0) intro += ` e ${today.length} para hoje`
    intro += ': '
  }

  return {
    kind: 'todo_query',
    answer: `${intro}${list}${extra}`,
    source: 'local',
  }
}

function parseAmountLocal(text: string): number | null {
  const normalized = text
    .toLowerCase()
    .replace(/r\$\s*/g, '')
    .replace(/\s+/g, ' ')
  const match = normalized.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/)
  if (!match) return null
  let raw = match[1]!
  if (raw.includes('.') && raw.includes(',')) raw = raw.replace(/\./g, '').replace(',', '.')
  else if (raw.includes(',')) raw = raw.replace(',', '.')
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseGfDebtText(text: string): GfParsedDebtEntry | null {
  if (!DEBT_HINT.test(text)) return null
  const amount = parseAmountLocal(text)
  if (!amount) return null
  let name = text
    .replace(/\b(nova|novo|criar|registrar|dívida|divida|empréstimo|emprestimo|financiamento|de|do|da)\b/gi, '')
    .replace(/r\$\s*[\d.,]+/gi, '')
    .replace(/\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 80)
  if (!name) name = 'Dívida'
  return {
    name,
    totalAmount: amount,
    dueDate: null,
    installments: null,
    summary: `Dívida «${name}» — R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
  }
}

function tryLocalReportQuery(text: string, ctx: GfPhraseRouteContext): GfPhraseParseResult | null {
  if (!REPORT_HINT.test(text)) return null
  const t = text.toLowerCase()
  const now = new Date(ctx.todayIso)
  const preset = /\b(hoje|di[aá]rio|neste dia)\b/.test(t)
    ? 'day'
    : /\b(semana|semanal)\b/.test(t)
      ? 'week'
      : /\b(trimestre)\b/.test(t)
        ? 'quarter'
        : 'month'
  const range = resolvePeriodRange(preset, now)
  const filtered = filterTransactionsByRange(ctx.transactions, range)
  const summary = buildPeriodSummary(filtered, preset, range)

  const wantsIncome = /\b(recebi|receita|entrada)\b/.test(t)
  const wantsExpense = /\b(gastei|despesa|gasto)\b/.test(t)
  const wantsSavings = /\b(economizei|poupei|guardou)\b/.test(t)

  if (wantsIncome && !wantsExpense) {
    return {
      kind: 'report',
      answer: `${summary.label}: receitas R$ ${summary.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${summary.transactionCount} movimentos).`,
      source: 'local',
    }
  }
  if (wantsExpense && !wantsIncome) {
    return {
      kind: 'report',
      answer: `${summary.label}: despesas R$ ${summary.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${summary.transactionCount} movimentos).`,
      source: 'local',
    }
  }
  if (wantsSavings) {
    return {
      kind: 'report',
      answer: `${summary.label}: economia R$ ${summary.savings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      source: 'local',
    }
  }

  return {
    kind: 'report',
    answer: `${summary.label}: receitas R$ ${summary.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · despesas R$ ${summary.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · economia R$ ${summary.savings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
    source: 'local',
  }
}

function looksLikeNewTodo(text: string): boolean {
  if (TODO_HINT.test(text)) return true
  if (/\b(pagar|ir|ligar|comprar|enviar|buscar|levar)\b/i.test(text) && /\b(amanh|segunda|terça|quarta|quinta|sexta|hoje)\b/i.test(text)) {
    return true
  }
  return false
}

/** Router local — tenta classificar antes da OpenAI. */
export function routeGfPhraseLocally(text: string, ctx: GfPhraseRouteContext): GfPhraseParseResult | null {
  const phrase = text.trim()
  if (!phrase) return null

  const todoAction = parseGfTodoActionText(phrase, ctx.existingTodos, ctx.todayIso)
  if (todoAction) {
    return { kind: 'todo_action', action: todoAction, source: 'local' }
  }

  const debt = parseGfDebtText(phrase)
  if (debt) {
    return { kind: 'debt', entry: debt, source: 'local' }
  }

  const todoQuery = tryLocalTodosQuery(phrase, ctx)
  if (todoQuery) return todoQuery

  const report = tryLocalReportQuery(phrase, ctx)
  if (report) return report

  const balance = tryLocalBalanceQuery(phrase, ctx)
  if (balance) return balance

  if (looksLikeNewTodo(phrase) && !parseAmountLocal(phrase)) {
    const todos = parseGfTodosText(phrase, ctx.todayIso)
    if (todos.length) return { kind: 'todos', items: todos, source: 'local' }
  }

  const tx = parseGfVoiceText(phrase)
  if (tx) return { kind: 'transaction', entry: tx, source: 'local' }

  if (looksLikeNewTodo(phrase)) {
    const todos = parseGfTodosText(phrase, ctx.todayIso)
    if (todos.length) return { kind: 'todos', items: todos, source: 'local' }
  }

  return null
}
