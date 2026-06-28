import {
  flushYieldscanSqlitePersist,
  kvGetJson,
  kvSetJson,
  sqlQuery,
  sqlRun,
  whenYieldscanSqliteReady,
} from '@/lib/client-db/sqlite-core'
import {
  DEFAULT_GF_CASH_BOXES,
  DEFAULT_GF_CATEGORIES,
  DEFAULT_GF_CRYPTO_WALLETS,
} from '@/lib/gestao-financeira/categories-default'
import type {
  GfBackupPayload,
  GfCashBox,
  GfCategory,
  GfCryptoHolding,
  GfCryptoWallet,
  GfDebt,
  GfInvestment,
  GfPatrimonySnapshot,
  GfTodo,
  GfTodoPriority,
  GfTransaction,
  GfTransactionType,
} from '@/lib/gestao-financeira/types'

const SCHEMA_VERSION = 2
const SCHEMA_KEY = 'gf_schema_version'
const AUTO_BACKUP_KEY = 'gf_auto_backup_v1'
/** Cópia extra fora do SQLite — sobrevive se o Android limpar o IndexedDB. */
const EMERGENCY_LS_KEY = 'yieldscan_gf_emergency_backup_v1'

let migrated = false
let backupTimer: ReturnType<typeof setTimeout> | null = null

