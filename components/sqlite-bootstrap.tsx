'use client'

import { useEffect } from 'react'
import { ensureGfDb, restoreGfFromAutoBackupIfNeeded } from '@/lib/gestao-financeira/db'
import { openYieldscanSqlite } from '@/lib/client-db/sqlite-core'

/** Inicializa SQLite + IndexedDB cedo para o resto da app poder ler/gravar preferências. */
export function SqliteBootstrap() {
  useEffect(() => {
    void openYieldscanSqlite()
      .then(() => ensureGfDb())
      .then(() => {
        restoreGfFromAutoBackupIfNeeded()
      })
      .catch(() => {
        /* WASM/IndexedDB indisponível */
      })
  }, [])
  return null
}
