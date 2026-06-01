import * as React from 'react'

const MOBILE_BREAKPOINT = 768

/** Telefone/tablet pequeno — usa o lado mais curto para não “virar desktop” em paisagem. */
export function isPhoneViewport(width = window.innerWidth, height = window.innerHeight): boolean {
  return Math.min(width, height) < MOBILE_BREAKPOINT
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === 'undefined') return false
    return isPhoneViewport()
  })

  React.useEffect(() => {
    const onChange = () => setIsMobile(isPhoneViewport())
    window.addEventListener('resize', onChange)
    window.addEventListener('orientationchange', onChange)
    onChange()
    return () => {
      window.removeEventListener('resize', onChange)
      window.removeEventListener('orientationchange', onChange)
    }
  }, [])

  return isMobile
}
