/**
 * Tradução em lote para /api/news — títulos e resumos em português.
 */

import type { NoticiaProcessada } from '@/lib/newsdata'
import { pareceIngles, parecePortugues } from '@/lib/news-lang'
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

const LOTE_PARALELO = 6

export async function traduzirNoticiasRapido(
  processadas: NoticiaProcessada[],
  opts?: { maxTraduzir?: number; loteParalelo?: number }
): Promise<NoticiaProcessada[]> {
  const maxTraduzir = opts?.maxTraduzir ?? Math.min(processadas.length, 40)
  const lote = opts?.loteParalelo ?? LOTE_PARALELO
  const copy = [...processadas]

  const indicesParaTraduzir: number[] = []
  for (let i = 0; i < copy.length; i++) {
    const n = copy[i]
    const origem = codigoOrigem(n.linguagem)
    const bloco = `${n.titulo}\n${n.resumo}`
    if (origem === 'pt' || parecePortugues(bloco)) {
      copy[i] = { ...n, linguagem: 'pt' }
      continue
    }
    indicesParaTraduzir.push(i)
  }

  const aTraduzir = indicesParaTraduzir.slice(0, maxTraduzir)

  for (let b = 0; b < aTraduzir.length; b += lote) {
    const chunk = aTraduzir.slice(b, b + lote)
    if (b > 0) await new Promise((r) => setTimeout(r, 80))
    await Promise.all(
      chunk.map(async (i) => {
        const n = copy[i]
        const lang = codigoOrigem(n.linguagem)
        const langPair = lang === 'auto' ? 'auto' : lang
        let titulo = await traduzirParaPortugues(n.titulo, langPair)
        let resumo = await traduzirParaPortugues(n.resumo, langPair)
        if (pareceIngles(titulo)) titulo = await traduzirParaPortugues(n.titulo, 'en')
        if (pareceIngles(resumo)) resumo = await traduzirParaPortugues(n.resumo, 'en')
        copy[i] = { ...n, titulo, resumo, linguagem: 'pt' }
      }),
    )
  }

  return copy
}

export { parecePortugues } from '@/lib/news-lang'
