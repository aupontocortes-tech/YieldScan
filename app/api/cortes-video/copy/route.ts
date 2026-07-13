import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 45

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

  let body: { transcriptText?: string; platformId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const transcriptText = (body.transcriptText ?? '').trim()
  const platformId = body.platformId ?? 'tiktok'
  if (!transcriptText) {
    return NextResponse.json({ error: 'Transcrição vazia.' }, { status: 400 })
  }

  const system = `Escreves copy em português de Portugal/Brasil para redes sociais.
Devolve JSON: {"title":string,"description":string,"hashtags":string[],"summary":string}
title curto e marcante; description 1-3 frases; 5-12 hashtags sem # no início opcional; summary 1 frase.`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Plataforma: ${platformId}\n\nConteúdo do vídeo:\n${transcriptText.slice(0, 8000)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
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
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(content) as Record<string, unknown>
    } catch {
      parsed = {}
    }

    const promptTokens = data?.usage?.prompt_tokens ?? 0
    const completionTokens = data?.usage?.completion_tokens ?? 0
    const costUsd = (promptTokens * 0.15 + completionTokens * 0.6) / 1_000_000

    return NextResponse.json({
      title: typeof parsed.title === 'string' ? parsed.title : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String) : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      costUsd,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro de rede'
    return NextResponse.json({ error: msg }, { status: 504 })
  }
}
