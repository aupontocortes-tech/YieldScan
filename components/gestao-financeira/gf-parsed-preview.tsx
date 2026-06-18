'use client'

import { Badge } from '@/components/ui/badge'
import type { GfParsedVoiceEntry } from '@/lib/gestao-financeira/types'

type Props = {
  parsed: GfParsedVoiceEntry
  title?: string
}

export function GfParsedPreview({ parsed, title = 'Confirmar:' }: Props) {
  return (
    <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 p-3 text-sm space-y-2">
      <p className="font-medium text-emerald-200">{title}</p>
      <p className="text-foreground">{parsed.summary}</p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          {parsed.type === 'income' ? 'Receita' : parsed.type === 'expense' ? 'Despesa' : 'Transferência'}
        </Badge>
        <Badge className="bg-emerald-600">
          R$ {parsed.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </Badge>
        {parsed.categoryName ? <Badge variant="secondary">{parsed.categoryName}</Badge> : null}
        {parsed.cashBoxName ? <Badge variant="outline">{parsed.cashBoxName}</Badge> : null}
        {parsed.toCashBoxName ? <Badge variant="outline">→ {parsed.toCashBoxName}</Badge> : null}
      </div>
    </div>
  )
}
