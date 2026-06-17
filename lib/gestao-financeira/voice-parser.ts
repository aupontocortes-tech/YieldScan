import type { GfParsedVoiceEntry, GfTransactionType } from '@/lib/gestao-financeira/types'

const INCOME_WORDS =
  /\b(recebi|ganhei|entrada|entrou|salário|salario|depositou|depósito|deposito|renda|adicionar|adicionei|coloquei|depositei|creditei|lucrei|vendi)\b/i
const EXPENSE_WORDS =
  /\b(gastei|paguei|comprei|saí|sai|despesa|pagamento|pago|gasto|tirei|retirei|debitou|débito|debito)\b/i
const TRANSFER_WORDS = /\b(transferi|transferência|transferencia|movi|mudei|passar|passei)\b/i

const CATEGORY_HINTS: { pattern: RegExp; category: string }[] = [
  { pattern: /\b(supermercado|mercado|compras|extra|carrefour|pão de açúcar)\b/i, category: 'Mercado' },
  { pattern: /\b(alimenta|restaurante|lanche|ifood|delivery|padaria)\b/i, category: 'Alimentação' },
  { pattern: /\b(combustível|combustivel|gasolina|posto|etanol|alcool)\b/i, category: 'Combustível' },
  { pattern: /\b(uber|99|transporte|ônibus|onibus|metrô|metro|taxi|táxi|passagem)\b/i, category: 'Transporte' },
  { pattern: /\b(aluguel|moradia|condomínio|condominio|iptu|aluguei)\b/i, category: 'Moradia' },
  { pattern: /\b(internet|wi-?fi|wifi|fibra|claro|vivo|tim)\b/i, category: 'Internet' },
  { pattern: /\b(água|agua|sabesp)\b/i, category: 'Água' },
  { pattern: /\b(energia|luz|eletricidade|enel|cpfl)\b/i, category: 'Energia' },
  { pattern: /\b(saúde|saude|médico|medico|farmácia|farmacia|plano de saúde|hospital)\b/i, category: 'Saúde' },
  { pattern: /\b(educação|educacao|curso|faculdade|escola|matrícula|matricula)\b/i, category: 'Educação' },
  { pattern: /\b(lazer|cinema|viagem|festa|jogo|netflix|spotify)\b/i, category: 'Lazer' },
  { pattern: /\b(salário|salario|folha|pagamento mensal)\b/i, category: 'Salário' },
  { pattern: /\b(freelance|freela|projeto|cliente|bico)\b/i, category: 'Freelance' },
  { pattern: /\b(bitcoin|btc|ethereum|eth|cripto|crypto|binance|solana)\b/i, category: 'Criptomoedas' },
  { pattern: /\b(investi|investimento|ações|acoes|fii|tesouro|cdb|lci)\b/i, category: 'Investimentos' },
]

/** Mapeia fala → nome da caixa padrão do app. */
const CASH_BOX_HINTS: { pattern: RegExp; name: string }[] = [
  { pattern: /\b(reserva de emergência|reserva|emergência|emergencia)\b/i, name: 'Reserva de Emergência' },
  { pattern: /\b(caixa de trade|trade|operações|operacoes)\b/i, name: 'Caixa de Trade' },
  { pattern: /\b(oportunidades|caixa de oportunidades)\b/i, name: 'Caixa de Oportunidades' },
  { pattern: /\b(investimentos|caixa de investimentos)\b/i, name: 'Caixa de Investimentos' },
  { pattern: /\b(longo prazo|caixa longo prazo)\b/i, name: 'Caixa Longo Prazo' },
  { pattern: /\b(viagem|caixa viagem)\b/i, name: 'Caixa Viagem' },
  { pattern: /\b(caixa principal|principal|carteira|conta)\b/i, name: 'Caixa Principal' },
]

