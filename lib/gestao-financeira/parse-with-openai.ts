import {
  appendGfOpenAiUsage,
  checkGfOpenAiLimits,
  loadGfOpenAiSettings,
} from '@/lib/gestao-financeira/openai-config'
import type { GfParsedVoiceEntry, GfVoiceParseResult } from '@/lib/gestao-financeira/types'

export type GfParseVoiceContext = {
  todayIso: string
  cashBoxes: { name: string; balance: number }[]
  cryptoHoldings: { symbol: string; quantity: number; valueBrl: number }[]
  categories: string[]
  totalCashBrl: number
  totalCryptoBrl: number
}

type ApiResponse = {
  result: GfVoiceParseResult | null
  usage?: {
    model: string
    promptTokens: number
    completionTokens: number
    estimatedUsd: number
  }
  error?: string
}

/** Consulta local rápida de saldo (sem API). */
export function tryLocalBalanceQuery(text: string, ctx: GfParseVoiceContext): GfVoiceParseResult | null {
  const t = text.toLowerCase()
  const isQuery =
    /\b(quanto|qual|quanto\s+tenho|saldo|tenho\s+de|tenho\s+no|quanto\s+tem|meu\s+caixa|minha\s+cripto)\b/i.test(
      t,
    )
  if (!isQuery) return null

  const wantsCrypto = /\b(cripto|crypto|bitcoin|btc|ethereum|eth|moeda|moedas|binance|carteira\s+cripto)\b/i.test(
    t,
  )
  const wantsCash = /\b(caixa|caixas|dinheiro|conta|carteira|espécie|especie|saldo\s+em\s+caixa)\b/i.test(t)

  if (wantsCrypto && !wantsCash) {
    if (ctx.cryptoHoldings.length === 0) {
      return {
        kind: 'balance',
        answer: 'Você ainda não registrou criptomoedas. Abra a aba Cripto para adicionar.',
        source: 'local',
      }
    }
    const lines = ctx.cryptoHoldings.map(
      (h) =>
        `${h.symbol}: ${h.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })} (≈ R$ ${h.valueBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
    )
    return {
      kind: 'balance',
      answer: `Total em cripto: R$ ${ctx.totalCryptoBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.\n${lines.join('\n')}`,
      source: 'local',
    }
  }

  if (wantsCash || (!wantsCrypto && isQuery)) {
    const lines = ctx.cashBoxes.map(
      (b) => `${b.name}: R$ ${b.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    )
    return {
      kind: 'balance',
      answer: `Total em caixas: R$ ${ctx.totalCashBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.\n${lines.join('\n')}`,
      source: 'local',
    }
  }

  return {
    kind: 'balance',
    answer: `Caixas: R$ ${ctx.totalCashBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · Cripto: R$ ${ctx.totalCryptoBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
    source: 'local',
  }
}

export async function parseGfVoiceWithOpenAi(
  text: string,
  ctx: GfParseVoiceContext,
): Promise<{ result: GfVoiceParseResult | null; error: string | null }> {
  const settings = loadGfOpenAiSettings()
  const limit = checkGfOpenAiLimits(settings)
  if (!limit.ok) return { result: null, error: limit.reason }

  try {
    const res = await fetch('/api/gestao-financeira/parse-voice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenAI-Key': settings.apiKey.trim(),
      },
      body: JSON.stringify({ text: text.trim(), context: ctx }),
    })

    const data = (await res.json()) as ApiResponse
    if (!res.ok) {
      return { result: null, error: data.error ?? 'Falha ao interpretar com OpenAI.' }
    }

    if (data.usage) {
      appendGfOpenAiUsage({
        at: new Date().toISOString(),
        feature: 'parse-voice',
        model: data.usage.model,
        promptTokens: data.usage.promptTokens,
        completionTokens: data.usage.completionTokens,
        estimatedUsd: data.usage.estimatedUsd,
      })
    }

    if (!data.result) {
      return { result: null, error: data.error ?? 'Não foi possível interpretar a frase.' }
    }

    return { result: data.result, error: null }
  } catch {
    return { result: null, error: 'Erro de rede ao chamar a OpenAI.' }
  }
}
