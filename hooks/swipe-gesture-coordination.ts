/**
 * Largura da faixa na borda esquerda (px) para abrir o drawer e ignorar swipe de navegação.
 * Partilhado com o swipe de navegação para não registar touch na mesma zona.
 */
export const SIDEBAR_EDGE_ZONE_PX = 20

/** Largura do drawer mobile em px (18rem ≈ Tailwind default). */
export const MOBILE_SIDEBAR_DRAWER_PX = 288

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