function nowIso(): string {
  return new Date().toISOString()
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `gf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function rowCategory(r: Record<string, unknown>): GfCategory {
  return {
    id: String(r.id),
    name: String(r.name),
    type: r.type as GfCategory['type'],
    icon: r.icon != null ? String(r.icon) : null,
    isDefault: Number(r.is_default) === 1,
    createdAt: String(r.created_at),
  }
}

function rowCashBox(r: Record<string, unknown>): GfCashBox {
  return {
    id: String(r.id),
    name: String(r.name),
    balance: Number(r.balance),
    goal: r.goal != null ? Number(r.goal) : null,
    note: r.note != null ? String(r.note) : null,
    sortOrder: Number(r.sort_order ?? 0),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }
}

function rowTransaction(r: Record<string, unknown>): GfTransaction {
  return {
    id: String(r.id),
    type: r.type as GfTransactionType,
    amount: Number(r.amount),
    categoryId: r.category_id != null ? String(r.category_id) : null,
    cashBoxId: String(r.cash_box_id),
    toCashBoxId: r.to_cash_box_id != null ? String(r.to_cash_box_id) : null,
    description: r.description != null ? String(r.description) : null,
    occurredAt: String(r.occurred_at),
    createdAt: String(r.created_at),
  }
}

function rowDebt(r: Record<string, unknown>): GfDebt {
  return {
    id: String(r.id),
    name: String(r.name),
    totalAmount: Number(r.total_amount),
    paidAmount: Number(r.paid_amount),
    installments: r.installments != null ? Number(r.installments) : null,
    paidInstallments: Number(r.paid_installments ?? 0),
    dueDate: r.due_date != null ? String(r.due_date) : null,
    status: r.status as GfDebt['status'],
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }
}

function rowCryptoWallet(r: Record<string, unknown>): GfCryptoWallet {
  return {
    id: String(r.id),
    name: String(r.name),
    walletType: r.wallet_type as GfCryptoWallet['walletType'],
    createdAt: String(r.created_at),
  }
}

function rowCryptoHolding(r: Record<string, unknown>): GfCryptoHolding {
  return {
    id: String(r.id),
    walletId: String(r.wallet_id),
    coinId: String(r.coin_id),
    symbol: String(r.symbol),
    quantity: Number(r.quantity),
    avgPriceUsd: Number(r.avg_price_usd),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }
}

function rowInvestment(r: Record<string, unknown>): GfInvestment {
  return {
    id: String(r.id),
    name: String(r.name),
    amountInvested: Number(r.amount_invested),
    currentValue: r.current_value != null ? Number(r.current_value) : null,
    investmentType: r.investment_type != null ? String(r.investment_type) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }
}

function rowSnapshot(r: Record<string, unknown>): GfPatrimonySnapshot {
  return {
    id: String(r.id),
    totalAssets: Number(r.total_assets),
    netWorth: Number(r.net_worth),
    cashTotal: Number(r.cash_total),
    investmentsTotal: Number(r.investments_total),
    cryptoTotal: Number(r.crypto_total),
    debtsTotal: Number(r.debts_total),
    recordedAt: String(r.recorded_at),
  }
}

function rowTodo(r: Record<string, unknown>): GfTodo {
  return {
    id: String(r.id),
    title: String(r.title),
    notes: r.notes != null ? String(r.notes) : null,
    dueDate: String(r.due_date),
    dueTime: r.due_time != null ? String(r.due_time) : null,
    completed: Number(r.completed) === 1,
    completedAt: r.completed_at != null ? String(r.completed_at) : null,
    priority: (r.priority as GfTodoPriority) ?? 'normal',
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }
}

function runMigrations(): void {
  const current = kvGetJson<number>(SCHEMA_KEY) ?? 0
  if (current >= SCHEMA_VERSION) return

  sqlRun(`
    CREATE TABLE IF NOT EXISTS gf_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      icon TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)
  sqlRun(`
    CREATE TABLE IF NOT EXISTS gf_cash_boxes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      goal REAL,
      note TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  sqlRun(`
    CREATE TABLE IF NOT EXISTS gf_transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id TEXT,
      cash_box_id TEXT NOT NULL,
      to_cash_box_id TEXT,
      description TEXT,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  sqlRun(`
    CREATE TABLE IF NOT EXISTS gf_debts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL DEFAULT 0,
      installments INTEGER,
      paid_installments INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  sqlRun(`
    CREATE TABLE IF NOT EXISTS gf_crypto_wallets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      wallet_type TEXT NOT NULL DEFAULT 'hold',
      created_at TEXT NOT NULL
    )
  `)
  sqlRun(`
    CREATE TABLE IF NOT EXISTS gf_crypto_holdings (
      id TEXT PRIMARY KEY,
      wallet_id TEXT NOT NULL,
      coin_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      quantity REAL NOT NULL,
      avg_price_usd REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  sqlRun(`
    CREATE TABLE IF NOT EXISTS gf_investments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount_invested REAL NOT NULL,
      current_value REAL,
      investment_type TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  sqlRun(`
    CREATE TABLE IF NOT EXISTS gf_patrimony_snapshots (
      id TEXT PRIMARY KEY,
      total_assets REAL NOT NULL,
      net_worth REAL NOT NULL,
      cash_total REAL NOT NULL,
      investments_total REAL NOT NULL,
      crypto_total REAL NOT NULL,
      debts_total REAL NOT NULL,
      recorded_at TEXT NOT NULL
    )
  `)
  sqlRun(`
    CREATE TABLE IF NOT EXISTS gf_todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT,
      due_date TEXT NOT NULL,
      due_time TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  seedDefaultsIfEmpty()
  kvSetJson(SCHEMA_KEY, SCHEMA_VERSION)
}

function seedDefaultsIfEmpty(): void {
  const catCount = sqlQuery<{ c: number }>('SELECT COUNT(*) as c FROM gf_categories')[0]?.c ?? 0
  if (catCount === 0) {
    const ts = nowIso()
    DEFAULT_GF_CATEGORIES.forEach((c, i) => {
      sqlRun(
        'INSERT INTO gf_categories (id, name, type, icon, is_default, created_at) VALUES (?, ?, ?, ?, 1, ?)',
        [newId(), c.name, c.type, c.icon, ts],
      )
      void i
    })
  }

  const boxCount = sqlQuery<{ c: number }>('SELECT COUNT(*) as c FROM gf_cash_boxes')[0]?.c ?? 0
  if (boxCount === 0) {
    const ts = nowIso()
    DEFAULT_GF_CASH_BOXES.forEach((b, i) => {
      sqlRun(
        'INSERT INTO gf_cash_boxes (id, name, balance, goal, note, sort_order, created_at, updated_at) VALUES (?, ?, 0, NULL, ?, ?, ?, ?)',
        [newId(), b.name, b.note, i, ts, ts],
      )
    })
  }

  const walletCount = sqlQuery<{ c: number }>('SELECT COUNT(*) as c FROM gf_crypto_wallets')[0]?.c ?? 0
  if (walletCount === 0) {
    const ts = nowIso()
    DEFAULT_GF_CRYPTO_WALLETS.forEach((w) => {
      sqlRun(
        'INSERT INTO gf_crypto_wallets (id, name, wallet_type, created_at) VALUES (?, ?, ?, ?)',
        [newId(), w.name, w.walletType, ts],
      )
    })
  }
}

export async function ensureGfDb(): Promise<void> {
  await whenYieldscanSqliteReady()
  if (!migrated) {
    runMigrations()
    migrated = true
    scheduleAutoBackup()
  }
}

function writeEmergencyBackup(payload: GfBackupPayload): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(EMERGENCY_LS_KEY, JSON.stringify({ at: Date.now(), payload }))
  } catch {
    /* quota */
  }
}