function parseAmount(text: string): number | null {
  const normalized = text
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

  const match = normalized.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/)
  if (!match) return null

  let raw = match[1]!
  if (raw.includes('.') && raw.includes(',')) {
    raw = raw.replace(/\./g, '').replace(',', '.')
  } else if (raw.includes(',')) {
    raw = raw.replace(',', '.')
  }
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function detectType(text: string): GfTransactionType {
  if (TRANSFER_WORDS.test(text)) return 'transfer'
  if (/\b(adicionar|adicionei|coloquei|depositei).*\b(carteira|caixa|conta)\b/i.test(text)) return 'income'
  if (INCOME_WORDS.test(text) && !EXPENSE_WORDS.test(text)) return 'income'
  if (EXPENSE_WORDS.test(text)) return 'expense'
  if (INCOME_WORDS.test(text)) return 'income'
  return 'expense'
}

function detectCategory(text: string): string | null {
  for (const { pattern, category } of CATEGORY_HINTS) {
    if (pattern.test(text)) return category
  }
  return null
}

function detectCashBox(text: string): string | null {
  for (const { pattern, name } of CASH_BOX_HINTS) {
    if (pattern.test(text)) return name
  }
  return null
}

/** "da caixa principal para reserva" → origem e destino. */
function detectTransferBoxes(text: string): { from: string | null; to: string | null } {
  const lower = text.toLowerCase()
  const paraMatch = lower.match(
    /(?:de|da|do)\s+(.+?)\s+para\s+(?:a|o)?\s*(.+?)(?:\.|$|,|\d)/i,
  )
  if (paraMatch) {
    return {
      from: matchCashBoxInFragment(paraMatch[1] ?? ''),
      to: matchCashBoxInFragment(paraMatch[2] ?? ''),
    }
  }

  const simplePara = lower.match(/para\s+(?:a|o)?\s*(caixa\s+.+?|reserva|trade|viagem|investimentos)(?:\.|$|,)/i)
  if (simplePara) {
    return { from: null, to: matchCashBoxInFragment(simplePara[1] ?? '') }
  }

  return { from: null, to: null }
}

function matchCashBoxInFragment(fragment: string): string | null {
  const f = fragment.trim()
  for (const { pattern, name } of CASH_BOX_HINTS) {
    if (pattern.test(f)) return name
  }
  return detectCashBox(f)
}

function buildDescription(text: string, category: string | null): string {
  const raw = stripDatePhrases(text.trim()).replace(/\s+/g, ' ')
  const noValor = raw.replace(/r\$\s*[\d.,]+/gi, '').replace(/\d[\d.,]*\s*(?:reais?|mil)/gi, '')
  const emMatch = noValor.match(/\b(?:no|na|em|de|com|para)\s+(.{3,60})/i)
  if (emMatch?.[1]) {
    const part = emMatch[1].trim().replace(/[.,]$/, '')
    if (part.length >= 3) return part.slice(0, 120)
  }
  if (category) return category
  return raw.slice(0, 120)
}

function buildSummary(
  type: GfTransactionType,
  amount: number,
  category: string | null,
  cashBox: string | null,
  toCashBox: string | null,
  occurredAt: Date,
  referenceDate: Date,
): string {
  const brl = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const dateSuffix = isSameCalendarDay(occurredAt, referenceDate)
    ? ''
    : ` · ${formatOccurredDate(occurredAt)}`

  if (type === 'transfer') {
    const dest = toCashBox ?? 'outra caixa'
    const orig = cashBox ?? 'caixa principal'
    return `Transferir ${brl} de ${orig} para ${dest}${dateSuffix}`
  }
  if (type === 'income') {
    const dest = cashBox ?? 'Caixa Principal'
    const cat = category ? ` (${category})` : ''
    return `Receita ${brl}${cat} → ${dest}${dateSuffix}`
  }
  const orig = cashBox ?? 'Caixa Principal'
  const cat = category ? ` · ${category}` : ''
  return `Despesa ${brl}${cat} · ${orig}${dateSuffix}`
}

