'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarClock,
  ChevronDown,
  DollarSign,
  Pencil,
  Search,
} from 'lucide-react'
import { formatCurrency } from '@/lib/api'
import { CoinAvatar } from '@/lib/portfolio/cmc-assets'
import type { CmcQuote, PortfolioHolding } from '@/lib/portfolio/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type SearchCoin = { id: number; symbol: string; name: string; iconUrl?: string }

type TxTab = 'buy' | 'sell' | 'transfer'

async function fetchPrices(symbols: string[]): Promise<{
  prices: Record<string, CmcQuote>
  error?: string
}> {
  if (!symbols.length) return { prices: {} }
  const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols.join(','))}`)
  const j = (await res.json()) as {
    prices?: Record<string, CmcQuote>
    error?: string
  }
  return { prices: j.prices ?? {}, error: j.error }
}

/** Pesquisa unificada no servidor (map CMC + fallbacks CoinGecko / quotes). */
async function fetchSearch(q: string, signal?: AbortSignal): Promise<SearchCoin[]> {
  const trimmed = q.trim()
  try {
    const res = await fetch(
      `/api/cmc-search?q=${encodeURIComponent(trimmed)}`,
      { signal },
    )
    const j = (await res.json()) as { coins?: SearchCoin[]; error?: string }
    return (j.coins ?? []).filter((c) => c.symbol && (c.id > 0 || c.name))
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return []
    return []
  }
}

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseNum(raw: string): number {
  const t = String(raw)
    .trim()
    .replace(/\$/g, '')
    .replace(/\s/g, '')
  if (!t) return NaN
  if (t.includes('.') && t.includes(',')) {
    return Number(t.replace(/\./g, '').replace(',', '.'))
  }
  if (t.includes(',') && !t.includes('.')) {
    return Number(t.replace(',', '.'))
  }
  return Number(t)
}

type AddTransactionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  holdings: PortfolioHolding[]
  spotPrices: Record<string, CmcQuote>
  /** Símbolo em “Comprar” para a página incluir na query de preços (cotação imediata). */
  onActiveBuySymbolChange?: (symbol: string | null) => void
  onBuy: (input: {
    cmcId: number
    symbol: string
    name: string
    iconUrl?: string
    qty: number
    priceUsd: number
    at: string
    feeUsd?: number
    note?: string
  }) => void
  onSell: (
    holdingId: string,
    qty: number,
    priceUsd: number,
    at: string,
    meta?: { feeUsd?: number; note?: string },
  ) => string | null
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  holdings,
  spotPrices,
  onActiveBuySymbolChange,
  onBuy,
  onSell,
}: AddTransactionDialogProps) {
  const [txTab, setTxTab] = useState<TxTab>('buy')
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const sellPrefillHoldingId = useRef<string | null>(null)

  const [searchQ, setSearchQ] = useState('')
  const [searchHits, setSearchHits] = useState<SearchCoin[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const [selectedCoin, setSelectedCoin] = useState<SearchCoin | null>(null)
  const [sellHoldingId, setSellHoldingId] = useState<string | null>(null)

  /** Se true, não sobrescrever o preço com cotação ao vivo. */
  const skipAutoPrice = useRef(false)

  const [qtyStr, setQtyStr] = useState('')
  const [priceStr, setPriceStr] = useState('')
  const [datetimeStr, setDatetimeStr] = useState(() => toDatetimeLocalValue(new Date()))

  const [feeStr, setFeeStr] = useState('')
  const [noteStr, setNoteStr] = useState('')
  const [feeOpen, setFeeOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)

  const [formErr, setFormErr] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setTxTab('buy')
    setPickerOpen(false)
    setSearchQ('')
    setSearchHits([])
    setSelectedCoin(null)
    setSellHoldingId(null)
    skipAutoPrice.current = false
    setQtyStr('')
    setPriceStr('')
    setDatetimeStr(toDatetimeLocalValue(new Date()))
    setFeeStr('')
    setNoteStr('')
    setFeeOpen(false)
    setNoteOpen(false)
    setFormErr(null)
    sellPrefillHoldingId.current = null
  }, [])

  useEffect(() => {
    if (!open) resetForm()
  }, [open, resetForm])

  useEffect(() => {
    if (!open || !pickerOpen || txTab !== 'buy') return
    const ac = new AbortController()
    const t = window.setTimeout(() => {
      setSearchLoading(true)
      void fetchSearch(searchQ, ac.signal)
        .then((hits) => {
          if (!ac.signal.aborted) setSearchHits(hits)
        })
        .finally(() => {
          if (!ac.signal.aborted) setSearchLoading(false)
        })
    }, 180)
    return () => {
      window.clearTimeout(t)
      ac.abort()
    }
  }, [searchQ, pickerOpen, open, txTab])

  useEffect(() => {
    if (!open || !pickerOpen || txTab !== 'buy') return
    queueMicrotask(() => searchInputRef.current?.focus())
  }, [open, pickerOpen, txTab])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!onActiveBuySymbolChange) return
    if (!open || txTab !== 'buy') {
      onActiveBuySymbolChange(null)
      return
    }
    onActiveBuySymbolChange(selectedCoin?.symbol ?? null)
  }, [open, txTab, selectedCoin?.symbol, onActiveBuySymbolChange])

  const selectedHolding = useMemo(
    () => holdings.find((h) => h.id === sellHoldingId) ?? null,
    [holdings, sellHoldingId],
  )

  useEffect(() => {
    skipAutoPrice.current = false
  }, [selectedCoin?.symbol])

  useEffect(() => {
    if (!open || txTab !== 'buy' || !selectedCoin || skipAutoPrice.current) return
    let cancelled = false
    const apply = (p: number) => {
      if (cancelled || skipAutoPrice.current) return
      setPriceStr(
        p.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 }),
      )
    }
    const spot = spotPrices[selectedCoin.symbol]?.price
    if (spot != null && spot > 0) apply(spot)
    void fetchPrices([selectedCoin.symbol]).then(({ prices }) => {
      const p = prices[selectedCoin.symbol]?.price
      if (p != null && p > 0) apply(p)
    })
    return () => {
      cancelled = true
    }
  }, [open, txTab, selectedCoin, spotPrices])

  useEffect(() => {
    if (!open || txTab !== 'buy' || !selectedCoin) return
    const id = window.setInterval(() => {
      if (skipAutoPrice.current) return
      void fetchPrices([selectedCoin.symbol]).then(({ prices }) => {
        if (skipAutoPrice.current) return
        const p = prices[selectedCoin.symbol]?.price
        if (p != null && p > 0) {
          setPriceStr(
            p.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8,
            }),
          )
        }
      })
    }, 30_000)
    return () => window.clearInterval(id)
  }, [open, txTab, selectedCoin])

  useEffect(() => {
    if (txTab !== 'sell' || !selectedHolding) return
    if (sellPrefillHoldingId.current === selectedHolding.id) return
    sellPrefillHoldingId.current = selectedHolding.id
    const p = spotPrices[selectedHolding.symbol]?.price
    if (p != null && p > 0) {
      setPriceStr(
        p.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 }),
      )
    }
  }, [txTab, selectedHolding, spotPrices])

  const qtyN = parseNum(qtyStr)
  const priceN = parseNum(priceStr)
  const feeN = Math.max(0, parseNum(feeStr) || 0)
  const gross = qtyN > 0 && priceN >= 0 ? qtyN * priceN : 0
  const buyTotal = gross + feeN
  const sellNet = Math.max(0, gross - feeN)

  const submit = useCallback(() => {
    setFormErr(null)
    const at = datetimeStr.trim() || toDatetimeLocalValue(new Date())
    const feeUsd = feeN > 0 ? feeN : undefined
    const note = noteStr.trim() || undefined

    if (txTab === 'transfer') return

    if (txTab === 'buy') {
      if (!selectedCoin) {
        setFormErr('Escolha uma moeda.')
        return
      }
      if (!Number.isFinite(qtyN) || qtyN <= 0) {
        setFormErr('Quantidade inválida.')
        return
      }
      if (!Number.isFinite(priceN) || priceN < 0) {
        setFormErr('Preço inválido.')
        return
      }
      onBuy({
        cmcId: selectedCoin.id,
        symbol: selectedCoin.symbol,
        name: selectedCoin.name,
        iconUrl: selectedCoin.iconUrl,
        qty: qtyN,
        priceUsd: priceN,
        at,
        feeUsd,
        note,
      })
      onOpenChange(false)
      return
    }

    if (txTab === 'sell') {
      if (!selectedHolding) {
        setFormErr('Escolha a posição a vender.')
        return
      }
      if (!Number.isFinite(qtyN) || qtyN <= 0) {
        setFormErr('Quantidade inválida.')
        return
      }
      if (!Number.isFinite(priceN) || priceN < 0) {
        setFormErr('Preço inválido.')
        return
      }
      const err = onSell(selectedHolding.id, qtyN, priceN, at, { feeUsd, note })
      if (err) {
        setFormErr(err)
        return
      }
      onOpenChange(false)
    }
  }, [
    txTab,
    selectedCoin,
    selectedHolding,
    qtyN,
    priceN,
    feeN,
    datetimeStr,
    noteStr,
    onBuy,
    onSell,
    onOpenChange,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          'gap-0 overflow-hidden border border-white/[0.08] bg-[#171924] p-0 text-foreground shadow-2xl sm:max-w-[440px]',
        )}
      >
        <DialogHeader className="border-b border-white/[0.06] px-5 py-4">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Adicionar transação
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-4">
          <Tabs
            value={txTab}
            onValueChange={(v) => {
              setTxTab(v as TxTab)
              setFormErr(null)
              setPickerOpen(false)
              if (v === 'buy') setSellHoldingId(null)
              if (v === 'sell') setSelectedCoin(null)
            }}
          >
            <TabsList className="grid h-11 w-full grid-cols-3 rounded-xl bg-[#0d0f14] p-1">
              <TabsTrigger
                value="buy"
                className="rounded-lg text-sm font-medium data-[state=active]:bg-[#252936] data-[state=active]:text-white data-[state=inactive]:text-muted-foreground"
              >
                Comprar
              </TabsTrigger>
              <TabsTrigger
                value="sell"
                className="rounded-lg text-sm font-medium data-[state=active]:bg-[#252936] data-[state=active]:text-white data-[state=inactive]:text-muted-foreground"
              >
                Vender
              </TabsTrigger>
              <TabsTrigger
                value="transfer"
                className="rounded-lg text-sm font-medium data-[state=active]:bg-[#252936] data-[state=active]:text-white data-[state=inactive]:text-muted-foreground"
              >
                Transferir
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {txTab === 'transfer' ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Transferências entre carteiras estarão disponíveis em breve.
          </div>
        ) : (
          <div className="space-y-4 px-5 py-4">
            {txTab === 'buy' && (
              <div className="grid gap-2" ref={pickerRef}>
                <Label className="text-xs font-medium text-muted-foreground">Criptoativo</Label>
                <button
                  type="button"
                  data-no-swipe-nav
                  onClick={() => setPickerOpen((o) => !o)}
                  className={cn(
                    'flex h-12 w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-[#13161f] px-3 text-left transition-colors hover:bg-[#1a1f2e]',
                    pickerOpen && 'ring-1 ring-[#3b82f6]/40',
                  )}
                >
                  {selectedCoin ? (
                    <>
                      <CoinAvatar
                        cmcId={selectedCoin.id}
                        symbol={selectedCoin.symbol}
                        iconUrl={selectedCoin.iconUrl}
                        size={36}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {selectedCoin.name}{' '}
                        <span className="text-muted-foreground">{selectedCoin.symbol}</span>
                      </span>
                    </>
                  ) : (
                    <span className="flex-1 text-muted-foreground">Escolher moeda</span>
                  )}
                  <ChevronDown className="size-5 shrink-0 text-muted-foreground opacity-70" />
                </button>

                {pickerOpen && (
                  <div
                    className="z-50 overflow-hidden rounded-xl border border-white/[0.08] bg-[#13161f] shadow-xl"
                    data-no-swipe-nav
                  >
                    <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
                      <Search className="size-4 shrink-0 text-muted-foreground" />
                      <Input
                        ref={searchInputRef}
                        value={searchQ}
                        onChange={(e) => setSearchQ(e.target.value)}
                        placeholder="BTC, ETH, Bitcoin…"
                        autoComplete="off"
                        spellCheck={false}
                        className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div className="max-h-[220px] min-h-[120px] overflow-y-auto overscroll-contain">
                      <div className="p-1">
                        {searchLoading ? (
                          <p className="p-3 text-xs text-muted-foreground">A pesquisar…</p>
                        ) : searchHits.length === 0 ? (
                          <div className="space-y-2 p-3 text-xs leading-relaxed text-muted-foreground">
                            <p>Nenhum resultado para &quot;{searchQ.trim() || '…'}&quot;.</p>
                            <p>
                              Confirma <code className="rounded bg-black/40 px-1 py-0.5">COINMARKETCAP_API_KEY</code>{' '}
                              no <code className="rounded bg-black/40 px-1 py-0.5">.env.local</code> e reinicia o
                              servidor.
                            </p>
                          </div>
                        ) : (
                          searchHits.map((c) => (
                            <button
                              key={`${c.id}-${c.symbol}`}
                              type="button"
                              className={cn(
                                'flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition-colors hover:bg-white/[0.06]',
                                selectedCoin?.symbol === c.symbol && 'bg-[#3b82f6]/15',
                              )}
                              onClick={() => {
                                setSelectedCoin(c)
                                setPickerOpen(false)
                              }}
                            >
                              <CoinAvatar
                                cmcId={c.id}
                                symbol={c.symbol}
                                iconUrl={c.iconUrl}
                                size={32}
                              />
                              <span className="min-w-0 flex-1 truncate">
                                <span className="font-medium text-foreground">{c.name}</span>{' '}
                                <span className="text-muted-foreground">{c.symbol}</span>
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {txTab === 'sell' && (
              <div className="grid gap-2">
                <Label className="text-xs font-medium text-muted-foreground">Da tua carteira</Label>
                <div className="max-h-[200px] overflow-y-auto rounded-xl border border-white/[0.08] bg-[#13161f] p-1">
                  {holdings.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      Não tens posições para vender.
                    </p>
                  ) : (
                    holdings.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-white/[0.06]',
                          sellHoldingId === h.id && 'bg-[#3b82f6]/15',
                        )}
                        onClick={() => {
                          setSellHoldingId(h.id)
                          setQtyStr('')
                        }}
                      >
                        <CoinAvatar
                          cmcId={h.cmcId}
                          symbol={h.symbol}
                          iconUrl={h.iconUrl}
                          size={32}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium">{h.name}</span>{' '}
                          <span className="text-muted-foreground">{h.symbol}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {h.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Quantidade</Label>
                <Input
                  value={qtyStr}
                  onChange={(e) => setQtyStr(e.target.value)}
                  placeholder="0,00"
                  data-no-swipe-nav
                  className="h-11 rounded-xl border-white/[0.08] bg-[#13161f] font-mono"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  {txTab === 'buy' ? 'Preço unitário (USD)' : 'Preço por moeda (USD)'}
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    value={priceStr}
                    onChange={(e) => {
                      if (txTab === 'buy') skipAutoPrice.current = true
                      setPriceStr(e.target.value)
                    }}
                    placeholder="0,00"
                    data-no-swipe-nav
                    className="h-11 rounded-xl border-white/[0.08] bg-[#13161f] pl-7 font-mono"
                  />
                </div>
              </div>
            </div>
            {txTab === 'buy' && selectedCoin && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Ao escolheres o ativo, o preço segue a cotação atual (atualiza a cada ~30s). A{' '}
                <span className="text-foreground/90">quantidade × preço</span> entra no total abaixo — podes editar o
                preço se quiseres outro valor.
              </p>
            )}

            <div className="flex flex-wrap items-stretch gap-2">
              <div className="grid min-w-0 flex-1 gap-1">
                <Label className="sr-only">Data e hora</Label>
                <div className="relative">
                  <CalendarClock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="datetime-local"
                    value={datetimeStr}
                    onChange={(e) => setDatetimeStr(e.target.value)}
                    data-no-swipe-nav
                    className="h-11 rounded-xl border-white/[0.08] bg-[#13161f] pl-10 font-mono text-sm"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'h-11 shrink-0 rounded-xl border-white/10 bg-[#13161f] px-3',
                  feeOpen && 'ring-1 ring-[#3b82f6]/35',
                )}
                onClick={() => setFeeOpen((v) => !v)}
              >
                <DollarSign className="size-4" />
                <span className="ml-1.5 hidden sm:inline">Taxa</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'h-11 shrink-0 rounded-xl border-white/10 bg-[#13161f] px-3',
                  noteOpen && 'ring-1 ring-[#3b82f6]/35',
                )}
                onClick={() => setNoteOpen((v) => !v)}
              >
                <Pencil className="size-4" />
                <span className="ml-1.5 hidden sm:inline">Notas</span>
              </Button>
            </div>

            {feeOpen && (
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">Taxa (USD)</Label>
                <Input
                  value={feeStr}
                  onChange={(e) => setFeeStr(e.target.value)}
                  placeholder="0"
                  className="h-10 rounded-xl border-white/[0.08] bg-[#13161f] font-mono"
                />
              </div>
            )}
            {noteOpen && (
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">Notas</Label>
                <Textarea
                  value={noteStr}
                  onChange={(e) => setNoteStr(e.target.value)}
                  placeholder="Opcional"
                  className="min-h-[72px] rounded-xl border-white/[0.08] bg-[#13161f]"
                />
              </div>
            )}

            <div className="rounded-xl bg-[#0d0f14] px-4 py-3 ring-1 ring-white/[0.06]">
              <p className="text-xs font-medium text-muted-foreground">
                {txTab === 'buy' ? 'Total gasto' : 'Total (bruto)'}
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-white">
                {txTab === 'buy'
                  ? formatCurrency(buyTotal, false)
                  : formatCurrency(gross, false)}
              </p>
              {txTab === 'buy' &&
                selectedCoin &&
                qtyN > 0 &&
                Number.isFinite(priceN) &&
                priceN >= 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {qtyN.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}{' '}
                    <span className="text-foreground/80">{selectedCoin.symbol}</span> ×{' '}
                    {formatCurrency(priceN, false)} = {formatCurrency(gross, false)}
                    {feeN > 0 && (
                      <>
                        {' '}
                        + taxa {formatCurrency(feeN, false)}
                      </>
                    )}
                  </p>
                )}
              {txTab === 'sell' && feeN > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Após taxa: {formatCurrency(sellNet, false)}
                </p>
              )}
            </div>

            {formErr && <p className="text-sm text-[#ef4444]">{formErr}</p>}
          </div>
        )}

        <DialogFooter className="border-t border-white/[0.06] bg-[#141720] px-5 py-4 sm:justify-stretch">
          <Button
            type="button"
            className="h-11 w-full rounded-xl bg-[#3861fb] text-[15px] font-semibold text-white hover:bg-[#2f56e0]"
            disabled={txTab === 'transfer'}
            onClick={submit}
          >
            {txTab === 'buy'
              ? 'Adicionar transação'
              : txTab === 'sell'
                ? 'Registar venda'
                : 'Indisponível'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
