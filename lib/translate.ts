/**
 * Tradução server-side via MyMemory (gratuita, sem chave obrigatória).
 * Limite: ~5 000 chars/dia sem email · ~10 000/dia com MYMEMORY_EMAIL em .env.local
 *
 * Falha silenciosamente: se a tradução falhar ou exceder o limite, devolve o texto original.
 */

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get'
const AVISO_LIMITE = 'MYMEMORY WARNING'

/** pt-PT por defeito (UI YieldScan); override com NEWS_TARGET_LANG=pt-BR */
function langAlvo(): string {
  const v = process.env.NEWS_TARGET_LANG?.trim()
  if (v) return v
  return 'pt-PT'
}

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

  /** Idioma desconhecido: MyMemory autodetecta a origem → português */
  const alvo = langAlvo()
  const langpair = langDe === 'auto' ? `auto|${alvo}` : `${langDe}|${alvo}`

  async function pedir(pair: string): Promise<string | null> {
    const p = new URLSearchParams({ q: t.slice(0, 480), langpair: pair })
    const email = process.env.MYMEMORY_EMAIL?.trim()
    if (email) p.set('de', email)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3_500)
    try {
      const res = await fetch(`${MYMEMORY_URL}?${p}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!res.ok) return null
      const data = (await res.json()) as {
        responseData?: { translatedText?: unknown }
      }
      const traduzido = data?.responseData?.translatedText
      return textoValido(traduzido) ? String(traduzido) : null
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    let out = await pedir(langpair)
    if (out == null && langDe === 'auto') {
      out = await pedir(`en|${alvo}`)
    }
    return out ?? texto
  } catch {
    return texto
  }
}
