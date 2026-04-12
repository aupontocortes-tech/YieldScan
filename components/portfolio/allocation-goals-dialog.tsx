'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type AllocationGoalSlice = {
  id: string
  symbol: string
  displayName: string
  currentPct: number
}

function parsePercentField(raw: string): number | null {
  const t = String(raw)
    .trim()
    .replace(/\s/g, '')
    .replace(/−/g, '-')
  if (!t) return null
  const normalized = t.includes(',') && !t.includes('.') ? t.replace(',', '.') : t.replace(',', '.')
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, n))
}

type AllocationGoalsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  slices: AllocationGoalSlice[]
  targets: Record<string, number>
  onSave: (next: Record<string, number>) => void
}

export function AllocationGoalsDialog({
  open,
  onOpenChange,
  slices,
  targets,
  onSave,
}: AllocationGoalsDialogProps) {
  const [draft, setDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    const next: Record<string, string> = {}
    for (const row of slices) {
      const v = targets[row.id]
      next[row.id] =
        v != null && Number.isFinite(v)
          ? String(v).replace('.', ',')
          : ''
    }
    setDraft(next)
  }, [open, slices, targets])

  const sumMeta = useMemo(() => {
    let s = 0
    for (const row of slices) {
      const p = parsePercentField(draft[row.id] ?? '')
      if (p != null) s += p
    }
    return s
  }, [draft, slices])

  const handleSave = () => {
    const next: Record<string, number> = { ...targets }
    for (const row of slices) {
      const p = parsePercentField(draft[row.id] ?? '')
      if (p == null) delete next[row.id]
      else next[row.id] = p
    }
    onSave(next)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto border-white/10 bg-[#111827] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Metas de alocação</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Define a percentagem objetivo (0–100%) de cada ativo na carteira. A soma pode ser diferente de
            100% se quiseres só referências parciais.
          </p>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {slices.map((row) => (
            <div key={row.id} className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{row.displayName}</span>{' '}
                <span className="font-mono">({row.symbol})</span>
                <span className="block font-normal text-muted-foreground">
                  Alocação atual: {row.currentPct.toFixed(2)}%
                </span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={draft[row.id] ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [row.id]: e.target.value }))
                  }
                  placeholder="ex.: 25"
                  inputMode="decimal"
                  className="border-white/10 bg-black/25 font-mono"
                />
                <span className="shrink-0 text-sm text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
        <p
          className={cn(
            'text-xs font-mono',
            Math.abs(sumMeta - 100) < 0.05 ? 'text-muted-foreground' : 'text-amber-400/90',
          )}
        >
          Soma das metas: {sumMeta.toFixed(2)}%
          {Math.abs(sumMeta - 100) >= 0.05 && sumMeta > 0 && (
            <span className="ml-2 text-muted-foreground">(geralmente 100% = carteira cheia)</span>
          )}
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" className="bg-[#3b82f6] hover:bg-[#2563eb]" onClick={handleSave}>
            Guardar metas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
