import type { ChartPoint, Drawing, FibLevelConfig, FibRetracementData } from '@/lib/drawing-system/types'
import { createDefaultFibData, createDefaultFibLevels } from '@/lib/drawing-system/tools/fib/FibMath'

export const FibRetracementTool = {
  type: 'fibonacci' as const,
  toolId: 'fib-retracement' as const,
  dragToComplete: true,
}

export function createFibDrawing(points: ChartPoint[], extra?: Partial<Drawing>): Drawing {
  return {
    id: extra?.id ?? `dr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    type: 'fibonacci',
    points,
    style: extra?.style ?? { color: '#787B86', lineWidth: 1 },
    visible: extra?.visible ?? true,
    locked: extra?.locked ?? false,
    zIndex: extra?.zIndex ?? Date.now(),
    fib: extra?.fib ?? createDefaultFibData(),
    createdAt: extra?.createdAt ?? Date.now(),
  }
}

export function normalizeFibLevels(levels: FibLevelConfig[]): FibLevelConfig[] {
  const seen = new Set<number>()
  const out: FibLevelConfig[] = []
  for (const l of levels) {
    const r = Math.round(l.ratio * 1000) / 1000
    if (seen.has(r)) continue
    seen.add(r)
    out.push({ ...l, ratio: r })
  }
  return out.sort((a, b) => a.ratio - b.ratio)
}

export function addFibLevel(data: FibRetracementData, ratio: number): FibRetracementData {
  const levels = normalizeFibLevels([...data.levels, { ratio, visible: true }])
  return { ...data, levels }
}

export function removeFibLevel(data: FibRetracementData, ratio: number): FibRetracementData {
  const r = Math.round(ratio * 1000) / 1000
  const levels = data.levels.filter((l) => Math.round(l.ratio * 1000) / 1000 !== r)
  return { ...data, levels: levels.length ? levels : createDefaultFibLevels() }
}

export function updateFibLevelStyle(
  data: FibRetracementData,
  ratio: number,
  patch: Partial<Pick<FibLevelConfig, 'color' | 'lineWidth' | 'visible'>>,
): FibRetracementData {
  const r = Math.round(ratio * 1000) / 1000
  return {
    ...data,
    levels: data.levels.map((l) =>
      Math.round(l.ratio * 1000) / 1000 === r ? { ...l, ...patch } : l,
    ),
  }
}
