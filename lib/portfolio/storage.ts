import type { PortfolioData, PortfolioHolding, PortfolioTransaction } from './types'

const STORAGE_KEY = 'yieldscan_portfolio_v1' as const

export function defaultPortfolio(): PortfolioData {
  return {
    version: 1,
    name: 'Minha Carteira',
    holdings: [],
    transactions: [],
    snapshots: [],
    realizedPnlUsd: 0,
    allocationTargetsPct: {},
  }
}

function normalize(raw: unknown): PortfolioData {
  const base = defaultPortfolio()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  if (o.version !== 1) return base
  const holdings = Array.isArray(o.holdings) ? (o.holdings as PortfolioHolding[]) : []
  const transactions = Array.isArray(o.transactions)
    ? (o.transactions as PortfolioTransaction[])
    : []
  const snapshots = Array.isArray(o.snapshots) ? (o.snapshots as PortfolioData['snapshots']) : []
  const allocationTargetsPct: Record<string, number> = {}
  const rawTargets = o.allocationTargetsPct
  if (rawTargets && typeof rawTargets === 'object' && !Array.isArray(rawTargets)) {
    for (const [k, v] of Object.entries(rawTargets)) {
      if (typeof k !== 'string' || k.length > 80) continue
      const n = typeof v === 'number' ? v : Number(v)
      if (!Number.isFinite(n)) continue
      allocationTargetsPct[k] = Math.max(0, Math.min(100, n))
    }
  }
  return {
    version: 1,
    name: typeof o.name === 'string' && o.name.trim() ? o.name.trim() : base.name,
    holdings: holdings
      .filter(
        (h) =>
          h &&
          typeof h.id === 'string' &&
          typeof h.symbol === 'string' &&
          typeof h.quantity === 'number' &&
          typeof h.avgBuyUsd === 'number',
      )
      .map((h) => ({
        ...h,
        cmcId: typeof h.cmcId === 'number' ? h.cmcId : 0,
        geckoId:
          typeof h.geckoId === 'string' && h.geckoId.trim()
            ? h.geckoId.trim().toLowerCase()
            : undefined,
        iconUrl:
          typeof h.iconUrl === 'string' && h.iconUrl.trim().startsWith('http')
            ? h.iconUrl.trim()
            : undefined,
      })),
    transactions,
    snapshots: snapshots.filter(
      (s) => s && typeof s.t === 'number' && typeof s.totalUsd === 'number',
    ),
    realizedPnlUsd: typeof o.realizedPnlUsd === 'number' ? o.realizedPnlUsd : 0,
    allocationTargetsPct:
      Object.keys(allocationTargetsPct).length > 0 ? allocationTargetsPct : {},
  }
}

export function loadPortfolio(): PortfolioData {
  if (typeof window === 'undefined') return defaultPortfolio()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultPortfolio()
    return normalize(JSON.parse(raw))
  } catch {
    return defaultPortfolio()
  }
}

