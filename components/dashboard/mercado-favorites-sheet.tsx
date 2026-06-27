'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Coins, Loader2, Plus, Search, Star, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { TokenSymbolAvatar } from '@/components/token-symbol-avatar'
import {
  highlightMetaFromPresetOrId,
  MERCADO_HIGHLIGHT_QUICK_PRESETS,
} from '@/lib/mercado-highlight-presets'
import {
  canonicalHighlightCoinGeckoId,
  DEFAULT_MARKET_HIGHLIGHT_IDS,
  MAX_MARKET_HIGHLIGHTS,
  sanitizeHighlightIds,
} from '@/lib/mercado-highlight-ids'
import type { MercadoDisplayFiat, MercadoDisplayPrefs, MercadoPriceOverrides } from '@/lib/mercado-display-prefs'
import { isUsEquityXstock } from '@/lib/us-equities'
import { readHighlightIconUrl, writeHighlightIconUrl } from '@/lib/mercado-highlight-icons'
import { cn } from '@/lib/utils'

const CRYPTO_QUICK = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'solana', name: 'Solana', symbol: 'SOL' },
  { id: 'hyperliquid', name: 'Hyperliquid', symbol: 'HYPE' },
  { id: 'ripple', name: 'XRP', symbol: 'XRP' },
  { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE' },
] as const

type SearchCoin = { id: string; name: string; symbol: string; image?: string }

