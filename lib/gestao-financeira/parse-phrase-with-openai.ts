import {
  appendGfOpenAiUsage,
  checkGfOpenAiLimits,
  loadGfOpenAiSettings,
} from '@/lib/gestao-financeira/openai-config'
import type { GfPhraseParseResult } from '@/lib/gestao-financeira/types'
import type { GfPhraseRouteContext } from '@/lib/gestao-financeira/phrase-router'
import { routeGfInstantPhraseLocally, routeGfPhraseLocally } from '@/lib/gestao-financeira/phrase-router'
import { buildGfPhraseSystemPrompt, phraseResultFromApi } from '@/lib/gestao-financeira/phrase-llm-shared'

type ApiResponse = {
  result: GfPhraseParseResult | null
  usage?: {
    model: string
    promptTokens: number
    completionTokens: number
    estimatedUsd: number
  }
  error?: string
}

export async function parseGfPhraseWithOpenAi(
  text: string,
  ctx: GfPhraseRouteContext,
): Promise<{ result: GfPhraseParseResult | null; error: string | null }> {
  const settings = loadGfOpenAiSettings()
  const limit = checkGfOpenAiLimits(settings)
  if (!limit.ok) return { result: null, error: limit.reason }

  try {
    const res = await fetch('/api/gestao-financeira/parse-phrase', {
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
        feature: 'parse-phrase',
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

/** Interpreta frase: com OpenAI activa, a IA classifica movimentos; sem API, regras locais. */
export async function interpretGfPhrase(
  text: string,
  ctx: GfPhraseRouteContext,
): Promise<{ result: GfPhraseParseResult | null; error: string | null }> {
  const settings = loadGfOpenAiSettings()
  const openAiReady = settings.enabled && settings.apiKey.trim()

  if (openAiReady) {
    const instant = routeGfInstantPhraseLocally(text, ctx)
    if (instant) return { result: instant, error: null }
    return parseGfPhraseWithOpenAi(text, ctx)
  }

  const local = routeGfPhraseLocally(text, ctx)
  if (local) return { result: local, error: null }

  return {
    result: null,
    error:
      'Não entendi. Fale com valor para movimentação, data para afazeres, ou active a OpenAI para frases complexas.',
  }
}
