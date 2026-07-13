import type { CortesHistoryItem, CortesVideoMeta, CortesPlatformId } from '@/lib/cortes-video/types'

const DB_NAME = 'yieldscan_cortes_video_v1'
const DB_VERSION = 1
const STORE_META = 'projects'
const STORE_BLOBS = 'blobs'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'id' })
      }
    }
  })
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IDB request failed'))
  })
}

export async function listCortesHistory(): Promise<CortesHistoryItem[]> {
  const db = await openDb()
  const tx = db.transaction(STORE_META, 'readonly')
  const all = await idbReq(tx.objectStore(STORE_META).getAll() as IDBRequest<CortesHistoryItem[]>)
  return (all ?? []).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveCortesHistoryItem(item: CortesHistoryItem): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE_META, 'readwrite')
  await idbReq(tx.objectStore(STORE_META).put(item))
}

export async function deleteCortesHistoryItem(id: string): Promise<void> {
  const db = await openDb()
  let tx = db.transaction(STORE_META, 'readwrite')
  await idbReq(tx.objectStore(STORE_META).delete(id))
  tx = db.transaction(STORE_BLOBS, 'readwrite')
  await idbReq(tx.objectStore(STORE_BLOBS).delete(id))
}

export async function saveCortesBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE_BLOBS, 'readwrite')
  await idbReq(tx.objectStore(STORE_BLOBS).put({ id, blob, updatedAt: Date.now() }))
}

export async function loadCortesBlob(id: string): Promise<Blob | null> {
  const db = await openDb()
  const tx = db.transaction(STORE_BLOBS, 'readonly')
  const row = await idbReq(
    tx.objectStore(STORE_BLOBS).get(id) as IDBRequest<{ id: string; blob: Blob } | undefined>,
  )
  return row?.blob ?? null
}

export function newHistoryId(): string {
  return `cv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function buildHistoryItem(input: {
  id: string
  title: string
  meta: CortesVideoMeta
  platformId?: CortesPlatformId | null
  hasTranscript?: boolean
  hasExport?: boolean
  thumbnailDataUrl?: string
  createdAt?: number
}): CortesHistoryItem {
  const now = Date.now()
  return {
    id: input.id,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    title: input.title,
    meta: input.meta,
    platformId: input.platformId ?? null,
    hasTranscript: input.hasTranscript ?? false,
    hasExport: input.hasExport ?? false,
    thumbnailDataUrl: input.thumbnailDataUrl,
  }
}
