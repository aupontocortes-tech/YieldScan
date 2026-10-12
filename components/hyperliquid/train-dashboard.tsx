'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { TrainChart } from '@/components/hyperliquid/train-chart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { kvGetJson, kvSetJson, openYieldscanSqlite } from '@/lib/client-db/sqlite-core'
import {
  FROZEN_RULES,
  HL_NETWORK,
  LIVE_TRADING_LOCKED,
  PAPER_STORAGE_KEY,
  SYMBOLS,
  TIMEFRAMES,
} from '@/lib/hyperliquid/constants'
import { generateBars, simulatedNews, simulatedOraclePrice } from '@/lib/hyperliquid/market'
import { computeMetrics, equityFromBook } from '@/lib/hyperliquid/metrics'
import { clearHalt, createPaperBook, emergencyStop, setRobot, stepPaper } from '@/lib/hyperliquid/paper'
import { evaluateStrategy } from '@/lib/hyperliquid/strategy'
import { applyPendingRules, runTraining } from '@/lib/hyperliquid/train'
import type { HlBar, HlSymbol, HlTimeframe, PaperBook } from '@/lib/hyperliquid/types'
import { cn } from '@/lib/utils'
import { OctagonX, Radar } from 'lucide-react'

function money(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function px(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v >= 1000 ? v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

type ServerStatus = {
  network: string
  liveTradingLocked: boolean
  execution: string
  rulesVersion: string
}

export function TrainDashboard() {
  const [symbol, setSymbol] = useState<HlSymbol>('BTC')
  const [tf, setTf] = useState<HlTimeframe>('1h')
  const [bars, setBars] = useState(() => generateBars('BTC', '1h'))
  const [btcBars, setBtcBars] = useState(() => generateBars('BTC', '1h'))
  const [book, setBook] = useState<PaperBook>(() => createPaperBook())
  const [ready, setReady] = useState(false)
  const [rabby, setRabby] = useState<string | null>(null)
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [equityCurve, setEquityCurve] = useState<number[]>([10_000])
  const [feed, setFeed] = useState<'hyperliquid' | 'simulado'>('simulado')
  const [hlOracle, setHlOracle] = useState<number | null>(null)
  const [hlMark, setHlMark] = useState<number | null>(null)
  const trainedOnce = useRef(false)
  const steppedTime = useRef(0)

  useEffect(() => {
    let cancel = false
    void openYieldscanSqlite().then(() => {
      if (cancel) return
      const saved = kvGetJson<PaperBook>(PAPER_STORAGE_KEY)
      if (saved && typeof saved.cashUsd === 'number') {
        const rules = saved.rules ?? FROZEN_RULES
        const staleCrash = (saved.logs ?? []).some((l) => l.message.includes('STRATEGY_RULES_VERSION is not defined'))
        setBook({
          ...createPaperBook(),
          ...saved,
          rules,
          rulesVersion: rules.id,
          samples: saved.samples ?? [],
          pending: saved.pending ?? null,
          haltedReason: staleCrash ? null : saved.haltedReason,
          consecutiveErrors: staleCrash ? 0 : saved.consecutiveErrors,
          robotOn: staleCrash ? false : saved.robotOn,
        })
      }
      setReady(true)
    })
    void fetch('/api/hyperliquid/status')
      .then((r) => r.json())
      .then((j) => {
        if (!cancel) setStatus(j as ServerStatus)
      })
      .catch(() => undefined)
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    kvSetJson(PAPER_STORAGE_KEY, book)
  }, [book, ready])

  useEffect(() => {
    if (!ready || trainedOnce.current) return
    trainedOnce.current = true
    setBook((current) => (current.pending ? current : runTraining(current)))
  }, [ready])

  useEffect(() => {
    let stop = false
    const liveOk = { current: false }
    steppedTime.current = 0

    async function pull() {
      try {
        const ownRes = await fetch(`/api/hyperliquid/market?symbol=${symbol}&interval=${tf}`)
        if (!ownRes.ok) throw new Error('market')
        const own = (await ownRes.json()) as { bars?: HlBar[]; oraclePx?: number | null; markPx?: number | null }
        if (stop || !own.bars?.length) throw new Error('empty')
        liveOk.current = true
        setBars(own.bars)
        setHlOracle(own.oraclePx ?? null)
        setHlMark(own.markPx ?? null)
        setFeed('hyperliquid')
        if (symbol === 'BTC') {
          setBtcBars(own.bars)
          return
        }
        const btcRes = await fetch(`/api/hyperliquid/market?symbol=BTC&interval=${tf}`)
        if (!btcRes.ok || stop) return
        const btc = (await btcRes.json()) as { bars?: HlBar[] }
        if (btc.bars?.length) setBtcBars(btc.bars)
      } catch {
        if (stop || liveOk.current) return
        setFeed('simulado')
        setHlOracle(null)
        setHlMark(null)
        const next = generateBars(symbol, tf)
        setBars(next)
        setBtcBars(symbol === 'BTC' ? next : generateBars('BTC', tf))
      }
    }

    void pull()
    const timer = window.setInterval(() => void pull(), 20000)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [symbol, tf])

  const last = bars[bars.length - 1]
  const news = last ? simulatedNews(symbol, last.time) : { risk: 'baixo' as const, title: 'Sem notícia.' }
  const oracle =
    feed === 'hyperliquid' && hlOracle != null ? hlOracle : last ? simulatedOraclePrice(last.close, symbol, last.time) : 0
  const equity = equityFromBook(book, (s) => (s === symbol && last ? last.close : book.positions.find((p) => p.symbol === s)?.entry ?? 0))
  const dayPnl = equity - book.dayStartEquity

  const decision = useMemo(() => {
    if (!last) return null
    return evaluateStrategy({
      symbol,
      bars,
      btcBars: symbol === 'BTC' ? bars : btcBars,
      equityUsd: equity,
      newsRisk: news.risk,
      oraclePrice: oracle,
      params: book.rules,
    })
  }, [bars, btcBars, book.rules, equity, last, news.risk, oracle, symbol])

  useEffect(() => {
    if (feed !== 'hyperliquid' || !last) return
    if (steppedTime.current === last.time) return
    steppedTime.current = last.time
    const bar = last
    const sym = symbol
    const oraclePrice = hlOracle ?? bar.close
    const btcSeries = sym === 'BTC' ? bars : btcBars
    const n = simulatedNews(sym, bar.time)
    setBook((current) => {
      if (!current.robotOn) return current
      const stepped = stepPaper({
        book: current,
        symbol: sym,
        bars,
        btcBars: btcSeries,
        prices: { [sym]: bar.close },
        newsRisk: n.risk,
        oraclePrice,
      })
      const eq = equityFromBook(stepped, (s) =>
        s === sym ? bar.close : (stepped.positions.find((p) => p.symbol === s)?.entry ?? 0),
      )
      setEquityCurve((curve) => [...curve, eq].slice(-400))
      return stepped
    })
  }, [bars, btcBars, feed, hlOracle, last, symbol])

  const metrics = computeMetrics(book.trades, equityCurve)
  const openPos = book.positions.find((p) => p.symbol === symbol)

  async function connectRabby() {
    const eth = (window as Window & { ethereum?: { isRabby?: boolean; request?: (args: { method: string }) => Promise<string[]> } }).ethereum
    if (!eth?.request) {
      setBook((b) => ({
        ...b,
        logs: [
          { at: Date.now(), level: 'warn' as const, message: 'Rabby não encontrada. A frase-semente nunca é pedida.' },
          ...b.logs,
        ].slice(0, 80),
      }))
      return
    }
    const accounts = await eth.request({ method: 'eth_requestAccounts' })
    setRabby(accounts[0] ?? null)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 bg-[#050507] p-3 text-zinc-100 md:p-4">
      <header className="grid gap-2 rounded-xl border border-white/10 bg-black/50 p-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Saldo simulado" value={money(equity)} />
        <Stat label="Resultado do dia" value={money(dayPnl)} tone={dayPnl >= 0 ? 'up' : 'down'} />
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-500/20 text-amber-200">{HL_NETWORK.toUpperCase()}</Badge>
          <Badge className={feed === 'hyperliquid' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-zinc-500/20 text-zinc-300'}>
            {feed === 'hyperliquid' ? 'PREÇO HL' : 'PREÇO SIMULADO'}
          </Badge>
          <Badge variant="outline" className="border-red-500/40 text-red-300">
            REAL BLOQUEADO
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={book.robotOn ? 'secondary' : 'default'}
            disabled={Boolean(book.haltedReason)}
            onClick={() => setBook((b) => setRobot(b, !b.robotOn))}
          >
            Robô {book.robotOn ? 'ON' : 'OFF'}
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={() => setBook((b) => emergencyStop(b))}>
            <OctagonX className="mr-1 h-4 w-4" />
            Emergência
          </Button>
        </div>
      </header>

      {book.haltedReason ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          <span>{book.haltedReason}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setBook((b) => clearHalt(b))}>
            Limpar bloqueio
          </Button>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-h-[360px] flex-col overflow-hidden rounded-xl border border-white/10 bg-black">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
            {SYMBOLS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSymbol(s)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-semibold',
                  symbol === s ? 'bg-yellow-400 text-black' : 'bg-white/5 text-zinc-300',
                )}
              >
                {s}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-white/10" />
            {TIMEFRAMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTf(t.id)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px]',
                  tf === t.id ? 'bg-white/15 text-white' : 'text-zinc-500',
                )}
              >
                {t.label}
              </button>
            ))}
            <span className="ml-auto text-right text-[11px] text-zinc-400">
              <span className="mr-3 font-semibold text-zinc-100">{symbol} {px(last?.close ?? null)}</span>
              <span className="mr-3">mark {px(hlMark)}</span>
              <span>EMA 9 · 21 · 200</span>
            </span>
          </div>
          <div className="min-h-[300px] flex-1">
            <TrainChart key={`${symbol}-${tf}`} bars={bars} />
          </div>
        </section>

        <aside className="space-y-3 rounded-xl border border-white/10 bg-zinc-950 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Radar className="h-4 w-4 text-lime-400" />
            Estratégia {book.rules?.id ?? FROZEN_RULES.id}
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Regras congeladas enquanto o robô opera. Notícias e oráculo só filtram risco. Sem alavancagem.
          </p>
          <Row label="Sinal" value={decision?.signal === 'buy' ? 'COMPRA' : decision?.signal === 'sell' ? 'SAÍDA' : 'AGUARDAR'} />
          <p className="text-xs leading-relaxed text-zinc-300">{decision?.reason ?? '—'}</p>
          <Row label="Entrada" value={px(decision?.entry ?? openPos?.entry ?? null)} />
          <Row label="Stop" value={px(decision?.stop ?? openPos?.stop ?? null)} />
          <Row label="Alvo" value={px(decision?.takeProfit ?? openPos?.takeProfit ?? null)} />
          <Row label="Tamanho" value={decision?.sizeUsd ? money(decision.sizeUsd) : '—'} />
          <Row label="RSI" value={decision?.indicators.rsi?.toFixed(1) ?? '—'} />
          <Row label="MACD" value={decision?.indicators.macdHist?.toFixed(2) ?? '—'} />
          <Row label="ATR" value={px(decision?.indicators.atr ?? null)} />
          <Row label="Suporte" value={px(decision?.indicators.support ?? null)} />
          <Row label="Resistência" value={px(decision?.indicators.resistance ?? null)} />
          <Row label="Oráculo HL" value={px(oracle)} />
          <Row label="Notícias" value={`${news.risk} · ${news.title}`} />
          <div className="border-t border-white/10 pt-2 text-[11px] text-zinc-400">
            <p>Rabby: {rabby ? `${rabby.slice(0, 6)}…${rabby.slice(-4)}` : 'desligada'}</p>
            <p>API Wallet: não criada · saque desligado</p>
            <p>Preço: API pública Hyperliquid · ordens {status?.execution ?? 'paper'}</p>
            <p>Live lock: {String(status?.liveTradingLocked ?? LIVE_TRADING_LOCKED)}</p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void connectRabby()}>
              Ligar Rabby
            </Button>
          </div>
        </aside>
      </div>

      <Tabs defaultValue="posicoes" className="rounded-xl border border-white/10 bg-black/40 p-3">
        <TabsList className="bg-white/5">
          <TabsTrigger value="posicoes">Posições</TabsTrigger>
          <TabsTrigger value="ordens">Ordens</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
          <TabsTrigger value="treino">Treino</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="posicoes">
          <SimpleTable
            headers={['Ativo', 'Entrada', 'Stop', 'Alvo', 'Tamanho', 'Motivo']}
            rows={book.positions.map((p) => [p.symbol, px(p.entry), px(p.stop), px(p.takeProfit), money(p.sizeUsd), p.reason])}
            empty="Sem posições simuladas."
          />
        </TabsContent>
        <TabsContent value="ordens">
          <SimpleTable
            headers={['Ativo', 'Lado', 'Estado', 'Preço', 'Motivo']}
            rows={book.orders.map((o) => [o.symbol, o.side, o.status, px(o.price), o.reason])}
            empty="Sem ordens."
          />
        </TabsContent>
        <TabsContent value="historico">
          <SimpleTable
            headers={['Ativo', 'Entrada', 'Saída', 'Líquido', 'Saída por']}
            rows={book.trades.map((t) => [t.symbol, px(t.entry), px(t.exit), money(t.netUsd), t.exitReason])}
            empty="Ainda sem trades fechados."
          />
        </TabsContent>
        <TabsContent value="metricas">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Taxa de acerto" value={`${metrics.winRatePct.toFixed(1)}%`} hint={`${metrics.wins}W / ${metrics.losses}L`} />
            <Stat label="Lucro médio" value={money(metrics.avgWinUsd)} />
            <Stat label="Perda média" value={money(metrics.avgLossUsd)} />
            <Stat label="Risco/retorno" value={Number.isFinite(metrics.payoffRatio) ? metrics.payoffRatio.toFixed(2) : '—'} />
            <Stat label="Drawdown máx." value={`${metrics.maxDrawdownPct.toFixed(1)}%`} />
            <Stat label="Taxas" value={money(metrics.feesUsd)} />
            <Stat label="Slippage" value={money(metrics.slippageUsd)} />
            <Stat label="Resultado líquido" value={money(metrics.netUsd)} tone={metrics.netUsd >= 0 ? 'up' : 'down'} />
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            Estes números medem só o livro simulado. Não são uma promessa de acerto.
          </p>
        </TabsContent>
        <TabsContent value="treino">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Amostras" value={String(book.samples?.length ?? 0)} hint="replay + trades reais do simulado" />
            <Stat label="Acerto no treino" value={book.pending ? `${book.pending.trainWinPct.toFixed(1)}%` : '—'} />
            <Stat
              label="Acerto no teste cego"
              value={book.pending ? `${book.pending.holdoutWinPct.toFixed(1)}%` : '—'}
              hint={book.pending ? `regras atuais ${book.pending.activeHoldoutWinPct.toFixed(1)}%` : undefined}
            />
            <Stat
              label="Líquido no teste"
              value={book.pending ? money(book.pending.holdoutNetUsd) : '—'}
              tone={book.pending && book.pending.holdoutNetUsd >= 0 ? 'up' : 'down'}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-300">{book.pending?.reason ?? 'A correr o primeiro treino…'}</p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {book.pending?.approved
              ? 'Candidata aprovada. Só entra com o robô desligado.'
              : 'As regras atuais continuam congeladas.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setBook((b) => runTraining(b))}>
              Treinar de novo
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!book.pending?.approved || book.robotOn}
              onClick={() => setBook((b) => applyPendingRules(b))}
            >
              Aplicar regras aprovadas
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="logs">
          <ul className="max-h-48 space-y-1 overflow-auto text-xs">
            {book.logs.map((l, i) => (
              <li key={`${l.at}-${i}`} className={l.level === 'error' ? 'text-red-300' : l.level === 'warn' ? 'text-amber-200' : 'text-zinc-400'}>
                {new Date(l.at).toLocaleTimeString('pt-BR')} · {l.message}
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'up' | 'down' }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={cn('text-lg font-semibold tabular-nums', tone === 'up' && 'text-emerald-300', tone === 'down' && 'text-red-300')}>{value}</p>
      {hint ? <p className="text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className="max-w-[180px] text-right text-zinc-100">{value}</span>
    </div>
  )
}

function SimpleTable({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) {
  if (!rows.length) return <p className="py-4 text-sm text-zinc-500">{empty}</p>
  return (
    <div className="max-h-52 overflow-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-zinc-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-2 py-1 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-white/5">
              {row.map((cell, j) => (
                <td key={j} className="max-w-[220px] truncate px-2 py-1.5 text-zinc-200">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
