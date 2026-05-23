'use client'

import type { ReactNode, SVGProps } from 'react'
import type { DrawingToolId } from '@/lib/btc/chart-drawings-config'
import { cn } from '@/lib/utils'

type IconProps = { className?: string }

const VB = '0 0 32 32'

function Svg({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox={VB}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-9 w-9 shrink-0', className)}
      aria-hidden
    >
      {children}
    </svg>
  )
}

const S: SVGProps<SVGPathElement> = {
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Dot({ x, y, r = 1.75 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill="currentColor" />
}

/* ─── Ferramentas (ícones alinhados ao TradingView mobile) ─── */

/** Marcações de régua ao longo da aresta superior do corpo */
function RulerTicks({ originX, originY, count, step }: { originX: number; originY: number; count: number; step: number }) {
  const ticks = []
  for (let i = 0; i <= count; i++) {
    const x = originX + i * step
    const major = i % 5 === 0
    ticks.push(
      <line
        key={i}
        x1={x}
        y1={originY}
        x2={x}
        y2={originY - (major ? 2.8 : 1.6)}
        stroke="currentColor"
        strokeWidth={major ? 1.1 : 0.85}
        strokeLinecap="round"
      />,
    )
  }
  return <>{ticks}</>
}

/** Régua de medição — corpo rectangular com escala (não é linha de tendência). */
function IconRuler(p: IconProps) {
  return (
    <Svg className={p.className}>
      <g transform="translate(16,16) rotate(-38) translate(-16,-16)">
        <rect
          x={4.5}
          y={12}
          width={23}
          height={8}
          rx={1.25}
          stroke="currentColor"
          strokeWidth={1.2}
          fill="none"
        />
        <RulerTicks originX={6.5} originY={12} count={10} step={2.05} />
      </g>
    </Svg>
  )
}

/** Borracha — bloco inclinado com linha a apagar (estilo TradingView). */
function IconEraser(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path
        d="M9.5 21.5 19.5 9.5 23.5 12.5 13.5 24.5 9.5 24.5Z"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity={0.08}
      />
      <path
        d="M11.5 19.5 21.5 10.5"
        stroke="currentColor"
        strokeWidth={0.9}
        strokeLinecap="round"
        opacity={0.55}
      />
      <path
        d="M6 25.5h11.5"
        stroke="currentColor"
        strokeWidth={1.15}
        strokeLinecap="round"
        opacity={0.4}
      />
      <path
        d="M5.5 25c2.5-0.5 5-0.5 8 0"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.28}
      />
    </Svg>
  )
}

/** Lápis + cadeado — «Continue desenhando». */
function IconContinueDrawing(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path
        d="M7.5 23.5 17 9.5 20.5 12 11.5 26 7.5 26Z"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity={0.06}
      />
      <path d="M17 9.5 21 6" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" />
      <g transform="translate(19 4.5)">
        <rect
          x={0}
          y={0}
          width={9}
          height={9}
          rx={2}
          stroke="currentColor"
          strokeWidth={1.1}
          fill="#131314"
        />
        <rect x={2.25} y={4.25} width={4.5} height={3.25} rx={0.5} stroke="currentColor" strokeWidth={0.95} />
        <path
          d="M3.25 4.25V3a1.35 1.35 0 0 1 2.7 0v1.25"
          stroke="currentColor"
          strokeWidth={0.95}
          strokeLinecap="round"
        />
      </g>
    </Svg>
  )
}

/** Olho riscado — «Ocultar desenhos». */
function IconHideDrawings(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path
        d="M4.5 16.5c4.2-5.8 19.3-5.8 23.5 0-4.2 5.8-19.3 5.8-23.5 0Z"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <circle cx={16} cy={16.5} r={2.75} stroke="currentColor" strokeWidth={1.15} />
      <circle cx={16} cy={16.5} r={0.9} fill="currentColor" />
      <path d="M6.5 7.5 25.5 25.5" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" />
    </Svg>
  )
}

/** Cadeado fechado — «Travar todos». */
function IconLockAll(p: IconProps) {
  return (
    <Svg className={p.className}>
      <rect x={8.5} y={14.5} width={15} height={11.5} rx={2} stroke="currentColor" strokeWidth={1.2} />
      <path
        d="M11.5 14.5v-2.75c0-2.35 2.15-4.25 4.75-4.25s4.75 1.9 4.75 4.25V14.5"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <circle cx={16} cy={19.5} r={1.35} fill="currentColor" />
      <path d="M16 19.5v2.25" stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
    </Svg>
  )
}

