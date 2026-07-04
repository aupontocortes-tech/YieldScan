import { createHmac } from 'node:crypto'

const MIN_PASSPHRASE_LEN = 6
const MAX_PASSPHRASE_LEN = 128

function pepper(): string {
  return (
    process.env.SYNC_PASSKEY_PEPPER?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    'yieldscan-dev-pepper-change-in-production'
  )
}

export function normalizePassphrase(raw: string): string {
  return raw.trim().normalize('NFKC')
}

export function validatePassphrase(raw: string): string | null {
  const n = normalizePassphrase(raw)
  if (n.length < MIN_PASSPHRASE_LEN) {
    return `Use pelo menos ${MIN_PASSPHRASE_LEN} caracteres.`
  }
  if (n.length > MAX_PASSPHRASE_LEN) {
    return `Máximo ${MAX_PASSPHRASE_LEN} caracteres.`
  }
  return null
}

export function derivePassKey(normalizedPassphrase: string): string {
  return createHmac('sha256', pepper()).update(normalizedPassphrase).digest('hex')
}
