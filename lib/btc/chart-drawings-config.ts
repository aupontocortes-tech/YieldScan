export type DrawingCategoryId =
  | 'favorites'
  | 'tools'
  | 'trendLines'
  | 'fibonacci'
  | 'patterns'
  | 'forecasts'
  | 'shapes'

export type DrawingToolId = string

export type DrawingToolKind = 'draw' | 'action'

export type DrawingActionId =
  | 'hide'
  | 'lock-all'
  | 'remove-all'
  | 'continue-drawing'
  | 'weak-magnet'
  | 'zoom-in'
  | 'zoom-out'

export type DrawingCategoryMeta = {
  id: DrawingCategoryId
  /** Rótulo curto na barra de abas (estilo TradingView) */
  tabLabel: string
  title: string
}

export type DrawingToolMeta = {
  id: DrawingToolId
  categoryId: Exclude<DrawingCategoryId, 'favorites'>
  label: string
  hint: string
  icon: string
  kind: DrawingToolKind
  action?: DrawingActionId
  /** Texto alternativo para pesquisa */
  keywords?: string[]
}

export const DRAWING_CATEGORIES: DrawingCategoryMeta[] = [
  { id: 'favorites', tabLabel: 'Favoritos', title: 'Favoritos' },
  { id: 'tools', tabLabel: 'Ferramentas', title: 'Ferramentas' },
  { id: 'trendLines', tabLabel: 'Linhas de tendência', title: 'Linhas de tendência' },
  { id: 'fibonacci', tabLabel: 'Gann e Fibonacci', title: 'Gann e Fibonacci' },
  { id: 'patterns', tabLabel: 'Padrões', title: 'Padrões' },
  { id: 'forecasts', tabLabel: 'Previsão e medição', title: 'Previsão e medição' },
  { id: 'shapes', tabLabel: 'Formas geométricas', title: 'Formas geométricas' },
]

function draw(
  categoryId: DrawingToolMeta['categoryId'],
  id: string,
  label: string,
  icon: string,
  hint: string,
  keywords?: string[],
): DrawingToolMeta {
  return { id, categoryId, label, icon, hint, kind: 'draw', keywords }
}

function action(
  categoryId: DrawingToolMeta['categoryId'],
  id: string,
  label: string,
  icon: string,
  hint: string,
  actionId: DrawingActionId,
): DrawingToolMeta {
  return { id, categoryId, label, icon, hint, kind: 'action', action: actionId }
}