const WEEKDAY_ALIASES: { pattern: RegExp; dow: number }[] = [
  { pattern: /\b(?:no\s+|na\s+|em\s+)?(?:último\s+|ultima\s+)?domingo\b/i, dow: 0 },
  { pattern: /\b(?:no\s+|na\s+|em\s+)?(?:última\s+|ultima\s+)?segunda(?:\s*[- ]?\s*feira)?\b/i, dow: 1 },
  { pattern: /\b(?:no\s+|na\s+|em\s+)?(?:última\s+|ultima\s+)?ter[cç]a(?:\s*[- ]?\s*feira)?\b/i, dow: 2 },
  { pattern: /\b(?:no\s+|na\s+|em\s+)?(?:última\s+|ultima\s+)?quarta(?:\s*[- ]?\s*feira)?\b/i, dow: 3 },
  { pattern: /\b(?:no\s+|na\s+|em\s+)?(?:última\s+|ultima\s+)?quinta(?:\s*[- ]?\s*feira)?\b/i, dow: 4 },
  { pattern: /\b(?:no\s+|na\s+|em\s+)?(?:última\s+|ultima\s+)?sexta(?:\s*[- ]?\s*feira)?\b/i, dow: 5 },
  { pattern: /\b(?:no\s+|na\s+|em\s+)?(?:último\s+|ultima\s+)?s[aá]bado\b/i, dow: 6 },
]

const DATE_PHRASE_PATTERN =
  /\b(?:ontem|anteontem|ante\s*-?\s*ontem|hoje|semana\s+passad[ao]|(?:no\s+|na\s+|em\s+)?(?:últim[ao]\s+|ultim[ao]\s+)?(?:segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:\s*[- ]?\s*feira)?(?:\s+passad[ao])?|(?:h[aá]|a)\s*\d{1,2}\s*dias?\s*(?:atr[aá]s)?)\b/gi

