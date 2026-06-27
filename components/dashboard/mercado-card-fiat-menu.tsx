'use client'

import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  effectiveDisplayFiatForCoin,
  type MercadoDisplayFiat,
  type MercadoDisplayPrefs,
} from '@/lib/mercado-display-prefs'
import { cn } from '@/lib/utils'

const FIAT_LABEL: Record<MercadoDisplayFiat, string> = {
  brl: 'Real (BRL)',
  usd: 'Dólar (USD)',
  eur: 'Euro (EUR)',
}

type FiatMode = MercadoDisplayFiat | 'default'

type Props = {
  coinId: string
  mercadoPrefs: MercadoDisplayPrefs
  onFiatChange: (coinId: string, mode: FiatMode) => void
  className?: string
  accent?: 'crypto' | 'stock'
}

/** Engrenagem no cartão — moeda do preço (BRL / USD / EUR). */
export function MercadoCardFiatMenu({
  coinId,
  mercadoPrefs,
  onFiatChange,
  className,
  accent = 'crypto',
}: Props) {
  const slug = coinId.trim().toLowerCase()
  const mapped = mercadoPrefs.displayFiatByCoinId[slug]
  const radioValue: FiatMode = mapped ?? 'default'
  const effective = effectiveDisplayFiatForCoin(slug, mercadoPrefs)

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-9 w-9 rounded-full border border-border/60 bg-background/90 shadow-sm backdrop-blur-sm',
            'hover:bg-muted/80',
            accent === 'stock' && 'hover:border-blue-500/40',
            accent === 'crypto' && 'hover:border-cyan-500/40',
            className,
          )}
          title="Moeda do preço (engrenagem)"
          aria-label="Engrenagem — escolher moeda do preço"
          data-mercado-card-control=""
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Settings2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Moeda do preço
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={radioValue}
          onValueChange={(v) => onFiatChange(slug, v as FiatMode)}
        >
          <DropdownMenuRadioItem value="default">
            Igual à página ({FIAT_LABEL[mercadoPrefs.displayFiat]})
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value="brl">{FIAT_LABEL.brl}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="usd">{FIAT_LABEL.usd}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="eur">{FIAT_LABEL.eur}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-[10px] text-muted-foreground">
          A mostrar: <span className="font-medium text-foreground">{FIAT_LABEL[effective]}</span>
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
