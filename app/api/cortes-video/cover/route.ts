import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'

function resolveKey(req: Request): string | null {
  const header = req.headers.get('x-openai-key')?.trim()
  if (header) return header
  return process.env.OPENAI_API_KEY?.trim() || null
}

/** Sinais leves de tendência (cripto) para o prompt — falha silenciosa. */
async function fetchTrendHints(): Promise<string> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/search/trending', {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return ''
    const data = (await res.json()) as {
      coins?: Array<{ item?: { name?: string; symbol?: string; market_cap_rank?: number } }>
    }
    const coins = (data.coins ?? [])
      .slice(0, 8)
      .map((c) => {
        const name = c.item?.name || ''
        const sym = c.item?.symbol?.toUpperCase() || ''
        return sym ? `${name} (${sym})` : name
      })
      .filter(Boolean)
    if (!coins.length) return ''
    return `Cripto em alta agora: ${coins.join(', ')}.`
  } catch {
    return ''
  }
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
    trendContext?: string
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
  const clientTrend = typeof body.trendContext === 'string' ? body.trendContext.trim() : ''

  if (!transcriptText && !generateImage) {
    return NextResponse.json({ error: 'Precisas de transcrição ou gerar imagem.' }, { status: 400 })
  }

  const liveTrends = await fetchTrendHints()
  const trendBlock = [clientTrend, liveTrends].filter(Boolean).join(' ')
  const today = new Date().toISOString().slice(0, 10)

  try {
    const metaRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.95,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `És um editor de thumbnails virais (TikTok/Reels/Shorts) em português do Brasil.
Hoje: ${today}.

Objectivo: capa que PARA o scroll — curiosidade, urgência, contraste emocional.

Regras do título (title):
- Máx 7 palavras, MAIÚSCULAS mentais (podes devolver normal; o overlay põe CAPS)
- Usa 1 gancho: número, contraste, erro, dinheiro, “ninguém fala”, “antes que”, “eu testei”
- Evita genéricos (“vídeo incrível”, “assista agora”, “dicas úteis”)
- Se o tema cruzar com tendência actual, INCORPORA (ex. ticker, nome quente) sem forçar

subtitle: 1 frase curta (máx 10 palavras) que completa o gancho.

badge: 1 palavra/2 curtas de urgência: EM ALTA | AGORA | VIRAL | URGENTE | BOMBA | TREND

suggestedTimeSec: frame com expressão/gesto forte, entre 0 e ${Math.floor(durationSec)}.

imagePrompt (inglês): thumbnail YouTube/TikTok, cinematic close-up, high contrast, saturated colors, emotional face or bold visual metaphor, dramatic lighting, empty lower third for text overlay, NO letters/words/logos in the image, 9:16 vertical.

JSON exacto:
{"title":string,"subtitle":string,"badge":string,"suggestedTimeSec":number,"imagePrompt":string,"hookReason":string}`,
          },
          {
            role: 'user',
            content: `Plataforma: ${platformId}
Duração: ${durationSec}s
Tendências / contexto actual:
${trendBlock || 'Sem feed externo — usa ganchos virais do próprio conteúdo e linguagem de 2025/2026.'}

Transcrição / tema do vídeo:
${(transcriptText || 'vídeo sem transcrição — inventa gancho forte genérico de finanças/lifestyle viral').slice(0, 7000)}`,
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
      badge?: string
      suggestedTimeSec?: number
      imagePrompt?: string
      hookReason?: string
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
        `Ultra bold vertical social thumbnail, high contrast cinematic close-up, saturated colors, dramatic lighting, empty lower third for title overlay, no text no letters no watermark, topic: ${parsed.title || 'viral finance clip'}`
      const imgRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: `${prompt.slice(0, 850)}. Style: clickbait thumbnail energy, not corporate, not flat illustration.`,
          size: '1024x1792',
          quality: 'hd',
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
            badge: parsed.badge,
            suggestedTimeSec: parsed.suggestedTimeSec,
            costUsd,
          },
          { status: 502 },
        )
      }
      imageBase64 = imgData?.data?.[0]?.b64_json ?? null
      costUsd += 0.08
    }

    return NextResponse.json({
      title: typeof parsed.title === 'string' ? parsed.title : 'Ninguém te contou isto',
      subtitle: typeof parsed.subtitle === 'string' ? parsed.subtitle : '',
      badge: typeof parsed.badge === 'string' ? parsed.badge : 'EM ALTA',
      suggestedTimeSec:
        typeof parsed.suggestedTimeSec === 'number' ? parsed.suggestedTimeSec : durationSec * 0.2,
      imagePrompt: parsed.imagePrompt ?? null,
      hookReason: typeof parsed.hookReason === 'string' ? parsed.hookReason : null,
      imageBase64,
      costUsd,
      trendUsed: Boolean(trendBlock),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro de rede'
    return NextResponse.json({ error: msg }, { status: 504 })
  }
}
