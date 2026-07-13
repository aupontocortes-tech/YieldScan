import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'

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

  let body: {
    text?: string
    segments?: Array<{ start: number; end: number; text: string }>
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const text = (body.text ?? '').trim()
  if (!text) {
    return NextResponse.json({ error: 'Transcrição vazia.' }, { status: 400 })
  }

  const segmentsJson = JSON.stringify((body.segments ?? []).slice(0, 80))

  const system = `És um editor de vídeo viral para redes sociais (TikTok, Reels, Shorts).
Analisa a transcrição e devolve JSON estrito:
{"suggestions":[{"start":number,"end":number,"reason":string,"score":0-1,"kind":"highlight"|"viral"|"silence"|"pause"|"suggested"}]}
Regras:
- 4 a 12 sugestões.
- Inclui momentos fortes (gancho, punchline, emoção) e silêncios/pausas a cortar.
- start/end em segundos, alinhados aos segmentos.
- Responde só JSON.`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `TRANSCRIÇÃO:\n${text.slice(0, 12000)}\n\nSEGMENTOS:\n${segmentsJson}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    })

    const data = (await res.json().catch(() => null)) as {
      error?: { message?: string }
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    } | null

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || `OpenAI falhou (${res.status}).` },
        { status: 502 },
      )
    }

    const content = data?.choices?.[0]?.message?.content ?? '{}'
    let parsed: { suggestions?: unknown[] } = {}
    try {
      parsed = JSON.parse(content) as { suggestions?: unknown[] }
    } catch {
      parsed = { suggestions: [] }
    }

    const promptTokens = data?.usage?.prompt_tokens ?? 0
    const completionTokens = data?.usage?.completion_tokens ?? 0
    const costUsd = (promptTokens * 0.15 + completionTokens * 0.6) / 1_000_000

    return NextResponse.json({
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      costUsd,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro de rede'
    return NextResponse.json({ error: msg }, { status: 504 })
  }
}
