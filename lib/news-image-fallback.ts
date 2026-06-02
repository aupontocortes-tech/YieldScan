/**
 * Imagens de recurso quando a API não envia URL válida.
 * (source.unsplash.com foi descontinuado — usar picsum + imagens fixas.)
 */

export type CategoriaNoticiaImagem = 'CRIPTO' | 'GEOPOLÍTICA' | 'MACRO' | 'IA' | 'ACOES'

/** URLs estáveis, sem hotlink agressivo. */
const FALLBACK: Record<CategoriaNoticiaImagem, string> = {
  CRIPTO: 'https://picsum.photos/seed/yieldscan-crypto/800/800',
  IA: 'https://picsum.photos/seed/yieldscan-ai/800/800',
  MACRO: 'https://picsum.photos/seed/yieldscan-macro/800/800',
  GEOPOLÍTICA: 'https://picsum.photos/seed/yieldscan-geo/800/800',
  ACOES: 'https://picsum.photos/seed/yieldscan-stocks/800/800',
}

export function fallbackImagemPorCategoria(categoria: CategoriaNoticiaImagem): string {
  return FALLBACK[categoria] ?? FALLBACK.MACRO
}
