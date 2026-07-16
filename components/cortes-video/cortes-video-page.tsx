'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  Clapperboard,
  Download,
  Film,
  History,
  ImagePlus,
  KeyRound,
  Loader2,
  Link2,
  Scissors,
  Sparkles,
  Trash2,
  Upload,
  Youtube,
} from 'lucide-react'
import type {
  CaptionStyle,
  CortesCopyPack,
  CortesHistoryItem,
  CortesPipelinePhase,
  CortesPlatformId,
  CortesTranscript,
  CortesVideoMeta,
  CutSuggestion,
  ReframeSettings,
  TimelineClip,
} from '@/lib/cortes-video/types'
import {
  DEFAULT_CAPTION_STYLE,
  DEFAULT_CORTES_OPENAI,
  DEFAULT_REFRAME,
} from '@/lib/cortes-video/types'
import { EXPORT_PROFILES, getExportProfile } from '@/lib/cortes-video/platforms'
import { activeWordAt, detectSilenceGaps, downloadTextFile, flattenWords, offsetTranscriptTimes } from '@/lib/cortes-video/srt'
import { formatBytes, formatDuration, probeVideoFile, videoThumbnailDataUrl } from '@/lib/cortes-video/probe'
import {
  buildHistoryItem,
  deleteCortesHistoryItem,
  listCortesHistory,
  loadCortesBlob,
  newHistoryId,
  saveCortesBlob,
  saveCortesHistoryItem,
} from '@/lib/cortes-video/history'
import {
  canCallCortesOpenAi,
  cortesOpenAiUsageToday,
  loadCortesOpenAiSettings,
  maskOpenAiKey,
  saveCortesOpenAiSettings,
} from '@/lib/cortes-video/openai-config'
import { fetchYouTubeVideoFile, generateCopy, generateCoverIdeas, suggestCuts, transcribeVideoAudio } from '@/lib/cortes-video/api-client'
import { isYouTubeUrl } from '@/lib/cortes-video/youtube'
import {
  captionCss,
  ensureFfmpegLoaded,
  exportEditedVideo,
  extractAudioMp3,
} from '@/lib/cortes-video/ffmpeg-client'
import { CORTES_FUTURE_CAPABILITIES } from '@/lib/cortes-video/future-plugins'
import type { CortesOpenAiSettings } from '@/lib/cortes-video/types'
import {
  TRIM_PRESETS,
  clampTimeRange,
  formatTimecode,
  parseTimecode,
  rangeDuration,
  rangeToClip,
  resolveTrimPreset,
  type TimeRange,
  type TrimPresetId,
} from '@/lib/cortes-video/trim-presets'
import { CortesChip, CortesGuide, CortesPanel, CortesStepNav, CortesStepRail, CortesTimelineBar } from '@/components/cortes-video/cortes-ui'
import {
  captureVideoFrame,
  composeCoverCard,
  downloadDataUrl,
  fileToDataUrl,
  newCoverId,
  type CoverCandidate,
} from '@/lib/cortes-video/cover'

const STEPS = [
  { id: 'import', label: 'Carregar vídeo', short: 'Vídeo' },
  { id: 'transcribe', label: 'Escolher trecho e transcrever', short: 'Fala' },
  { id: 'highlights', label: 'Melhores momentos', short: 'Destaques' },
  { id: 'editor', label: 'Cortar e ajustar', short: 'Cortar' },
  { id: 'captions', label: 'Legendas', short: 'Legendas' },
  { id: 'capa', label: 'Capa', short: 'Capa' },
  { id: 'export', label: 'Exportar vídeo', short: 'Exportar' },
  { id: 'copy', label: 'Texto para publicar', short: 'Texto' },
] as const

type StepId = (typeof STEPS)[number]['id']

const STEP_GUIDE: Record<
  StepId,
  { title: string; body: string; nextLabel: string; nextHint?: string }
> = {
  import: {
    title: 'Começa por carregar o vídeo',
    body: 'Arrasta um ficheiro MP4/WebM/MOV ou usa o botão. Depois avançamos juntos.',
    nextLabel: 'Continuar para a fala',
    nextHint: 'Precisas de um vídeo carregado',
  },
  transcribe: {
    title: 'Escolhe o trecho e transcreve',
    body: 'Usa atalhos (ex. últimos 30 min) ou tempos exactos. Só depois toca em Transcrever — poupa tempo e OpenAI.',
    nextLabel: 'Ver destaques',
    nextHint: 'Transcreve primeiro',
  },
  highlights: {
    title: 'Pede à IA os melhores momentos',
    body: '«Analisar com IA» sugere cortes. Podes aplicar um destaque ou saltar e cortar à mão.',
    nextLabel: 'Ir para cortar',
  },
  editor: {
    title: 'Corta o vídeo (começo e fim)',
    body: 'No bloco Corte manual preenche Começo e Fim, ou marca com o tempo actual do player. Depois toca em “Cortar neste intervalo”.',
    nextLabel: 'Ir para legendas',
  },
  captions: {
    title: 'Ajusta o estilo das legendas',
    body: 'Cor, tamanho e posição. A palavra activa aparece no preview. Podes saltar se não precisares.',
    nextLabel: 'Criar capa',
  },
  capa: {
    title: 'Cria ou deixa a IA fazer a capa',
    body: 'Frame do vídeo, imagem tua, ou IA. No fim selecciona a capa que queres usar.',
    nextLabel: 'Ir para exportar',
  },
  export: {
    title: 'Escolhe a rede e exporta',
    body: 'TikTok, Reels, Shorts… Depois descarrega o MP4 (e SRT se quiseres).',
    nextLabel: 'Gerar texto',
    nextHint: 'Exporta o vídeo para desbloquear o texto',
  },
  copy: {
    title: 'Gera título e hashtags',
    body: 'A IA escreve o texto para colares na publicação. Já podes publicar fora do app.',
    nextLabel: 'Concluído',
  },
}

function phaseLabel(phase: CortesPipelinePhase): string {
  const map: Record<CortesPipelinePhase, string> = {
    idle: 'Pronto',
    upload: 'A obter vídeo do YouTube…',
    probe: 'A ler metadados…',
    extract_audio: 'A extrair áudio…',
    transcribe: 'A transcrever (Whisper)…',
    analyze: 'A analisar cortes…',
    render: 'A renderizar…',
    export: 'A exportar…',
    copy: 'A gerar copy…',
    done: 'Concluído',
    error: 'Erro',
  }
  return map[phase]
}

/** Formata segundos em texto curto (ex.: 2 min 15 s). */
function formatRemainPt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '…'
  const s = Math.max(0, Math.ceil(sec))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m < 60) return r > 0 ? `${m} min ${r} s` : `${m} min`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm > 0 ? `${h} h ${rm} min` : `${h} h`
}

function estimateEtaSec(progressPct: number, startedAt: number | null, now: number): number | null {
  if (!startedAt || progressPct < 4) return null
  if (progressPct >= 99.5) return 0
  const elapsed = (now - startedAt) / 1000
  if (elapsed < 1.5) return null
  return Math.max(0, (elapsed * (100 - progressPct)) / progressPct)
}

function clipId() {
  return `clip_${Math.random().toString(36).slice(2, 9)}`
}

