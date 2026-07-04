import type { GfParsedVoiceEntry, GfTransactionType } from '@/lib/gestao-financeira/types'
import { looksLikeScheduledTodo, parseMoneyAmount } from '@/lib/gestao-financeira/time-vs-amount'

const INCOME_WORDS =
  /\b(recebi|ganhei|entrada|entrou|entrou\s+dinheiro|caiu|salário|salario|folha|depositou|depósito|deposito|renda|rendeu|adicionar|adicionei|coloquei|depositei|creditei|lucrei|vendi|dividendo|dividendos|cashback|estorno|reembolso|devolução|devolucao|herança|heranca|presente|gorjeta|bônus|bonus|gratificação|gratificacao|13º|décimo\s+terceiro|decimo\s+terceiro|pix\s+recebido)\b/i
const EXPENSE_WORDS =
  /\b(gastei|paguei|comprei|saí|sai|saquei|despesa|pagamento|pago|gasto|tirei|retirei|debitou|débito|debito|assinei|renovei|renovação|renovacao|multa|parcela|parcelas|anuidade|mensalidade|taxa|juros|boleto|fatura|cartão|cartao|débito\s+automático|debito\s+automatico)\b/i
const TRANSFER_WORDS =
  /\b(transferi|transferência|transferencia|movi|mudei|passar|passei|mandei|enviei)\b/i
/** Poupança / reserva — move da caixa principal para outra caixa. */
const SAVINGS_WORDS =
  /\b(guardei|guardar|guardo|poupei|poupar|poupo|economizei|economizar|economizo|separei|separar|separo|reservei|reservar|reservo|juntei|juntar|junto|guarde|poupe|economize|reserve|separe|junte)\b/i
/** Aporte / investimento interno — caixa principal → investimentos. */
const INVESTMENT_MOVE_WORDS =
  /\b(investi|investir|aportei|aportar|aporto|apliquei|aplicar|aplico|comprei\s+ações|comprei\s+acoes|comprei\s+fii|comprei\s+tesouro|comprei\s+cdb)\b/i
/** Entrada direta em caixa sem dizer «ganhei». */
const DEPOSIT_WORDS =
  /\b(adicionar|adicionei|adiciona|coloquei|colocar|coloca|depositei|depositar|deposita|entrou|creditei)\b/i

const CATEGORY_HINTS: { pattern: RegExp; category: string }[] = [
  { pattern: /\b(cart[aã]o\s+de\s+cr[eé]dito|fatura\s+do\s+cart[aã]o|anuidade\s+do\s+cart[aã]o)\b/i, category: 'Cartão de crédito' },
  { pattern: /\b(supermercado|mercado|compras|extra|carrefour|pão de açúcar|pao de acucar|atacadão|atacadao|assai)\b/i, category: 'Mercado' },
  { pattern: /\b(padaria|padoca|padariao)\b/i, category: 'Padaria' },
  { pattern: /\b(alimenta|restaurante|lanche|ifood|delivery|mcdonald|burger)\b/i, category: 'Alimentação' },
  { pattern: /\b(combustível|combustivel|gasolina|posto|etanol|álcool|alcool|abasteci)\b/i, category: 'Combustível' },
  { pattern: /\b(uber|99|transporte|ônibus|onibus|metrô|metro|taxi|táxi|passagem|estacionamento|pedágio|pedagio)\b/i, category: 'Transporte' },
  { pattern: /\b(aluguel|moradia|condomínio|condominio|iptu|aluguei|financiamento\s+imobiliário|financiamento\s+imobiliario)\b/i, category: 'Moradia' },
  { pattern: /\b(internet|wi-?fi|wifi|fibra|claro|vivo|tim|oi\s+internet)\b/i, category: 'Internet' },
  { pattern: /\b(água|agua|sabesp|copasa)\b/i, category: 'Água' },
  { pattern: /\b(energia|luz|eletricidade|enel|cpfl|cemig|conta\s+de\s+luz)\b/i, category: 'Energia' },
  { pattern: /\b(saúde|saude|médico|medico|farmácia|farmacia|plano de saúde|hospital|dentista|consulta)\b/i, category: 'Saúde' },
  { pattern: /\b(educação|educacao|curso|faculdade|escola|matrícula|matricula|mensalidade\s+escolar)\b/i, category: 'Educação' },
  { pattern: /\b(lazer|cinema|viagem|festa|jogo|netflix|spotify|disney|amazon\s+prime|bar|pub)\b/i, category: 'Lazer' },
  { pattern: /\b(salário|salario|folha|pagamento mensal|holerite|contracheque)\b/i, category: 'Salário' },
  { pattern: /\b(freelance|freela|projeto|cliente|bico|nota\s+fiscal)\b/i, category: 'Freelance' },
  { pattern: /\b(bitcoin|btc|ethereum|eth|cripto|crypto|binance|solana|usdt|stablecoin)\b/i, category: 'Criptomoedas' },
  { pattern: /\b(investi|investimento|investimentos|ações|acoes|fii|tesouro|cdb|lci|lca|poupança\s+bancária|poupanca\s+bancaria)\b/i, category: 'Investimentos' },
  { pattern: /\b(petshop|ração|racao|veterinário|veterinario)\b/i, category: 'Outros' },
  { pattern: /\b(academia|gym|musculação|musculacao|personal)\b/i, category: 'Lazer' },
  { pattern: /\b(manicure|cabeleireiro|salão|salao|beleza)\b/i, category: 'Outros' },
]

