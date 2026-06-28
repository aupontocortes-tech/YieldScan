import {
  appendGfOpenAiUsage,
  checkGfOpenAiLimits,
  loadGfOpenAiSettings,
} from '@/lib/gestao-financeira/openai-config'
import type { GfTodoParseResult } from '@/lib/gestao-financeira/types'

export type GfParseTodosContext = {
  todayIso: string
  existingTodos?: { title: string; dueDate: string }[]
}

type ApiResponse = {
  result: GfTodoParseResult | null
  usage?: {
    model: string
    promptTokens: number
    completionTokens: number
    estimatedUsd: number
  }
  error?: string
}

export async function parseGfTodosWithOpenAi(
  text: string,
  ctx: GfParseTodosContext,
): Promise<{ result: GfTodoParseResult | null; error?: string }> {
  const settings = loadGfOpenAiSettings()
  const key = settings.apiKey.trim()
  if (!key) return { result: null, error: 'Chave OpenAI não configurada.' }

  const limit = checkGfOpenAiLimits(settings)
  if (!limit.ok) return { result: null, error: limit.reason }

  const res = await fetch('/api/gestao-financeira/parse-todos', {
    method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenAI-Key': key,
      },
    body: JSON.stringify({
      text,
      context: {
        todayIso: ctx.todayIso,
        existingTodos: ctx.existingTodos ?? [],
      },
    }),
  })

  let json: ApiResponse
  try {
    json = (await res.json()) as ApiResponse
  } catch {
    return { result: null, error: 'Resposta inválida do servidor.' }
  }

  if (!res.ok) {
    return { result: null, error: json.error ?? `Erro ${res.status}.` }
  }

  if (json.usage) {
    appendGfOpenAiUsage({
      at: new Date().toISOString(),
      feature: 'parse-todos',
      model: json.usage.model,
      promptTokens: json.usage.promptTokens,
      completionTokens: json.usage.completionTokens,
      estimatedUsd: json.usage.estimatedUsd,
    })
  }

  if (!json.result?.items?.length) {
    return { result: null, error: json.error ?? 'Não consegui extrair afazeres desta frase.' }
  }

  return { result: json.result }
}
