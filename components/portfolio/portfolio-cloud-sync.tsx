'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  exportPortfolioJson,
  importPortfolioJson,
  loadPortfolio,
} from '@/lib/portfolio/storage'
import type { PortfolioData } from '@/lib/portfolio/types'
import {
  pullPortfolioFromNeon,
  pushPortfolioToNeonNow,
} from '@/lib/neon/sync-portfolio'
import { Cloud, CloudDownload, CloudUpload, Download, Upload } from 'lucide-react'

type Props = {
  data: PortfolioData
  onImport: (next: PortfolioData) => void
}

export function PortfolioCloudSync({ data, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'push' | 'pull' | 'export' | 'import' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const run = async (kind: 'push' | 'pull', fn: () => Promise<boolean | void>) => {
    setBusy(kind)
    setMsg(null)
    try {
      const result = await fn()
      if (kind === 'push') {
        setMsg('Carteira guardada na nuvem.')
      } else if (result) {
        setMsg('Carteira restaurada da nuvem.')
      } else {
        setMsg('Nuvem vazia ou dados locais mais recentes — nada alterado.')
      }
    } catch {
      setMsg('Falha de rede. Verifique ligação e tente de novo.')
    } finally {
      setBusy(null)
    }
  }

  const handleExportFile = () => {
    setBusy('export')
    try {
      const blob = new Blob([exportPortfolioJson(data)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `yieldscan-carteira-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMsg('Ficheiro exportado — use no PC ou outro telemóvel.')
    } finally {
      setBusy(null)
    }
  }

  const handleImportFile = async (file: File) => {
    setBusy('import')
    setMsg(null)
    try {
      const text = await file.text()
      const result = importPortfolioJson(text)
      if ('error' in result) {
        setMsg(result.error)
        return
      }
      onImport(result)
      await pushPortfolioToNeonNow(result)
      setMsg('Carteira importada e enviada para a nuvem.')
    } catch {
      setMsg('Não foi possível ler o ficheiro.')
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const hasData = data.holdings.length > 0 || data.transactions.length > 0

  return (
    <div className="mb-4 rounded-2xl border border-white/[0.08] bg-[#111827]/80 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Cloud className="size-4 shrink-0 text-sky-400" />
        <p className="text-xs font-medium text-foreground">Backup da carteira</p>
        <span className="text-[10px] text-muted-foreground">
          Telemóvel → nuvem · ficheiro para outro aparelho
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-sky-500/30 text-xs"
          disabled={!hasData || busy !== null}
          onClick={() => void run('push', () => pushPortfolioToNeonNow(data))}
        >
          <CloudUpload className="size-3.5" />
          {busy === 'push' ? 'A guardar…' : 'Guardar na nuvem'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-sky-500/30 text-xs"
          disabled={busy !== null}
          onClick={() =>
            void run('pull', async () => {
              const ok = await pullPortfolioFromNeon()
              if (ok) onImport(loadPortfolio())
              return ok
            })
          }
        >
          <CloudDownload className="size-3.5" />
          {busy === 'pull' ? 'A restaurar…' : 'Restaurar da nuvem'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={!hasData || busy !== null}
          onClick={handleExportFile}
        >
          <Download className="size-3.5" />
          Exportar ficheiro
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={busy !== null}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-3.5" />
          Importar ficheiro
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleImportFile(f)
          }}
        />
      </div>
      {msg ? <p className="mt-2 text-[11px] text-muted-foreground">{msg}</p> : null}
    </div>
  )
}
