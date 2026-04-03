'use client'

import { useEffect } from 'react'
import { openYieldscanSqlite } from '@/lib/client-db/sqlite-core'

/** Inicializa SQLite + IndexedDB cedo para o resto da app poder ler/gravar preferências. */
export function SqliteBootstrap() {
  useEffect(() => {
    void openYieldscanSqlite()
  }, [])
  return null
}