/** Mapeia fala → nome da caixa padrão do app (ordem: mais específico primeiro). */
const CASH_BOX_HINTS: { pattern: RegExp; name: string }[] = [
  { pattern: /\b(reserva de emergência|reserva de emergencia|fundo de emergência|fundo de emergencia)\b/i, name: 'Reserva de Emergência' },
  { pattern: /\b(caixa de trade|trade|day\s*trade|swing\s*trade|operações|operacoes|trading)\b/i, name: 'Caixa de Trade' },
  { pattern: /\b(caixa de oportunidades|oportunidades)\b/i, name: 'Caixa de Oportunidades' },
  { pattern: /\b(caixa de investimentos|investimentos|aportes|ações|acoes|fii|tesouro|cdb)\b/i, name: 'Caixa de Investimentos' },
  { pattern: /\b(caixa longo prazo|longo prazo|aposentadoria|previdência|previdencia)\b/i, name: 'Caixa Longo Prazo' },
  { pattern: /\b(caixa viagem|viagem|férias|ferias|passagens)\b/i, name: 'Caixa Viagem' },
  { pattern: /\b(poupança|poupanca|guardar\s+dinheiro)\b/i, name: 'Reserva de Emergência' },
  { pattern: /\b(caixa principal|principal|carteira|conta\s+corrente|conta|caixa|dinheiro\s+vivo|espécie|especie)\b/i, name: 'Caixa Principal' },
  { pattern: /\b(reserva)\b/i, name: 'Reserva de Emergência' },
]

function parseAmount(text: string): number | null {
  return parseMoneyAmount(text)
}

function detectType(text: string): GfTransactionType {
  if (TRANSFER_WORDS.test(text)) return 'transfer'
  if (SAVINGS_WORDS.test(text) && !INCOME_WORDS.test(text) && !EXPENSE_WORDS.test(text)) return 'transfer'
  if (INVESTMENT_MOVE_WORDS.test(text)) return 'transfer'
  if (/\b(coloquei|colocar|coloca|depositei|depositar|deposita|mandei|passei).*\b(para|pra|na|no|em)\b/i.test(text)) {
    const dest = detectCashBox(text)
    if (dest && dest !== 'Caixa Principal') return 'transfer'
  }
  if (DEPOSIT_WORDS.test(text) && /\b(carteira|caixa|conta|principal)\b/i.test(text)) return 'income'
  if (INCOME_WORDS.test(text) && !EXPENSE_WORDS.test(text)) return 'income'
  if (EXPENSE_WORDS.test(text)) return 'expense'
  if (INCOME_WORDS.test(text)) return 'income'
  const cat = detectCategory(text)
  if (cat === 'Salário' || cat === 'Freelance') return 'income'
  if (cat) return 'expense'
  return 'expense'
}

