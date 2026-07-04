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

/** Frase parece agendar um afazer (não um gasto). */
export function looksLikeScheduledTodo(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (TODO_ACTION_HINT.test(t)) return true
  if (TODO_SCHEDULE_HINT.test(t) && TODO_EVENT_HINT.test(t)) return true
  if (/\b(?:às|as)\s*\d{1,2}(?::\d{2})?\b/i.test(t) && /\b(amanh|hoje|segunda|terça|terca|quarta|quinta|sexta|domingo|sábado|sabado)\b/i.test(t)) {
    return true
  }
  if (/\b(pagar|ir|ligar|comprar|enviar|buscar|levar|assistir|ver)\b/i.test(t) && /\b(amanh|segunda|terça|quarta|quinta|sexta|hoje)\b/i.test(t)) {
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
    const n = Number(mil[1]!.replace(',', '.'))
    return Number.isFinite(n) ? n * 1000 : null
  }

  const reaisCentavos = normalized.match(/(\d+)\s*reais?\s*(?:e\s*)?(\d{1,2})?\s*centavos?/)
  if (reaisCentavos) {
    const reais = Number(reaisCentavos[1])
    const cent = reaisCentavos[2] ? Number(reaisCentavos[2]) / 100 : 0
    return reais + cent
  }

  if (MONEY_EXPLICIT.test(text)) {
    const match = normalized.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/)
    if (match) {
      let raw = match[1]!
      if (raw.includes('.') && raw.includes(',')) raw = raw.replace(/\./g, '').replace(',', '.')
      else if (raw.includes(',')) raw = raw.replace(',', '.')
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) return n
    }
  }

  // Número sozinho só conta como dinheiro se houver verbo de gasto/receita
  if (EXPENSE_VERB.test(text) || /\b(recebi|ganhei|entrada)\b/i.test(text)) {
    const match = normalized.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/)
    if (match) {
      let raw = match[1]!
      if (raw.includes('.') && raw.includes(',')) raw = raw.replace(/\./g, '').replace(',', '.')
      else if (raw.includes(',')) raw = raw.replace(',', '.')
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) return n
    }
  }

  return null
}
