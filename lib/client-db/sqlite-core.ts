/**
 * SQLite no browser (sql.js WASM) + ficheiro guardado no IndexedDB.
 * Funciona em desktop e telemóvel (Chrome, Safari, Edge).
 *
 * Nota: o serviço "MyMemory" do projeto é só tradução; esta base é armazenamento local YieldScan.
 */

import type { Database } from 'sql.js'

const IDB_NAME = 'yieldscan-sqlite-v1'
const IDB_STORE = 'db'
const IDB_ROW = 'sqlite'

const MIGRATION_FLAG = 'yieldscan-sqlite-migrated-v1'

let db: Database | null = null
let initPromise: Promise<void> | null = null

const pendingWrites: Array<{ key: string; value: string }> = []
let persistTimer: ReturnType<typeof setTimeout> | null = null

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const idb = req.result
      if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.createObjectStore(IDB_STORE)
      }
    }
  })
}

async function idbLoad(): Promise<Uint8Array | null> {
  try {
    const idb = await idbOpen()
    return await new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readonly')
      const r = tx.objectStore(IDB_STORE).get(IDB_ROW)
      r.onsuccess = () => {
        const v = r.result
        if (v instanceof Uint8Array) resolve(v)
        else if (v?.buffer instanceof ArrayBuffer) resolve(new Uint8Array(v.buffer))
        else resolve(null)
      }
      r.onerror = () => reject(r.error)
    })
  } catch {
    return null
  }
}

async function idbSave(data: Uint8Array): Promise<void> {
  const idb = await idbOpen()
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(data, IDB_ROW)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function migrateFromLocalStorage() {
  if (typeof localStorage === 'undefined' || !db || localStorage.getItem(MIGRATION_FLAG)) return

  const putRaw = (key: string, raw: string | null) => {
    if (!raw?.trim()) return
    try {
      db!.run('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, raw])
    } catch {
      /* ignore */
    }
  }

  putRaw(
    'mercado_display_v1',
    localStorage.getItem('yieldscan-mercado-display-v1')
  )
  putRaw(
    'mercado_highlights_v1',
    localStorage.getItem('yieldscan-mercado-highlight-ids')
  )

  try {
    localStorage.setItem(MIGRATION_FLAG, '1')
  } catch {
    /* ignore */
  }
}

function flushPending() {
  if (!db) return
  for (const { key, value } of pendingWrites) {
    try {
      db.run('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, value])
    } catch {
      /* ignore */
    }
  }
  pendingWrites.length = 0
  schedulePersist()
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void persistToIdb()
  }, 400)
}

async function persistToIdb() {
  if (!db) return
  try {
    const data = db.export()
    await idbSave(data)
  } catch {
    /* ignore quota / modo privado */
  }
}

/** Grava o snapshot atual do SQLite (memória → IndexedDB) sem esperar o debounce interno. */
export async function flushYieldscanSqlitePersist(): Promise<void> {
  if (typeof window === 'undefined') return
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  await persistToIdb()
}

export async function openYieldscanSqlite(): Promise<void> {
  if (typeof window === 'undefined') return
  if (db) return
  if (!initPromise) {
    initPromise = (async () => {
      const initSqlJs = (await import('sql.js')).default
      const SQL = await initSqlJs({
        locateFile: (file) => `${window.location.origin}/${file}`,
      })

      const buf = await idbLoad()
      db = buf?.byteLength ? new SQL.Database(buf) : new SQL.Database()

      db.run(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)

      migrateFromLocalStorage()
      flushPending()
    })()
  }
  try {
    await initPromise
  } catch (e) {
    initPromise = null
    throw e
  }
}

export function isYieldscanSqliteOpen(): boolean {
  return db != null
}

export function kvGetJson<T>(key: string): T | null {
  if (!db) return null
  let stmt: ReturnType<Database['prepare']> | null = null
  try {
    stmt = db.prepare('SELECT value FROM kv WHERE key = ?')
    stmt.bind([key])
    if (!stmt.step()) return null
    const row = stmt.get()
    const raw = row?.[0]
    if (typeof raw !== 'string') return null
    return JSON.parse(raw) as T
  } catch {
    return null
  } finally {
    try {
      stmt?.free()
    } catch {
      /* ignore */
    }
  }
}

export function kvSetJson(key: string, value: unknown): void {
  const json = JSON.stringify(value)
  if (!db) {
    pendingWrites.push({ key, value: json })
    void openYieldscanSqlite().then(() => flushPending())
    return
  }
  try {
    db.run('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, json])
  } catch {
    /* ignore */
  }
  schedulePersist()
}

export function kvDelete(key: string): void {
  if (!db) {
    void openYieldscanSqlite().then(() => kvDelete(key))
    return
  }
  try {
    db.run('DELETE FROM kv WHERE key = ?', [key])
  } catch {
    /* ignore */
  }
  schedulePersist()
}
