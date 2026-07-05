/** Remove horários para não confundir «17:00» ou «às 17» com valor em reais. */
export function stripTimePhrases(text: string): string {
  return text
    .replace(/\b(?:às|as|a)\s*\d{1,2}(?::\d{2})?\s*(?:h|horas?)?\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}\s*(?:h|horas?)?\b/gi, ' ')
    .replace(/\b\d{1,2}h\d{2}\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const TODO_SCHEDULE_HINT =
  /\b(amanh[ãa]|depois de amanh[ãa]|hoje|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|às\s+\d|as\s+\d|\d{1,2}:\d{2})\b/i

const TODO_EVENT_HINT =
  /\b(jogo|partida|assistir|compromisso|encontro|evento|reunião|reuniao|consulta|dentista|barbeiro|cinema|viagem|aniversário|aniversario|festa|show|live|transmissão|transmissao)\b/i

const TODO_ACTION_HINT =
  /\b(lembrete|lembrar|preciso|tenho que|devo|marcar|ir ao|ligar para|comprar|buscar|levar|pagar\s+luz)\b/i

const MONEY_EXPLICIT =
  /\b(r\$\s*\d|\d+\s*(?:reais?|real|mil|centavos?))\b/i

const EXPENSE_VERB = /\b(gastei|paguei|comprei|saí|sai|despesa|pagamento|pago|gasto)\b/i

const INCOME_CONTEXT =
  /\b(recebi|ganhei|entrada|entrou|salário|salario|folha|depositou|depósito|deposito|renda|creditei|coloquei|depositei)\b/i

/** Converte token numérico PT-BR (1.500 → 1500, 150,50 → 150.5). */
export function normalizeMoneyToken(raw: string): number | null {
  const s = raw.trim()
  if (!s || !/^[\d.,]+$/.test(s)) return null

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    const n = Number(s.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  if (hasComma) {
    const n = Number(s.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  if (hasDot) {
    const parts = s.split('.')
    if (parts.length > 1 && parts.slice(1).every((p) => p.length === 3)) {
      const n = Number(parts.join(''))
      return Number.isFinite(n) ? n : null
    }
    if (parts.length === 2 && parts[1]!.length <= 2) {
      const n = Number(s)
      return Number.isFinite(n) ? n : null
    }
    if (parts.length === 2 && parts[1]!.length === 3) {
      const n = Number(parts[0]! + parts[1]!)
      return Number.isFinite(n) ? n : null
    }
  }
  if (/^\d+$/.test(s)) {
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function extractMoneyToken(text: string): string | null {
  const match = text.match(
    /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{1,3}(?:\.\d{3})+|\d+(?:,\d{1,2})?|\d+(?:\.\d{1,2})?)/,
  )
  return match?.[1] ?? null
}

/** Frase parece agendar um afazer (não um gasto). */
export function looksLikeScheduledTodo(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (TODO_ACTION_HINT.test(t)) return true
  if (TODO_SCHEDULE_HINT.test(t) && TODO_EVENT_HINT.test(t)) return true
  if (
    /\b(?:às|as)\s*\d{1,2}(?::\d{2})?\b/i.test(t) &&
    /\b(amanh|hoje|segunda|terça|terca|quarta|quinta|sexta|domingo|sábado|sabado)\b/i.test(t)
  ) {
    return true
  }
  if (
    /\b(pagar|ir|ligar|comprar|enviar|buscar|levar|assistir|ver)\b/i.test(t) &&
    /\b(amanh|segunda|terça|quarta|quinta|sexta|hoje)\b/i.test(t)
  ) {
    return true
  }
  return false
}

/** Valor monetário explícito (não confundir hora com reais). */
export function parseMoneyAmount(text: string): number | null {
  const normalized = stripTimePhrases(text)
    .toLowerCase()
    .replace(/r\$\s*/g, '')
    .replace(/\s+/g, ' ')

  const mil = normalized.match(/(\d+(?:[.,]\d+)?)\s*mil\b/)
  if (mil) {
    const n = normalizeMoneyToken(mil[1]!.replace(',', '.'))
    return n != null ? n * 1000 : null
  }

  const reaisCentavos = normalized.match(/(\d+)\s*reais?\s*(?:e\s*)?(\d{1,2})?\s*centavos?/)
  if (reaisCentavos) {
    const reais = Number(reaisCentavos[1])
    const cent = reaisCentavos[2] ? Number(reaisCentavos[2]) / 100 : 0
    return reais + cent
  }

  if (MONEY_EXPLICIT.test(text)) {
    const token = extractMoneyToken(normalized)
    if (token) {
      const n = normalizeMoneyToken(token)
      if (n != null && n > 0) return n
    }
  }

  // Número com contexto de receita/despesa (ex.: «salário 1.500»)
  if (EXPENSE_VERB.test(text) || INCOME_CONTEXT.test(text)) {
    const token = extractMoneyToken(normalized)
    if (token) {
      const n = normalizeMoneyToken(token)
      if (n != null && n > 0) return n
    }
  }

  return null
}
