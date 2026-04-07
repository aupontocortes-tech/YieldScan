/**
 * Imagens de recurso quando a API não envia URL válida.
 * Mantido isolado para o cliente poder importar sem puxar o pipeline pesado de `newsdata`.
 */

export type CategoriaNoticiaImagem = 'CRIPTO' | 'GEOPOLÍTICA' | 'MACRO' | 'IA'

const FALLBACK: Record<CategoriaNoticiaImagem, string> = {
  CRIPTO: 'https://source.unsplash.com/600x400/?crypto,bitcoin',
  IA: 'https://source.unsplash.com/600x400/?artificial-intelligence',
  MACRO: 'https://source.unsplash.com/600x400/?economy,stock-market',
  GEOPOLÍTICA: 'https://source.unsplash.com/600x400/?war,politics',
}

export function fallbackImagemPorCategoria(categoria: CategoriaNoticiaImagem): string {
  return FALLBACK[categoria] ?? FALLBACK.MACRO
}
