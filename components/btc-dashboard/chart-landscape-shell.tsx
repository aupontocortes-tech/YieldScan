'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Smartphone } from 'lucide-react'
import { useChartLandscape } from '@/hooks/use-chart-landscape'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

const LANDSCAPE_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100dvh',
  height: '100dvw',
  maxWidth: '100dvh',
  maxHeight: '100dvw',
  transform: 'rotate(90deg) translateY(-100%)',
  transformOrigin: 'top left',
  zIndex: 245,
}

export function ChartLandscapeShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()
  const { active, mode, toggle } = useChartLandscape()

  if (!isMobile) {
    return <>{children}</>
  }

  return (
    <>
      {active && mode === 'css' && (
        <div
          className="fixed inset-0 z-[244] bg-[#050505]"
          aria-hidden
        />
      )}

      <div
        className={cn(
          'flex min-h-0 w-full flex-1 flex-col',
          active && mode === 'css' && 'overflow-hidden',
        )}
        style={active && mode === 'css' ? LANDSCAPE_STYLE : undefined}
      >
        {children}
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-pressed={active}
        aria-label={
          active
            ? 'Voltar à orientação vertical'
            : 'Girar gráfico para modo horizontal (paisagem)'
        }
        className={cn(
          'fixed z-[260] flex touch-manipulation flex-col items-center justify-center gap-1',
          'border border-[#d4af37]/35 bg-[#0a0a0a]/95 shadow-xl backdrop-blur-md',
          'py-2.5 pl-2 pr-2.5 transition-transform duration-200',
          'right-0 top-[40%] -translate-y-1/2 rounded-l-2xl rounded-r-none',
          active
            ? 'translate-x-0 border-[#d4af37]/60 bg-[#d4af37]/12'
            : 'translate-x-[42%] hover:translate-x-[28%]',
        )}
      >
        <Smartphone
          className={cn(
            'h-5 w-5 text-[#d4af37] transition-transform duration-300',
            active ? 'rotate-0' : '-rotate-90',
          )}
          aria-hidden
        />
        <span
          className="text-[8px] font-semibold uppercase leading-none tracking-wider text-[#d4af37]/90"
          style={{ writingMode: 'vertical-rl' }}
        >
          {active ? 'Vertical' : 'Girar'}
        </span>
      </button>
    </>
  )
}