/** Ímã em ferradura — «Ímã fraco». */
function IconWeakMagnet(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path
        d="M9 19V12.5C9 9.2 11.8 6.5 15.25 6.5S21.5 9.2 21.5 12.5V19"
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinecap="round"
        fill="none"
      />
      <path d="M9 19h3.25M18.25 19H21.5" stroke="currentColor" strokeWidth={2.35} strokeLinecap="round" />
    </Svg>
  )
}

/** Caixote do lixo — «Remover todos». */
function IconRemoveAll(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M10.5 12.5h11" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
      <path
        d="M11.75 12.5 12.65 25h6.7l.9-12.5"
        stroke="currentColor"
        strokeWidth={1.15}
        strokeLinejoin="round"
      />
      <path
        d="M13.25 12.5V10a2.6 2.6 0 0 1 5.2 0v2.5"
        stroke="currentColor"
        strokeWidth={1.15}
        strokeLinecap="round"
      />
      <path d="M12.5 9h7" stroke="currentColor" strokeWidth={1.15} strokeLinecap="round" />
      <path d="M14.25 16v5.5M16 16v5.5M17.75 16v5.5" stroke="currentColor" strokeWidth={0.85} opacity={0.45} />
    </Svg>
  )
}

function IconZoomIn(p: IconProps) {
  return (
    <Svg className={p.className}>
      <circle cx={13.5} cy={13.5} r={7.25} stroke="currentColor" strokeWidth={1.2} />
      <path d="M18.25 18.25 24 24" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" />
      <path d="M13.5 9.75v7.5M9.75 13.5h7.5" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" />
    </Svg>
  )
}

function IconZoomOut(p: IconProps) {
  return (
    <Svg className={p.className}>
      <circle cx={13.5} cy={13.5} r={7.25} stroke="currentColor" strokeWidth={1.2} />
      <path d="M18.25 18.25 24 24" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" />
      <path d="M9.75 13.5h7.5" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" />
    </Svg>
  )
}

/* ─── Linhas de tendência ─── */

function IconTrendLine(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M7 24L23 10" {...S} />
      <Dot x={7} y={24} />
      <Dot x={23} y={10} />
    </Svg>
  )
}

function IconRay(p: IconProps) {
  return (
    <Svg className={p.className}>
      <Dot x={8} y={23} />
      <path d="M9.5 21.5L26 7" {...S} />
    </Svg>
  )
}

function IconInfoLine(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M6 24L22 11" {...S} />
      <Dot x={6} y={24} />
      <Dot x={22} y={11} />
      <rect x={13} y={14} width={7} height={5} rx={1} stroke="currentColor" strokeWidth={1} />
      <path d="M16.5 17v-1.5" stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
    </Svg>
  )
}

function IconExtendedLine(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M4 20L26 12" {...S} strokeDasharray="3 2" opacity={0.45} />
      <path d="M8 22L24 14" {...S} />
      <Dot x={8} y={22} />
      <Dot x={24} y={14} />
    </Svg>
  )
}

function IconTrendAngle(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M6 24L24 12" {...S} />
      <path d="M6 24h10" {...S} opacity={0.6} />
      <path
        d="M6 24a8 8 0 0 1 7-6.5"
        stroke="currentColor"
        strokeWidth={1}
        fill="none"
        opacity={0.6}
      />
      <Dot x={6} y={24} />
      <Dot x={24} y={12} />
    </Svg>
  )
}

function IconHorizontalLine(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M4 16h24" {...S} />
      <Dot x={16} y={16} />
    </Svg>
  )
}

function IconHorizontalRay(p: IconProps) {
  return (
    <Svg className={p.className}>
      <Dot x={7} y={16} />
      <path d="M8.5 16H27" {...S} />
      <path d="M24 16l3-2.5v5L24 16z" fill="currentColor" />
    </Svg>
  )
}

function IconVerticalLine(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M16 5v22" {...S} />
      <Dot x={16} y={16} />
    </Svg>
  )
}

function IconCrossLine(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M4 16h24M16 5v22" {...S} />
      <Dot x={16} y={16} />
    </Svg>
  )
}