export const DRAWING_TOOLS: DrawingToolMeta[] = [
  // —— Ferramentas ——
  draw('tools', 'ruler', 'Régua', 'Ruler', 'Medir distância e ângulo no gráfico'),
  draw('tools', 'eraser', 'Borracha', 'Eraser', 'Apagar desenhos ao clicar'),
  action('tools', 'continue-drawing', 'Continue desenhando', 'PencilLine', 'Manter a última ferramenta activa', 'continue-drawing'),
  action('tools', 'hide-drawings', 'Ocultar desenhos', 'EyeOff', 'Esconder ou mostrar todos os desenhos', 'hide'),
  action('tools', 'lock-all', 'Travar todos os desenhos', 'Lock', 'Bloquear edição de todos os desenhos', 'lock-all'),
  action('tools', 'weak-magnet', 'Ímã fraco', 'Magnet', 'Ajuste suave a velas e níveis próximos', 'weak-magnet'),
  action('tools', 'remove-all', 'Remover todos', 'Trash2', 'Apagar todos os desenhos do gráfico', 'remove-all'),
  action('tools', 'zoom-in', 'Zoom mais', 'ZoomIn', 'Aumentar zoom do gráfico', 'zoom-in'),
  action('tools', 'zoom-out', 'Zoom menos', 'ZoomOut', 'Reduzir zoom do gráfico', 'zoom-out'),
  draw('tools', 'cursor', 'Cursor', 'MousePointer2', 'Seleccionar e mover desenhos'),
  draw('tools', 'crosshair', 'Mira', 'Crosshair', 'Medir no gráfico'),

  // —— Linhas de tendência ——
  draw('trendLines', 'trend-line', 'Linha de tendência', 'TrendingUp', 'Dois pontos', ['tendencia']),
  draw('trendLines', 'ray', 'Raio', 'MoveUpRight', 'Linha com início fixo'),
  draw('trendLines', 'info-line', 'Linha com informações', 'Info', 'Linha com etiqueta de dados'),
  draw('trendLines', 'extended-line', 'Linha estendida', 'UnfoldHorizontal', 'Prolonga para ambos os lados'),
  draw('trendLines', 'trend-angle', 'Ângulo de tendência', 'Percent', 'Ângulo entre dois pontos'),
  draw('trendLines', 'horizontal-line', 'Linha horizontal', 'Minus', 'Nível de preço'),
  draw('trendLines', 'horizontal-ray', 'Raio horizontal', 'ArrowRightToLine', 'Horizontal a partir de um ponto'),
  draw('trendLines', 'vertical-line', 'Linha vertical', 'SeparatorVertical', 'Marca temporal'),
  draw('trendLines', 'cross-line', 'Linha cruzada', 'Plus', 'Horizontal + vertical no mesmo ponto'),
  draw('trendLines', 'parallel-channel', 'Canal paralelo', 'AlignJustify', 'Duas linhas equidistantes'),
  draw('trendLines', 'regression-trend', 'Tendência de regressão', 'ChartLine', 'Canal de regressão linear'),
  draw('trendLines', 'flat-top-bottom', 'Topo/fundo plano', 'AlignVerticalSpaceAround', 'Topo ou fundo horizontal'),
  draw('trendLines', 'disjoint-channel', 'Canal separado', 'Layers', 'Canal com linhas independentes'),
  draw('trendLines', 'pitchfork', 'Garfo', 'GitFork', 'Andrews pitchfork'),
  draw('trendLines', 'schiff-pitchfork', 'Garfo de Schiff', 'GitFork', 'Schiff pitchfork'),
  draw('trendLines', 'modified-schiff-pitchfork', 'Garfo de Schiff modificado', 'GitFork', 'Modified Schiff'),
  draw('trendLines', 'inside-pitchfork', 'Garfo interno', 'GitFork', 'Inside pitchfork'),

  // —— Gann e Fibonacci ——
  draw('fibonacci', 'fib-retracement', 'Retração de Fibonacci', 'GitBranch', 'Níveis 0–100%'),
  draw('fibonacci', 'fib-extension-trend', 'Extensão Fibonacci baseada em tendência', 'GitMerge', 'Extensão ao longo da tendência'),
  draw('fibonacci', 'fib-channel', 'Canal de Fibonacci', 'AlignJustify', 'Canal com níveis Fib'),
  draw('fibonacci', 'fib-timezone', 'Zona temporal de Fibonacci', 'Columns3', 'Divisões verticais no tempo'),
  draw('fibonacci', 'speed-resistance-fan', 'Leque de resistência a velocidade', 'Fan', 'Leque de velocidade'),
  draw('fibonacci', 'fib-time-trend', 'Tempo de Fibonacci baseado em tendência', 'Clock', 'Tempo ao longo da tendência'),
  draw('fibonacci', 'fib-circles', 'Círculos de Fibonacci', 'Circle', 'Círculos concêntricos'),
  draw('fibonacci', 'fib-spiral', 'Espiral de Fibonacci', 'Sparkles', 'Espiral de Fibonacci'),
  draw('fibonacci', 'speed-resistance-arcs', 'Arcos de resistência e velocidade', 'Spline', 'Arcos de velocidade'),
  draw('fibonacci', 'fib-wedge', 'Cunha de Fibonacci', 'Triangle', 'Cunha com níveis Fib'),
  draw('fibonacci', 'line-fan', 'Leque de linhas', 'Fan', 'Leque de linhas a partir de um pivô'),
  draw('fibonacci', 'gann-box', 'Caixa de Gann', 'Square', 'Caixa de Gann'),
  draw('fibonacci', 'gann-square-fixed', 'Quadrado de Gann fixo', 'Grid3x3', 'Quadrado de Gann fixo'),
  draw('fibonacci', 'gann-square', 'Quadrado de Gann', 'Grid3x3', 'Quadrado de Gann'),
  draw('fibonacci', 'gann-fan', 'Leque de Gann', 'Fan', 'Leque de Gann'),

  // —— Padrões ——
  draw('patterns', 'xabcd', 'Padrão XABCD', 'Pentagon', 'Harmónico XABCD'),
  draw('patterns', 'cypher', 'Padrão Cypher', 'Hexagon', 'Harmónico Cypher'),
  draw('patterns', 'head-shoulders', 'Cabeça e ombros', 'Mountain', 'Reversão clássica'),
  draw('patterns', 'abcd', 'Padrão ABCD', 'Square', 'Harmónico ABCD'),
  draw('patterns', 'triangle-pattern', 'Padrão triangular', 'Triangle', 'Triângulo harmónico'),
  draw('patterns', 'three-drives', 'Padrão dos três avanços', 'TrendingUp', 'Three drives'),
  draw('patterns', 'elliott-impulse', 'Onda de impulso Elliott (12345)', 'Activity', 'Impulso 1-2-3-4-5'),
  draw('patterns', 'elliott-corrective', 'Onda corretiva Elliott (ABC)', 'Waves', 'Correcção ABC'),
  draw('patterns', 'elliott-triangle', 'Onda triangular Elliott (ABCDE)', 'Triangle', 'Triângulo ABCDE'),
  draw('patterns', 'elliott-double-combo', 'Onda combo dupla Elliott (WXY)', 'GitBranch', 'Combo W-X-Y'),
  draw('patterns', 'elliott-triple-combo', 'Onda combo tripla Elliott (WXYZ)', 'GitMerge', 'Combo W-X-Y-Z'),
  draw('patterns', 'cyclic-lines', 'Linhas cíclicas', 'Columns3', 'Linhas verticais cíclicas'),
  draw('patterns', 'time-cycles', 'Ciclos temporais', 'RefreshCw', 'Ciclos de tempo'),
  draw('patterns', 'sine-line', 'Senóide', 'Activity', 'Onda senoidal'),

  // —— Previsão e medição ——
  draw('forecasts', 'long-position', 'Posição compradora', 'ArrowUpFromLine', 'Long com alvo e stop'),
  draw('forecasts', 'short-position', 'Posição vendedora', 'ArrowDownFromLine', 'Short com alvo e stop'),
  draw('forecasts', 'forecast', 'Previsão', 'BarChart3', 'Projeção de preço'),
  draw('forecasts', 'bar-pattern', 'Padrão de barras', 'BarChart2', 'Padrão em barras'),
  draw('forecasts', 'ghost-feed', 'Informações fantasma', 'Ghost', 'Projeção fantasma'),
  draw('forecasts', 'projection', 'Projeção', 'MoveUpRight', 'Projeção de movimento'),
  draw('forecasts', 'anchored-vwap', 'VWAP ancorado', 'Anchor', 'VWAP desde um ponto'),
  draw('forecasts', 'fixed-range-volume', 'Perfil de volume — intervalo fixo', 'BarChartHorizontal', 'Volume profile fixo'),
  draw('forecasts', 'anchored-volume', 'Perfil de volume ancorado', 'BarChartHorizontal', 'Volume profile ancorado'),
  draw('forecasts', 'price-range', 'Intervalo de preço', 'ArrowUpDown', 'Amplitude vertical'),
  draw('forecasts', 'date-range', 'Intervalo de data', 'ArrowLeftRight', 'Duração horizontal'),
  draw('forecasts', 'date-price-range', 'Variação de data e preço', 'Move', 'Caixa tempo + preço'),

  // —— Formas geométricas e anotações ——
  draw('shapes', 'brush', 'Pincel', 'Brush', 'Desenho à mão livre'),
  draw('shapes', 'highlighter', 'Destaques', 'Highlighter', 'Realçar zona no gráfico'),
  draw('shapes', 'arrow-marker', 'Marcador de seta', 'ArrowBigUp', 'Seta grossa'),
  draw('shapes', 'arrow', 'Seta', 'ArrowRight', 'Seta simples'),
  draw('shapes', 'arrow-up', 'Seta para cima', 'ArrowUp', 'Seta para cima'),
  draw('shapes', 'arrow-down', 'Seta para baixo', 'ArrowDown', 'Seta para baixo'),
  draw('shapes', 'rectangle', 'Retângulo', 'Square', 'Zona rectangular'),
  draw('shapes', 'rotated-rectangle', 'Retângulo giratório', 'Square', 'Retângulo com rotação'),
  draw('shapes', 'path', 'Sequência', 'Waypoints', 'Vários segmentos'),
  draw('shapes', 'circle', 'Círculo', 'Circle', 'Círculo'),
  draw('shapes', 'ellipse', 'Elipse', 'Circle', 'Elipse'),
  draw('shapes', 'polyline', 'Linha segmentada', 'Spline', 'Polilinha'),
  draw('shapes', 'triangle-shape', 'Triângulo', 'Triangle', 'Três vértices'),
  draw('shapes', 'arc-shape', 'Arco', 'Spline', 'Arco'),
  draw('shapes', 'curve', 'Curva', 'Spline', 'Curva suave'),
  draw('shapes', 'double-curve', 'Curva dupla', 'Spline', 'Curva em S'),
  draw('shapes', 'text', 'Texto', 'Type', 'Etiqueta de texto'),
  draw('shapes', 'note', 'Nota fixa', 'StickyNote', 'Post-it'),
  draw('shapes', 'callout', 'Callout', 'MessageSquare', 'Balão com texto'),
  draw('shapes', 'flag', 'Bandeira', 'Flag', 'Marcador de evento'),
  draw('shapes', 'marker', 'Marcador', 'MapPin', 'Ponto de referência'),
]

const toolById = new Map(DRAWING_TOOLS.map((t) => [t.id, t]))

export function getDrawingTool(id: DrawingToolId): DrawingToolMeta | undefined {
  return toolById.get(id)
}

export function getToolsForCategory(categoryId: DrawingCategoryId): DrawingToolMeta[] {
  if (categoryId === 'favorites') return []
  return DRAWING_TOOLS.filter((t) => t.categoryId === categoryId)
}

export function searchDrawingTools(query: string, categoryId?: DrawingCategoryId): DrawingToolMeta[] {
  const q = query.trim().toLowerCase()
  if (!q) {
    if (!categoryId || categoryId === 'favorites') return []
    return getToolsForCategory(categoryId)
  }
  const pool =
    categoryId && categoryId !== 'favorites'
      ? getToolsForCategory(categoryId)
      : DRAWING_TOOLS
  return pool.filter(
    (t) =>
      t.label.toLowerCase().includes(q) ||
      t.hint.toLowerCase().includes(q) ||
      t.keywords?.some((k) => k.includes(q)),
  )
}

export function getCategoryMeta(id: DrawingCategoryId): DrawingCategoryMeta | undefined {
  return DRAWING_CATEGORIES.find((c) => c.id === id)
}
