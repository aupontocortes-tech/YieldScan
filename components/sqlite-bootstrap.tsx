'use client'

import { useEffect } from 'react'
import { openYieldscanSqlite } from '@/lib/client-db/sqlite-core'

/** Inicializa SQLite + IndexedDB cedo para o resto da app poder ler/gravar preferências. */
export function SqliteBootstrap() {
  useEffect(() => {
    void openYieldscanSqlite().catch(() => {
      /* WASM/IndexedDB indisponível: prefs em memória/fallback; não bloquear a app */
    })
  }, [])
  return null
}