function readEmergencyBackup(): GfBackupPayload | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(EMERGENCY_LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { payload?: GfBackupPayload }
    return parsed.payload ?? null
  } catch {
    return null
  }
}

function persistAutoBackup(payload: GfBackupPayload): void {
  kvSetJson(AUTO_BACKUP_KEY, { at: Date.now(), payload })
  writeEmergencyBackup(payload)
  void flushYieldscanSqlitePersist()
}

function scheduleAutoBackup(): void {
  if (backupTimer) clearTimeout(backupTimer)
  backupTimer = setTimeout(() => {
    backupTimer = null
    persistAutoBackup(exportGfBackup())
  }, 2000)
}

export function listGfCategories(): GfCategory[] {
  return sqlQuery<Record<string, unknown>>(
    'SELECT * FROM gf_categories ORDER BY is_default DESC, name ASC',
  ).map(rowCategory)
}

export function createGfCategory(name: string, type: GfCategory['type'], icon?: string): GfCategory {
  const cat: GfCategory = {
    id: newId(),
    name: name.trim(),
    type,
    icon: icon ?? '📌',
    isDefault: false,
    createdAt: nowIso(),
  }
  sqlRun(
    'INSERT INTO gf_categories (id, name, type, icon, is_default, created_at) VALUES (?, ?, ?, ?, 0, ?)',
    [cat.id, cat.name, cat.type, cat.icon, cat.createdAt],
  )
  scheduleAutoBackup()
  return cat
}

export function listGfCashBoxes(): GfCashBox[] {
  return sqlQuery<Record<string, unknown>>(
    'SELECT * FROM gf_cash_boxes ORDER BY sort_order ASC, name ASC',
  ).map(rowCashBox)
}

export function updateGfCashBox(
  id: string,
  patch: Partial<Pick<GfCashBox, 'name' | 'goal' | 'note' | 'sortOrder'>>,
): void {
  const ts = nowIso()
  if (patch.name != null) sqlRun('UPDATE gf_cash_boxes SET name = ?, updated_at = ? WHERE id = ?', [patch.name, ts, id])
  if (patch.goal !== undefined) sqlRun('UPDATE gf_cash_boxes SET goal = ?, updated_at = ? WHERE id = ?', [patch.goal, ts, id])
  if (patch.note !== undefined) sqlRun('UPDATE gf_cash_boxes SET note = ?, updated_at = ? WHERE id = ?', [patch.note, ts, id])
  if (patch.sortOrder != null) sqlRun('UPDATE gf_cash_boxes SET sort_order = ?, updated_at = ? WHERE id = ?', [patch.sortOrder, ts, id])
  scheduleAutoBackup()
}

