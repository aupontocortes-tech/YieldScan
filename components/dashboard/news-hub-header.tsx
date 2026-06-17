'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { openGfVoiceFromUserGesture } from '@/lib/gestao-financeira/voice-bridge'
import { isStandalonePwa } from '@/lib/mic-permission'
import { Building2, LineChart, Newspaper, Sparkles } from 'lucide-react'

const LINKS = [
  {
    href: '/news/mercado',
    label: 'Preços e mercado',
    shortLabel: 'Mercado',
    description: 'Cripto, ações US tokenizadas (xStock) e top 10 em tempo real.',
    icon: LineChart,
    voiceOnLongPress: false,
  },
  {
    href: '/news/noticias',
    label: 'Notícias',
    shortLabel: 'Notícias',
    description: 'Cripto, ações americanas, macro, geopolítica e IA — em português.',
    icon: Newspaper,
    voiceOnLongPress: false,
  },
  {
    href: '/news/tendencias',
    label: 'Tendências',
    shortLabel: 'Tendências',
    description: 'Cripto + ações US em destaque, volume, IA/tech e alertas.',
    icon: Sparkles,
    voiceOnLongPress: false,
  },
  {
    href: '/news/gestao-financeira',
    label: 'Gestão Financeira',
    shortLabel: 'Gestão',
    description: 'Patrimônio, receitas, despesas, caixas, dívidas e cripto — segure para falar.',
    icon: Building2,
    voiceOnLongPress: true,
  },
] as const

const LONG_PRESS_MS = 600
const VOICE_DISPATCH_DELAY_MS = 450

function HubNavLink({
  href,
  label,
  shortLabel,
  description,
  icon: Icon,
  active,
  voiceOnLongPress,
}: (typeof LINKS)[number] & { active: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const openVoiceAfterNav = useCallback(() => {
    const onGestao = pathname === href || pathname.startsWith(`${href}/`)
    const open = () => openGfVoiceFromUserGesture({ autoStart: !isStandalonePwa() })
    if (onGestao) {
      open()
      return
    }
    router.push(href)
    window.setTimeout(open, VOICE_DISPATCH_DELAY_MS)
  }, [href, pathname, router])

  const startLongPress = useCallback(() => {
    if (!voiceOnLongPress) return
    longPressRef.current = false
    clearTimer()
    timerRef.current = setTimeout(() => {
      longPressRef.current = true
      if (navigator.vibrate) navigator.vibrate(30)
      openVoiceAfterNav()
    }, LONG_PRESS_MS)
  }, [clearTimer, openVoiceAfterNav, voiceOnLongPress])

  const onPointerDown = useCallback(() => {
    startLongPress()
  }, [startLongPress])

  const onPointerUp = useCallback(() => {
    clearTimer()
  }, [clearTimer])

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!voiceOnLongPress) return
      e.stopPropagation()
      startLongPress()
    },
    [startLongPress, voiceOnLongPress],
  )

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (longPressRef.current) {
        e.preventDefault()
        longPressRef.current = false
      }
      clearTimer()
    },
    [clearTimer],
  )

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (longPressRef.current) {
        e.preventDefault()
        longPressRef.current = false
      }
    },
    [],
  )

  return (
    <Link
      href={href}
      title={voiceOnLongPress ? `${description} (segure para falar)` : description}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerCancel={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onContextMenu={voiceOnLongPress ? (e) => e.preventDefault() : undefined}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-center transition-all select-none touch-manipulation',
        'sm:min-h-[88px] sm:items-start sm:justify-center sm:gap-1 sm:px-4 sm:py-3.5 sm:text-left',
        active
          ? 'border-yellow-500 bg-yellow-500 text-black shadow-md'
          : 'border-border/60 bg-card/50 text-foreground hover:border-yellow-500/40 hover:bg-card',
        voiceOnLongPress && !active && 'hover:border-emerald-500/40',
      )}
    >
      <Icon
        className={cn('h-5 w-5 shrink-0 sm:h-4 sm:w-4', active ? 'text-black' : voiceOnLongPress ? 'text-emerald-400' : 'text-yellow-500')}
        aria-hidden
      />
      <span className="text-[10px] font-semibold leading-tight sm:hidden">{shortLabel}</span>
      <span className="hidden items-center gap-2 font-semibold sm:flex">
        <span>{label}</span>
      </span>
      <span
        className={cn(
          'hidden text-xs leading-snug sm:line-clamp-2',
          active ? 'text-black/75' : 'text-muted-foreground',
        )}
      >
        {description}
      </span>
    </Link>
  )
}

export function NewsHubHeader() {
  const pathname = usePathname()
  const onGestao = pathname.startsWith('/news/gestao-financeira')

  return (
    <header className="mb-5 border-b border-border/40 pb-5 sm:mb-8 sm:pb-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {onGestao ? 'Gestão Financeira' : 'Cripto e mercado global'}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {onGestao
          ? 'Controle patrimônio, receitas, despesas, caixas, dívidas e criptomoedas — segure o botão Gestão para registrar por voz.'
          : 'Preços (cripto e ações US), notícias e análise inteligente — escolhe a secção abaixo.'}
      </p>

      <nav
        className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-4 sm:gap-3"
        aria-label="Secções do hub"
      >
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
          return <HubNavLink key={link.href} {...link} active={active} />
        })}
      </nav>
    </header>
  )
}
