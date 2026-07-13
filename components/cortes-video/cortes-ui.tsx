'use client'

import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, ArrowRight, Check, Lock } from 'lucide-react'

/** Painel estilo estúdio — alinhado ao hub YieldScan, accent rosa. */
export function CortesPanel({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
  headerRight,
  noPad,
}: {
  title: string
  subtitle?: string
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
  headerRight?: React.ReactNode
  noPad?: boolean
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border border-pink-500/15',
        'bg-gradient-to-b from-zinc-900/90 via-card/70 to-background/95',
        'shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_20px_50px_-28px_rgba(0,0,0,0.75)]',
        'ring-1 ring-white/[0.04]',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-400/50 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-pink-500/10 blur-3xl"
        aria-hidden
      />
      <header className="relative flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-pink-500/25 bg-pink-500/10">
              <Icon className="h-4 w-4 text-pink-400" aria-hidden />
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {headerRight}
      </header>
      <div className={cn('relative', !noPad && 'px-4 py-4 sm:px-5')}>{children}</div>
    </section>
  )
}

/** Caixa “Agora faz isto” — torna cada ecrã óbvio. */
export function CortesGuide({
  step,
  title,
  children,
}: {
  step: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-pink-500/25 bg-gradient-to-r from-pink-500/15 via-pink-500/5 to-transparent px-4 py-3.5 sm:px-5">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pink-500 text-xs font-bold text-white">
          {step}
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pink-300/90">
            Agora faz isto
          </p>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <div className="text-[12px] leading-relaxed text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function CortesStepRail({
  steps,
  active,
  onSelect,
  doneIds,
  lockedIds,
}: {
  steps: ReadonlyArray<{ id: string; label: string; short?: string }>
  active: string
  onSelect: (id: string) => void
  doneIds?: Set<string> | string[]
  lockedIds?: Set<string> | string[]
}) {
  const done = doneIds instanceof Set ? doneIds : new Set(doneIds ?? [])
  const locked = lockedIds instanceof Set ? lockedIds : new Set(lockedIds ?? [])

  return (
    <nav
      className="relative overflow-x-auto rounded-2xl border border-white/[0.06] bg-zinc-950/60 p-1.5 backdrop-blur-sm"
      aria-label="Fluxo de edição"
    >
      <ol className="flex min-w-max items-center gap-1">
        {steps.map((s, i) => {
          const isActive = s.id === active
          const isDone = done.has(s.id)
          const isLocked = locked.has(s.id) && !isDone
          const idx = i + 1
          return (
            <li key={s.id} className="flex items-center gap-1">
              {i > 0 ? (
                <span
                  className={cn(
                    'mx-0.5 hidden h-px w-3 sm:block',
                    isDone || isActive ? 'bg-pink-500/50' : 'bg-white/10',
                  )}
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onSelect(s.id)}
                title={isLocked ? 'Completa o passo anterior primeiro' : s.label}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all',
                  isActive && 'bg-pink-500/15 text-pink-100 shadow-[0_0_0_1px_rgba(244,114,182,0.35)]',
                  !isActive && !isLocked && 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
                  isLocked && 'cursor-not-allowed opacity-40',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold tabular-nums',
                    isActive && 'bg-pink-500 text-white',
                    isDone && !isActive && 'bg-emerald-500/90 text-white',
                    !isActive && !isDone && 'bg-white/[0.06] text-muted-foreground',
                  )}
                >
                  {isDone && !isActive ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : isLocked ? (
                    <Lock className="h-3 w-3" aria-hidden />
                  ) : (
                    idx
                  )}
                </span>
                <span className="text-[11px] font-medium sm:text-xs">{s.short ?? s.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function CortesStepNav({
  onBack,
  onNext,
  backLabel = 'Voltar',
  nextLabel = 'Continuar',
  nextDisabled,
  nextHint,
}: {
  onBack?: () => void
  onNext?: () => void
  backLabel?: string
  nextLabel?: string
  nextDisabled?: boolean
  nextHint?: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-zinc-950/50 px-3 py-3 sm:px-4">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      <div className="flex flex-col items-end gap-1">
        {nextHint ? <p className="max-w-[220px] text-right text-[10px] text-muted-foreground">{nextHint}</p> : null}
        {onNext ? (
          <button
            type="button"
            disabled={nextDisabled}
            onClick={onNext}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors',
              nextDisabled
                ? 'cursor-not-allowed bg-white/5 text-muted-foreground'
                : 'bg-pink-500 text-white hover:bg-pink-400',
            )}
          >
            {nextLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function CortesTimelineBar({
  durationSec,
  ranges,
  playhead,
  onSeek,
}: {
  durationSec: number
  ranges: Array<{ start: number; end: number; tone?: 'work' | 'clip' }>
  playhead: number
  onSeek?: (t: number) => void
}) {
  const dur = Math.max(0.1, durationSec)
  const pct = (t: number) => `${Math.min(100, Math.max(0, (t / dur) * 100))}%`

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-mono tabular-nums text-muted-foreground">
        <span>0:00</span>
        <span>
          {Math.floor(dur / 60)}:{String(Math.floor(dur % 60)).padStart(2, '0')}
        </span>
      </div>
      <button
        type="button"
        className="relative h-10 w-full overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-950/80"
        onClick={(e) => {
          if (!onSeek) return
          const rect = e.currentTarget.getBoundingClientRect()
          const x = (e.clientX - rect.left) / rect.width
          onSeek(x * dur)
        }}
        aria-label="Timeline"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent, transparent 9%, rgba(255,255,255,0.06) 9%, rgba(255,255,255,0.06) 10%)',
          }}
          aria-hidden
        />
        {ranges.map((r, i) => (
          <div
            key={i}
            className={cn(
              'absolute top-1.5 bottom-1.5 rounded-md',
              r.tone === 'work'
                ? 'bg-pink-500/35 ring-1 ring-pink-400/40'
                : 'bg-cyan-500/30 ring-1 ring-cyan-400/30',
            )}
            style={{ left: pct(r.start), width: pct(r.end - r.start) }}
          />
        ))}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-yellow-300 shadow-[0_0_8px_rgba(253,224,71,0.8)]"
          style={{ left: pct(playhead) }}
          aria-hidden
        />
      </button>
      <p className="text-[10px] text-muted-foreground">Toca na barra para saltar no vídeo.</p>
    </div>
  )
}

export function CortesChip({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'pink' | 'ok'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg border px-2 py-1 text-[10px] font-medium tabular-nums',
        tone === 'pink' && 'border-pink-500/30 bg-pink-500/10 text-pink-200',
        tone === 'ok' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
        tone === 'neutral' && 'border-white/[0.08] bg-white/[0.03] text-muted-foreground',
      )}
    >
      {children}
    </span>
  )
}
