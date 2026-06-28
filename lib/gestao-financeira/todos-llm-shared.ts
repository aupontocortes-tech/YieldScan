import type { GfParsedTodoEntry, GfTodoPriority } from '@/lib/gestao-financeira/types'
import { GF_OPENAI_MODEL } from '@/lib/gestao-financeira/voice-llm-shared'

export { GF_OPENAI_MODEL }

function normalizePriority(v: unknown): GfTodoPriority {
  if (v === 'high' || v === 'low') return v
  return 'normal'
}

function normalizeDate(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string' || !raw.trim()) return fallback.slice(0, 10)
  const d = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
  const parsed = new Date(d)
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const day = String(parsed.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return fallback.slice(0, 10)
}

function normalizeTime(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const t = raw.trim()
  const m = t.match(/^(\d{1,2}):(\d{2})$/)
  if (m) {
    const h = String(Math.min(23, parseInt(m[1]!, 10))).padStart(2, '0')
    const min = String(Math.min(59, parseInt(m[2]!, 10))).padStart(2, '0')
    return `${h}:${min}`
  }
  const hOnly = t.match(/^(\d{1,2})h?$/)
  if (hOnly) {
    const h = String(Math.min(23, parseInt(hOnly[1]!, 10))).padStart(2, '0')
    return `${h}:00`
  }
  return null
}

export function todosFromApi(raw: Record<string, unknown>, todayIso: string): GfParsedTodoEntry[] {
  const fallbackDate = todayIso.slice(0, 10)
  const list = Array.isArray(raw.items) ? raw.items : Array.isArray(raw.todos) ? raw.todos : null
  if (!list) return []

  const out: GfParsedTodoEntry[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    if (!title) continue
    const summary = typeof row.summary === 'string' ? row.summary.trim() : title
    out.push({
      title,
      notes: typeof row.notes === 'string' ? row.notes.trim() || null : null,
      dueDate: normalizeDate(row.dueDate ?? row.date, fallbackDate),
      dueTime: normalizeTime(row.dueTime ?? row.time),
      priority: normalizePriority(row.priority),
      summary,
    })
  }
  return out
}

export function buildGfTodosSystemPrompt(): string {
  return `És assistente de agenda pessoal em português (Brasil).
Analisa a frase do utilizador e extrai lembretes / afazeres. Responde SOMENTE com JSON válido (sem markdown).

Formato:
{
  "items": [
    {
      "title": "string curta e clara",
      "notes": "string | null",
      "dueDate": "YYYY-MM-DD",
      "dueTime": "HH:mm | null",
      "priority": "low" | "normal" | "high",
      "summary": "frase curta para confirmação"
    }
  ]
}

Regras:
- Use todayIso do contexto como referência para "hoje", "amanhã", "segunda", "próxima semana", etc.
- dueDate sempre YYYY-MM-DD no fuso do utilizador (Brasil).
- dueTime só se houver hora explícita (ex.: "às 14h" → "14:00").
- Uma frase pode gerar vários items (ex.: "amanhã dentista às 10 e sexta pagar luz").
- Verbos: lembrar, preciso, tenho que, marcar, pagar, ir, ligar, enviar, comprar…
- priority high: urgente, importante; low: quando der, sem pressa.
- summary: confirmação legível em português.`
}
