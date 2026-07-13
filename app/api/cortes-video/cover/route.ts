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
    transcriptText?: string
    platformId?: string
    durationSec?: number
    generateImage?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const transcriptText = (body.transcriptText ?? '').trim()
  const platformId = body.platformId ?? 'tiktok'
  const durationSec = Number(body.durationSec) > 0 ? Number(body.durationSec) : 60
  const generateImage = body.generateImage === true

  if (!transcriptText && !generateImage) {
    return NextResponse.json({ error: 'Precisas de transcrição ou gerar imagem.' }, { status: 400 })
  }

  try {
    const metaRes = await fetch('https://api.openai.com/v1/chat/completions', {
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
          {
            role: 'system',
            content: `Crias capas virais para redes sociais. JSON:
{"title":"máx 8 palavras","subtitle":"máx 12 palavras","suggestedTimeSec":number,"imagePrompt":"prompt EN para imagem de capa"}
suggestedTimeSec entre 0 e ${Math.floor(durationSec)}.`,
          },
          {
            role: 'user',
            content: `Plataforma: ${platformId}\nDuração: ${durationSec}s\nTexto:\n${(transcriptText || 'vídeo sem transcrição').slice(0, 6000)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    })

    const metaData = (await metaRes.json().catch(() => null)) as {
      error?: { message?: string }
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    } | null

    if (!metaRes.ok) {
      return NextResponse.json(
        { error: metaData?.error?.message || `OpenAI falhou (${metaRes.status}).` },
        { status: 502 },
      )
    }

    let parsed: {
      title?: string
      subtitle?: string
      suggestedTimeSec?: number
      imagePrompt?: string
    } = {}
    try {
      parsed = JSON.parse(metaData?.choices?.[0]?.message?.content ?? '{}') as typeof parsed
    } catch {
      parsed = {}
    }

    const promptTokens = metaData?.usage?.prompt_tokens ?? 0
    const completionTokens = metaData?.usage?.completion_tokens ?? 0
    let costUsd = (promptTokens * 0.15 + completionTokens * 0.6) / 1_000_000

    let imageBase64: string | null = null
    if (generateImage) {
      const prompt =
        parsed.imagePrompt?.trim() ||
        `Bold social media video thumbnail, cinematic, high contrast, text space at bottom, topic: ${parsed.title || 'viral clip'}`
      const imgRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: prompt.slice(0, 900),
          size: '1024x1792',
          quality: 'standard',
          n: 1,
          response_format: 'b64_json',
        }),
        signal: AbortSignal.timeout(90_000),
      })
      const imgData = (await imgRes.json().catch(() => null)) as {
        error?: { message?: string }
        data?: Array<{ b64_json?: string }>
      } | null
      if (!imgRes.ok) {
        return NextResponse.json(
          {
            error: imgData?.error?.message || 'Falha ao gerar imagem.',
            title: parsed.title,
            subtitle: parsed.subtitle,
            suggestedTimeSec: parsed.suggestedTimeSec,
            costUsd,
          },
          { status: 502 },
        )
      }
      imageBase64 = imgData?.data?.[0]?.b64_json ?? null
      costUsd += 0.04
    }

    return NextResponse.json({
      title: typeof parsed.title === 'string' ? parsed.title : 'Capa do vídeo',
      subtitle: typeof parsed.subtitle === 'string' ? parsed.subtitle : '',
      suggestedTimeSec:
        typeof parsed.suggestedTimeSec === 'number' ? parsed.suggestedTimeSec : durationSec * 0.2,
      imagePrompt: parsed.imagePrompt ?? null,
      imageBase64,
      costUsd,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro de rede'
    return NextResponse.json({ error: msg }, { status: 504 })
  }
}