export function savePortfolio(data: PortfolioData): void {
  if (typeof window === 'undefined') return
  try {
    const name = data.name.trim() || defaultPortfolio().name
    const payload = name === data.name ? data : { ...data, name }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

export function addBuy(
  data: PortfolioData,
  input: {
    cmcId: number
    geckoId?: string
    symbol: string
    name: string
    iconUrl?: string
    qty: number
    priceUsd: number
    at: string
    feeUsd?: number
    note?: string
  },
): PortfolioData {
  const qty = Math.max(0, input.qty)
  if (qty <= 0) return data
  const sym = input.symbol.trim().toUpperCase()
  const existing = data.holdings.find((h) => h.symbol === sym)
  const inputGecko = input.geckoId?.trim().toLowerCase() || undefined
  let holdings: PortfolioHolding[]
  if (existing) {
    const totalQty = existing.quantity + qty
    const newAvg =
      totalQty > 0
        ? (existing.quantity * existing.avgBuyUsd + qty * input.priceUsd) / totalQty
        : input.priceUsd
    const nextCmc = input.cmcId > 0 ? input.cmcId : existing.cmcId
    const nextGecko = inputGecko ?? existing.geckoId
    const nextIcon =
      input.iconUrl?.trim().startsWith('http')
        ? input.iconUrl.trim()
        : existing.iconUrl
    holdings = data.holdings.map((h) =>
      h.id === existing.id
        ? {
            ...h,
            cmcId: nextCmc,
            ...(nextGecko ? { geckoId: nextGecko } : {}),
            quantity: totalQty,
            avgBuyUsd: newAvg,
            symbol: sym,
            name: input.name.trim() || h.name,
            ...(nextIcon ? { iconUrl: nextIcon } : {}),
          }
        : h,
    )
  } else {
    const newIcon =
      input.iconUrl?.trim().startsWith('http') ? input.iconUrl.trim() : undefined
    holdings = [
      ...data.holdings,
      {
        id: crypto.randomUUID(),
        cmcId: input.cmcId,
        ...(inputGecko ? { geckoId: inputGecko } : {}),
        symbol: sym,
        name: input.name.trim() || sym,
        ...(newIcon ? { iconUrl: newIcon } : {}),
        quantity: qty,
        avgBuyUsd: input.priceUsd,
        firstBuyAt: input.at,
      },
    ]
  }
  const fee = input.feeUsd != null && Number.isFinite(input.feeUsd) ? Math.max(0, input.feeUsd) : undefined
  const note = input.note?.trim() || undefined
  const tx: PortfolioTransaction = {
    id: crypto.randomUUID(),
    type: 'buy',
    cmcId: input.cmcId,
    ...(inputGecko ? { geckoId: inputGecko } : {}),
    symbol: sym,
    name: input.name.trim() || sym,
    quantity: qty,
    priceUsd: input.priceUsd,
    at: input.at,
    feeUsd: fee,
    note,
  }
  return { ...data, holdings, transactions: [tx, ...data.transactions] }
}

export function updateHolding(
  data: PortfolioData,
  id: string,
  patch: Partial<Pick<PortfolioHolding, 'quantity' | 'avgBuyUsd' | 'firstBuyAt' | 'name'>>,
): PortfolioData {
  const holdings = data.holdings.map((h) => {
    if (h.id !== id) return h
    const quantity =
      typeof patch.quantity === 'number' && patch.quantity >= 0 ? patch.quantity : h.quantity
    const avgBuyUsd =
      typeof patch.avgBuyUsd === 'number' && patch.avgBuyUsd >= 0 ? patch.avgBuyUsd : h.avgBuyUsd
    const firstBuyAt =
      typeof patch.firstBuyAt === 'string' && patch.firstBuyAt ? patch.firstBuyAt : h.firstBuyAt
    const name = typeof patch.name === 'string' && patch.name.trim() ? patch.name.trim() : h.name
    return { ...h, quantity, avgBuyUsd, firstBuyAt, name }
  })
  return { ...data, holdings }
}

export function removeHolding(data: PortfolioData, id: string): PortfolioData {
  const nextTargets = { ...(data.allocationTargetsPct ?? {}) }
  delete nextTargets[id]
  return {
    ...data,
    holdings: data.holdings.filter((h) => h.id !== id),
    allocationTargetsPct: nextTargets,
  }
}

export function registerSell(
  data: PortfolioData,
  holdingId: string,
  qty: number,
  sellPriceUsd: number,
  at: string,
  meta?: { feeUsd?: number; note?: string },
): { data: PortfolioData } | { error: string } {
  const h = data.holdings.find((x) => x.id === holdingId)
  if (!h) return { error: 'Posição não encontrada.' }
  if (qty <= 0 || qty > h.quantity + 1e-12) return { error: 'Quantidade inválida.' }
  const realized = qty * (sellPriceUsd - h.avgBuyUsd)
  const newQty = h.quantity - qty
  const holdings =
    newQty < 1e-10
      ? data.holdings.filter((x) => x.id !== holdingId)
      : data.holdings.map((x) => (x.id === holdingId ? { ...x, quantity: newQty } : x))
  const fee =
    meta?.feeUsd != null && Number.isFinite(meta.feeUsd) ? Math.max(0, meta.feeUsd) : undefined
  const note = meta?.note?.trim() || undefined
  const tx: PortfolioTransaction = {
    id: crypto.randomUUID(),
    type: 'sell',
    cmcId: h.cmcId,
    ...(h.geckoId ? { geckoId: h.geckoId } : {}),
    symbol: h.symbol,
    name: h.name,
    quantity: qty,
    priceUsd: sellPriceUsd,
    at,
    realizedPnlUsd: realized,
    feeUsd: fee,
    note,
  }
  const nextTargets = { ...(data.allocationTargetsPct ?? {}) }
  if (newQty < 1e-10) delete nextTargets[holdingId]

  return {
    data: {
      ...data,
      holdings,
      realizedPnlUsd: data.realizedPnlUsd + realized,
      transactions: [tx, ...data.transactions],
      allocationTargetsPct: nextTargets,
    },
  }
}

export function appendSnapshot(data: PortfolioData, totalUsd: number, max = 500): PortfolioData {
  const t = Date.now()
  if (data.snapshots.length === 0 && totalUsd > 0) {
    return {
      ...data,
      snapshots: [
        { t, totalUsd },
        { t: t - 60_000, totalUsd },
      ].slice(0, max),
    }
  }
  const last = data.snapshots[0]
  if (last && Math.abs(last.totalUsd - totalUsd) < 0.01 && t - last.t < 30_000) {
    return data
  }
  const next = [{ t, totalUsd }, ...data.snapshots].slice(0, max)
  return { ...data, snapshots: next }
}
