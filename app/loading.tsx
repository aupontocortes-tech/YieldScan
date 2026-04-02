import { Loader2 } from 'lucide-react'

export default function RootLoading() {
  return (
    <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 bg-background px-4">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-500/80" aria-hidden />
      <p className="text-sm text-muted-foreground">A carregar YieldScan…</p>
    </div>
  )
}
