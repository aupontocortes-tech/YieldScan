import type { AnalysisTone, TendenciasApiResponse } from '@/lib/tendencias/types'

const TONE_HINT: Record<AnalysisTone, string> = {
  conservador: 'Tom cauteloso, foco em riscos e confirmações.',
  neutro: 'Tom profissional equilibrado, factos antes de opinião.',
  agressivo: 'Tom directo, destaca oportunidades e movimentos fortes.',
}

export async function enrichTendenciasWithLlm(
  payload: TendenciasApiResponse,
  opts: { tone: AnalysisTone; customNote?: string }
): Promise<TendenciasApiResponse> {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) return payload

  const context = {
    sentiment: payload.market.sentiment,
    trendIndex: payload.market.trendIndex,
    btcDominance: payload.market.btcDominance,
    narratives: payload.narratives.slice(0, 4).map((n) => n.label),
    topTokens: payload.buckets.acelerando.slice(0, 3).map((t) => t.symbol),
    news: { pos: payload.news.positivo, neg: payload.news.negativo },
    defi: payload.defi.summary,
    alerts: payload.alerts.slice(0, 4).map((a) => a.title),
  }

  const system = `És analista cripto profissional. Responde só em português (PT). ${TONE_HINT[opts.tone]} Máximo 3 frases, estilo terminal Bloomberg/crypto.`
  const user = `Com base nestes dados JSON, escreve "O que observar hoje":
${JSON.stringify(context)}
${opts.customNote?.trim() ? `Nota do utilizador: ${opts.customNote.trim()}` : ''}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 280,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return payload
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = json.choices?.[0]?.message?.content?.trim()
    if (!text) return payload
    return {
      ...payload,
      observeToday: text,
      meta: { ...payload.meta, llmUsed: true },
    }
  } catch {
    return payload
  }
}
