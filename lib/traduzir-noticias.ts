/**
 * Tradução em lote para /api/news — muito mais rápida que um artigo de cada vez.
 * Só os primeiros N não-PT são traduzidos (o resto fica no idioma original).
 */

import type { NoticiaProcessada } from '@/lib/newsdata'
import { traduzirParaPortugues } from '@/lib/translate'

function normalizarLang(lang: string | null): string {
  if (!lang) return 'pt'
  const l = lang.toLowerCase()
  if (l === 'portuguese' || l.startsWith('pt')) return 'pt'
  if (l === 'english' || l.startsWith('en')) return 'en'
  if (l === 'spanish' || l.startsWith('es')) return 'es'
  if (l === 'french' || l.startsWith('fr')) return 'fr'
  return l.slice(0, 2)
}

const MAX_TRADUZIR_PADRAO = 24
const LOTE_PARALELO = 6

export async function traduzirNoticiasRapido(
  processadas: NoticiaProcessada[],
  opts?: { maxTraduzir?: number; loteParalelo?: number }
): Promise<NoticiaProcessada[]> {
  const maxTraduzir = opts?.maxTraduzir ?? MAX_TRADUZIR_PADRAO
  const lote = opts?.loteParalelo ?? LOTE_PARALELO
  const copy = [...processadas]

  const indicesNaoPt: number[] = []
  for (let i = 0; i < copy.length; i++) {
    if (normalizarLang(copy[i].linguagem) !== 'pt') indicesNaoPt.push(i)
  }
  const aTraduzir = indicesNaoPt.slice(0, maxTraduzir)

  for (let b = 0; b < aTraduzir.length; b += lote) {
    const chunk = aTraduzir.slice(b, b + lote)
    await Promise.all(
      chunk.map(async (i) => {
        const n = copy[i]
        const lang = normalizarLang(n.linguagem)
        const [titulo, resumo] = await Promise.all([
          traduzirParaPortugues(n.titulo, lang),
          traduzirParaPortugues(n.resumo, lang),
        ])
        copy[i] = { ...n, titulo, resumo }
      })
    )
  }

  return copy
}
