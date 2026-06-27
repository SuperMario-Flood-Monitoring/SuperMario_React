import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import resetZoomIconPng from '../../assets/reset-zoom-arrow.png'

export type MobileZoomControlsHandle = {
  setPercentLabel: (nextLabel: string) => void
}

interface MobileZoomControlsProps {
  className?: string
  isDark: boolean
  onDarkSurface?: boolean
  percentLabel: string
  canZoomOut: boolean
  canReset: boolean
  zoomOutLabel?: string
  resetLabel?: string
  zoomInLabel?: string
  onZoomOut: () => void
  onReset: () => void
  onZoomIn: () => void
}

export const MobileZoomControls = forwardRef<MobileZoomControlsHandle, MobileZoomControlsProps>(function MobileZoomControls({
  className = '',
  isDark,
  onDarkSurface = false,
  percentLabel,
  canZoomOut,
  canReset,
  zoomOutLabel = '축소',
  resetLabel = '확대 초기화',
  zoomInLabel = '확대',
  onZoomOut,
  onReset,
  onZoomIn,
}, ref) {
  const [visiblePercentLabel, setVisiblePercentLabel] = useState(percentLabel)

  useEffect(() => {
    setVisiblePercentLabel(percentLabel)
  }, [percentLabel])

  useImperativeHandle(ref, () => ({
    setPercentLabel: setVisiblePercentLabel,
  }), [])

  const surfaceClassName = !isDark && onDarkSurface
    ? 'border-white/20 bg-slate-950/92 text-white ring-1 ring-white/10'
    : isDark
    ? 'border-white bg-white text-slate-950'
    : 'border-slate-950 bg-slate-950 text-white'
  const dividerClassName = isDark ? 'border-slate-200' : 'border-white/15'
  const hoverClassName = isDark ? 'hover:bg-slate-100' : 'hover:bg-slate-900'
  const disabledClassName = isDark ? 'disabled:opacity-45' : 'disabled:opacity-35'
  return (
    <div className={`h-[78px] w-36 ${className}`}>
      <div className="relative h-[78px] w-36">
        <div className={`absolute left-0 top-0 inline-flex h-12 w-36 overflow-hidden rounded-md border shadow-xl backdrop-blur ${surfaceClassName}`}>
          <button
            type="button"
            onClick={onZoomOut}
            aria-label={zoomOutLabel}
            title={zoomOutLabel}
            disabled={!canZoomOut}
            className={`flex h-12 w-12 items-center justify-center border-r text-xl font-black leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 disabled:cursor-not-allowed ${dividerClassName} ${hoverClassName} ${disabledClassName}`}
          >
            -
          </button>
          <button
            type="button"
            onClick={onReset}
            aria-label={resetLabel}
            title={resetLabel}
            disabled={!canReset}
            className={`flex h-12 w-12 items-center justify-center border-r transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-45 ${dividerClassName} ${hoverClassName}`}
          >
            <span
              aria-hidden="true"
              className="h-6 w-6 bg-current"
              style={{
                WebkitMask: `url(${resetZoomIconPng}) center / contain no-repeat`,
                mask: `url(${resetZoomIconPng}) center / contain no-repeat`,
              }}
            />
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            aria-label={zoomInLabel}
            title={zoomInLabel}
            className={`flex h-12 w-12 items-center justify-center text-xl font-black leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 ${hoverClassName}`}
          >
            +
          </button>
        </div>
        <div className={`absolute left-1/2 top-[54px] min-w-12 -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-center text-[11px] font-black leading-none shadow-lg backdrop-blur ${surfaceClassName}`}>
          {visiblePercentLabel}
        </div>
      </div>
    </div>
  )
})