function IconParallelChannel(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M6 22L24 10" {...S} />
      <path d="M6 18L24 6" {...S} />
      <Dot x={6} y={22} />
      <Dot x={24} y={10} />
      <Dot x={6} y={18} />
    </Svg>
  )
}

function IconRegressionTrend(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M5 21L25 9" {...S} opacity={0.45} />
      <path d="M7 23L23 11" {...S} opacity={0.45} />
      <path d="M6 22L24 10" {...S} />
      <Dot x={6} y={22} />
      <Dot x={24} y={10} />
    </Svg>
  )
}

function IconFlatTopBottom(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M4 12h24M4 20h24" {...S} />
      <Dot x={8} y={12} />
      <Dot x={24} y={20} />
    </Svg>
  )
}

function IconDisjointChannel(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M5 20L20 12" {...S} />
      <path d="M12 24L27 14" {...S} />
      <Dot x={5} y={20} />
      <Dot x={20} y={12} />
      <Dot x={12} y={24} />
    </Svg>
  )
}

function IconPitchfork(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M16 6v20M16 12L6 24M16 12L26 24" {...S} />
      <Dot x={16} y={6} />
      <Dot x={6} y={24} />
      <Dot x={26} y={24} />
    </Svg>
  )
}

function IconSchiffPitchfork(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M16 6v20M11 24L16 12M21 24L16 12" {...S} />
      <Dot x={16} y={6} />
      <Dot x={11} y={24} />
      <Dot x={21} y={24} />
    </Svg>
  )
}

function IconInsidePitchfork(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M16 6v20M10 22L16 12M22 22L16 12" {...S} />
      <path d="M13 18L19 18" {...S} opacity={0.5} />
      <Dot x={16} y={6} />
    </Svg>
  )
}

/* ─── Fibonacci / Gann ─── */

function IconFibRetracement(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M6 24L24 8" {...S} />
      {[10, 14, 18, 22].map((y) => (
        <path key={y} d={`M5 ${y}h22`} stroke="currentColor" strokeWidth={1} opacity={0.85} />
      ))}
      <Dot x={6} y={24} />
      <Dot x={24} y={8} />
    </Svg>
  )
}

function IconFibExtension(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M7 22L21 10" {...S} />
      {[8, 12, 16, 20, 24].map((y) => (
        <path key={y} d={`M6 ${y}h20`} stroke="currentColor" strokeWidth={1} opacity={0.7} />
      ))}
      <Dot x={7} y={22} />
      <Dot x={21} y={10} />
    </Svg>
  )
}

function IconFibChannel(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M6 22L24 10" {...S} />
      <path d="M6 18L24 6" {...S} />
      <path d="M8 20h16M8 16h16M8 12h16" stroke="currentColor" strokeWidth={0.9} opacity={0.55} />
      <Dot x={6} y={22} />
      <Dot x={24} y={10} />
    </Svg>
  )
}

function IconFibTimezone(p: IconProps) {
  return (
    <Svg className={p.className}>
      {[8, 12, 16, 20, 24].map((x) => (
        <path key={x} d={`M${x} 6v20`} stroke="currentColor" strokeWidth={1} opacity={0.8} />
      ))}
      <Dot x={8} y={24} />
      <Dot x={24} y={8} />
    </Svg>
  )
}

function IconSpeedResistanceFan(p: IconProps) {
  return (
    <Svg className={p.className}>
      <Dot x={8} y={24} />
      <path d="M8 24L26 8M8 24L24 14M8 24L20 20M8 24L14 22" {...S} opacity={0.9} />
    </Svg>
  )
}

function IconFibTimeTrend(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M7 23L23 9" {...S} />
      {[11, 15, 19].map((x, i) => (
        <path key={x} d={`M${x} ${9 + i * 4}v${14 - i * 2}`} stroke="currentColor" strokeWidth={1} />
      ))}
      <Dot x={7} y={23} />
      <Dot x={23} y={9} />
    </Svg>
  )
}

function IconFibCircles(p: IconProps) {
  return (
    <Svg className={p.className}>
      <ellipse cx={16} cy={16} rx={10} ry={6} stroke="currentColor" strokeWidth={1.25} />
      <ellipse cx={16} cy={16} rx={6} ry={3.5} stroke="currentColor" strokeWidth={1} opacity={0.7} />
      <ellipse cx={16} cy={16} rx={3} ry={1.75} stroke="currentColor" strokeWidth={1} opacity={0.5} />
      <path d="M8 24L24 8" {...S} opacity={0.4} />
      <Dot x={8} y={24} />
      <Dot x={24} y={8} />
    </Svg>
  )
}