/** Encaminha automaticamente para a caixa certa sem o utilizador escolher. */
function applySmartRouting(
  text: string,
  type: GfTransactionType,
  categoryName: string | null,
  cashBoxName: string | null,
  toCashBoxName: string | null,
): { type: GfTransactionType; cashBoxName: string | null; toCashBoxName: string | null } {
  let t = type
  let from = cashBoxName
  let to = toCashBoxName

  if (t === 'transfer') {
    from = from ?? 'Caixa Principal'
    if (!to) {
      to = detectCashBox(text)
      if (!to || to === from) {
        if (SAVINGS_WORDS.test(text)) to = 'Reserva de Emergência'
        else if (INVESTMENT_MOVE_WORDS.test(text) || categoryName === 'Investimentos') to = 'Caixa de Investimentos'
        else if (categoryName === 'Criptomoedas') to = 'Caixa de Trade'
        else if (categoryName === 'Lazer' && /\b(viagem|férias|ferias)\b/i.test(text)) to = 'Caixa Viagem'
        else to = 'Reserva de Emergência'
      }
    }
    return { type: t, cashBoxName: from, toCashBoxName: to }
  }

  if (t === 'income') {
    if (!from) {
      if (categoryName === 'Investimentos') from = 'Caixa de Investimentos'
      else if (categoryName === 'Criptomoedas') from = 'Caixa de Trade'
      else if (categoryName === 'Salário' || categoryName === 'Freelance') from = 'Caixa Principal'
      else if (DEPOSIT_WORDS.test(text) || INCOME_WORDS.test(text)) from = 'Caixa Principal'
      else from = 'Caixa Principal'
    }
    return { type: t, cashBoxName: from, toCashBoxName: null }
  }

  // expense
  if (!from) {
    if (categoryName === 'Criptomoedas') from = 'Caixa de Trade'
    else if (categoryName === 'Investimentos') from = 'Caixa de Investimentos'
    else from = 'Caixa Principal'
  }
  return { type: t, cashBoxName: from, toCashBoxName: null }
}

function hasTransactionIntent(text: string, categoryName: string | null): boolean {
  return (
    INCOME_WORDS.test(text) ||
    EXPENSE_WORDS.test(text) ||
    TRANSFER_WORDS.test(text) ||
    SAVINGS_WORDS.test(text) ||
    INVESTMENT_MOVE_WORDS.test(text) ||
    DEPOSIT_WORDS.test(text) ||
    categoryName != null
  )
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
  savingsTransfer = false,
): string {
  const brl = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const dateSuffix = isSameCalendarDay(occurredAt, referenceDate)
    ? ''
    : ` · ${formatOccurredDate(occurredAt)}`

  if (type === 'transfer') {
    const dest = toCashBox ?? 'Reserva de Emergência'
    const orig = cashBox ?? 'Caixa Principal'
    const action = savingsTransfer ? 'Guardar' : 'Transferir'
    return `${action} ${brl} de ${orig} para ${dest}${dateSuffix}`
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
  if (looksLikeScheduledTodo(raw)) return null

  const amount = parseAmount(raw)
  if (amount == null) return null

  const type = detectType(raw)
  const categoryName = detectCategory(raw)
  let cashBoxName = detectCashBox(raw)
  let toCashBoxName: string | null = null
  const occurredAt = parseOccurredAt(raw, referenceDate)
  const ref = atLocalNoon(referenceDate)
  const savingsIntent = SAVINGS_WORDS.test(raw) && !INCOME_WORDS.test(raw) && !EXPENSE_WORDS.test(raw)

  if (type === 'transfer' && TRANSFER_WORDS.test(raw)) {
    const boxes = detectTransferBoxes(raw)
    cashBoxName = boxes.from ?? cashBoxName
    toCashBoxName = boxes.to ?? detectCashBox(raw.replace(/transferi|transferência|transferencia|movi|mudei/gi, ''))
  }

  const routed = applySmartRouting(raw, type, categoryName, cashBoxName, toCashBoxName)
  const finalType = routed.type
  cashBoxName = routed.cashBoxName
  toCashBoxName = routed.toCashBoxName

  const hasIntent = hasTransactionIntent(raw, categoryName)

  const confidence: GfParsedVoiceEntry['confidence'] =
    categoryName && hasIntent && (cashBoxName || finalType !== 'transfer')
      ? 'high'
      : hasIntent
        ? 'medium'
        : 'low'

  const description = buildDescription(raw, categoryName)
  const summary = buildSummary(
    finalType,
    amount,
    categoryName,
    cashBoxName,
    toCashBoxName,
    occurredAt,
    ref,
    savingsIntent || (finalType === 'transfer' && SAVINGS_WORDS.test(raw)),
  )

  return {
    type: finalType,
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