export function CortesVideoPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const [step, setStep] = useState<StepId>('import')
  const [file, setFile] = useState<File | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [meta, setMeta] = useState<CortesVideoMeta | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)

  const [phase, setPhase] = useState<CortesPipelinePhase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [transcript, setTranscript] = useState<CortesTranscript | null>(null)
  const [suggestions, setSuggestions] = useState<CutSuggestion[]>([])
  const [clips, setClips] = useState<TimelineClip[]>([])
  const [trimPreset, setTrimPreset] = useState<TrimPresetId>('full')
  const [workRange, setWorkRange] = useState<TimeRange>({ start: 0, end: 1 })
  const [customStartTc, setCustomStartTc] = useState('0:00')
  const [customEndTc, setCustomEndTc] = useState('0:00')
  const [manualTimeError, setManualTimeError] = useState<string | null>(null)
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE)
  const [reframe, setReframe] = useState<ReframeSettings>(DEFAULT_REFRAME)
  const [platformId, setPlatformId] = useState<CortesPlatformId>('tiktok')
  const [burnCaptions, setBurnCaptions] = useState(false)
  const [exportBlob, setExportBlob] = useState<Blob | null>(null)
  const [copyPack, setCopyPack] = useState<CortesCopyPack | null>(null)
  const [covers, setCovers] = useState<CoverCandidate[]>([])
  const [selectedCoverId, setSelectedCoverId] = useState<string | null>(null)
  const [coverTitle, setCoverTitle] = useState('')
  const [coverSubtitle, setCoverSubtitle] = useState('')
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [currentTime, setCurrentTime] = useState(0)
  const [history, setHistory] = useState<CortesHistoryItem[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [jobStartedAt, setJobStartedAt] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const whisperStartRef = useRef<number | null>(null)
  const whisperExpectedSecRef = useRef(60)

  const words = useMemo(
    () => (transcript ? flattenWords(transcript.segments) : []),
    [transcript],
  )
  const activeWord = useMemo(() => activeWordAt(words, currentTime), [words, currentTime])
  const profile = getExportProfile(platformId)

  const refreshHistory = useCallback(async () => {
    setHistory(await listCortesHistory())
  }, [])

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const beginJob = useCallback(() => {
    setJobStartedAt(Date.now())
    setNowTick(Date.now())
  }, [])

  const persistProject = useCallback(
    async (opts?: { hasTranscript?: boolean; hasExport?: boolean; thumb?: string }) => {
      if (!file || !meta) return
      const id = projectId ?? newHistoryId()
      if (!projectId) setProjectId(id)
      await saveCortesBlob(id, file)
      const item = buildHistoryItem({
        id,
        title: meta.name.replace(/\.[^.]+$/, ''),
        meta,
        platformId,
        hasTranscript: opts?.hasTranscript ?? !!transcript,
        hasExport: opts?.hasExport ?? !!exportBlob,
        thumbnailDataUrl: opts?.thumb,
        createdAt: history.find((h) => h.id === id)?.createdAt,
      })
      await saveCortesHistoryItem(item)
      await refreshHistory()
    },
    [file, meta, projectId, platformId, transcript, exportBlob, history, refreshHistory],
  )

  const acceptFile = useCallback(
    async (f: File) => {
      if (!f.type.startsWith('video/') && !/\.(mp4|webm|mov|mkv)$/i.test(f.name)) {
        setError('Selecciona um ficheiro de vídeo (mp4, webm, mov).')
        return
      }
      setError(null)
      setPhase('probe')
      setProgress(10)
      beginJob()
      try {
        if (objectUrl) URL.revokeObjectURL(objectUrl)
        const url = URL.createObjectURL(f)
        setObjectUrl(url)
        setFile(f)
        const m = await probeVideoFile(f)
        setMeta(m)
        const full = resolveTrimPreset(m.durationSec || 1, 'full')
        setTrimPreset('full')
        setWorkRange(full)
        setCustomStartTc(formatTimecode(full.start))
        setCustomEndTc(formatTimecode(full.end))
        setManualTimeError(null)
        setClips([rangeToClip(full, clipId)])
        setTranscript(null)
        setSuggestions([])
        setExportBlob(null)
        setCopyPack(null)
        setCovers([])
        setSelectedCoverId(null)
        setCoverTitle('')
        setCoverSubtitle('')
        const id = newHistoryId()
        setProjectId(id)
        const thumb = await videoThumbnailDataUrl(f)
        await saveCortesBlob(id, f)
        await saveCortesHistoryItem(
          buildHistoryItem({
            id,
            title: m.name.replace(/\.[^.]+$/, ''),
            meta: m,
            thumbnailDataUrl: thumb,
          }),
        )
        await refreshHistory()
        setProgress(100)
        setPhase('done')
        setStep('transcribe')
      } catch (e) {
        setPhase('error')
        setError(e instanceof Error ? e.message : 'Falha ao ler vídeo.')
      }
    },
    [objectUrl, refreshHistory],
  )

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) await acceptFile(f)
  }

  const importFromYouTube = useCallback(async () => {
    const url = youtubeUrl.trim()
    if (!url) {
      setError('Cola um link do YouTube.')
      return
    }
    if (!isYouTubeUrl(url)) {
      setError('URL inválida. Exemplos: youtube.com/watch?v=… ou youtu.be/…')
      return
    }
    setError(null)
    beginJob()
    setPhase('upload')
    setProgress(15)
    try {
      const f = await fetchYouTubeVideoFile(url)
      setProgress(70)
      await acceptFile(f)
    } catch (e) {
      setPhase('error')
      setError(e instanceof Error ? e.message : 'Falha ao importar do YouTube.')
    }
  }, [youtubeUrl, acceptFile])

  const applyWorkRange = useCallback(
    (range: TimeRange, preset: TrimPresetId) => {
      setTrimPreset(preset)
      setWorkRange(range)
      setClips([rangeToClip(range, clipId)])
      setCustomStartTc(formatTimecode(range.start))
      setCustomEndTc(formatTimecode(range.end))
      setManualTimeError(null)
      if (videoRef.current) {
        videoRef.current.currentTime = range.start
      }
    },
    [],
  )

  const applyPreset = useCallback(
    (preset: TrimPresetId) => {
      if (!meta) return
      if (preset === 'custom') {
        const start = parseTimecode(customStartTc)
        const end = parseTimecode(customEndTc)
        if (start == null || end == null) {
          setManualTimeError('Usa formato M:SS ou H:MM:SS (ex.: 12:30 ou 1:05:00).')
          return
        }
        if (end <= start) {
          setManualTimeError('O fim tem de ser depois do início.')
          return
        }
        applyWorkRange(
          resolveTrimPreset(meta.durationSec, 'custom', { start, end }),
          'custom',
        )
        return
      }
      applyWorkRange(resolveTrimPreset(meta.durationSec, preset), preset)
    },
    [meta, customStartTc, customEndTc, applyWorkRange],
  )

  const setRangeFromPlayhead = (which: 'start' | 'end') => {
    if (!meta) return
    const t = currentTime
    const next =
      which === 'start'
        ? clampTimeRange(t, Math.max(t + 0.1, workRange.end), meta.durationSec)
        : clampTimeRange(Math.min(workRange.start, t - 0.1), t, meta.durationSec)
    applyWorkRange(next, 'custom')
  }

  const updateClipTimes = (clipIdToEdit: string, startRaw: string, endRaw: string) => {
    if (!meta) return
    const start = parseTimecode(startRaw)
    const end = parseTimecode(endRaw)
    if (start == null || end == null) {
      setManualTimeError('Tempo do clip inválido. Ex.: 0:45 → 3:20')
      return
    }
    if (end <= start) {
      setManualTimeError('No clip, o fim tem de ser depois do início.')
      return
    }
    const clamped = clampTimeRange(start, end, meta.durationSec)
    setManualTimeError(null)
    setTrimPreset('custom')
    setClips((prev) => {
      const next = prev.map((c) =>
        c.id === clipIdToEdit
          ? { ...c, sourceStart: clamped.start, sourceEnd: clamped.end }
          : c,
      )
      if (next.length === 1) {
        setWorkRange(clamped)
        setCustomStartTc(formatTimecode(clamped.start))
        setCustomEndTc(formatTimecode(clamped.end))
      }
      return next
    })
  }

  const addManualClip = () => {
    if (!meta) return
    const start = parseTimecode(customStartTc) ?? workRange.start
    const end = parseTimecode(customEndTc) ?? Math.min(meta.durationSec, start + 30)
    const clamped = clampTimeRange(start, end, meta.durationSec)
    setClips((prev) => [...prev, rangeToClip(clamped, clipId)])
    setTrimPreset('custom')
    setManualTimeError(null)
  }

  const runTranscribe = async () => {
    if (!file || !meta) return
    const settings = loadCortesOpenAiSettings()
    const gate = canCallCortesOpenAi(settings)
    if (!gate.ok) {
      setSettingsOpen(true)
      setError(gate.reason ?? 'Configura a OpenAI.')
      return
    }
    setError(null)
    beginJob()
    setPhase('extract_audio')
    setProgress(5)
    try {
      const range = workRange.end > workRange.start ? workRange : resolveTrimPreset(meta.durationSec, 'full')
      await ensureFfmpegLoaded((r) => setProgress(5 + r * 35))
      const audio = await extractAudioMp3(file, (r) => setProgress(5 + r * 40), range)
      const durationForCost = rangeDuration(range)
      // Whisper costuma ser mais rápido que real-time, mas upload+API demoram; estimativa prudente.
      whisperExpectedSecRef.current = Math.max(25, durationForCost * 0.45 + 20)
      whisperStartRef.current = Date.now()
      setPhase('transcribe')
      setProgress(50)
      let tr = await transcribeVideoAudio(audio, durationForCost)
      tr = offsetTranscriptTimes(tr, range.start)
      setTranscript(tr)
      const silences = detectSilenceGaps(tr.segments).filter(
        (g) => g.start >= range.start - 0.05 && g.end <= range.end + 0.05,
      )
      const silenceSuggestions: CutSuggestion[] = silences.map((g, i) => ({
        id: `sil_${i}`,
        start: g.start,
        end: g.end,
        reason: 'Pausa / silêncio detectado',
        score: 0.4,
        kind: 'silence' as const,
      }))
      setSuggestions(silenceSuggestions)
      setProgress(100)
      setPhase('done')
      setStep('highlights')
      await persistProject({ hasTranscript: true })
    } catch (e) {
      setPhase('error')
      setError(e instanceof Error ? e.message : 'Falha na transcrição.')
    }
  }

  const runAnalyze = async () => {
    if (!transcript) return
    setError(null)
    beginJob()
    setPhase('analyze')
    setProgress(20)
    try {
      const ai = await suggestCuts(transcript)
      setSuggestions((prev) => {
        const silences = prev.filter((s) => s.kind === 'silence' || s.kind === 'pause')
        return [...ai, ...silences]
      })
      setProgress(100)
      setPhase('done')
      setStep('editor')
    } catch (e) {
      setPhase('error')
      setError(e instanceof Error ? e.message : 'Falha na análise.')
    }
  }

  const applySuggestion = (s: CutSuggestion) => {
    if (s.kind === 'silence' || s.kind === 'pause') {
      // remover intervalo da timeline
      setClips((prev) => {
        const next: TimelineClip[] = []
        for (const c of prev) {
          if (s.end <= c.sourceStart || s.start >= c.sourceEnd) {
            next.push(c)
            continue
          }
          if (s.start > c.sourceStart) {
            next.push({ id: clipId(), sourceStart: c.sourceStart, sourceEnd: s.start })
          }
          if (s.end < c.sourceEnd) {
            next.push({ id: clipId(), sourceStart: s.end, sourceEnd: c.sourceEnd })
          }
        }
        return next.length ? next : prev
      })
    } else {
      setClips([{ id: clipId(), sourceStart: s.start, sourceEnd: s.end }])
    }
    setStep('editor')
  }

  const splitAtPlayhead = () => {
    const t = currentTime
    setClips((prev) => {
      const next: TimelineClip[] = []
      for (const c of prev) {
        if (t > c.sourceStart + 0.05 && t < c.sourceEnd - 0.05) {
          next.push({ id: clipId(), sourceStart: c.sourceStart, sourceEnd: t })
          next.push({ id: clipId(), sourceStart: t, sourceEnd: c.sourceEnd })
        } else {
          next.push(c)
        }
      }
      return next
    })
  }

  const selectedCover = useMemo(
    () => covers.find((c) => c.id === selectedCoverId) ?? null,
    [covers, selectedCoverId],
  )

  const addCover = (cover: CoverCandidate) => {
    setCovers((prev) => [cover, ...prev].slice(0, 12))
    setSelectedCoverId(cover.id)
  }

  const captureCoverFromPlayhead = async (withTitle: boolean) => {
    const video = videoRef.current
    if (!video) {
      setError('Abre o player primeiro (passa da Importação).')
      return
    }
    try {
      let dataUrl = captureVideoFrame(video)
      const title = coverTitle.trim() || copyPack?.title || meta?.name || 'Capa'
      if (withTitle) {
        dataUrl = await composeCoverCard({
          baseDataUrl: dataUrl,
          title,
          subtitle: coverSubtitle || copyPack?.summary || undefined,
          profile,
        })
      }
      addCover({
        id: newCoverId(),
        source: 'frame',
        label: withTitle ? `Frame + texto · ${formatTimecode(video.currentTime)}` : `Frame · ${formatTimecode(video.currentTime)}`,
        dataUrl,
        atSec: video.currentTime,
      })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao capturar frame.')
    }
  }

  const uploadCoverFile = async (fileImg: File) => {
    try {
      let dataUrl = await fileToDataUrl(fileImg)
      if (coverTitle.trim()) {
        dataUrl = await composeCoverCard({
          baseDataUrl: dataUrl,
          title: coverTitle.trim(),
          subtitle: coverSubtitle || undefined,
          profile,
        })
      }
      addCover({
        id: newCoverId(),
        source: 'upload',
        label: fileImg.name.slice(0, 40),
        dataUrl,
      })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no upload da capa.')
    }
  }

  const runAiCover = async (generateImage: boolean) => {
    if (!meta) return
    const settings = loadCortesOpenAiSettings()
    const gate = canCallCortesOpenAi(settings)
    if (!gate.ok) {
      setSettingsOpen(true)
      setError(gate.reason ?? 'Configura a OpenAI.')
      return
    }
    setError(null)
    beginJob()
    setPhase('copy')
    setProgress(20)
    try {
      const ideas = await generateCoverIdeas({
        transcriptText: transcript?.text || meta.name,
        platformId,
        durationSec: meta.durationSec,
        generateImage,
      })
      setCoverTitle(ideas.title)
      setCoverSubtitle(ideas.subtitle)
      setProgress(55)

      if (ideas.imageDataUrl) {
        const composed = await composeCoverCard({
          baseDataUrl: ideas.imageDataUrl,
          title: ideas.title,
          subtitle: ideas.subtitle,
          profile,
        })
        addCover({
          id: newCoverId(),
          source: 'ai',
          label: 'IA · imagem gerada',
          dataUrl: composed,
        })
      } else {
        const video = videoRef.current
        const t = Math.min(meta.durationSec - 0.1, Math.max(0, ideas.suggestedTimeSec))
        if (video) {
          video.currentTime = t
          await new Promise<void>((resolve) => {
            const done = () => {
              video.removeEventListener('seeked', done)
              resolve()
            }
            video.addEventListener('seeked', done)
            setTimeout(done, 800)
          })
          let frame = captureVideoFrame(video)
          frame = await composeCoverCard({
            baseDataUrl: frame,
            title: ideas.title,
            subtitle: ideas.subtitle,
            profile,
          })
          addCover({
            id: newCoverId(),
            source: 'ai',
            label: `IA · frame ${formatTimecode(t)}`,
            dataUrl: frame,
            atSec: t,
          })
        }
      }
      setProgress(100)
      setPhase('done')
    } catch (e) {
      setPhase('error')
      setError(e instanceof Error ? e.message : 'Falha na capa IA.')
    }
  }

  const removeClip = (id: string) => {
    setClips((prev) => (prev.length <= 1 ? prev : prev.filter((c) => c.id !== id)))
  }

  const runExport = async () => {
    if (!file || !meta || !clips.length) return
    setError(null)
    beginJob()
    setPhase('export')
    setProgress(5)
    try {
      await ensureFfmpegLoaded((r) => setProgress(5 + r * 90))
      const blob = await exportEditedVideo({
        videoFile: file,
        clips,
        profile,
        reframe,
        srcWidth: meta.width || 1280,
        srcHeight: meta.height || 720,
        burnSrt: burnCaptions ? transcript?.srt ?? null : null,
        onProgress: (r) => setProgress(5 + r * 90),
      })
      setExportBlob(blob)
      setProgress(100)
      setPhase('done')
      setStep('copy')
      await persistProject({ hasExport: true })
    } catch (e) {
      setPhase('error')
      setError(e instanceof Error ? e.message : 'Falha na exportação.')
    }
  }

  const runCopy = async () => {
    if (!transcript) return
    setError(null)
    beginJob()
    setPhase('copy')
    setProgress(30)
    try {
      const pack = await generateCopy({
        transcriptText: transcript.text,
        platformId,
      })
      setCopyPack(pack)
      setProgress(100)
      setPhase('done')
    } catch (e) {
      setPhase('error')
      setError(e instanceof Error ? e.message : 'Falha ao gerar copy.')
    }
  }

  const downloadExport = (kind: 'video' | 'srt' | 'both') => {
    if (kind === 'srt' || kind === 'both') {
      if (transcript?.srt) downloadTextFile('legendas.srt', transcript.srt, 'application/x-subrip')
    }
    if ((kind === 'video' || kind === 'both') && exportBlob) {
      const url = URL.createObjectURL(exportBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cortes-${platformId}.mp4`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const openHistory = async (item: CortesHistoryItem) => {
    const blob = await loadCortesBlob(item.id)
    if (!blob) {
      setError('Ficheiro do histórico já não está disponível.')
      return
    }
    const f = new File([blob], item.meta.name, { type: item.meta.mimeType || 'video/mp4' })
    setProjectId(item.id)
    await acceptFile(f)
  }

  const busy = ['upload', 'extract_audio', 'transcribe', 'analyze', 'render', 'export', 'copy', 'probe'].includes(
    phase,
  )

  /** Relógio + progresso estimado na fase Whisper (a API não envia %). */
  useEffect(() => {
    if (!busy) {
      whisperStartRef.current = null
      return
    }
    if (!jobStartedAt) setJobStartedAt(Date.now())
    const id = window.setInterval(() => {
      const now = Date.now()
      setNowTick(now)
      if (phase === 'transcribe' && whisperStartRef.current) {
        const elapsed = (now - whisperStartRef.current) / 1000
        const expected = Math.max(20, whisperExpectedSecRef.current)
        const ratio = Math.min(0.96, elapsed / expected)
        setProgress((p) => Math.max(p, 50 + ratio * 42))
      }
    }, 400)
    return () => window.clearInterval(id)
  }, [busy, phase, jobStartedAt])

  const etaSec = busy ? estimateEtaSec(progress, jobStartedAt, nowTick) : null
  const elapsedSec = jobStartedAt && busy ? Math.max(0, (nowTick - jobStartedAt) / 1000) : 0

  const doneStepIds = useMemo(() => {
    const d = new Set<string>()
    if (file && meta) d.add('import')
    if (transcript) d.add('transcribe')
    if (suggestions.length > 0) d.add('highlights')
    if (clips.length > 0 && file) d.add('editor')
    if (transcript) d.add('captions')
    if (selectedCoverId) d.add('capa')
    if (exportBlob) d.add('export')
    if (copyPack) d.add('copy')
    return d
  }, [file, meta, transcript, suggestions.length, clips.length, selectedCoverId, exportBlob, copyPack])

  const lockedStepIds = useMemo(() => {
    const locked = new Set<string>()
    if (!file) {
      for (const s of STEPS) if (s.id !== 'import') locked.add(s.id)
    } else {
      if (!transcript) {
        locked.add('highlights')
        locked.add('copy')
      }
    }
    return locked
  }, [file, transcript])

  const stepIndex = STEPS.findIndex((s) => s.id === step)
  const goNext = () => {
    const next = STEPS[stepIndex + 1]
    if (!next) return
    if (lockedStepIds.has(next.id)) {
      // salta passos bloqueados
      const skipTo = STEPS.slice(stepIndex + 1).find((s) => !lockedStepIds.has(s.id))
      if (skipTo) setStep(skipTo.id)
      return
    }
    setStep(next.id)
  }
  const goBack = () => {
    const prev = STEPS[stepIndex - 1]
    if (prev) setStep(prev.id)
  }

  const nextDisabled =
    (step === 'import' && !file) || (step === 'transcribe' && !transcript)

  const guide = STEP_GUIDE[step]

  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 py-5 sm:px-5 sm:py-7">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-[radial-gradient(ellipse_at_top,_rgba(236,72,153,0.14),_transparent_60%)]"
        aria-hidden
      />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-pink-400/90">
            Estúdio · passo a passo
          </p>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-pink-500/30 bg-pink-500/10 shadow-[0_0_24px_-6px_rgba(236,72,153,0.55)]">
              <Clapperboard className="h-5 w-5 text-pink-400" aria-hidden />
            </span>
            Cortes de Vídeo
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Segue a barra de passos. Em cada ecrã dizemos exactamente o que fazer.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-pink-500/25 bg-pink-500/5 hover:bg-pink-500/10"
          onClick={() => setSettingsOpen(true)}
        >
          <KeyRound className="mr-1.5 h-3.5 w-3.5 text-pink-400" />
          OpenAI
        </Button>
      </header>

      <CortesStepRail
        steps={STEPS}
        active={step}
        doneIds={doneStepIds}
        lockedIds={lockedStepIds}
        onSelect={(id) => {
          if (!lockedStepIds.has(id)) setStep(id as StepId)
        }}
      />

      <CortesGuide step={stepIndex + 1} title={guide.title}>
        {guide.body}
      </CortesGuide>

      {(busy || phase === 'error' || (progress > 0 && progress < 100) || phase === 'done') && (
        <CortesPanel title="Processamento" subtitle={phaseLabel(phase)} icon={Loader2}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2 text-xs">
              <div className="min-w-0 space-y-0.5">
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-pink-400" /> : null}
                  {phaseLabel(phase)}
                </p>
                {busy ? (
                  <p className="text-[11px] text-muted-foreground">
                    Passado {formatRemainPt(elapsedSec)}
                    {etaSec != null ? (
                      <>
                        {' '}
                        · faltam ≈ <span className="font-semibold text-amber-200">{formatRemainPt(etaSec)}</span>
                      </>
                    ) : (
                      <span> · a estimar tempo…</span>
                    )}
                  </p>
                ) : phase === 'done' ? (
                  <p className="text-[11px] text-emerald-400">Concluído</p>
                ) : null}
              </div>
              <span className="font-mono text-sm tabular-nums text-pink-300">{Math.round(progress)}%</span>
            </div>
            <div className="relative">
              <Progress value={progress} className="h-3" />
              {busy ? (
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                >
                  <div className="h-full w-full animate-pulse bg-gradient-to-r from-pink-500/0 via-pink-300/35 to-pink-500/0" />
                </div>
              ) : null}
            </div>
            {busy && phase === 'transcribe' ? (
              <p className="text-[10px] text-muted-foreground">
                A OpenAI processa o áudio no servidor — a barra avança com estimativa (não é exacta ao
                segundo). Trechos mais curtos acabam muito mais depressa.
              </p>
            ) : null}
            {error ? <p className="text-xs text-red-400">{error}</p> : null}
          </div>
        </CortesPanel>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {/* Import */}
          {step === 'import' && (
            <CortesPanel title="Importar vídeo" subtitle="Ficheiro local ou link do YouTube" icon={Upload}>
              <div
                className={cn(
                  'flex flex-col items-center gap-4 rounded-2xl border border-dashed px-4 py-14 text-center transition-colors',
                  dragging
                    ? 'border-pink-400/60 bg-pink-500/10'
                    : 'border-white/10 bg-zinc-950/40 hover:border-pink-500/30',
                )}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-pink-500/25 bg-pink-500/10">
                  <Upload className="h-6 w-6 text-pink-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Larga o vídeo aqui</p>
                  <p className="mt-1 text-xs text-muted-foreground">MP4 · WebM · MOV</p>
                </div>
                <Button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
                  Seleccionar ficheiro
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="video/*,.mp4,.webm,.mov"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void acceptFile(f)
                  }}
                />
              </div>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.06]" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wide">
                  <span className="bg-card px-3 text-muted-foreground">ou</span>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-zinc-950/40 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Youtube className="h-4 w-4 text-red-400" />
                  Colar link do YouTube
                </div>
                <p className="text-[11px] text-muted-foreground">
                  O app tenta descarregar vídeos públicos. Em produção o YouTube pode bloquear o
                  servidor — configura um proxy (YOUTUBE_PROXY_URL) ou, se falhar, descarrega o MP4 e
                  usa <strong>Seleccionar ficheiro</strong>.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=… ou youtu.be/…"
                      className="pl-9"
                      disabled={busy}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void importFromYouTube()
                        }
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => void importFromYouTube()}
                    disabled={busy || !youtubeUrl.trim()}
                  >
                    {phase === 'upload' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        A obter…
                      </>
                    ) : (
                      'Importar URL'
                    )}
                  </Button>
                </div>
              </div>
            </CortesPanel>
          )}

          {meta && objectUrl && step !== 'import' && (
            <CortesPanel
              title={meta.name}
              subtitle="Pré-visualização"
              icon={Film}
              headerRight={
                <div className="flex flex-wrap justify-end gap-1.5">
                  <CortesChip>{formatDuration(meta.durationSec)}</CortesChip>
                  <CortesChip>
                    {meta.width}×{meta.height}
                  </CortesChip>
                  <CortesChip tone="pink">
                    {formatTimecode(workRange.start)}–{formatTimecode(workRange.end)}
                  </CortesChip>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="relative aspect-video overflow-hidden rounded-xl border border-white/[0.06] bg-black shadow-inner">
                  <video
                    ref={videoRef}
                    src={objectUrl}
                    className="h-full w-full object-contain"
                    controls
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  />
                  {transcript ? (
                    <div
                      style={captionCss(captionStyle) as CSSProperties}
                      className={cn(
                        captionStyle.animation === 'fade' && 'animate-in fade-in duration-300',
                        captionStyle.animation === 'pop' && 'animate-in zoom-in-95 duration-200',
                      )}
                    >
                      {words.length ? (
                        <span>
                          {words
                            .filter(
                              (w) =>
                                Math.abs(w.start - currentTime) < 2.5 ||
                                Math.abs(w.end - currentTime) < 2.5,
                            )
                            .slice(0, 12)
                            .map((w, i) => (
                              <span
                                key={`${w.start}-${i}`}
                                className={cn(
                                  activeWord && activeWord.start === w.start
                                    ? 'text-yellow-300'
                                    : 'opacity-80',
                                )}
                              >
                                {w.word}{' '}
                              </span>
                            ))}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <CortesTimelineBar
                  durationSec={meta.durationSec}
                  playhead={currentTime}
                  ranges={[
                    { start: workRange.start, end: workRange.end, tone: 'work' },
                    ...clips.map((c) => ({
                      start: c.sourceStart,
                      end: c.sourceEnd,
                      tone: 'clip' as const,
                    })),
                  ]}
                  onSeek={(t) => {
                    if (videoRef.current) videoRef.current.currentTime = t
                    setCurrentTime(t)
                  }}
                />
              </div>
            </CortesPanel>
          )}

          {step === 'transcribe' && (
            <Card className="border-border/50 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Transcrição automática</CardTitle>
                <CardDescription>
                  Escolhe primeiro o trecho a usar (ex.: últimos 30 min) — assim a OpenAI e o FFmpeg
                  trabalham só nessa parte, mais rápido e mais barato.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {meta ? (
                  <div className="space-y-2 rounded-lg border border-border/40 bg-muted/5 p-3">
                    <p className="text-xs font-medium text-foreground">Trecho de trabalho</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TRIM_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          disabled={busy}
                          onClick={() => applyPreset(p.id)}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                            trimPreset === p.id
                              ? 'border-pink-500/50 bg-pink-500/15 text-pink-300'
                              : 'border-border/40 text-muted-foreground hover:text-foreground',
                          )}
                          title={p.hint}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 sm:max-w-lg">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Início exacto (M:SS ou H:MM:SS)</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="ex.: 30:00"
                          value={customStartTc}
                          disabled={busy}
                          onChange={(e) => setCustomStartTc(e.target.value)}
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Fim exacto</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="ex.: 1:00:00"
                          value={customEndTc}
                          disabled={busy}
                          onChange={(e) => setCustomEndTc(e.target.value)}
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => applyPreset('custom')}
                      >
                        Aplicar tempo exacto
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setRangeFromPlayhead('start')}
                      >
                        Início = playhead ({formatTimecode(currentTime)})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setRangeFromPlayhead('end')}
                      >
                        Fim = playhead
                      </Button>
                    </div>
                    {manualTimeError ? (
                      <p className="text-[11px] text-red-400">{manualTimeError}</p>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">
                      A usar:{' '}
                      <span className="font-medium text-foreground font-mono">
                        {formatTimecode(workRange.start)} → {formatTimecode(workRange.end)}
                      </span>{' '}
                      ({formatDuration(rangeDuration(workRange))} ·{' '}
                      {meta.durationSec > 0
                        ? `${Math.round((rangeDuration(workRange) / meta.durationSec) * 100)}% do vídeo`
                        : '—'}
                      )
                    </p>
                  </div>
                ) : null}
                <Button type="button" onClick={() => void runTranscribe()} disabled={!file || busy}>
                  {busy && phase === 'transcribe' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Transcrever trecho seleccionado
                </Button>
                {transcript ? (
                  <div className="space-y-2">
                    <Textarea readOnly value={transcript.text} className="min-h-[140px] text-sm" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => downloadTextFile('legendas.srt', transcript.srt)}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Descarregar SRT
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {step === 'highlights' && (
            <Card className="border-border/50 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Melhores momentos & cortes</CardTitle>
                <CardDescription>
                  IA identifica destaques, potencial viral e silêncios.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button type="button" onClick={() => void runAnalyze()} disabled={!transcript || busy}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analisar com IA
                </Button>
                <ul className="space-y-2">
                  {suggestions.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/10 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{s.reason}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDuration(s.start)} → {formatDuration(s.end)} · {s.kind} · score{' '}
                          {(s.score * 100).toFixed(0)}
                        </p>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => applySuggestion(s)}>
                        <Scissors className="mr-1 h-3.5 w-3.5" />
                        Aplicar
                      </Button>
                    </li>
                  ))}
                  {!suggestions.length ? (
                    <p className="text-xs text-muted-foreground">
                      Transcreve primeiro; silêncios aparecem automaticamente. Corre a análise IA para
                      destaques.
                    </p>
                  ) : null}
                </ul>
              </CardContent>
            </Card>
          )}

          {step === 'editor' && (
            <CortesPanel
              title="Editor de timeline"
              subtitle="Começo + fim do corte, clips e enquadramento"
              icon={Scissors}
            >
              <div className="space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {TRIM_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p.id)}
                      className={cn(
                        'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all',
                        trimPreset === p.id
                          ? 'border-pink-500/50 bg-pink-500/15 text-pink-200'
                          : 'border-white/[0.08] text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="rounded-xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-zinc-950/60 to-transparent p-4">
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-pink-300/90">
                        Corte manual
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Define o <span className="text-foreground">começo</span> e o{' '}
                        <span className="text-foreground">fim</span> do pedaço a ficar no vídeo final.
                      </p>
                    </div>
                    <p className="rounded-lg border border-white/[0.08] bg-black/40 px-2.5 py-1 font-mono text-[11px] text-pink-200">
                      {formatTimecode(workRange.start)} → {formatTimecode(workRange.end)}
                      <span className="ml-2 text-muted-foreground">
                        ({formatDuration(rangeDuration(workRange))})
                      </span>
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <Label className="text-xs font-medium text-emerald-200">Começo do corte</Label>
                      <Input
                        className="h-11 border-white/10 bg-black/50 font-mono text-base"
                        value={customStartTc}
                        onChange={(e) => setCustomStartTc(e.target.value)}
                        placeholder="0:00"
                        inputMode="numeric"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            applyPreset('custom')
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full border-emerald-500/25 text-emerald-100"
                        onClick={() => setRangeFromPlayhead('start')}
                      >
                        Usar tempo actual ({formatTimecode(currentTime)})
                      </Button>
                    </div>
                    <div className="space-y-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                      <Label className="text-xs font-medium text-rose-200">Fim do corte</Label>
                      <Input
                        className="h-11 border-white/10 bg-black/50 font-mono text-base"
                        value={customEndTc}
                        onChange={(e) => setCustomEndTc(e.target.value)}
                        placeholder="1:00:00"
                        inputMode="numeric"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            applyPreset('custom')
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full border-rose-500/25 text-rose-100"
                        onClick={() => setRangeFromPlayhead('end')}
                      >
                        Usar tempo actual ({formatTimecode(currentTime)})
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" className="bg-pink-600 text-white hover:bg-pink-500" onClick={() => applyPreset('custom')}>
                      <Scissors className="mr-1.5 h-4 w-4" />
                      Cortar neste intervalo
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={addManualClip}>
                      + Guardar como clip extra
                    </Button>
                  </div>
                  {manualTimeError ? (
                    <p className="mt-2 text-[11px] text-red-400">{manualTimeError}</p>
                  ) : (
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Formato: <span className="font-mono">M:SS</span> ou{' '}
                      <span className="font-mono">H:MM:SS</span> — ex.: 0:45 → 3:20. O fim tem de ser
                      depois do começo.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={splitAtPlayhead}>
                    Dividir no playhead
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => meta && applyPreset('full')}>
                    Restaurar completo
                  </Button>
                </div>

                <ul className="grid gap-2 sm:grid-cols-2">
                  {clips.map((c, i) => (
                    <ClipManualRow
                      key={c.id}
                      index={i}
                      clip={c}
                      onSeek={(t) => {
                        if (videoRef.current) videoRef.current.currentTime = t
                      }}
                      onApply={(startTc, endTc) => updateClipTimes(c.id, startTc, endTc)}
                      onRemove={() => removeClip(c.id)}
                      canRemove={clips.length > 1}
                    />
                  ))}
                </ul>

                <div className="space-y-3 rounded-xl border border-white/[0.06] bg-zinc-950/40 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Enquadramento manual
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <Label>Zoom</Label>
                        <span className="font-mono text-muted-foreground">{reframe.zoom.toFixed(2)}×</span>
                      </div>
                      <Slider
                        value={[reframe.zoom]}
                        min={1}
                        max={2.5}
                        step={0.05}
                        onValueChange={([v]) => setReframe((r) => ({ ...r, zoom: v ?? 1 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <Label>Horizontal</Label>
                        <span className="font-mono text-muted-foreground">{reframe.offsetX.toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[reframe.offsetX]}
                        min={-1}
                        max={1}
                        step={0.05}
                        onValueChange={([v]) => setReframe((r) => ({ ...r, offsetX: v ?? 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <Label>Vertical</Label>
                        <span className="font-mono text-muted-foreground">{reframe.offsetY.toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[reframe.offsetY]}
                        min={-1}
                        max={1}
                        step={0.05}
                        onValueChange={([v]) => setReframe((r) => ({ ...r, offsetY: v ?? 0 }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CortesPanel>
          )}

          {step === 'captions' && (
            <Card className="border-border/50 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Legendas</CardTitle>
                <CardDescription>Estilo, posição e animação. Palavra activa destacada no preview.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fonte</Label>
                  <Input
                    value={captionStyle.fontFamily}
                    onChange={(e) => setCaptionStyle((s) => ({ ...s, fontFamily: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cor</Label>
                  <Input
                    type="color"
                    value={captionStyle.color}
                    onChange={(e) => setCaptionStyle((s) => ({ ...s, color: e.target.value }))}
                    className="h-9 p-1"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Tamanho ({captionStyle.fontSize}px)</Label>
                  <Slider
                    value={[captionStyle.fontSize]}
                    min={16}
                    max={56}
                    step={1}
                    onValueChange={([v]) => setCaptionStyle((s) => ({ ...s, fontSize: v ?? 28 }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
                  <Label className="text-xs">Sombra</Label>
                  <Switch
                    checked={captionStyle.shadow}
                    onCheckedChange={(v) => setCaptionStyle((s) => ({ ...s, shadow: v }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Posição</Label>
                  <div className="flex flex-wrap gap-1">
                    {(['top', 'center', 'bottom'] as const).map((p) => (
                      <Button
                        key={p}
                        type="button"
                        size="sm"
                        variant={captionStyle.position === p ? 'default' : 'outline'}
                        onClick={() => setCaptionStyle((s) => ({ ...s, position: p }))}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Animação</Label>
                  <div className="flex flex-wrap gap-1">
                    {(['none', 'fade', 'pop'] as const).map((a) => (
                      <Button
                        key={a}
                        type="button"
                        size="sm"
                        variant={captionStyle.animation === a ? 'default' : 'outline'}
                        onClick={() => setCaptionStyle((s) => ({ ...s, animation: a }))}
                      >
                        {a}
                      </Button>
                    ))}
                  </div>
                </div>
                {transcript ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="sm:col-span-2"
                    onClick={() => downloadTextFile('legendas.srt', transcript.srt)}
                  >
                    Exportar SRT
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground sm:col-span-2">Transcreve o vídeo para gerar legendas.</p>
                )}
              </CardContent>
            </Card>
          )}

          {step === 'capa' && (
            <CortesPanel
              title="Capa do vídeo"
              subtitle="Tu defines ou a IA cria — escolhe a preferida"
              icon={ImagePlus}
            >
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Título da capa
                    </Label>
                    <Input
                      value={coverTitle}
                      onChange={(e) => setCoverTitle(e.target.value)}
                      placeholder="Ex.: 3 erros que custam dinheiro"
                      className="border-white/10 bg-black/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Subtítulo (opcional)
                    </Label>
                    <Input
                      value={coverSubtitle}
                      onChange={(e) => setCoverSubtitle(e.target.value)}
                      placeholder="Curto e claro"
                      className="border-white/10 bg-black/40"
                    />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={!objectUrl || busy}
                    onClick={() => void captureCoverFromPlayhead(false)}
                    className="rounded-xl border border-white/[0.08] bg-zinc-950/50 p-4 text-left transition-colors hover:border-pink-500/35 disabled:opacity-50"
                  >
                    <p className="text-sm font-semibold text-foreground">Eu crio · frame actual</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Usa o instante do player ({formatTimecode(currentTime)})
                    </p>
                  </button>
                  <button
                    type="button"
                    disabled={!objectUrl || busy}
                    onClick={() => void captureCoverFromPlayhead(true)}
                    className="rounded-xl border border-white/[0.08] bg-zinc-950/50 p-4 text-left transition-colors hover:border-pink-500/35 disabled:opacity-50"
                  >
                    <p className="text-sm font-semibold text-foreground">Eu crio · frame + texto</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Frame actual com título por cima
                    </p>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => coverInputRef.current?.click()}
                    className="rounded-xl border border-white/[0.08] bg-zinc-950/50 p-4 text-left transition-colors hover:border-pink-500/35"
                  >
                    <p className="text-sm font-semibold text-foreground">Eu crio · enviar imagem</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">PNG/JPG da tua autoria</p>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAiCover(false)}
                    className="rounded-xl border border-pink-500/25 bg-pink-500/10 p-4 text-left transition-colors hover:border-pink-400/50"
                  >
                    <p className="text-sm font-semibold text-pink-100">IA cria · frame sugerido</p>
                    <p className="mt-1 text-[11px] text-pink-200/70">
                      Título + melhor momento (Whisper/texto)
                    </p>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAiCover(true)}
                    className="rounded-xl border border-pink-500/25 bg-pink-500/10 p-4 text-left transition-colors hover:border-pink-400/50 sm:col-span-2"
                  >
                    <p className="text-sm font-semibold text-pink-100">IA cria · imagem nova (DALL·E)</p>
                    <p className="mt-1 text-[11px] text-pink-200/70">
                      Gasta mais créditos · gera capa do zero
                    </p>
                  </button>
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void uploadCoverFile(f)
                    e.target.value = ''
                  }}
                />

                {covers.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Escolhe a capa
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {covers.map((c) => {
                        const active = c.id === selectedCoverId
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedCoverId(c.id)}
                            className={cn(
                              'group relative overflow-hidden rounded-xl border text-left transition-all',
                              active
                                ? 'border-pink-400 ring-2 ring-pink-500/40'
                                : 'border-white/[0.08] hover:border-pink-500/30',
                            )}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={c.dataUrl} alt="" className="aspect-[9/16] w-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                              <p className="truncate text-[10px] font-medium text-white">{c.label}</p>
                              <p className="text-[9px] uppercase tracking-wide text-white/60">{c.source}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    {selectedCover ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => downloadDataUrl('capa-video.jpg', selectedCover.dataUrl)}
                        >
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          Descarregar capa
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setCovers((prev) => prev.filter((x) => x.id !== selectedCover.id))
                            setSelectedCoverId((id) => (id === selectedCover.id ? null : id))
                          }}
                        >
                          Remover seleccionado
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Ainda sem capas. Cria uma manualmente ou pede à IA.
                  </p>
                )}
              </div>
            </CortesPanel>
          )}

          {step === 'export' && (
            <Card className="border-border/50 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Exportação por plataforma</CardTitle>
                <CardDescription>
                  Perfil activo: {profile.label} · {profile.aspectLabel} · {profile.width}×{profile.height}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedCover ? (
                  <div className="flex items-center gap-3 rounded-xl border border-pink-500/20 bg-pink-500/5 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedCover.dataUrl}
                      alt=""
                      className="h-16 w-10 rounded-md object-cover ring-1 ring-pink-400/30"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">Capa seleccionada</p>
                      <p className="truncate text-[10px] text-muted-foreground">{selectedCover.label}</p>
                    </div>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setStep('capa')}>
                      Mudar
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep('capa')}
                    className="w-full rounded-xl border border-dashed border-white/15 px-3 py-3 text-left text-xs text-muted-foreground hover:border-pink-500/30 hover:text-foreground"
                  >
                    Sem capa · tocar para criar/seleccionar
                  </button>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {EXPORT_PROFILES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlatformId(p.id)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium',
                        platformId === p.id
                          ? 'border-pink-500/50 bg-pink-500/15 text-pink-300'
                          : 'border-border/40 text-muted-foreground',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
                  <Label className="text-xs">Incorporar legendas no vídeo (burn-in)</Label>
                  <Switch checked={burnCaptions} onCheckedChange={setBurnCaptions} />
                </div>
                <Button type="button" onClick={() => void runExport()} disabled={!file || !clips.length || busy}>
                  {busy && phase === 'export' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Exportar MP4
                </Button>
                {exportBlob ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => downloadExport('video')}>
                      Descarregar vídeo
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => downloadExport('srt')}>
                      Descarregar SRT
                    </Button>
                    <Button type="button" size="sm" onClick={() => downloadExport('both')}>
                      Vídeo + SRT
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {step === 'copy' && (
            <Card className="border-border/50 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Texto para publicar</CardTitle>
                <CardDescription>
                  Um toque e a IA escreve título, descrição e hashtags para a plataforma escolhida.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button type="button" onClick={() => void runCopy()} disabled={!transcript || busy}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar texto agora
                </Button>
                {copyPack ? (
                  <div className="space-y-2 text-sm">
                    <div>
                      <Label className="text-xs">Título</Label>
                      <p className="rounded-md border border-border/40 bg-muted/10 px-3 py-2">{copyPack.title}</p>
                    </div>
                    <div>
                      <Label className="text-xs">Descrição</Label>
                      <p className="rounded-md border border-border/40 bg-muted/10 px-3 py-2 whitespace-pre-wrap">
                        {copyPack.description}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs">Hashtags</Label>
                      <p className="rounded-md border border-border/40 bg-muted/10 px-3 py-2">
                        {copyPack.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs">Resumo</Label>
                      <p className="rounded-md border border-border/40 bg-muted/10 px-3 py-2">{copyPack.summary}</p>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          <CortesStepNav
            onBack={stepIndex > 0 ? goBack : undefined}
            onNext={stepIndex < STEPS.length - 1 ? goNext : undefined}
            nextLabel={guide.nextLabel}
            nextHint={
              nextDisabled
                ? guide.nextHint
                : step === 'highlights'
                  ? 'Podes continuar mesmo sem analisar'
                  : step === 'capa'
                    ? selectedCoverId
                      ? 'Capa escolhida ✓'
                      : 'Podes exportar sem capa'
                    : step === 'export'
                      ? exportBlob
                        ? 'Vídeo exportado ✓'
                        : 'Exporta quando estiveres pronto'
                      : undefined
            }
            nextDisabled={nextDisabled}
          />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <CortesPanel title="Histórico" subtitle="Projectos neste dispositivo" icon={History}>
            <div className="space-y-2">
              {history.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-xs text-muted-foreground">
                  Ainda sem projectos guardados.
                </p>
              ) : (
                history.slice(0, 12).map((h) => (
                  <div
                    key={h.id}
                    className="flex gap-2.5 rounded-xl border border-white/[0.06] bg-zinc-950/40 p-2 transition-colors hover:border-pink-500/25"
                  >
                    {h.thumbnailDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={h.thumbnailDataUrl}
                        alt=""
                        className="h-12 w-12 rounded-lg object-cover ring-1 ring-white/10"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.04] text-[10px] text-muted-foreground">
                        VID
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className="block w-full truncate text-left text-xs font-medium hover:text-pink-300"
                        onClick={() => void openHistory(h)}
                      >
                        {h.title}
                      </button>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatDuration(h.meta.durationSec)} · {formatBytes(h.meta.sizeBytes)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => void deleteCortesHistoryItem(h.id).then(refreshHistory)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CortesPanel>

          <div className="rounded-2xl border border-white/[0.06] bg-zinc-950/40 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Roadmap
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {CORTES_FUTURE_CAPABILITIES.slice(0, 4)
                .map((c) => c.label)
                .join(' · ')}
              …
            </p>
          </div>

          {meta ? (
            <Button
              type="button"
              variant="outline"
              className="w-full border-pink-500/20"
              onClick={() => setStep('import')}
            >
              Novo upload
            </Button>
          ) : null}
        </aside>
      </div>

      <CortesOpenAiSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}

function ClipManualRow({
  index,
  clip,
  onSeek,
  onApply,
  onRemove,
  canRemove,
}: {
  index: number
  clip: TimelineClip
  onSeek: (t: number) => void
  onApply: (startTc: string, endTc: string) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const [startTc, setStartTc] = useState(formatTimecode(clip.sourceStart))
  const [endTc, setEndTc] = useState(formatTimecode(clip.sourceEnd))

  useEffect(() => {
    setStartTc(formatTimecode(clip.sourceStart))
    setEndTc(formatTimecode(clip.sourceEnd))
  }, [clip.sourceStart, clip.sourceEnd, clip.id])

  return (
    <li className="rounded-xl border border-white/[0.06] bg-zinc-950/50 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-left text-xs font-semibold tracking-tight hover:text-pink-300"
          onClick={() => onSeek(clip.sourceStart)}
        >
          Clip {index + 1}
          <span className="ml-2 font-mono font-normal text-muted-foreground">
            {formatDuration(clip.sourceEnd - clip.sourceStart)}
          </span>
        </button>
        {canRemove ? (
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] font-medium uppercase tracking-wide text-emerald-300/90">
            Começo
          </Label>
          <Input
            className="h-9 border-white/10 bg-black/40 font-mono text-xs"
            value={startTc}
            onChange={(e) => setStartTc(e.target.value)}
            placeholder="0:00"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-medium uppercase tracking-wide text-rose-300/90">
            Fim
          </Label>
          <Input
            className="h-9 border-white/10 bg-black/40 font-mono text-xs"
            value={endTc}
            onChange={(e) => setEndTc(e.target.value)}
            placeholder="0:30"
          />
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full border-pink-500/20"
        onClick={() => onApply(startTc, endTc)}
      >
        Aplicar começo e fim
      </Button>
    </li>
  )
}

function CortesOpenAiSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [settings, setSettings] = useState<CortesOpenAiSettings>(DEFAULT_CORTES_OPENAI)
  const [keyInput, setKeyInput] = useState('')
  const usage = cortesOpenAiUsageToday()

  useEffect(() => {
    if (open) {
      setSettings(loadCortesOpenAiSettings())
      setKeyInput('')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>OpenAI — Cortes de Vídeo</DialogTitle>
          <DialogDescription>
            A chave é partilhada com o resto do app. Prefere colá-la em{' '}
            <a href="/settings" className="text-indigo-300 underline underline-offset-2">
              Configurações
            </a>
            , onde também vês os gastos por área. Fallback no servidor: OPENAI_API_KEY.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Activar IA</Label>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Chave API</Label>
            <Input
              type="password"
              placeholder={settings.apiKey ? maskOpenAiKey(settings.apiKey) : 'sk-…'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Máx. chamadas / dia</Label>
            <Input
              type="number"
              value={settings.maxCallsPerDay}
              onChange={(e) =>
                setSettings((s) => ({ ...s, maxCallsPerDay: Number(e.target.value) || 50 }))
              }
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Hoje: {usage.calls} chamadas · ~${usage.costUsd.toFixed(4)}
          </p>
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              const next = {
                ...settings,
                apiKey: keyInput.trim() || settings.apiKey,
              }
              saveCortesOpenAiSettings(next)
              setSettings(next)
              onOpenChange(false)
            }}
          >
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