function adjustCashBoxBalance(id: string, delta: number): void {
  sqlRun('UPDATE gf_cash_boxes SET balance = balance + ?, updated_at = ? WHERE id = ?', [
    delta,
    nowIso(),
    id,
  ])
}

export function listGfTransactions(limit = 500): GfTransaction[] {
  return sqlQuery<Record<string, unknown>>(
    'SELECT * FROM gf_transactions ORDER BY occurred_at DESC LIMIT ?',
    [limit],
  ).map(rowTransaction)
}

export function insertGfTransaction(input: {
  type: GfTransactionType
  amount: number
  categoryId?: string | null
  cashBoxId: string
  toCashBoxId?: string | null
  description?: string | null
  occurredAt?: string
}): GfTransaction {
  const tx: GfTransaction = {
    id: newId(),
    type: input.type,
    amount: Math.abs(input.amount),
    categoryId: input.categoryId ?? null,
    cashBoxId: input.cashBoxId,
    toCashBoxId: input.toCashBoxId ?? null,
    description: input.description?.trim() || null,
    occurredAt: input.occurredAt ?? nowIso(),
    createdAt: nowIso(),
  }

  sqlRun(
    `INSERT INTO gf_transactions (id, type, amount, category_id, cash_box_id, to_cash_box_id, description, occurred_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tx.id,
      tx.type,
      tx.amount,
      tx.categoryId,
      tx.cashBoxId,
      tx.toCashBoxId,
      tx.description,
      tx.occurredAt,
      tx.createdAt,
    ],
  )

  if (tx.type === 'income') {
    adjustCashBoxBalance(tx.cashBoxId, tx.amount)
  } else if (tx.type === 'expense') {
    adjustCashBoxBalance(tx.cashBoxId, -tx.amount)
  } else if (tx.type === 'transfer' && tx.toCashBoxId) {
    adjustCashBoxBalance(tx.cashBoxId, -tx.amount)
    adjustCashBoxBalance(tx.toCashBoxId, tx.amount)
  }

  scheduleAutoBackup()
  return tx
}

export function deleteGfTransaction(id: string): boolean {
  const row = sqlQuery<Record<string, unknown>>(
    'SELECT * FROM gf_transactions WHERE id = ? LIMIT 1',
    [id],
  )[0]
  if (!row) return false

  const tx = rowTransaction(row)

  if (tx.type === 'income') {
    adjustCashBoxBalance(tx.cashBoxId, -tx.amount)
  } else if (tx.type === 'expense') {
    adjustCashBoxBalance(tx.cashBoxId, tx.amount)
  } else if (tx.type === 'transfer' && tx.toCashBoxId) {
    adjustCashBoxBalance(tx.cashBoxId, tx.amount)
    adjustCashBoxBalance(tx.toCashBoxId, -tx.amount)
  }

  sqlRun('DELETE FROM gf_transactions WHERE id = ?', [id])
  scheduleAutoBackup()
  return true
}

export function listGfDebts(): GfDebt[] {
  return sqlQuery<Record<string, unknown>>(
    'SELECT * FROM gf_debts ORDER BY due_date ASC, name ASC',
  ).map(rowDebt)
}

export function insertGfDebt(input: Omit<GfDebt, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: GfDebt['status'] }): GfDebt {
  const debt: GfDebt = {
    id: newId(),
    name: input.name.trim(),
    totalAmount: input.totalAmount,
    paidAmount: input.paidAmount ?? 0,
    installments: input.installments ?? null,
    paidInstallments: input.paidInstallments ?? 0,
    dueDate: input.dueDate ?? null,
    status: input.status ?? 'active',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  sqlRun(
    `INSERT INTO gf_debts (id, name, total_amount, paid_amount, installments, paid_installments, due_date, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      debt.id,
      debt.name,
      debt.totalAmount,
      debt.paidAmount,
      debt.installments,
      debt.paidInstallments,
      debt.dueDate,
      debt.status,
      debt.createdAt,
      debt.updatedAt,
    ],
  )
  scheduleAutoBackup()
  return debt
}

