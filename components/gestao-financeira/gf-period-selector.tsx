'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPeriodLabel, resolvePeriodRange } from '@/lib/gestao-financeira/calculations'
import type { GfPeriodPreset } from '@/lib/gestao-financeira/types'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type GfReportPeriodState = {
  preset: GfPeriodPreset
  anchor: Date
  customFrom: string
  customTo: string
}

const PRESETS: { id: GfPeriodPreset; label: string }[] = [
  { id: 'day', label: 'Diário' },
  { id: 'week', label: 'Semanal' },
  { id: 'month', label: 'Mensal' },
  { id: 'quarter', label: 'Trimestral' },
  { id: 'custom', label: 'Personalizado' },
]

type Props = {
  value: GfReportPeriodState
  onChange: (next: GfReportPeriodState) => void
  onPrev?: () => void
  onNext?: () => void
}

export function GfPeriodSelector({ value, onChange, onPrev, onNext }: Props) {
  const range = resolvePeriodRange(value.preset, value.anchor, {
    from: value.customFrom,
    to: value.customTo,
  })
  const label = formatPeriodLabel(value.preset, range)

  return (
    <div className="space-y-3 rounded-2xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={value.preset === p.id ? 'default' : 'outline'}
            className={cn(value.preset === p.id && 'bg-emerald-600 hover:bg-emerald-600/90')}
            onClick={() => onChange({ ...value, preset: p.id })}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {value.preset !== 'custom' ? (
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={onPrev} aria-label="Período anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="min-w-[10rem] text-center text-sm font-medium text-foreground">{label}</p>
            <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={onNext} aria-label="Período seguinte">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="gf-from" className="text-xs text-muted-foreground">
                De
              </Label>
              <Input
                id="gf-from"
                type="date"
                className="h-9 w-[11rem]"
                value={value.customFrom}
                max={value.customTo}
                onChange={(e) => onChange({ ...value, customFrom: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="gf-to" className="text-xs text-muted-foreground">
                Até
              </Label>
              <Input
                id="gf-to"
                type="date"
                className="h-9 w-[11rem]"
                value={value.customTo}
                min={value.customFrom}
                onChange={(e) => onChange({ ...value, customTo: e.target.value })}
              />
            </div>
            <p className="pb-1 text-sm text-muted-foreground">{label}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function defaultReportPeriodState(): GfReportPeriodState {
  const today = new Date()
  const ymd = today.toISOString().slice(0, 10)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  return {
    preset: 'day',
    anchor: today,
    customFrom: monthStart,
    customTo: ymd,
  }
}
