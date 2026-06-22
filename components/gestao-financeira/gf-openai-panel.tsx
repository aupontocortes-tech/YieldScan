'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  clearGfOpenAiUsage,
  DEFAULT_GF_OPENAI_SETTINGS,
  loadGfOpenAiSettings,
  maskOpenAiKey,
  saveGfOpenAiSettings,
  summarizeGfOpenAiUsage,
} from '@/lib/gestao-financeira/openai-config'
import { GF_OPENAI_MODEL } from '@/lib/gestao-financeira/voice-llm-shared'
import type { GfOpenAiSettings } from '@/lib/gestao-financeira/types'
import { AlertTriangle, Gauge, KeyRound, Sparkles, Trash2 } from 'lucide-react'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  brlPerUsd?: number
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 })
}

function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })
}

export function GfOpenAiPanel({ open, onOpenChange, brlPerUsd = 5.1 }: Props) {
  const [settings, setSettings] = useState<GfOpenAiSettings>(DEFAULT_GF_OPENAI_SETTINGS)
  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [usageTick, setUsageTick] = useState(0)

  const refresh = useCallback(() => {
    const s = loadGfOpenAiSettings()
    setSettings(s)
    setKeyInput('')
    setUsageTick((t) => t + 1)
  }, [])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  const summary = summarizeGfOpenAiUsage(settings, brlPerUsd)
  void usageTick

  const handleSave = () => {
    const next: GfOpenAiSettings = {
      ...settings,
      apiKey: keyInput.trim() || settings.apiKey,
    }
    saveGfOpenAiSettings(next)
    setSettings(next)
    setKeyInput('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const budgetPct =
    settings.monthlyBudgetUsd > 0
      ? Math.min(100, (summary.monthEstimatedUsd / settings.monthlyBudgetUsd) * 100)
      : 0
  const callsPct =
    settings.maxCallsPerDay > 0
      ? Math.min(100, (summary.callsToday / settings.maxCallsPerDay) * 100)
      : 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) saveGfOpenAiSettings(settings)
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            OpenAI · Interpretação e consumo
          </DialogTitle>
          <DialogDescription>
            Chave guardada só neste dispositivo. Modelo: {GF_OPENAI_MODEL}. Use limites para controlar gastos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="rounded-xl border border-violet-500/25 bg-violet-950/15 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <KeyRound className="h-4 w-4 text-violet-300" />
                Chave da API
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="gf-openai-enabled" className="text-xs text-muted-foreground">
                  Ativar IA
                </Label>
                <Switch
                  id="gf-openai-enabled"
                  checked={settings.enabled}
                  onCheckedChange={(enabled) => setSettings((s) => ({ ...s, enabled }))}
                />
              </div>
            </div>

            {settings.apiKey && !keyInput ? (
              <p className="text-xs text-muted-foreground">
                Chave actual: <span className="font-mono text-foreground">{maskOpenAiKey(settings.apiKey)}</span>
              </p>
            ) : null}

            <div className="space-y-2">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder="sk-…"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? 'Ocultar' : 'Mostrar'}
                </Button>
                <Button type="button" size="sm" className="bg-violet-600 hover:bg-violet-500" onClick={handleSave}>
                  {saved ? 'Guardado' : 'Guardar'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Orçamento mensal (USD)</Label>
                <Input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={settings.monthlyBudgetUsd}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, monthlyBudgetUsd: Math.max(0.1, Number(e.target.value) || 0.1) }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Máx. chamadas / dia</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={settings.maxCallsPerDay}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, maxCallsPerDay: Math.max(1, Math.floor(Number(e.target.value) || 1)) }))
                  }
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-amber-500/25 bg-amber-950/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Gauge className="h-4 w-4 text-amber-300" />
              Consumo da API
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-muted/40 p-2">
                <p className="text-xs text-muted-foreground">Hoje</p>
                <p className="font-semibold">
                  {summary.callsToday} / {settings.maxCallsPerDay} chamadas
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2">
                <p className="text-xs text-muted-foreground">Gasto hoje (R$)</p>
                <p className="font-semibold text-emerald-300">{fmtBrl(summary.todayEstimatedBrl)}</p>
                <p className="text-[10px] text-muted-foreground">{fmtUsd(summary.todayEstimatedUsd)}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2">
                <p className="text-xs text-muted-foreground">Média por chamada hoje</p>
                <p className="font-semibold">{fmtBrl(summary.avgCallCostBrlToday)}</p>
                <p className="text-[10px] text-muted-foreground">{fmtUsd(summary.avgCallCostUsdToday)}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2">
                <p className="text-xs text-muted-foreground">Restantes hoje</p>
                <p className="font-semibold">{summary.remainingCallsToday}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2 col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground">Custo estimado (mês)</p>
                <p className="font-semibold text-emerald-300">{fmtBrl(summary.monthEstimatedBrl)}</p>
                <p className="text-[10px] text-muted-foreground">{fmtUsd(summary.monthEstimatedUsd)}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2 col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground">Orçamento restante</p>
                <p className="font-semibold">{fmtBrl(summary.remainingBudgetBrl)}</p>
                <p className="text-[10px] text-muted-foreground">{fmtUsd(summary.remainingBudgetUsd)}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <div className="mb-1 flex justify-between">
                  <span>Chamadas hoje</span>
                  <span>{callsPct.toFixed(0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${callsPct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between">
                  <span>Orçamento mensal</span>
                  <span>{budgetPct.toFixed(0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all"
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </div>
            </div>

            {(budgetPct >= 90 || callsPct >= 90) && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2 text-xs text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Próximo do limite. A interpretação local continua grátis; a IA pausa ao atingir o tecto.
              </div>
            )}

            {summary.records.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Últimas chamadas</p>
                <ul className="max-h-36 space-y-1 overflow-y-auto text-xs">
                  {summary.records.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1"
                    >
                      <span className="text-muted-foreground">
                        {new Date(r.at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {r.feature === 'transcribe' ? 'voz' : `${r.promptTokens + r.completionTokens} tok`}
                      </Badge>
                      <span className="text-right">
                        <span className="block text-emerald-300">{fmtBrl(r.estimatedUsd * brlPerUsd)}</span>
                        <span className="text-[10px] text-muted-foreground">{fmtUsd(r.estimatedUsd)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma chamada registada ainda.</p>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={() => {
                clearGfOpenAiUsage()
                refresh()
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar histórico de consumo
            </Button>
          </section>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            A chave fica no seu navegador. Cada interpretação com IA envia a frase e saldos actuais para a OpenAI
            (via servidor YieldScan). Transacções simples podem ser interpretadas localmente, sem custo.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
