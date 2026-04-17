'use client'

import * as React from 'react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

type SliderControlProps = {
  label: string
  hint?: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  format?: (v: number) => string
  className?: string
}

export function SliderControl({
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange,
  format = (v) => `${v.toFixed(2)}×`,
  className,
}: SliderControlProps) {
  const [local, setLocal] = React.useState(value)
  React.useEffect(() => setLocal(value), [value])

  return (
    <div className={cn('space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md', className)}>
      <div className="flex items-end justify-between gap-2">
        <div>
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</Label>
          {hint && <p className="mt-0.5 text-[11px] text-muted-foreground/85">{hint}</p>}
        </div>
        <span className="font-mono text-sm font-semibold tabular-nums text-cyan-300/90">{format(local)}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[local]}
        onValueChange={(v) => {
          const n = v[0] ?? min
          setLocal(n)
          onChange(n)
        }}
        className="w-full [&_[role=slider]]:border-violet-400/60 [&_[role=slider]]:bg-gradient-to-br [&_[role=slider]]:from-violet-500 [&_[role=slider]]:to-cyan-400"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Estreito (0,5×)</span>
        <span>Largo (1,5×)</span>
      </div>
    </div>
  )
}