function IconFibSpiral(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path
        d="M16 16c0-5 4-8 8-8 4 0 6 2 6 5 0 4-4 6-8 6-6 0-10 4-10 9 0 5 5 8 11 8"
        stroke="currentColor"
        strokeWidth={1.25}
        fill="none"
      />
      <Dot x={16} y={16} />
    </Svg>
  )
}

function IconSpeedResistanceArcs(p: IconProps) {
  return (
    <Svg className={p.className}>
      <Dot x={8} y={24} />
      <path
        d="M8 24c6-10 14-14 20-10M8 24c4-6 10-9 16-7M8 24c2-3 6-4 10-3"
        stroke="currentColor"
        strokeWidth={1.15}
        fill="none"
      />
    </Svg>
  )
}

function IconFibWedge(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M8 24L24 8M8 24L24 20M24 8L24 20" {...S} />
      <path d="M12 20h12M14 16h10" stroke="currentColor" strokeWidth={0.9} opacity={0.5} />
      <Dot x={8} y={24} />
    </Svg>
  )
}

function IconLineFan(p: IconProps) {
  return (
    <Svg className={p.className}>
      <Dot x={16} y={24} />
      <path d="M16 24L6 8M16 24L12 8M16 24L20 8M16 24L26 8" {...S} />
    </Svg>
  )
}

function IconGannBox(p: IconProps) {
  return (
    <Svg className={p.className}>
      <rect x={7} y={8} width={18} height={16} stroke="currentColor" strokeWidth={1.25} />
      <path d="M7 8l18 16M25 8L7 24" stroke="currentColor" strokeWidth={0.9} opacity={0.5} />
      <path d="M16 8v16M7 16h18" stroke="currentColor" strokeWidth={0.9} opacity={0.5} />
      <Dot x={7} y={8} />
      <Dot x={25} y={24} />
    </Svg>
  )
}

function IconGannSquare(p: IconProps) {
  return (
    <Svg className={p.className}>
      <rect x={8} y={8} width={16} height={16} stroke="currentColor" strokeWidth={1.25} />
      {[12, 16, 20].map((n) => (
        <g key={n} opacity={0.45}>
          <path d={`M8 ${n}h16M${n} 8v16`} stroke="currentColor" strokeWidth={0.75} />
        </g>
      ))}
      <Dot x={8} y={8} />
      <Dot x={24} y={24} />
    </Svg>
  )
}

function IconGannFan(p: IconProps) {
  return (
    <Svg className={p.className}>
      <Dot x={8} y={24} />
      <path d="M8 24h18M8 24v-16M8 24L24 8" {...S} />
      <path d="M8 24L22 12M8 24L18 16" {...S} opacity={0.55} />
    </Svg>
  )
}

/* ─── Padrões ─── */

function IconXabcd(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M4 20L10 12L15 17L22 7L27 11" {...S} />
      {[
        [4, 20, 'X'],
        [10, 12, 'A'],
        [15, 17, 'B'],
        [22, 7, 'C'],
        [27, 11, 'D'],
      ].map(([x, y, l]) => (
        <text
          key={l as string}
          x={(x as number) - 1}
          y={(y as number) + (l === 'C' ? -2 : 4)}
          fill="currentColor"
          fontSize={5}
          fontWeight={600}
          fontFamily="system-ui,sans-serif"
        >
          {l as string}
        </text>
      ))}
    </Svg>
  )
}

function IconCypher(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M4 18L11 10L16 15L23 8L27 13" {...S} />
      <text x={14} y={13} fill="currentColor" fontSize={5.5} fontWeight={700} fontFamily="system-ui">
        C
      </text>
      <Dot x={4} y={18} />
      <Dot x={27} y={13} />
    </Svg>
  )
}

function IconHeadShoulders(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M4 20L9 14L14 18L16 8L18 18L23 14L28 20" {...S} />
      <Dot x={16} y={8} />
    </Svg>
  )
}

