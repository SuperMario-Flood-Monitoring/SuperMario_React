import { useCallback, useEffect, useRef, useState } from 'react'

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>
  unlock?: () => void
}

export type LandscapeModeSupport = 'not-mobile' | 'supported' | 'unsupported'

const MOBILE_LANDSCAPE_QUERY = [
  '(hover: none) and (pointer: coarse)',
  '(max-width: 900px) and (pointer: coarse)',
].join(', ')
const PORTRAIT_QUERY = '(orientation: portrait)'

function getMediaQueryState(query: string) {
  return typeof window !== 'undefined' && window.matchMedia(query).matches
}

function getLockableOrientation() {
  return typeof screen !== 'undefined'
    ? (screen.orientation as LockableScreenOrientation | undefined)
    : undefined
}

function canUseFullscreenRequest() {
  return typeof document !== 'undefined' &&
    Boolean(document.fullscreenEnabled) &&
    typeof document.documentElement.requestFullscreen === 'function'
}

function getLandscapeModeSupport(): LandscapeModeSupport {
  if (!getMediaQueryState(MOBILE_LANDSCAPE_QUERY)) {
    return 'not-mobile'
  }

  const orientation = getLockableOrientation()

  if (!orientation?.lock || !canUseFullscreenRequest()) {
    return 'unsupported'
  }

  return 'supported'
}

function addMediaListener(query: string, listener: () => void) {
  const mediaQueryList = window.matchMedia(query)
  mediaQueryList.addEventListener('change', listener)
  return () => mediaQueryList.removeEventListener('change', listener)
}

export function useMobileLandscapePreference(active: boolean) {
  const ownsFullscreenRef = useRef(false)
  const [isMobileLike, setIsMobileLike] = useState(() => getMediaQueryState(MOBILE_LANDSCAPE_QUERY))
  const [isPortrait, setIsPortrait] = useState(() => getMediaQueryState(PORTRAIT_QUERY))
  const [landscapeModeSupport, setLandscapeModeSupport] = useState<LandscapeModeSupport>(() => getLandscapeModeSupport())

  useEffect(() => {
    const update = () => {
      setIsMobileLike(getMediaQueryState(MOBILE_LANDSCAPE_QUERY))
      setIsPortrait(getMediaQueryState(PORTRAIT_QUERY))
      setLandscapeModeSupport(getLandscapeModeSupport())
    }

    update()
    const removeMobileListener = addMediaListener(MOBILE_LANDSCAPE_QUERY, update)
    const removePortraitListener = addMediaListener(PORTRAIT_QUERY, update)

    return () => {
      removeMobileListener()
      removePortraitListener()
    }
  }, [])

  const releaseLandscape = useCallback(() => {
    getLockableOrientation()?.unlock?.()

    if (
      ownsFullscreenRef.current &&
      document.fullscreenElement === document.documentElement &&
      document.exitFullscreen
    ) {
      document.exitFullscreen().catch(() => undefined)
    }

    ownsFullscreenRef.current = false
  }, [])

  const requestLandscape = useCallback(async () => {
    const support = getLandscapeModeSupport()

    if (support !== 'supported') {
      return false
    }

    const orientation = getLockableOrientation()
    if (!orientation?.lock) {
      return false
    }

    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        ownsFullscreenRef.current = true
      }

      await orientation.lock('landscape')
      return true
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    if (active) {
      void requestLandscape()
      return undefined
    }

    releaseLandscape()
    return undefined
  }, [active, releaseLandscape, requestLandscape])

  useEffect(() => releaseLandscape, [releaseLandscape])

  return {
    isMobileLike,
    isPortrait,
    landscapeModeSupport,
    requestLandscape,
  }
}
