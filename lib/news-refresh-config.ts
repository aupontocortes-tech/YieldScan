/**
 * Ciclo de atualização das notícias — ajustável sem mudar layout.
 *
 * Variáveis de ambiente (opcional):
 * - `NEWS_SERVER_REVALIDATE_SECONDS` — cache Next `unstable_cache` + alinhamento CDN (segundos). Padrão: 60.
 * - `NEWS_CDN_STALE_WHILE_REVALIDATE_SECONDS` — SWR na edge (segundos). Padrão: 45.
 * - `NEXT_PUBLIC_NEWS_STALE_MS` — TanStack `staleTime` no cliente (ms). Padrão: 8000.
 * - `NEXT_PUBLIC_NEWS_REFETCH_MS` — TanStack `refetchInterval` (ms). Padrão: 10000 (mín. 5000).
 * - `NEXT_PUBLIC_NEWS_RELATIVE_CLOCK_MS` — intervalo para atualizar "há X min/h" nos cartões (ms). Padrão: 30000.
 *
 * Nota: "há 12 h" vem da **data de publicação** da fonte (GNews, etc.); refrescar só traz artigos
 * mais novos quando as APIs os publicam. Intervalos menores = apanhar novidades mais cedo.
 */

function parseEnvInt(name: string, fallback: number, min?: number, max?: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  let v = n
  if (min != null) v = Math.max(min, v)
  if (max != null) v = Math.min(max, v)
  return v
}

/** Segundos — só em servidor (route /api/news). */
export const NEWS_SERVER_REVALIDATE_SECONDS = parseEnvInt(
  'NEWS_SERVER_REVALIDATE_SECONDS',
  60,
  15,
  300
)

export const NEWS_CDN_S_MAXAGE_SECONDS = NEWS_SERVER_REVALIDATE_SECONDS

export const NEWS_CDN_STALE_WHILE_REVALIDATE_SECONDS = parseEnvInt(
  'NEWS_CDN_STALE_WHILE_REVALIDATE_SECONDS',
  Math.min(120, Math.max(45, NEWS_SERVER_REVALIDATE_SECONDS * 4)),
  15,
  600
)

/** Milissegundos — exposto ao cliente (build-time). */
export const NEWS_CLIENT_STALE_MS = parseEnvInt(
  'NEXT_PUBLIC_NEWS_STALE_MS',
  60_000,
  10_000,
  300_000
)

export const NEWS_CLIENT_REFETCH_MS = parseEnvInt(
  'NEXT_PUBLIC_NEWS_REFETCH_MS',
  120_000,
  30_000,
  600_000
)

/** Atualiza o relógio relativo nos cartões ("há X min"). */
export const NEWS_RELATIVE_CLOCK_MS = parseEnvInt(
  'NEXT_PUBLIC_NEWS_RELATIVE_CLOCK_MS',
  30_000,
  10_000,
  300_000
)
