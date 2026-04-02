/**
 * Zona a partir da borda esquerda (px) onde o gesto abre o drawer do menu.
 * Partilhado com o swipe de navegação para não registar touch na mesma zona.
 */
export const SIDEBAR_EDGE_ZONE_PX = 28

/**
 * Evita que o gesto de abrir o menu pela borda dispare também o swipe de navegação (ir para /).
 */
let suppressMainNavSwipeUntil = 0

export function suppressMainNavSwipeFor(ms: number) {
  suppressMainNavSwipeUntil = Date.now() + ms
}

export function isMainNavSwipeSuppressed(): boolean {
  return Date.now() < suppressMainNavSwipeUntil
}