function IconAbcd(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M5 20L11 11L17 17L26 8" {...S} />
      {['A', 'B', 'C', 'D'].map((l, i) => (
        <text
          key={l}
          x={[5, 11, 17, 26][i] - 1}
          y={[20, 11, 17, 8][i] + 4}
          fill="currentColor"
          fontSize={5}
          fontWeight={600}
          fontFamily="system-ui"
        >
          {l}
        </text>
      ))}
    </Svg>
  )
}

function IconTrianglePattern(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M6 22L16 8L26 22M6 22L26 22" {...S} />
      <Dot x={6} y={22} />
      <Dot x={16} y={8} />
      <Dot x={26} y={22} />
    </Svg>
  )
}

function IconThreeDrives(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M4 22L9 16L13 19L18 11L22 14L27 6" {...S} />
      <Dot x={4} y={22} />
      <Dot x={27} y={6} />
    </Svg>
  )
}

function IconElliottImpulse(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M4 20L8 14L11 17L15 9L18 12L22 6L27 10" {...S} />
      {['1', '2', '3', '4', '5'].map((n, i) => (
        <text
          key={n}
          x={[4, 8, 15, 18, 22][i]}
          y={[20, 14, 9, 12, 6][i] - 2}
          fill="currentColor"
          fontSize={5}
          fontWeight={600}
          fontFamily="system-ui"
        >
          {n}
        </text>
      ))}
    </Svg>
  )
}

function IconElliottCorrective(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M5 18L12 10L18 16L26 8" {...S} />
      {['A', 'B', 'C'].map((l, i) => (
        <text key={l} x={[5, 12, 26][i]} y={[18, 10, 8][i] - 2} fill="currentColor" fontSize={5} fontWeight={600}>
          {l}
        </text>
      ))}
    </Svg>
  )
}

function IconElliottTriangle(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M5 20L10 14L14 18L18 12L22 16L26 10" {...S} />
      <text x={4} y={22} fill="currentColor" fontSize={4.5} fontWeight={600}>
        A
      </text>
      <text x={25} y={12} fill="currentColor" fontSize={4.5} fontWeight={600}>
        E
      </text>
    </Svg>
  )
}

function IconElliottCombo(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M5 18L11 11L17 16L25 9" {...S} />
      <text x={4} y={20} fill="currentColor" fontSize={5} fontWeight={600}>
        W
      </text>
      <text x={24} y={11} fill="currentColor" fontSize={5} fontWeight={600}>
        Y
      </text>
    </Svg>
  )
}

function IconCyclicLines(p: IconProps) {
  return (
    <Svg className={p.className}>
      {[9, 13, 17, 21, 25].map((x) => (
        <g key={x}>
          <path d={`M${x} 7v18`} stroke="currentColor" strokeWidth={1.1} />
          <circle cx={x} cy={7} r={1.25} fill="currentColor" />
          <circle cx={x} cy={25} r={1.25} fill="currentColor" />
        </g>
      ))}
    </Svg>
  )
}

function IconTimeCycles(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path
        d="M6 20a4 4 0 0 1 8 0a4 4 0 0 1 8 0a4 4 0 0 1 8 0"
        stroke="currentColor"
        strokeWidth={1.2}
        fill="none"
      />
      <path d="M6 20h20" stroke="currentColor" strokeWidth={1} opacity={0.35} />
    </Svg>
  )
}

function IconSineLine(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path
        d="M4 16c2-6 4-6 6 0s4 6 6 0 4-6 6 0 4 6 6 0"
        stroke="currentColor"
        strokeWidth={1.25}
        fill="none"
      />
    </Svg>
  )
}

/* ─── Previsão e medição ─── */

function IconLongPosition(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M8 22L22 10" {...S} />
      <path d="M22 10h6" {...S} />
      <path d="M8 22v5" {...S} />
      <path d="M20 14h4" stroke="currentColor" strokeWidth={1} strokeDasharray="2 2" opacity={0.6} />
      <rect x={18} y={12} width={8} height={3} fill="currentColor" opacity={0.25} />
    </Svg>
  )
}

function IconShortPosition(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M8 10L22 22" {...S} />
      <path d="M22 22h6" {...S} />
      <path d="M8 10v-4" {...S} />
      <path d="M20 18h4" stroke="currentColor" strokeWidth={1} strokeDasharray="2 2" opacity={0.6} />
      <rect x={18} y={17} width={8} height={3} fill="currentColor" opacity={0.25} />
    </Svg>
  )
}

