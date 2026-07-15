/**
 * Regras de classificação de despesas/receitas a partir do texto (descrição ou frase).
 * Usado no registo por voz/frase e no resumo «gastos por categoria».
 */

export const GF_CATEGORY_HINTS: ReadonlyArray<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(cart[aã]o\s+de\s+cr[eé]dito|fatura\s+do\s+cart[aã]o|anuidade\s+do\s+cart[aã]o)\b/i, category: 'Cartão de crédito' },
  {
    pattern:
      /\b(supermercado|mercado|compras|extra|carrefour|pão de açúcar|pao de acucar|atacadão|atacadao|assai|açougue|acougue|hortifruti|feira)\b/i,
    category: 'Mercado',
  },
  { pattern: /\b(padaria|padoca|padariao)\b/i, category: 'Padaria' },
  { pattern: /\b(alimenta|restaurante|lanche|ifood|delivery|mcdonald|burger)\b/i, category: 'Alimentação' },
  { pattern: /\b(combustível|combustivel|gasolina|posto|etanol|álcool|alcool|abasteci|diesel)\b/i, category: 'Combustível' },
  {
    pattern:
      /\b(uber|99|transporte|ônibus|onibus|metrô|metro|taxi|táxi|passagem|estacionamento|pedágio|pedagio|borracharia|borracheiro)\b/i,
    category: 'Transporte',
  },
  {
    pattern:
      /\b(aluguel|moradia|condomínio|condominio|iptu|aluguei|financiamento\s+imobiliário|financiamento\s+imobiliario)\b/i,
    category: 'Moradia',
  },
  { pattern: /\b(internet|wi-?fi|wifi|fibra|claro|vivo|tim|oi\s+internet)\b/i, category: 'Internet' },
  { pattern: /\b(celular|telefone|plano\s+de\s+celular|operadora|recarga|chip)\b/i, category: 'Telefone' },
  { pattern: /\b(água|agua|sabesp|copasa)\b/i, category: 'Água' },
  { pattern: /\b(energia|luz|eletricidade|enel|cpfl|cemig|conta\s+de\s+luz)\b/i, category: 'Energia' },
  {
    pattern: /\b(saúde|saude|médico|medico|farmácia|farmacia|plano de saúde|hospital|dentista|consulta)\b/i,
    category: 'Saúde',
  },
  {
    pattern: /\b(educação|educacao|curso|faculdade|escola|matrícula|matricula|mensalidade\s+escolar)\b/i,
    category: 'Educação',
  },
  { pattern: /\b(lazer|cinema|viagem|festa|jogo|netflix|spotify|disney|amazon\s+prime|bar|pub)\b/i, category: 'Lazer' },
  { pattern: /\b(salário|salario|folha|pagamento mensal|holerite|contracheque)\b/i, category: 'Salário' },
  { pattern: /\b(freelance|freela|projeto|cliente|bico|nota\s+fiscal)\b/i, category: 'Freelance' },
  { pattern: /\b(bitcoin|btc|ethereum|eth|cripto|crypto|binance|solana|usdt|stablecoin)\b/i, category: 'Criptomoedas' },
  {
    pattern:
      /\b(investi|investimento|investimentos|ações|acoes|fii|tesouro|cdb|lci|lca|poupança\s+bancária|poupanca\s+bancaria)\b/i,
    category: 'Investimentos',
  },
  { pattern: /\b(petshop|ração|racao|veterinário|veterinario)\b/i, category: 'Outros' },
  { pattern: /\b(academia|gym|musculação|musculacao|personal)\b/i, category: 'Lazer' },
  { pattern: /\b(manicure|cabeleireiro|salão|salao|beleza)\b/i, category: 'Outros' },
]

/** Infere nome de categoria a partir de texto livre (descrição / voz). */
export function inferCategoryFromText(text: string): string | null {
  const t = text.trim()
  if (!t) return null
  for (const { pattern, category } of GF_CATEGORY_HINTS) {
    pattern.lastIndex = 0
    if (pattern.test(t)) return category
  }
  return null
}

/**
 * Nome estável para agrupar totais:
 * 1) categoria ligada à movimentação
 * 2) inferência pela descrição (mercado, gasolina…)
 * 3) Outros
 */
export function resolveExpenseCategoryName(
  t: { categoryId: string | null; description?: string | null },
  categories: { id: string; name: string }[],
): string {
  if (t.categoryId) {
    const found = categories.find((c) => c.id === t.categoryId)
    if (found?.name) return found.name
  }
  const desc = (t.description ?? '').trim()
  if (desc) {
    const inferred = inferCategoryFromText(desc)
    if (inferred) return inferred
    /** Descrição curta tipo «mercado» / «gasolina» — capitaliza e usa como rótulo. */
    if (desc.length <= 28 && !/\d/.test(desc)) {
      return desc.charAt(0).toUpperCase() + desc.slice(1).toLowerCase()
    }
  }
  return 'Outros'
}
