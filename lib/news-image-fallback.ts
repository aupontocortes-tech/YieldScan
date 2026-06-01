/**
 * Imagens de recurso quando a API não envia URL válida.
 * Mantido isolado para o cliente poder importar sem puxar o pipeline pesado de `newsdata`.
 */

export type CategoriaNoticiaImagem = 'CRIPTO' | 'GEOPOLÍTICA' | 'MACRO' | 'IA' | 'ACOES'

const FALLBACK: Record<CategoriaNoticiaImagem, string> = {
  CRIPTO: 'https://source.unsplash.com/600x400/?crypto',
  IA: 'https://source.unsplash.com/600x400/?artificial-intelligence',
  MACRO: 'https://source.unsplash.com/600x400/?economy',
  GEOPOLÍTICA: 'https://source.unsplash.com/600x400/?war',
  ACOES: 'https://source.unsplash.com/600x400/?stock-market',
}

export function fallbackImagemPorCategoria(categoria: CategoriaNoticiaImagem): string {
  return FALLBACK[categoria] ?? FALLBACK.MACRO
}