export function updateGfDebtPayment(id: string, paidAmount: number, paidInstallments?: number): void {
  const ts = nowIso()
  sqlRun(
    'UPDATE gf_debts SET paid_amount = ?, paid_installments = COALESCE(?, paid_installments), updated_at = ?, status = CASE WHEN ? >= total_amount THEN \'paid\' ELSE status END WHERE id = ?',
    [paidAmount, paidInstallments ?? null, ts, paidAmount, id],
  )
  scheduleAutoBackup()
}

export function deleteGfDebt(id: string): boolean {
  const row = sqlQuery<Record<string, unknown>>('SELECT id FROM gf_debts WHERE id = ? LIMIT 1', [id])[0]
  if (!row) return false
  sqlRun('DELETE FROM gf_debts WHERE id = ?', [id])
  scheduleAutoBackup()
  return true
}

export function listGfCryptoWallets(): GfCryptoWallet[] {
  return sqlQuery<Record<string, unknown>>(
    'SELECT * FROM gf_crypto_wallets ORDER BY name ASC',
  ).map(rowCryptoWallet)
}

export function listGfCryptoHoldings(): GfCryptoHolding[] {
  return sqlQuery<Record<string, unknown>>(
    'SELECT * FROM gf_crypto_holdings ORDER BY symbol ASC',
  ).map(rowCryptoHolding)
}

export function upsertGfCryptoHolding(input: {
  walletId: string
  coinId: string
  symbol: string
  quantity: number
  avgPriceUsd: number
}): GfCryptoHolding {
  const existing = sqlQuery<Record<string, unknown>>(
    'SELECT * FROM gf_crypto_holdings WHERE wallet_id = ? AND coin_id = ? LIMIT 1',
    [input.walletId, input.coinId],
  )[0]

  const ts = nowIso()
  if (existing) {
    sqlRun(
      'UPDATE gf_crypto_holdings SET quantity = ?, avg_price_usd = ?, symbol = ?, updated_at = ? WHERE id = ?',
      [input.quantity, input.avgPriceUsd, input.symbol.toUpperCase(), ts, String(existing.id)],
    )
    scheduleAutoBackup()
    return rowCryptoHolding({ ...existing, quantity: input.quantity, avg_price_usd: input.avgPriceUsd, symbol: input.symbol, updated_at: ts })
  }

  const holding: GfCryptoHolding = {
    id: newId(),
    walletId: input.walletId,
    coinId: input.coinId,
    symbol: input.symbol.toUpperCase(),
    quantity: input.quantity,
    avgPriceUsd: input.avgPriceUsd,
    createdAt: ts,
    updatedAt: ts,
  }
  sqlRun(
    `INSERT INTO gf_crypto_holdings (id, wallet_id, coin_id, symbol, quantity, avg_price_usd, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      holding.id,
      holding.walletId,
      holding.coinId,
      holding.symbol,
      holding.quantity,
      holding.avgPriceUsd,
      holding.createdAt,
      holding.updatedAt,
    ],
  )
  scheduleAutoBackup()
  return holding
}

export function deleteGfCryptoHolding(id: string): boolean {
  const row = sqlQuery<Record<string, unknown>>(
    'SELECT id FROM gf_crypto_holdings WHERE id = ? LIMIT 1',
    [id],
  )[0]
  if (!row) return false
  sqlRun('DELETE FROM gf_crypto_holdings WHERE id = ?', [id])
  scheduleAutoBackup()
  return true
}

export function listGfInvestments(): GfInvestment[] {
  return sqlQuery<Record<string, unknown>>(
    'SELECT * FROM gf_investments ORDER BY name ASC',
  ).map(rowInvestment)
}

export function upsertGfInvestment(input: {
  id?: string
  name: string
  amountInvested: number
  currentValue?: number | null
  investmentType?: string | null
}): GfInvestment {
  const ts = nowIso()
  if (input.id) {
    sqlRun(
      'UPDATE gf_investments SET name = ?, amount_invested = ?, current_value = ?, investment_type = ?, updated_at = ? WHERE id = ?',
      [input.name, input.amountInvested, input.currentValue ?? null, input.investmentType ?? null, ts, input.id],
    )
    scheduleAutoBackup()
    const row = sqlQuery<Record<string, unknown>>('SELECT * FROM gf_investments WHERE id = ?', [input.id])[0]
    return rowInvestment(row)
  }

  const inv: GfInvestment = {
    id: newId(),
    name: input.name.trim(),
    amountInvested: input.amountInvested,
    currentValue: input.currentValue ?? null,
    investmentType: input.investmentType ?? null,
    createdAt: ts,
    updatedAt: ts,
  }
  sqlRun(
    'INSERT INTO gf_investments (id, name, amount_invested, current_value, investment_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [inv.id, inv.name, inv.amountInvested, inv.currentValue, inv.investmentType, inv.createdAt, inv.updatedAt],
  )
  scheduleAutoBackup()
  return inv
}

export function insertGfPatrimonySnapshot(snapshot: Omit<GfPatrimonySnapshot, 'id'>): GfPatrimonySnapshot {
  const row: GfPatrimonySnapshot = { id: newId(), ...snapshot }
  sqlRun(
    `INSERT INTO gf_patrimony_snapshots (id, total_assets, net_worth, cash_total, investments_total, crypto_total, debts_total, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.totalAssets,
      row.netWorth,
      row.cashTotal,
      row.investmentsTotal,
      row.cryptoTotal,
      row.debtsTotal,
      row.recordedAt,
    ],
  )
  scheduleAutoBackup()
  return row
}

