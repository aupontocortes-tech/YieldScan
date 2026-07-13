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
  clearGfOpenAiUsageToday,
  DEFAULT_GF_OPENAI_SETTINGS,
  loadGfOpenAiSettings,
  maskOpenAiKey,
  registerGfOpenAiTestCall,
  saveGfOpenAiSettings,
  summarizeGfOpenAiUsage,
} from '@/lib/gestao-financeira/openai-config'
import { fetchBrlPerUsd } from '@/lib/gestao-financeira/fx-rate'
import { GF_OPENAI_MODEL } from '@/lib/gestao-financeira/voice-llm-shared'
import type { GfOpenAiSettings } from '@/lib/gestao-financeira/types'
import { AlertTriangle, Gauge, KeyRound, Sparkles, Trash2 } from 'lucide-react'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fallback se a cotação ainda não carregou. */
  brlPerUsd?: number
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 })
}

function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })
}

export function GfOpenAiPanel({ open, onOpenChange, brlPerUsd: brlFallback = 5.1 }: Props) {
  const [settings, setSettings] = useState<GfOpenAiSettings>(DEFAULT_GF_OPENAI_SETTINGS)
  const [savedSettings, setSavedSettings] = useState<GfOpenAiSettings>(DEFAULT_GF_OPENAI_SETTINGS)
  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [usageTick, setUsageTick] = useState(0)
  const [brlPerUsd, setBrlPerUsd] = useState(brlFallback)
  const [showFineTune, setShowFineTune] = useState(false)

  const refresh = useCallback(() => {
    const s = loadGfOpenAiSettings()
    setSettings(s)
    setSavedSettings(s)
    setKeyInput('')
    setUsageTick((t) => t + 1)
  }, [])

  useEffect(() => {
    if (open) {
      refresh()
      void fetchBrlPerUsd().then(setBrlPerUsd)
    }
  }, [open, refresh])

  useEffect(() => {
    if (brlFallback > 0) setBrlPerUsd((fx) => (fx === 5.1 ? brlFallback : fx))
  }, [brlFallback])

  const summary = summarizeGfOpenAiUsage(settings, brlPerUsd)
  void usageTick

  const handleSave = () => {
    const next: GfOpenAiSettings = {
      ...settings,
      apiKey: keyInput.trim() || settings.apiKey,
      monthlyBudgetUsd: Math.max(0.1, settings.monthlyBudgetUsd),
      maxCallsPerDay: Math.max(1, Math.floor(settings.maxCallsPerDay)),
    }
    saveGfOpenAiSettings(next)
    setSettings(next)
    setSavedSettings(next)
    setKeyInput('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const hasUnsavedChanges =
    keyInput.trim().length > 0 ||
    settings.enabled !== savedSettings.enabled ||
    settings.monthlyBudgetUsd !== savedSettings.monthlyBudgetUsd ||
    settings.maxCallsPerDay !== savedSettings.maxCallsPerDay

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
        if (!next && hasUnsavedChanges) {
          const discard = window.confirm('Descartar alterações não guardadas?')
          if (!discard) return
          setSettings(savedSettings)
          setKeyInput('')
        }
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
            Uma chave para tudo: receitas/despesas, voz (Whisper) e afazeres. Preferes colá-la em{' '}
            <a href="/settings" className="text-indigo-300 underline underline-offset-2">
              Configurações
            </a>
            , onde também comparas gastos com Cortes de Vídeo. Modelo: {GF_OPENAI_MODEL}.
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
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/40 p-3 space-y-3">
              <div>
                <p className="text-sm font-medium">Seus limites</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Digite os valores que quiser e toque <strong>Guardar</strong> no final do painel.
                </p>
              </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="gf-openai-budget" className="text-xs">Orçamento mensal (USD)</Label>
                <Input
                  id="gf-openai-budget"
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
                <Label htmlFor="gf-openai-calls" className="text-xs">Máx. chamadas / dia</Label>
                <Input
                  id="gf-openai-calls"
                  type="number"
                  min={1}
                  step={1}
                  value={settings.maxCallsPerDay}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      maxCallsPerDay: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                    }))
                  }
                />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Cada comando de voz usa ~2 chamadas (transcrever + interpretar).
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[50, 100, 200, 500].map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={settings.maxCallsPerDay === n ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setSettings((s) => ({ ...s, maxCallsPerDay: n }))}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>
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
                {callsPct >= 100
                  ? 'Limite diário esgotado. Aumente «Máx. chamadas / dia» e toque Guardar no final, ou zere o contador de hoje.'
                  : 'Próximo do limite. A interpretação local continua grátis; a IA pausa ao atingir o tecto.'}
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
                        {r.feature === 'transcribe'
                          ? 'voz'
                          : r.feature === 'parse-phrase'
                            ? 'direcionar'
                            : r.feature === 'parse-todos'
                              ? 'afazeres'
                              : r.feature === 'parse-voice'
                                ? 'finanças'
                                : `${r.promptTokens + r.completionTokens} tok`}
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

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  clearGfOpenAiUsageToday()
                  refresh()
                }}
              >
                Zerar contador de hoje
              </Button>
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
                Limpar todo o histórico
              </Button>
            </div>

            <details
              className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2"
              open={showFineTune}
              onToggle={(e) => setShowFineTune((e.target as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer text-[11px] text-muted-foreground select-none">
                Ajuste fino (só neste aparelho)
              </summary>
              <div className="mt-2 space-y-2">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  O histórico não sincroniza entre PC e celular. Use isto para testar o contador aqui.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    registerGfOpenAiTestCall()
                    refresh()
                  }}
                >
                  +1 chamada de teste
                </Button>
              </div>
            </details>
          </section>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            A chave fica no seu navegador. Finanças, afazeres e transcrição de voz usam a mesma API e contam no
            orçamento acima. Transacções simples podem ser interpretadas localmente, sem custo.
          </p>

          <div className="sticky bottom-0 -mx-1 flex flex-col gap-2 border-t border-border/50 bg-background/95 pt-3 backdrop-blur-sm">
            {hasUnsavedChanges ? (
              <p className="text-xs text-amber-200/90">Alterações não guardadas — toque Guardar para aplicar.</p>
            ) : saved ? (
              <p className="text-xs text-emerald-300">Configurações guardadas neste dispositivo.</p>
            ) : null}
            <Button type="button" size="lg" className="w-full bg-violet-600 hover:bg-violet-500" onClick={handleSave}>
              {saved ? 'Guardado ✓' : 'Guardar configurações'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
