'use client'

import { useCallback, useEffect, useState } from 'react'
import { useChartDrawings } from '@/components/btc-dashboard/chart-drawings-context'
import {
  ChartIndicatorQuickMenu,
  type ChartIndicatorQuickMenuState,
} from '@/components/btc-dashboard/chart-indicator-quick-menu'
import type { ChartLegendSettingsFocus } from '@/components/btc-dashboard/chart-indicator-legend'
import { useChartIndicators } from '@/components/btc-dashboard/chart-indicators-context'
import { useBtcSettings } from '@/components/btc-dashboard/btc-settings-context'
import { hitChartIndicatorAt } from '@/lib/btc/chart-indicator-hit'
import { useDrawingStore } from '@/lib/drawing-system/store/drawing-store'
import { resolveToolMode } from '@/lib/drawing-system/tools/tool-registry'
import type { OhlcvBar } from '@/lib/btc/types'

function clampMenuPosition(x: number, y: number, w = 180, h = 200) {
  const pad = 8
  const maxX = typeof window !== 'undefined' ? window.innerWidth - w - pad : x
  const maxY = typeof window !== 'undefined' ? window.innerHeight - h - pad : y
  return {
    x: Math.max(pad, Math.min(x, maxX)),
    y: Math.max(pad, Math.min(y, maxY)),
  }
}

export function ChartIndicatorHitLayer({
  bars,
  onOpenSettings,
}: {
  bars: OhlcvBar[]
  onOpenSettings?: (focus: ChartLegendSettingsFocus) => void
}) {
  const { mainChart } = useChartDrawings()
  const { targets } = useChartIndicators()
  const { chartIndicatorDisplay } = useBtcSettings()
  const activeToolId = useDrawingStore((s) => s.activeToolId)
  const [menu, setMenu] = useState<ChartIndicatorQuickMenuState | null>(null)

  const openMenuFor = useCallback(
    (entry: (typeof targets)[number], clientX: number, clientY: number) => {
      if (chartIndicatorDisplay.tapAction === 'settings') {
        onOpenSettings?.(entry.settingsFocus)
        return
      }
      const pos = clampMenuPosition(clientX + 6, clientY - 8)
      setMenu({
        ...pos,
        id: entry.id,
        label: entry.label,
        colors: entry.colors,
        settingsFocus: entry.settingsFocus,
        onRemove: entry.onRemove,
      })
    },
    [chartIndicatorDisplay.tapAction, onOpenSettings],
  )

  useEffect(() => {
    const api = mainChart
    if (!api || !targets.length) return

    const { chart, series, container } = api
    const mode = resolveToolMode(activeToolId)

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (mode === 'draw' || mode === 'erase') return
      if (useDrawingStore.getState().selectedId) return

      const hit = hitChartIndicatorAt(e.clientX, e.clientY, container, chart, series, bars, targets)
      if (!hit) return

      const entry = targets.find((t) => t.id === hit.id)
      if (!entry) return

      e.preventDefault()
      e.stopPropagation()
      openMenuFor(entry, e.clientX, e.clientY)
    }

    container.addEventListener('pointerdown', onPointerDown, true)
    return () => container.removeEventListener('pointerdown', onPointerDown, true)
  }, [mainChart, targets, bars, activeToolId, openMenuFor])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const timer = window.setTimeout(() => {
      window.addEventListener('pointerdown', close, { once: true })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', close)
    }
  }, [menu])

  if (!menu) return null

  return (
    <ChartIndicatorQuickMenu menu={menu} onClose={() => setMenu(null)} onOpenSettings={onOpenSettings} />
  )
}