function atLocalNoon(d: Date): Date {
  const x = new Date(d)
  x.setHours(12, 0, 0, 0)
  return x
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatOccurredDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Segunda/terça/etc. da semana corrente, ou o dia mais recente no passado. */
function resolveWeekdayDate(targetDow: number, ref: Date): Date {
  const d = new Date(ref)
  const refDow = d.getDay()
  let diff = refDow - targetDow
  if (diff < 0) diff += 7
  d.setDate(d.getDate() - diff)
  return atLocalNoon(d)
}

/** Interpreta "ontem", "segunda-feira", "terça passada", "há 3 dias", etc. */
export function parseOccurredAt(text: string, referenceDate = new Date()): Date {
  const lower = text.toLowerCase()
  const ref = atLocalNoon(referenceDate)

  const semanaPassada = lower.match(
    /\bsemana\s+passad[ao]\b.*?\b(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:\s*[- ]?\s*feira)?\b/i,
  )
  if (semanaPassada) {
    const dow = weekdayNameToDow(semanaPassada[1] ?? '')
    if (dow != null) {
      const thisWeek = resolveWeekdayDate(dow, ref)
      thisWeek.setDate(thisWeek.getDate() - 7)
      return atLocalNoon(thisWeek)
    }
  }

  const weekdayPassado = lower.match(
    /\b(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:\s*[- ]?\s*feira)?\s+passad[ao]\b/i,
  )
  if (weekdayPassado) {
    const dow = weekdayNameToDow(weekdayPassado[1] ?? '')
    if (dow != null) {
      const thisWeek = resolveWeekdayDate(dow, ref)
      thisWeek.setDate(thisWeek.getDate() - 7)
      return atLocalNoon(thisWeek)
    }
  }

  if (/\banteontem\b|\bante\s*-?\s*ontem\b/i.test(lower)) {
    const d = new Date(ref)
    d.setDate(d.getDate() - 2)
    return atLocalNoon(d)
  }

  if (/\bontem\b/i.test(lower)) {
    const d = new Date(ref)
    d.setDate(d.getDate() - 1)
    return atLocalNoon(d)
  }

  if (/\bhoje\b/i.test(lower)) {
    return ref
  }

  for (const { pattern, dow } of WEEKDAY_ALIASES) {
    if (pattern.test(lower)) {
      return resolveWeekdayDate(dow, ref)
    }
  }

  const diasAtras = lower.match(/\b(?:h[aá]|a)\s*(\d{1,2})\s*dias?\s*(?:atr[aá]s)?\b/i)
  if (diasAtras) {
    const n = Number(diasAtras[1])
    if (n > 0 && n <= 366) {
      const d = new Date(ref)
      d.setDate(d.getDate() - n)
      return atLocalNoon(d)
    }
  }

  return ref
}

function weekdayNameToDow(fragment: string): number | null {
  const f = fragment.toLowerCase()
  if (f.startsWith('dom')) return 0
  if (f.startsWith('seg')) return 1
  if (f.startsWith('ter')) return 2
  if (f.startsWith('qua') && !f.startsWith('quint')) return 3
  if (f.startsWith('qui')) return 4
  if (f.startsWith('sex')) return 5
  if (f.startsWith('sab') || f.startsWith('sáb')) return 6
  return null
}

function stripDatePhrases(text: string): string {
  return text.replace(DATE_PHRASE_PATTERN, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Interpreta frase em português (voz grátis do navegador ou texto digitado).
 * Não usa API paga — a "inteligência" é regras locais em PT-BR.
 */
export function parseGfVoiceText(text: string, referenceDate = new Date()): GfParsedVoiceEntry | null {
  const raw = text.trim()
  if (!raw) return null

  const amount = parseAmount(raw)
  if (amount == null) return null

  const type = detectType(raw)
  const categoryName = detectCategory(raw)
  let cashBoxName = detectCashBox(raw)
  let toCashBoxName: string | null = null
  const occurredAt = parseOccurredAt(raw, referenceDate)
  const ref = atLocalNoon(referenceDate)

  if (type === 'transfer') {
    const boxes = detectTransferBoxes(raw)
    cashBoxName = boxes.from ?? cashBoxName
    toCashBoxName = boxes.to ?? detectCashBox(raw.replace(/transferi|transferência|transferencia|movi|mudei/gi, ''))
  } else if (type === 'income' && !cashBoxName) {
    if (/\b(carteira|caixa|conta)\b/i.test(raw)) cashBoxName = 'Caixa Principal'
  }

  const hasIntent =
    INCOME_WORDS.test(raw) || EXPENSE_WORDS.test(raw) || TRANSFER_WORDS.test(raw) || categoryName != null

  const confidence: GfParsedVoiceEntry['confidence'] =
    categoryName && hasIntent && (cashBoxName || type !== 'transfer')
      ? 'high'
      : hasIntent
        ? 'medium'
        : 'low'

  const description = buildDescription(raw, categoryName)
  const summary = buildSummary(type, amount, categoryName, cashBoxName, toCashBoxName, occurredAt, ref)

  return {
    type,
    amount,
    categoryName,
    cashBoxName,
    toCashBoxName,
    description,
    occurredAt: occurredAt.toISOString(),
    confidence,
    summary,
  }
}

/** Resolve nome falado → caixa existente (match parcial). */
export function resolveCashBoxId(
  boxes: { id: string; name: string }[],
  hint: string | null,
): string | null {
  if (!hint || !boxes.length) return boxes[0]?.id ?? null
  const norm = hint.trim().toLowerCase()
  const exact = boxes.find((b) => b.name.toLowerCase() === norm)
  if (exact) return exact.id
  const partial = boxes.find(
    (b) => b.name.toLowerCase().includes(norm) || norm.includes(b.name.toLowerCase()),
  )
  return partial?.id ?? boxes[0]?.id ?? null
}
