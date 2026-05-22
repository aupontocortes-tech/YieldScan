'use client'

import type { CycleBottomSignalState } from '@/lib/btc/cycle-bottom'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle } from 'lucide-react'

export function CycleBottomAlerts({ signals }: { signals: CycleBottomSignalState }) {
  const rows = [
    {
      active: signals.signal1,
      text: 'Sinal 1: Rompimento da SMA 200 Diária',
      desc: 'Gráfico diário — preço acima da SMA 200',
    },
    {
      active: signals.signal2,
      text: 'Sinal 2: Fechamento mensal (HA) acima da Bull Market Band',
      desc: 'Gráfico mensal — vela Heikin Ashi verde acima da banda (médias semanais)',
    },
  ]

  const anyActive = signals.signal1 || signals.signal2

  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2.5',
        anyActive
          ? 'border-emerald-500/35 bg-emerald-950/25'
          : 'border-white/[0.06] bg-black/30',
      )}
      role="status"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        Sinais de início de bull market
      </p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.text} className="flex items-start gap-2 text-[11px]">
            {r.active ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            ) : (
              <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />
            )}
            <span>
              <span className={r.active ? 'font-medium text-emerald-100' : 'text-zinc-500'}>{r.text}</span>
              <span className="mt-0.5 block text-[10px] text-zinc-600">{r.desc}</span>
            </span>
          </li>
        ))}
      </ul>
      {!anyActive && (
        <p className="mt-2 text-[10px] text-zinc-500">
          Nenhum sinal activo neste momento. Os indicadores podem estar ligados no gráfico mesmo sem alerta.
        </p>
      )}
    </div>
  )
}