function IconForecast(p: IconProps) {
  return (
    <Svg className={p.className}>
      <rect x={6} y={14} width={3} height={8} fill="currentColor" opacity={0.5} />
      <rect x={11} y={10} width={3} height={12} fill="currentColor" opacity={0.65} />
      <rect x={16} y={6} width={3} height={16} fill="currentColor" opacity={0.8} />
      <path d="M8 18L20 8" {...S} />
      <Dot x={8} y={18} />
      <Dot x={20} y={8} />
    </Svg>
  )
}

function IconBarPattern(p: IconProps) {
  return (
    <Svg className={p.className}>
      {[8, 14, 20].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={10 + i * 2}
          width={4}
          height={14 - i * 2}
          fill="currentColor"
          opacity={0.45 + i * 0.15}
        />
      ))}
    </Svg>
  )
}

function IconGhostFeed(p: IconProps) {
  return (
    <Svg className={p.className}>
      <rect x={7} y={12} width={3} height={10} stroke="currentColor" strokeWidth={1} opacity={0.35} />
      <rect x={13} y={8} width={3} height={14} stroke="currentColor" strokeWidth={1} opacity={0.35} />
      <rect x={19} y={10} width={3} height={12} stroke="currentColor" strokeWidth={1} opacity={0.35} />
      <path d="M6 16h20" {...S} />
      <Dot x={6} y={16} />
      <Dot x={26} y={16} />
    </Svg>
  )
}

function IconProjection(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M6 22L16 14" {...S} />
      <path
        d="M16 14c4-2 8-2 12 0"
        stroke="currentColor"
        strokeWidth={1.25}
        fill="none"
      />
      <Dot x={6} y={22} />
      <Dot x={16} y={14} />
      <Dot x={26} y={12} />
    </Svg>
  )
}

function IconAnchoredVwap(p: IconProps) {
  return (
    <Svg className={p.className}>
      <circle cx={8} cy={22} r={2} stroke="currentColor" strokeWidth={1.1} />
      <path d="M10 21L24 9" {...S} />
      <rect x={14} y={12} width={2} height={8} fill="currentColor" opacity={0.4} />
      <rect x={18} y={10} width={2} height={10} fill="currentColor" opacity={0.55} />
      <rect x={22} y={8} width={2} height={12} fill="currentColor" opacity={0.7} />
    </Svg>
  )
}

function IconVolumeProfile(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M16 6v20" {...S} />
      {[10, 13, 16, 19, 22].map((y, i) => (
        <rect
          key={y}
          x={16 - (i + 1) * 1.8}
          y={y - 1}
          width={(i + 1) * 1.6}
          height={2}
          fill="currentColor"
          opacity={0.35 + i * 0.12}
        />
      ))}
      <Dot x={16} y={6} />
    </Svg>
  )
}

function IconPriceRange(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M10 8h12M10 24h12" {...S} />
      <path d="M16 10v12" {...S} />
      <path d="M14 11l2-2 2 2M14 21l2 2 2-2" stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
      <Dot x={10} y={8} />
      <Dot x={22} y={24} />
    </Svg>
  )
}

function IconDateRange(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M7 16h18M7 10v12M25 10v12" {...S} />
      <path d="M9 14h-2M23 14h2" stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
      <Dot x={7} y={16} />
      <Dot x={25} y={16} />
    </Svg>
  )
}

function IconDatePriceRange(p: IconProps) {
  return (
    <Svg className={p.className}>
      <rect x={9} y={9} width={14} height={14} stroke="currentColor" strokeWidth={1.25} />
      <path d="M16 11v10M11 16h10" {...S} opacity={0.55} />
      <Dot x={9} y={9} />
      <Dot x={23} y={23} />
    </Svg>
  )
}

/* ─── Formas e anotações ─── */

function IconBrush(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path
        d="M7 22c2-4 5-7 9-8.5 3.5-1.5 7-1 10 1.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
      />
      <path d="M22 15l3 3-2 2-3-3 2-2z" stroke="currentColor" strokeWidth={1.1} strokeLinejoin="round" />
    </Svg>
  )
}

function IconHighlighter(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M8 20h16" stroke="currentColor" strokeWidth={4} strokeLinecap="round" opacity={0.35} />
      <path d="M10 18l10-8 4 4-10 8H10v-4z" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round" />
    </Svg>
  )
}

