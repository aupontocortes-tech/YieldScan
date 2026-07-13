import type { TranscriptSegment, TranscriptWord } from '@/lib/cortes-video/types'

function pad(n: number, w = 2) {
  return String(n).padStart(w, '0')
}

/** Segundos → SRT timestamp 00:00:00,000 */
export function formatSrtTime(sec: number): string {
  const s = Math.max(0, sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const whole = Math.floor(r)
  const ms = Math.round((r - whole) * 1000)
  return `${pad(h)}:${pad(m)}:${pad(whole)},${pad(ms, 3)}`
}

export function segmentsToSrt(segments: TranscriptSegment[]): string {
  return segments
    .map((seg, i) => {
      const text = seg.text.trim() || seg.words.map((w) => w.word).join(' ')
      return `${i + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${text}\n`
    })
    .join('\n')
}

/** Desloca timestamps após transcrever só um trecho do vídeo. */
export function offsetTranscriptTimes(
  transcript: {
    text: string
    language: string
    segments: TranscriptSegment[]
    srt: string
  },
  offsetSec: number,
): typeof transcript {
  if (!offsetSec || Math.abs(offsetSec) < 0.001) return transcript
  const segments = transcript.segments.map((s) => ({
    ...s,
    start: s.start + offsetSec,
    end: s.end + offsetSec,
    words: s.words.map((w) => ({
      ...w,
      start: w.start + offsetSec,
      end: w.end + offsetSec,
    })),
  }))
  return {
    ...transcript,
    segments,
    srt: segmentsToSrt(segments),
  }
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function activeWordAt(
  words: TranscriptWord[],
  t: number,
): TranscriptWord | null {
  for (const w of words) {
    if (t >= w.start && t <= w.end) return w
  }
  return null
}

export function flattenWords(segments: TranscriptSegment[]): TranscriptWord[] {
  return segments.flatMap((s) => s.words)
}

/** Heurística: gaps > threshold = silêncios. */
export function detectSilenceGaps(
  segments: TranscriptSegment[],
  thresholdSec = 0.8,
): Array<{ start: number; end: number }> {
  const gaps: Array<{ start: number; end: number }> = []
  const sorted = [...segments].sort((a, b) => a.start - b.start)
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!
    const b = sorted[i + 1]!
    if (b.start - a.end >= thresholdSec) {
      gaps.push({ start: a.end, end: b.start })
    }
  }
  return gaps
}