export function listGfPatrimonySnapshots(limit = 90): GfPatrimonySnapshot[] {
  return sqlQuery<Record<string, unknown>>(
    'SELECT * FROM gf_patrimony_snapshots ORDER BY recorded_at ASC LIMIT ?',
    [limit],
  ).map(rowSnapshot)
}

export function findGfCategoryByName(name: string): GfCategory | null {
  const norm = name.trim().toLowerCase()
  const hit = listGfCategories().find((c) => c.name.toLowerCase() === norm)
  return hit ?? null
}

export function getDefaultCashBox(): GfCashBox | null {
  return listGfCashBoxes()[0] ?? null
}

export function listGfTodos(includeCompleted = true): GfTodo[] {
  const where = includeCompleted ? '' : ' WHERE completed = 0'
  return sqlQuery<Record<string, unknown>>(
    `SELECT * FROM gf_todos${where} ORDER BY completed ASC, due_date ASC, (due_time IS NULL), due_time ASC, created_at ASC`,
  ).map(rowTodo)
}

export function insertGfTodo(input: {
  title: string
  notes?: string | null
  dueDate: string
  dueTime?: string | null
  priority?: GfTodoPriority
}): GfTodo {
  const ts = nowIso()
  const id = newId()
  const dueDate = input.dueDate.slice(0, 10)
  sqlRun(
    `INSERT INTO gf_todos (id, title, notes, due_date, due_time, completed, completed_at, priority, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)`,
    [id, input.title.trim(), input.notes?.trim() || null, dueDate, input.dueTime ?? null, input.priority ?? 'normal', ts, ts],
  )
  persistAutoBackup(exportGfBackup())
  return rowTodo(
    sqlQuery<Record<string, unknown>>('SELECT * FROM gf_todos WHERE id = ?', [id])[0]!,
  )
}

export function insertGfTodosBatch(
  items: {
    title: string
    notes?: string | null
    dueDate: string
    dueTime?: string | null
    priority?: GfTodoPriority
  }[],
): GfTodo[] {
  return items.map((item) => insertGfTodo(item))
}

