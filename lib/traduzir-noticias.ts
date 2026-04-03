/**
 * Tradução em lote para /api/news — títulos e resumos em português (Brasil).
 *
 * Regra importante: muitas fontes não enviam `language`; antes isso era tratado
 * como PT e a notícia ficava em inglês. Agora `null`/vazio → autodetecção (auto).
 * Texto que já parece português (acentos / palavras comuns) não é reenviado à API.
 */

import type { NoticiaProcessada } from '@/lib/newsdata'
import { traduzirParaPortugues } from '@/lib/translate'

/** Código ISO usado em MyMemory (pt = não traduzir). */
function codigoOrigem(lang: string | null | undefined): 'pt' | 'en' | 'es' | 'fr' | 'de' | 'auto' {
  if (!lang || !String(lang).trim()) return 'auto'
  const l = String(lang).toLowerCase()
  if (l === 'portuguese' || l.startsWith('pt')) return 'pt'
  if (l === 'english' || l.startsWith('en')) return 'en'
  if (l === 'spanish' || l.startsWith('es')) return 'es'
  if (l === 'french' || l.startsWith('fr')) return 'fr'
  if (l === 'german' || l.startsWith('de')) return 'de'
  return 'auto'
}

/** Evita traduzir texto que já está claramente em português (ex.: fonte sem metadata). */
function parecePortugues(texto: string): boolean {
  const t = texto.trim()
  if (t.length < 8) return false
  if (/[ãõáéíóúâêôçÃÕÁÉÍÓÚÂÊÔÇ]/.test(t)) return true
  return /\b(não|também|será|está|foram|sobre|entre|governo|Brasil|país|hoje|mercado|disse|segundo|após|durante|crise|economia)\b/i.test(
    t
  )
}

const LOTE_PARALELO = 5

export async function traduzirNoticiasRapido(
  processadas: NoticiaProcessada[],
  opts?: { maxTraduzir?: number; loteParalelo?: number }
): Promise<NoticiaProcessada[]> {
  const maxTraduzir = opts?.maxTraduzir ?? Math.max(processadas.length, 1)
  const lote = opts?.loteParalelo ?? LOTE_PARALELO
  const copy = [...processadas]

  const indicesParaTraduzir: number[] = []
  for (let i = 0; i < copy.length; i++) {
    const n = copy[i]
    const origem = codigoOrigem(n.linguagem)
    if (origem === 'pt') continue
    const bloco = `${n.titulo}\n${n.resumo}`
    if (origem === 'auto' && parecePortugues(bloco)) continue
    indicesParaTraduzir.push(i)
  }

  const aTraduzir = indicesParaTraduzir.slice(0, maxTraduzir)

  for (let b = 0; b < aTraduzir.length; b += lote) {
    const chunk = aTraduzir.slice(b, b + lote)
    if (b > 0) await new Promise((r) => setTimeout(r, 100))
    await Promise.all(
      chunk.map(async (i) => {
        const n = copy[i]
        const lang = codigoOrigem(n.linguagem)
        const langPair = lang === 'auto' ? 'auto' : lang
        const [titulo, resumo] = await Promise.all([
          traduzirParaPortugues(n.titulo, langPair),
          traduzirParaPortugues(n.resumo, langPair),
        ])
        copy[i] = { ...n, titulo, resumo, linguagem: 'pt' }
      })
    )
  }

  return copy
}
