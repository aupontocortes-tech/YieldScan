'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Mic, ShieldCheck } from 'lucide-react'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  requesting: boolean
  error: string | null
  onAllow: () => Promise<boolean>
}

/** Área de conexão — pede permissão do microfone ao Chrome no gesto do utilizador. */
export function GfMicConnectDialog({ open, onOpenChange, requesting, error, onAllow }: Props) {
  const handleAllow = async () => {
    const ok = await onAllow()
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-emerald-500/25 bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Conexão do microfone
          </DialogTitle>
          <DialogDescription>
            O Chrome precisa de permissão para ouvir a sua voz. Toque em «Permitir microfone» e depois confirme no
            aviso do navegador.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/15 px-3 py-2.5 text-xs text-muted-foreground">
          <p className="font-medium text-emerald-200/90">Passos</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4">
            <li>Toque em <strong className="text-foreground">Permitir microfone</strong> abaixo</li>
            <li>No aviso do Chrome, escolha <strong className="text-foreground">Permitir</strong></li>
            <li>Segure o botão verde e fale a frase</li>
          </ol>
        </div>

        {error ? <p className="text-xs text-amber-200/90">{error}</p> : null}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500"
            disabled={requesting}
            onClick={() => void handleAllow()}
          >
            {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            Permitir microfone
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
