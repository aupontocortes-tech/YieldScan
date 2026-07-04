export function maskUserId(userId: string): string {
  const t = userId.trim()
  if (t.length <= 12) return t
  return `${t.slice(0, 8)}…${t.slice(-4)}`
}
