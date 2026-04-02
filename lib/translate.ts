/**
 * Tradução server-side via MyMemory (gratuita, sem chave obrigatória).
 * Limite: ~5 000 chars/dia sem email · ~10 000/dia com MYMEMORY_EMAIL em .env.local
 *
 * Falha silenciosamente: se a tradução falhar ou exceder o limite, devolve o texto original.
 */

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get'
const AVISO_LIMITE = 'MYMEMORY WARNING'

function textoValido(t: unknown): t is string {
  return typeof t === 'string' && t.trim().length > 0 && !t.includes(AVISO_LIMITE)
}

export async function traduzirParaPortugues(
  texto: string,
  langDe = 'en'
): Promise<string> {
  const t = texto?.trim()
  if (!t) return texto
  if (langDe.startsWith('pt')) return texto

  const params = new URLSearchParams({
    q: t.slice(0, 480),
    langpair: `${langDe}|pt-BR`,
  })
  const email = process.env.MYMEMORY_EMAIL?.trim()
  if (email) params.set('de', email)

  try {
    const controller = new AbortController()
    /* Pedidos em lote na API de notícias: timeout mais curto evita fila gigante. */
    const timer = setTimeout(() => controller.abort(), 3_500)
    try {
      const res = await fetch(`${MYMEMORY_URL}?${params}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!res.ok) return texto
      const data = (await res.json()) as {
        responseData?: { translatedText?: unknown }
      }
      const traduzido = data?.responseData?.translatedText
      return textoValido(traduzido) ? traduzido : texto
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return texto
  }
}
