import type { AnalysisTone } from '@/lib/tendencias/types'
import { SCORE_TENDENCIA_NOME, type TrimClass } from '@/lib/tendencias/trim-config'
import type { TrimTokenScores } from '@/lib/tendencias/trim-scores'
import type { RawMarketCoin } from '@/lib/tendencias/fetch-data'

const TONE_PREFIX: Record<AnalysisTone, string[]> = {
  conservador: ['Com cautela,', 'Num contexto de risco,', 'Observando defesas,'],
  neutro: ['', 'No agregado,', 'Em termos quantitativos,'],
  agressivo: ['Com momentum claro,', 'Destaque imediato:', 'Oportunidade em foco:'],
}

const TRIM_VERB: Record<TrimClass, string[]> = {
  fraco: ['perde tração', 'enfraquece', 'mostra fragilidade'],
  estavel: ['mantém estabilidade', 'opera de forma lateral', 'demonstra equilíbrio'],
  forte: ['mantém tendência forte', 'consolida força', 'apresenta desempenho sólido'],
  acelerando: ['acelera positivamente', 'ganha impulso', 'expande momentum'],
}

const VOLUME_PHRASE = [
  'acompanhado de crescimento de volume',
  'com volume acima da média',
  'com actividade de volume relevante',
  'enquanto o volume permanece contido',
]

const NARRATIVE_PHRASE = [
  'enquanto o mercado acompanha novas narrativas',
  'alinhado à narrativa dominante do momento',
  'num contexto de rotação sectorial',
]

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]
}

export function generateTokenSummary(
  c: RawMarketCoin,
  trim: TrimTokenScores,
  dominantNarrative: string | null,
  tone: AnalysisTone,
): string {
  const sym = c.name || c.symbol.toUpperCase()
  const prefix = pick(TONE_PREFIX[tone], trim.trimScore)
  const verb = pick(TRIM_VERB[trim.trimClass], trim.trimScore + sym.length)
  const volPhrase = pick(VOLUME_PHRASE, trim.volume + trim.momentum)
  const narr = dominantNarrative
    ? `${pick(NARRATIVE_PHRASE, trim.relevance)} (${dominantNarrative})`
    : pick(NARRATIVE_PHRASE, trim.relevance)

  const cp = c.price_change_percentage_7d_in_currency ?? c.price_change_percentage_24h ?? 0
  const changeBit =
    Math.abs(cp) >= 3
      ? ` (${cp >= 0 ? '+' : ''}${cp.toFixed(1)}% em 7d)`
      : ''

  return `${prefix} ${sym} ${verb} ${volPhrase}${changeBit}. ${narr}.`.replace(/\s+/g, ' ').trim()
}

export function generateObserveToday(input: {
  marketTrimScore: number
  marketSentiment: string
  dominantNarrative: string | null
  gainers: number
  losers: number
  period: string
  topAccel: RawMarketCoin | null
  topAccelTrim: TrimTokenScores | null
  defiSummary: string
  tone: AnalysisTone
}): string {
  const parts: string[] = []
  const mood =
    input.marketTrimScore >= 65
      ? 'O mercado apresenta leitura quantitativa construtiva'
      : input.marketTrimScore <= 35
        ? 'O mercado opera em modo defensivo'
        : 'O mercado mantém-se equilibrado'

  parts.push(
    `${mood} (${SCORE_TENDENCIA_NOME} do mercado ${input.marketTrimScore}/100, sentimento ${input.marketSentiment}). ${input.gainers} ativos em alta vs ${input.losers} em queda (24h). Janela de momentum: ${input.period}.`,
  )

  if (input.dominantNarrative) {
    parts.push(`Narrativa dominante: ${input.dominantNarrative}.`)
  }

  if (input.topAccel && input.topAccelTrim) {
    parts.push(generateTokenSummary(input.topAccel, input.topAccelTrim, input.dominantNarrative, input.tone))
  }

  if (input.defiSummary && !input.defiSummary.includes('indisponível')) {
    parts.push(input.defiSummary)
  }

  return parts.join(' ')
}

export function generateDefiInterpretation(input: {
  name: string
  tvlChange?: number | null
  feesChange?: number | null
  revenue24h?: number | null
}): string {
  const { name, tvlChange, feesChange, revenue24h } = input
  if (tvlChange != null && tvlChange > 3 && (feesChange ?? 0) > 0) {
    return `${name} apresenta crescimento sustentável de TVL junto com aumento de actividade on-chain.`
  }
  if (tvlChange != null && tvlChange < -4) {
    return `${name} regista perda de força com contração de TVL na última semana.`
  }
  if (revenue24h != null && revenue24h > 5_000_000) {
    return `${name} mantém receita diária elevada — sinal de expansão do protocolo.`
  }
  if (feesChange != null && feesChange < -8) {
    return `${name} mostra queda de actividade medida por fees recentes.`
  }
  return `${name} mantém presença relevante no ecossistema DeFi.`
}