export function updateGfTodo(
  id: string,
  patch: Partial<Pick<GfTodo, 'title' | 'notes' | 'dueDate' | 'dueTime' | 'priority' | 'completed'>>,
): GfTodo | null {
  const existing = sqlQuery<Record<string, unknown>>('SELECT * FROM gf_todos WHERE id = ?', [id])[0]
  if (!existing) return null
  const current = rowTodo(existing)
  const ts = nowIso()
  const completed = patch.completed ?? current.completed
  const completedAt =
    patch.completed === true && !current.completed
      ? ts
      : patch.completed === false
        ? null
        : current.completedAt
  sqlRun(
    `UPDATE gf_todos SET title = ?, notes = ?, due_date = ?, due_time = ?, completed = ?, completed_at = ?, priority = ?, updated_at = ?
     WHERE id = ?`,
    [
      (patch.title ?? current.title).trim(),
      patch.notes !== undefined ? patch.notes : current.notes,
      (patch.dueDate ?? current.dueDate).slice(0, 10),
      patch.dueTime !== undefined ? patch.dueTime : current.dueTime,
      completed ? 1 : 0,
      completedAt,
      patch.priority ?? current.priority,
      ts,
      id,
    ],
  )
  persistAutoBackup(exportGfBackup())
  return rowTodo(sqlQuery<Record<string, unknown>>('SELECT * FROM gf_todos WHERE id = ?', [id])[0]!)
}

export function toggleGfTodoComplete(id: string): GfTodo | null {
  const existing = sqlQuery<Record<string, unknown>>('SELECT * FROM gf_todos WHERE id = ?', [id])[0]
  if (!existing) return null
  const current = rowTodo(existing)
  return updateGfTodo(id, { completed: !current.completed })
}

export function deleteGfTodo(id: string): boolean {
  sqlRun('DELETE FROM gf_todos WHERE id = ?', [id])
  persistAutoBackup(exportGfBackup())
  return true
}

export function exportGfBackup(): GfBackupPayload {
  return {
    version: SCHEMA_VERSION,
    exportedAt: nowIso(),
    categories: listGfCategories(),
    cashBoxes: listGfCashBoxes(),
    transactions: listGfTransactions(10_000),
    debts: listGfDebts(),
    cryptoWallets: listGfCryptoWallets(),
    cryptoHoldings: listGfCryptoHoldings(),
    investments: listGfInvestments(),
    patrimonySnapshots: listGfPatrimonySnapshots(365),
    todos: listGfTodos(true),
  }
}

