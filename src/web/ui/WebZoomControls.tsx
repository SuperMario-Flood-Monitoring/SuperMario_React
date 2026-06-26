import resetZoomIconPng from '../../assets/reset-zoom-arrow.png'

interface WebZoomControlsProps {
  className?: string
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

export function WebZoomControls({
  className = '',
  percentLabel,
  canZoomOut,
  canReset,
  zoomOutLabel = '축소',
  resetLabel = '확대 초기화',
  zoomInLabel = '확대',
  onZoomOut,
  onReset,
  onZoomIn,
}: WebZoomControlsProps) {
  return (
    <div className={`grid grid-cols-3 justify-items-center gap-y-1.5 ${className}`}>
      <div className="col-span-3 inline-flex h-12 overflow-hidden rounded-md border border-white/15 bg-slate-950/88 text-white shadow-xl backdrop-blur">
        <button
          type="button"
          onClick={onZoomOut}
          aria-label={zoomOutLabel}
          title={zoomOutLabel}
          disabled={!canZoomOut}
          className="flex h-12 w-12 items-center justify-center border-r border-white/10 text-xl font-black leading-none transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:text-slate-500 disabled:opacity-35"
        >
          -
        </button>
        <button
          type="button"
          onClick={onReset}
          aria-label={resetLabel}
          title={resetLabel}
          disabled={!canReset}
          className="flex h-12 w-12 items-center justify-center border-r border-white/10 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <img src={resetZoomIconPng} alt="" className="h-6 w-6" draggable={false} />
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          aria-label={zoomInLabel}
          title={zoomInLabel}
          className="flex h-12 w-12 items-center justify-center text-xl font-black leading-none transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300"
        >
          +
        </button>
      </div>
      <div className="col-start-2 min-w-12 rounded-md border border-white/15 bg-slate-950/88 px-2 py-1 text-center text-[11px] font-black leading-none text-white shadow-lg backdrop-blur">
        {percentLabel}
      </div>
    </div>
  )
}