function IconArrowMarker(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M8 24L22 8" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M15 8h7v7" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function IconArrowThin(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M6 24L22 10" {...S} />
      <path d="M16 10h6v6" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function IconArrowUp(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M16 6v16" {...S} />
      <path d="M11 11l5-5 5 5" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function IconArrowDown(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M16 6v16" {...S} />
      <path d="M11 21l5 5 5-5" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function IconRectangle(p: IconProps) {
  return (
    <Svg className={p.className}>
      <rect x={7} y={9} width={18} height={14} stroke="currentColor" strokeWidth={1.25} />
      <Dot x={7} y={9} />
      <Dot x={25} y={9} />
      <Dot x={7} y={23} />
      <Dot x={25} y={23} />
    </Svg>
  )
}

function IconRotatedRectangle(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M10 22L20 8L26 14L16 26Z" stroke="currentColor" strokeWidth={1.25} strokeLinejoin="round" />
      <Dot x={10} y={22} />
      <Dot x={20} y={8} />
      <Dot x={26} y={14} />
      <Dot x={16} y={26} />
    </Svg>
  )
}

function IconPath(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M5 22L12 16L18 20L26 8" {...S} />
      <Dot x={5} y={22} />
      <Dot x={12} y={16} />
      <Dot x={18} y={20} />
      <Dot x={26} y={8} />
    </Svg>
  )
}

function IconCircle(p: IconProps) {
  return (
    <Svg className={p.className}>
      <circle cx={16} cy={16} r={9} stroke="currentColor" strokeWidth={1.25} />
      <Dot x={16} y={16} />
      <Dot x={16} y={7} />
    </Svg>
  )
}

function IconEllipse(p: IconProps) {
  return (
    <Svg className={p.className}>
      <ellipse cx={16} cy={16} rx={11} ry={7} stroke="currentColor" strokeWidth={1.25} />
      <Dot x={16} y={16} />
      <Dot x={27} y={16} />
      <Dot x={16} y={9} />
    </Svg>
  )
}

function IconPolyline(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M4 20L10 14L14 18L20 10L26 14" {...S} />
      {[4, 10, 14, 20, 26].map((x, i) => (
        <Dot key={x} x={x} y={[20, 14, 18, 10, 14][i]} />
      ))}
    </Svg>
  )
}

function IconTriangleShape(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M16 7L26 25H6Z" stroke="currentColor" strokeWidth={1.25} strokeLinejoin="round" />
      <Dot x={16} y={7} />
      <Dot x={6} y={25} />
      <Dot x={26} y={25} />
    </Svg>
  )
}

function IconArc(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M7 22a12 12 0 0 1 18-8" stroke="currentColor" strokeWidth={1.25} fill="none" />
      <Dot x={7} y={22} />
      <Dot x={25} y={14} />
      <Dot x={16} y={10} />
    </Svg>
  )
}

function IconCurve(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M6 22Q16 6 26 12" stroke="currentColor" strokeWidth={1.25} fill="none" />
      <Dot x={6} y={22} />
      <Dot x={16} y={6} />
      <Dot x={26} y={12} />
    </Svg>
  )
}

function IconDoubleCurve(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M5 20Q12 8 16 16T27 10" stroke="currentColor" strokeWidth={1.25} fill="none" />
      <Dot x={5} y={20} />
      <Dot x={16} y={16} />
      <Dot x={27} y={10} />
    </Svg>
  )
}

function IconText(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M10 8h12" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M16 8v16" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  )
}

function IconNote(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path
        d="M9 7h11v14l-3-2H9V7z"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
      <path d="M12 11h6M12 14h4" stroke="currentColor" strokeWidth={1} opacity={0.6} />
    </Svg>
  )
}

function IconCallout(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path
        d="M8 8h14v9H14l-3 4v-4H8V8z"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function IconFlag(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path d="M10 6v20" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" />
      <path d="M10 8h14l-3 4 3 4H10" stroke="currentColor" strokeWidth={1.25} strokeLinejoin="round" />
    </Svg>
  )
}

function IconMarker(p: IconProps) {
  return (
    <Svg className={p.className}>
      <path
        d="M16 6c-3.5 0-6 2.5-6 5.5c0 4 6 10.5 6 10.5s6-6.5 6-10.5c0-3-2.5-5.5-6-5.5z"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
      <circle cx={16} cy={11.5} r={2} fill="currentColor" />
    </Svg>
  )
}