async function searchCoins(q: string): Promise<SearchCoin[]> {
  const res = await fetch(`/api/coingecko/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) return []
  const j = (await res.json()) as {
    coins?: Array<{ id: string; name: string; symbol: string; image?: string; thumb?: string }>
  }
  if (!Array.isArray(j.coins)) return []
  return j.coins.slice(0, 16).map((c) => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol,
    image: c.image ?? c.thumb,
  }))
}

type OverrideTextDraft = Record<string, Partial<Record<MercadoDisplayFiat, string>>>

const FIAT_OPTIONS: { id: MercadoDisplayFiat; label: string }[] = [
  { id: 'brl', label: 'Real (BRL)' },
  { id: 'usd', label: 'Dólar (USD)' },
  { id: 'eur', label: 'Euro (EUR)' },
]

function textsFromOverrides(o: MercadoPriceOverrides): OverrideTextDraft {
  const texts: OverrideTextDraft = {}
  for (const [id, slice] of Object.entries(o)) {
    const row: Partial<Record<MercadoDisplayFiat, string>> = {}
    for (const f of ['usd', 'brl', 'eur'] as const) {
      if (slice[f] != null && Number.isFinite(slice[f])) row[f] = String(slice[f])
    }
    if (Object.keys(row).length > 0) texts[id] = row
  }
  return texts
}

function parseOverrideTexts(texts: OverrideTextDraft): MercadoPriceOverrides {
  const out: MercadoPriceOverrides = {}
  for (const [id, slice] of Object.entries(texts)) {
    const cur: Partial<Record<MercadoDisplayFiat, number>> = {}
    for (const f of ['usd', 'brl', 'eur'] as const) {
      const s = (slice[f] ?? '').trim().replace(/\s/g, '').replace(',', '.')
      if (!s) continue
      const n = Number(s)
      if (Number.isFinite(n) && n >= 0) cur[f] = n
    }
    if (Object.keys(cur).length > 0) out[id] = cur
  }
  return out
}

function FavoriteList({
  ids,
  onRemove,
  canRemove,
  accent,
}: {
  ids: string[]
  onRemove: (id: string) => void
  canRemove: boolean
  accent: 'crypto' | 'stock'
}) {
  if (!ids.length) {
    return (
      <p className="rounded-lg border border-dashed border-border/50 px-3 py-4 text-center text-xs text-muted-foreground">
        Nenhum favorito nesta secção.
      </p>
    )
  }
  return (
    <ul className="space-y-2">
      {ids.map((id) => {
        const meta = highlightMetaFromPresetOrId(id)
        return (
          <li
            key={id}
            className={cn(
              'flex items-center gap-2 rounded-lg border bg-card/50 px-2.5 py-2',
              accent === 'stock' ? 'border-blue-500/25' : 'border-cyan-500/25',
            )}
          >
            <TokenSymbolAvatar
              symbol={meta.symbol}
              coingeckoId={id}
              iconUrl={readHighlightIconUrl(id)}
              size={32}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{meta.name}</p>
              <p className="text-[10px] uppercase text-muted-foreground">{meta.symbol}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              disabled={!canRemove}
              aria-label={`Remover ${meta.name}`}
              onClick={() => onRemove(id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

function AssetSearch({
  placeholder,
  search,
  onSearchChange,
  debounced,
  results,
  loading,
  draftIds,
  atLimit,
  onAdd,
  filter,
}: {
  placeholder: string
  search: string
  onSearchChange: (v: string) => void
  debounced: string
  results: SearchCoin[]
  loading: boolean
  draftIds: string[]
  atLimit: boolean
  onAdd: (id: string, image?: string) => void
  filter: (c: SearchCoin) => boolean
}) {
  const filtered = results.filter(filter)

  return (
    <Command shouldFilter={false} className="rounded-xl border border-border/50 bg-card/40">
      <div className="flex items-center gap-2 border-b border-border/40 px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <CommandInput
          placeholder={placeholder}
          value={search}
          onValueChange={onSearchChange}
          className="h-10 border-0"
        />
      </div>
      <CommandList className="max-h-40">
        {debounced.length < 2 ? (
          <p className="px-3 py-3 text-center text-xs text-muted-foreground">
            Escreve 2+ letras para pesquisar.
          </p>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> A pesquisar…
          </div>
        ) : (
          <>
            <CommandEmpty>Sem resultados nesta categoria.</CommandEmpty>
            <CommandGroup>
              {filtered.map((c) => {
                const added = draftIds.includes(c.id)
                return (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    disabled={added || atLimit}
                    onPointerDown={(e) => e.preventDefault()}
                    onSelect={() => onAdd(c.id, c.image)}
                    className="gap-2"
                  >
                    <TokenSymbolAvatar symbol={c.symbol} coingeckoId={c.id} iconUrl={c.image} size={26} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{c.name}</span>
                      <span className="ml-1.5 text-xs uppercase text-muted-foreground">{c.symbol}</span>
                    </span>
                    {added ? (
                      <Badge variant="outline" className="text-[10px]">
                        Na lista
                      </Badge>
                    ) : (
                      <Plus className="h-4 w-4 shrink-0 text-yellow-500" />
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  )
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  favoriteIds: string[]
  displayPrefs: MercadoDisplayPrefs
  onSaved: (ids: string[], prefs: MercadoDisplayPrefs) => void
}

export function MercadoFavoritesSheet({
  open,
  onOpenChange,
  favoriteIds,
  displayPrefs,
  onSaved,
}: Props) {
  const [draftIds, setDraftIds] = useState<string[]>([])
  const [draftFiat, setDraftFiat] = useState<MercadoDisplayFiat>('usd')
  const [searchCrypto, setSearchCrypto] = useState('')
  const [searchStock, setSearchStock] = useState('')
  const [debouncedCrypto, setDebouncedCrypto] = useState('')
  const [debouncedStock, setDebouncedStock] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [draftOverrideText, setDraftOverrideText] = useState<OverrideTextDraft>({})

  useEffect(() => {
    if (!open) return
    setDraftIds([...favoriteIds])
    setDraftFiat(displayPrefs.displayFiat)
    setDraftOverrideText(textsFromOverrides(displayPrefs.priceOverrides))
    setSearchCrypto('')
    setSearchStock('')
    setDebouncedCrypto('')
    setDebouncedStock('')
  }, [open, favoriteIds, displayPrefs])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedCrypto(searchCrypto.trim()), 300)
    return () => clearTimeout(t)
  }, [searchCrypto])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedStock(searchStock.trim()), 300)
    return () => clearTimeout(t)
  }, [searchStock])

  const { data: cryptoSearchResults = [], isFetching: cryptoSearchLoading } = useQuery({
    queryKey: ['mercado-coin-search-crypto', debouncedCrypto],
    queryFn: () => searchCoins(debouncedCrypto),
    enabled: open && debouncedCrypto.length >= 2,
    staleTime: 60_000,
  })

  const { data: stockSearchResults = [], isFetching: stockSearchLoading } = useQuery({
    queryKey: ['mercado-coin-search-stock', debouncedStock],
    queryFn: () => searchCoins(debouncedStock),
    enabled: open && debouncedStock.length >= 2,
    staleTime: 60_000,
  })

  const cryptoIds = useMemo(() => draftIds.filter((id) => !isUsEquityXstock(id)), [draftIds])
  const stockIds = useMemo(() => draftIds.filter((id) => isUsEquityXstock(id)), [draftIds])

  const addFavorite = useCallback((rawId: string, iconUrl?: string) => {
    const id = canonicalHighlightCoinGeckoId(rawId)
    if (!id) return
    writeHighlightIconUrl(id, iconUrl)
    setDraftIds((prev) => {
      if (prev.includes(id)) return prev
      if (prev.length >= MAX_MARKET_HIGHLIGHTS) return prev
      return [...prev, id]
    })
    setSearchCrypto('')
    setSearchStock('')
    setDebouncedCrypto('')
    setDebouncedStock('')
  }, [])

  const removeFavorite = useCallback((id: string) => {
    setDraftIds((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x !== id)))
  }, [])

  const save = useCallback(() => {
    const cleaned = sanitizeHighlightIds(draftIds)
    const overrides = parseOverrideTexts(draftOverrideText)
    const nextPrefs: MercadoDisplayPrefs = {
      displayFiat: draftFiat,
      displayFiatByCoinId: displayPrefs.displayFiatByCoinId,
      priceOverrides: overrides,
    }
    onSaved(cleaned, nextPrefs)
    onOpenChange(false)
  }, [draftIds, draftFiat, draftOverrideText, displayPrefs.displayFiatByCoinId, onSaved, onOpenChange])

  const atLimit = draftIds.length >= MAX_MARKET_HIGHLIGHTS
  const canRemove = draftIds.length > 1

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-no-swipe-nav=""
        className="flex h-full w-full flex-col gap-0 border-l border-yellow-500/20 bg-background p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
            <Star className="h-5 w-5 text-yellow-500" />
            Adicionar favoritos
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Primeiro cripto, depois ações US. No cartão, a engrenagem em baixo à direita muda a moeda.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 px-5 py-4">
            <section className="space-y-2">
              <Label className="text-xs font-semibold">Moeda padrão da página</Label>
              <Select value={draftFiat} onValueChange={(v) => setDraftFiat(v as MercadoDisplayFiat)}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIAT_OPTIONS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            <p className="text-center text-[11px] tabular-nums text-muted-foreground">
              Total {draftIds.length}/{MAX_MARKET_HIGHLIGHTS} favoritos
            </p>

            {/* 1 — Cripto */}
            <section className="space-y-3 rounded-xl border border-cyan-500/25 bg-cyan-950/10 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-cyan-400">
                <Coins className="h-4 w-4" />
                Criptomoedas
              </h3>

              <AssetSearch
                placeholder="Pesquisar cripto (BTC, Solana…)…"
                search={searchCrypto}
                onSearchChange={setSearchCrypto}
                debounced={debouncedCrypto}
                results={cryptoSearchResults}
                loading={cryptoSearchLoading}
                draftIds={draftIds}
                atLimit={atLimit}
                onAdd={addFavorite}
                filter={(c) => !isUsEquityXstock(c.id)}
              />

              <div className="flex flex-wrap gap-1.5">
                {CRYPTO_QUICK.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 border-cyan-500/30 px-2 text-[11px]"
                    disabled={atLimit || draftIds.includes(p.id)}
                    onClick={() => addFavorite(p.id)}
                  >
                    <TokenSymbolAvatar symbol={p.symbol} coingeckoId={p.id} size={18} />
                    {p.symbol}
                  </Button>
                ))}
              </div>

              <FavoriteList
                ids={cryptoIds}
                onRemove={removeFavorite}
                canRemove={canRemove}
                accent="crypto"
              />
            </section>

            {/* 2 — Ações */}
            <section className="space-y-3 rounded-xl border border-blue-500/25 bg-blue-950/10 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-400">
                <Building2 className="h-4 w-4" />
                Ações americanas (US)
              </h3>

              <AssetSearch
                placeholder="Pesquisar ação (NVIDIA, Tesla, Nasdaq…)…"
                search={searchStock}
                onSearchChange={setSearchStock}
                debounced={debouncedStock}
                results={stockSearchResults}
                loading={stockSearchLoading}
                draftIds={draftIds}
                atLimit={atLimit}
                onAdd={addFavorite}
                filter={(c) => isUsEquityXstock(c.id)}
              />

              <div className="flex flex-wrap gap-1.5">
                {MERCADO_HIGHLIGHT_QUICK_PRESETS.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 border-blue-500/30 px-2 text-[11px]"
                    disabled={atLimit || draftIds.includes(p.id)}
                    onClick={() => addFavorite(p.id)}
                  >
                    <TokenSymbolAvatar symbol={p.symbol} coingeckoId={p.id} size={18} />
                    {p.symbol}
                  </Button>
                ))}
              </div>

              <FavoriteList ids={stockIds} onRemove={removeFavorite} canRemove={canRemove} accent="stock" />
            </section>

            <button
              type="button"
              className="w-full text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? 'Ocultar' : 'Mostrar'} preços manuais (avançado)
            </button>
            {showAdvanced && (
              <div className="space-y-3 rounded-lg border border-border/50 bg-muted/10 p-3">
                {draftIds.map((id) => {
                  const meta = highlightMetaFromPresetOrId(id)
                  return (
                    <div key={`ov-${id}`} className="space-y-1">
                      <p className="text-xs font-medium">
                        {meta.name} ({meta.symbol})
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {FIAT_OPTIONS.map((f) => (
                          <div key={f.id}>
                            <Label className="text-[9px] text-muted-foreground">{f.label}</Label>
                            <Input
                              className="mt-0.5 h-8 font-mono text-xs"
                              inputMode="decimal"
                              placeholder="—"
                              value={draftOverrideText[id]?.[f.id] ?? ''}
                              onChange={(e) => {
                                const v = e.target.value
                                setDraftOverrideText((prev) => ({
                                  ...prev,
                                  [id]: { ...prev[id], [f.id]: v },
                                }))
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="flex-col gap-2 border-t border-border/60 px-5 py-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setDraftIds([...DEFAULT_MARKET_HIGHLIGHT_IDS])}
          >
            Repor lista inicial
          </Button>
          <Button type="button" className="w-full font-semibold" onClick={save}>
            Guardar favoritos
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
