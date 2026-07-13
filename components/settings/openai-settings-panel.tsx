'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  clearCentralOpenAiUsage,
  DEFAULT_CENTRAL_OPENAI,
  loadCentralOpenAiSettings,
  maskOpenAiKey,
  saveCentralOpenAiSettings,
  summarizeOpenAiSpendByArea,
  type CentralOpenAiSettings,
} from '@/lib/openai/central-openai'
import { fetchBrlPerUsd } from '@/lib/gestao-financeira/fx-rate'
import { Building2, Clapperboard, KeyRound, Sparkles, Trash2, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

function fmtUsd(n: number) {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
  })
}

function fmtBrl(n: number) {
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

const AREA_ICON = {
  gestao_financeira: Building2,
  cortes_video: Clapperboard,
  outro: Sparkles,
} as const

export function OpenAiSettingsPanel() {
  const [settings, setSettings] = useState<CentralOpenAiSettings>(DEFAULT_CENTRAL_OPENAI)
  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tick, setTick] = useState(0)
  const [brlPerUsd, setBrlPerUsd] = useState(5.1)

  const refresh = useCallback(() => {
    setSettings(loadCentralOpenAiSettings())
    setKeyInput('')
    setTick((t) => t + 1)
  }, [])

  useEffect(() => {
    refresh()
    void fetchBrlPerUsd().then(setBrlPerUsd)
    const onUpd = () => refresh()
    window.addEventListener('ys-openai-central-updated', onUpd)
    return () => window.removeEventListener('ys-openai-central-updated', onUpd)
  }, [refresh])

  void tick
  const summary = summarizeOpenAiSpendByArea(settings)
  const maxArea = Math.max(0.0001, ...summary.byArea.map((a) => a.monthUsd))

  const handleSave = () => {
    const next: CentralOpenAiSettings = {
      ...settings,
      apiKey: keyInput.trim() || settings.apiKey,
    }
    saveCentralOpenAiSettings(next)
    setSettings(next)
    setKeyInput('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <section className="rounded-2xl border border-indigo-500/20 bg-gradient-to-b from-indigo-950/30 via-card/60 to-background/90 p-5 shadow-sm ring-1 ring-white/[0.04] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15">
            <KeyRound className="h-4 w-4 text-indigo-300" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">OpenAI · chave e gastos</h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
              Cola aqui a API uma vez. Serve para Gestão Financeira e Cortes de Vídeo. Os gastos
              aparecem separados para veres o que consome mais — no mesmo sítio onde controlas as
              finanças da conta.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-indigo-500/30 text-indigo-200">
          Finanças · IA
        </Badge>
      </div>

      <div className="mt-5 space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-950/40 px-3 py-2.5">
          <div>
            <Label className="text-sm">Activar OpenAI no app</Label>
            <p className="text-[11px] text-muted-foreground">Desliga para bloquear novas chamadas.</p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Chave da API OpenAI</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              placeholder={settings.apiKey ? maskOpenAiKey(settings.apiKey) : 'sk-…'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="font-mono text-sm"
            />
            <Button type="button" variant="outline" onClick={() => setShowKey((v) => !v)}>
              {showKey ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>
          {settings.apiKey && !keyInput ? (
            <p className="text-[11px] text-muted-foreground">
              Chave guardada: {maskOpenAiKey(settings.apiKey)}
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Orçamento mensal (USD)</Label>
            <Input
              type="number"
              min={0.1}
              step={0.5}
              value={settings.monthlyBudgetUsd}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  monthlyBudgetUsd: Number(e.target.value) || s.monthlyBudgetUsd,
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Máx. chamadas / dia</Label>
            <Input
              type="number"
              min={1}
              value={settings.maxCallsPerDay}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  maxCallsPerDay: Number(e.target.value) || s.maxCallsPerDay,
                }))
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleSave}>
            Guardar chave e limites
          </Button>
          {saved ? <span className="self-center text-xs text-emerald-400">Guardado.</span> : null}
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href="/news/gestao-financeira" className="inline-flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" />
              Abrir Gestão Financeira
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-3 border-t border-white/[0.06] pt-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Gastos por área</h3>
            <p className="text-[11px] text-muted-foreground">
              Este mês: {fmtUsd(summary.monthUsd)} ({fmtBrl(summary.monthUsd * brlPerUsd)}) · hoje:{' '}
              {fmtUsd(summary.todayUsd)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-red-300 hover:text-red-200"
            onClick={() => {
              if (window.confirm('Apagar histórico de gastos OpenAI deste dispositivo?')) {
                clearCentralOpenAiUsage()
                refresh()
              }
            }}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Limpar histórico
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.06] bg-zinc-950/40 px-3 py-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Mês</p>
            <p className="mt-1 font-mono text-sm font-semibold">{fmtUsd(summary.monthUsd)}</p>
            <p className="text-[10px] text-muted-foreground">{summary.monthCalls} chamadas</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-zinc-950/40 px-3 py-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Hoje</p>
            <p className="mt-1 font-mono text-sm font-semibold">{fmtUsd(summary.todayUsd)}</p>
            <p className="text-[10px] text-muted-foreground">{summary.todayCalls} chamadas</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-zinc-950/40 px-3 py-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Restante orçamento</p>
            <p className="mt-1 font-mono text-sm font-semibold">{fmtUsd(summary.remainingBudgetUsd)}</p>
            <p className="text-[10px] text-muted-foreground">
              {summary.remainingCallsToday} chamadas hoje
            </p>
          </div>
        </div>

        <ul className="space-y-2">
          {summary.byArea.map((row) => {
            const Icon = AREA_ICON[row.area]
            const pct = Math.round((row.monthUsd / maxArea) * 100)
            const isTop = row.monthUsd === maxArea && row.monthUsd > 0
            return (
              <li
                key={row.area}
                className="rounded-xl border border-white/[0.06] bg-zinc-950/40 px-3 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-indigo-300" />
                    <span className="text-sm font-medium">{row.label}</span>
                    {isTop ? (
                      <Badge className="bg-amber-500/15 text-[10px] text-amber-200">Mais gasta</Badge>
                    ) : null}
                    {row.monthUsd === 0 ? (
                      <Badge variant="outline" className="text-[10px]">
                        Sem uso
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs font-semibold">{fmtUsd(row.monthUsd)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      hoje {fmtUsd(row.todayUsd)} · {row.monthCalls} calls
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      row.area === 'gestao_financeira' && 'bg-emerald-400',
                      row.area === 'cortes_video' && 'bg-pink-400',
                      row.area === 'outro' && 'bg-indigo-400',
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
        <p className="text-[10px] text-muted-foreground">
          Valores estimados (Whisper / gpt-4o-mini / DALL·E). A cobrança real está na conta OpenAI.
        </p>
      </div>
    </section>
  )
}