/* ─── Mapa completo por ferramenta ─── */

const BY_TOOL: Record<DrawingToolId, (p: IconProps) => React.JSX.Element> = {
  ruler: IconRuler,
  eraser: IconEraser,
  'continue-drawing': IconContinueDrawing,
  'hide-drawings': IconHideDrawings,
  'lock-all': IconLockAll,
  'weak-magnet': IconWeakMagnet,
  'remove-all': IconRemoveAll,
  'zoom-in': IconZoomIn,
  'zoom-out': IconZoomOut,
  'trend-line': IconTrendLine,
  ray: IconRay,
  'info-line': IconInfoLine,
  'extended-line': IconExtendedLine,
  'trend-angle': IconTrendAngle,
  'horizontal-line': IconHorizontalLine,
  'horizontal-ray': IconHorizontalRay,
  'vertical-line': IconVerticalLine,
  'cross-line': IconCrossLine,
  'parallel-channel': IconParallelChannel,
  'regression-trend': IconRegressionTrend,
  'flat-top-bottom': IconFlatTopBottom,
  'disjoint-channel': IconDisjointChannel,
  pitchfork: IconPitchfork,
  'schiff-pitchfork': IconSchiffPitchfork,
  'modified-schiff-pitchfork': IconSchiffPitchfork,
  'inside-pitchfork': IconInsidePitchfork,
  'fib-retracement': IconFibRetracement,
  'fib-extension-trend': IconFibExtension,
  'fib-channel': IconFibChannel,
  'fib-timezone': IconFibTimezone,
  'speed-resistance-fan': IconSpeedResistanceFan,
  'fib-time-trend': IconFibTimeTrend,
  'fib-circles': IconFibCircles,
  'fib-spiral': IconFibSpiral,
  'speed-resistance-arcs': IconSpeedResistanceArcs,
  'fib-wedge': IconFibWedge,
  'line-fan': IconLineFan,
  'gann-box': IconGannBox,
  'gann-square-fixed': IconGannSquare,
  'gann-square': IconGannSquare,
  'gann-fan': IconGannFan,
  xabcd: IconXabcd,
  cypher: IconCypher,
  'head-shoulders': IconHeadShoulders,
  abcd: IconAbcd,
  'triangle-pattern': IconTrianglePattern,
  'three-drives': IconThreeDrives,
  'elliott-impulse': IconElliottImpulse,
  'elliott-corrective': IconElliottCorrective,
  'elliott-triangle': IconElliottTriangle,
  'elliott-double-combo': IconElliottCombo,
  'elliott-triple-combo': IconElliottCombo,
  'cyclic-lines': IconCyclicLines,
  'time-cycles': IconTimeCycles,
  'sine-line': IconSineLine,
  'long-position': IconLongPosition,
  'short-position': IconShortPosition,
  forecast: IconForecast,
  'bar-pattern': IconBarPattern,
  'ghost-feed': IconGhostFeed,
  projection: IconProjection,
  'anchored-vwap': IconAnchoredVwap,
  'fixed-range-volume': IconVolumeProfile,
  'anchored-volume': IconVolumeProfile,
  'price-range': IconPriceRange,
  'date-range': IconDateRange,
  'date-price-range': IconDatePriceRange,
  brush: IconBrush,
  highlighter: IconHighlighter,
  'arrow-marker': IconArrowMarker,
  arrow: IconArrowThin,
  'arrow-up': IconArrowUp,
  'arrow-down': IconArrowDown,
  rectangle: IconRectangle,
  'rotated-rectangle': IconRotatedRectangle,
  path: IconPath,
  circle: IconCircle,
  ellipse: IconEllipse,
  polyline: IconPolyline,
  'triangle-shape': IconTriangleShape,
  'arc-shape': IconArc,
  curve: IconCurve,
  'double-curve': IconDoubleCurve,
  text: IconText,
  note: IconNote,
  callout: IconCallout,
  flag: IconFlag,
  marker: IconMarker,
}

export function DrawingTvIcon({ toolId, className }: { toolId: DrawingToolId; className?: string }) {
  const Comp = BY_TOOL[toolId] ?? IconTrendLine
  return <Comp className={cn('text-[#e8e8ed]', className)} />
}
