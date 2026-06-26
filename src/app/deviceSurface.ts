export type AppSurface = 'web' | 'mobile'

const MOBILE_SURFACE_QUERY = '(pointer: coarse), (max-width: 1023px)'

function getSurfaceFromQuery(): AppSurface {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'web'
  }

  return window.matchMedia(MOBILE_SURFACE_QUERY).matches ? 'mobile' : 'web'
}

export function getInitialAppSurface(): AppSurface {
  return getSurfaceFromQuery()
}

export function subscribeAppSurfaceChange(onChange: (surface: AppSurface) => void) {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => undefined
  }

  const mediaQuery = window.matchMedia(MOBILE_SURFACE_QUERY)
  const syncSurface = () => onChange(mediaQuery.matches ? 'mobile' : 'web')

  mediaQuery.addEventListener('change', syncSurface)

  return () => mediaQuery.removeEventListener('change', syncSurface)
}
