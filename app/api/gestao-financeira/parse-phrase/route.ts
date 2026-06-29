import { NextResponse } from 'next/server'
import { estimateOpenAiCostUsd } from '@/lib/gestao-financeira/openai-config'
import { buildGfPhraseSystemPrompt, GF_OPENAI_MODEL, phraseResultFromApi } from '@/lib/gestao-financeira/phrase-llm-shared'
import type { GfPhraseParseResult } from '@/lib/gestao-financeira/types'

export const runtime = 'nodejs'

type Body = {
  text?: string
  context?: Record<string, unknown>
}

function resolveKey(req: Request): string | null {
  const header = req.headers.get('x-openai-key')?.trim()
  if (header) return header
  return process.env.OPENAI_API_KEY?.trim() || null
}

export async function POST(req: Request) {
  const key = resolveKey(req)
  if (!key) {
    return NextResponse.json({ error: 'Chave OpenAI não configurada.' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const text = body.text?.trim()
  if (!text) {
    return NextResponse.json({ error: 'Frase vazia.' }, { status: 400 })
  }

  const ctx = body.context ?? {}
  const model = process.env.OPENAI_MODEL?.trim() || GF_OPENAI_MODEL
  const todayIso = typeof ctx.todayIso === 'string' ? ctx.todayIso : new Date().toISOString()

  const userContent = JSON.stringify({
    phrase: text,
    ...ctx,
    todayIso,
  })

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildGfPhraseSystemPrompt() },
          { role: 'user', content: userContent },
        ],
        max_tokens: 600,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(35_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      if (res.status === 401) {
        return NextResponse.json({ error: 'Chave OpenAI inválida.' }, { status: 401 })
      }
      return NextResponse.json(
        { error: `OpenAI respondeu ${res.status}. ${errText.slice(0, 120)}` },
        { status: 502 },
      )
    }

    const json = (await res.json()) as {
      usage?: { prompt_tokens?: number; completion_tokens?: number }
      choices?: { message?: { content?: string } }[]
    }

    const rawContent = json.choices?.[0]?.message?.content?.trim()
    if (!rawContent) {
      return NextResponse.json({ error: 'Resposta vazia da OpenAI.' }, { status: 502 })
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(rawContent) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'JSON inválido da OpenAI.' }, { status: 502 })
    }

    const promptTokens = json.usage?.prompt_tokens ?? 0
    const completionTokens = json.usage?.completion_tokens ?? 0
    const estimatedUsd = estimateOpenAiCostUsd(model, promptTokens, completionTokens)

    const result: GfPhraseParseResult | null = phraseResultFromApi(parsed, todayIso)

    if (!result) {
      return NextResponse.json({
        result: null,
        error: 'Não consegui classificar a frase. Tente ser mais específico.',
        usage: { model, promptTokens, completionTokens, estimatedUsd },
      })
    }

    return NextResponse.json({
      result,
      usage: { model, promptTokens, completionTokens, estimatedUsd },
    })
  } catch {
    return NextResponse.json({ error: 'Timeout ou falha ao contactar OpenAI.' }, { status: 504 })
  }
}
