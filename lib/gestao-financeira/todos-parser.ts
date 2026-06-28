import type { GfParsedTodoEntry, GfTodoPriority } from '@/lib/gestao-financeira/types'

function addDays(base: Date, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseTime(text: string): string | null {
  const at = text.match(/\b(?:às|as|as\s+)?(\d{1,2})(?::(\d{2}))?\s*h?\b/i)
  if (!at) return null
  const h = String(Math.min(23, parseInt(at[1]!, 10))).padStart(2, '0')
  const min = at[2] ? String(Math.min(59, parseInt(at[2], 10))).padStart(2, '0') : '00'
  return `${h}:${min}`
}

function parseDateHint(text: string, today: Date): string {
  const t = text.toLowerCase()
  if (/\bdepois de amanh[ãa]\b/.test(t)) return addDays(today, 2)
  if (/\bamanh[ãa]\b/.test(t)) return addDays(today, 1)
  if (/\bhoje\b/.test(t)) return addDays(today, 0)

  const weekdays: Record<string, number> = {
    domingo: 0,
    segunda: 1,
    terça: 2,
    terca: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sábado: 6,
    sabado: 6,
  }
  for (const [name, target] of Object.entries(weekdays)) {
    if (new RegExp(`\\b${name}(?:-feira)?\\b`, 'i').test(t)) {
      const current = today.getDay()
      let delta = target - current
      if (delta <= 0) delta += 7
      return addDays(today, delta)
    }
  }

  const dm = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/)
  if (dm) {
    const day = parseInt(dm[1]!, 10)
    const month = parseInt(dm[2]!, 10) - 1
    const year = dm[3] ? (dm[3].length === 2 ? 2000 + parseInt(dm[3], 10) : parseInt(dm[3], 10)) : today.getFullYear()
    const d = new Date(year, month, day)
    if (!Number.isNaN(d.getTime())) return addDays(d, 0)
  }

  return addDays(today, 0)
}

function parsePriority(text: string): GfTodoPriority {
  if (/\b(urgente|importante|prioridade)\b/i.test(text)) return 'high'
  if (/\b(quando der|sem pressa|depois)\b/i.test(text)) return 'low'
  return 'normal'
}

function cleanTitle(text: string): string {
  return text
    .replace(/\b(hoje|amanh[ãa]|depois de amanh[ãa])\b/gi, '')
    .replace(/\b(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(?:-feira)?\b/gi, '')
    .replace(/\b(?:às|as)\s*\d{1,2}(?::\d{2})?\s*h?\b/gi, '')
    .replace(/\b(lembrete|lembrar de|preciso|tenho que|devo|marca|marcar)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[-–—:,.\s]+|[-–—:,.\s]+$/g, '')
}

/** Interpretação local simples (uma tarefa por frase). */
export function parseGfTodosText(text: string, todayIso?: string): GfParsedTodoEntry[] {
  const phrase = text.trim()
  if (!phrase || phrase.length < 3) return []

  const today = todayIso ? new Date(todayIso) : new Date()
  const dueDate = parseDateHint(phrase, today)
  const dueTime = parseTime(phrase)
  const priority = parsePriority(phrase)
  let title = cleanTitle(phrase)
  if (!title) title = phrase.slice(0, 120)

  return [
    {
      title,
      notes: null,
      dueDate,
      dueTime,
      priority,
      summary: `${title}${dueTime ? ` · ${dueTime}` : ''} · ${dueDate.split('-').reverse().join('/')}`,
    },
  ]
}