/** Importa backup — faz merge (INSERT OR REPLACE), nunca apaga tabelas. */
export function importGfBackup(payload: GfBackupPayload): void {
  for (const c of payload.categories) {
    sqlRun(
      'INSERT OR REPLACE INTO gf_categories (id, name, type, icon, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [c.id, c.name, c.type, c.icon, c.isDefault ? 1 : 0, c.createdAt],
    )
  }
  for (const b of payload.cashBoxes) {
    sqlRun(
      'INSERT OR REPLACE INTO gf_cash_boxes (id, name, balance, goal, note, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [b.id, b.name, b.balance, b.goal, b.note, b.sortOrder, b.createdAt, b.updatedAt],
    )
  }
  for (const t of payload.transactions) {
    sqlRun(
      `INSERT OR REPLACE INTO gf_transactions (id, type, amount, category_id, cash_box_id, to_cash_box_id, description, occurred_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.type, t.amount, t.categoryId, t.cashBoxId, t.toCashBoxId, t.description, t.occurredAt, t.createdAt],
    )
  }
  for (const d of payload.debts) {
    sqlRun(
      `INSERT OR REPLACE INTO gf_debts (id, name, total_amount, paid_amount, installments, paid_installments, due_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.id, d.name, d.totalAmount, d.paidAmount, d.installments, d.paidInstallments, d.dueDate, d.status, d.createdAt, d.updatedAt],
    )
  }
  for (const w of payload.cryptoWallets) {
    sqlRun('INSERT OR REPLACE INTO gf_crypto_wallets (id, name, wallet_type, created_at) VALUES (?, ?, ?, ?)', [
      w.id,
      w.name,
      w.walletType,
      w.createdAt,
    ])
  }
  for (const h of payload.cryptoHoldings) {
    sqlRun(
      `INSERT OR REPLACE INTO gf_crypto_holdings (id, wallet_id, coin_id, symbol, quantity, avg_price_usd, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [h.id, h.walletId, h.coinId, h.symbol, h.quantity, h.avgPriceUsd, h.createdAt, h.updatedAt],
    )
  }
  for (const i of payload.investments) {
    sqlRun(
      'INSERT OR REPLACE INTO gf_investments (id, name, amount_invested, current_value, investment_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [i.id, i.name, i.amountInvested, i.currentValue, i.investmentType, i.createdAt, i.updatedAt],
    )
  }
  for (const s of payload.patrimonySnapshots) {
    sqlRun(
      `INSERT OR REPLACE INTO gf_patrimony_snapshots (id, total_assets, net_worth, cash_total, investments_total, crypto_total, debts_total, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.totalAssets, s.netWorth, s.cashTotal, s.investmentsTotal, s.cryptoTotal, s.debtsTotal, s.recordedAt],
    )
  }
  for (const t of payload.todos ?? []) {
    sqlRun(
      `INSERT OR REPLACE INTO gf_todos (id, title, notes, due_date, due_time, completed, completed_at, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id,
        t.title,
        t.notes,
        t.dueDate.slice(0, 10),
        t.dueTime,
        t.completed ? 1 : 0,
        t.completedAt,
        t.priority,
        t.createdAt,
        t.updatedAt,
      ],
    )
  }
  persistAutoBackup(exportGfBackup())
}

export function restoreGfFromAutoBackup(): boolean {
  const stored = kvGetJson<{ payload: GfBackupPayload }>(AUTO_BACKUP_KEY)
  if (!stored?.payload) return false
  importGfBackup(stored.payload)
  return true
}

/** True se o utilizador já tem movimentações ou saldos reais (não só caixas vazias por defeito). */
export function hasGfUserData(): boolean {
  const txCount = sqlQuery<{ c: number }>('SELECT COUNT(*) as c FROM gf_transactions')[0]?.c ?? 0
  if (txCount > 0) return true
  const debtCount = sqlQuery<{ c: number }>('SELECT COUNT(*) as c FROM gf_debts')[0]?.c ?? 0
  if (debtCount > 0) return true
  const cryptoCount = sqlQuery<{ c: number }>('SELECT COUNT(*) as c FROM gf_crypto_holdings')[0]?.c ?? 0
  if (cryptoCount > 0) return true
  const boxBalance = sqlQuery<{ c: number }>(
    'SELECT COUNT(*) as c FROM gf_cash_boxes WHERE balance != 0',
  )[0]?.c ?? 0
  return boxBalance > 0
}

function backupHasUserData(payload: GfBackupPayload): boolean {
  if ((payload.transactions?.length ?? 0) > 0) return true
  if ((payload.debts?.length ?? 0) > 0) return true
  if ((payload.cryptoHoldings?.length ?? 0) > 0) return true
  return (payload.cashBoxes ?? []).some((b) => b.balance !== 0)
}

/** Restaura backup automático só se a base actual estiver vazia mas o backup tiver dados. */
export function restoreGfFromAutoBackupIfNeeded(): boolean {
  if (hasGfUserData()) return false

  const stored = kvGetJson<{ payload: GfBackupPayload }>(AUTO_BACKUP_KEY)
  if (stored?.payload && backupHasUserData(stored.payload)) {
    importGfBackup(stored.payload)
    return true
  }

  const emergency = readEmergencyBackup()
  if (emergency && backupHasUserData(emergency)) {
    importGfBackup(emergency)
    return true
  }

  return false
}
