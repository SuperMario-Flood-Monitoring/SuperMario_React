import type { WorkbenchTheme } from '../theme/workbenchTheme'
import type { LandscapeModeSupport } from './mobileLandscape'

export function MobileLandscapeNotice({
  active,
  isMobileLike,
  isPortrait,
  landscapeModeSupport = 'supported',
  theme,
  title,
  body,
  onRetry,
}: {
  active: boolean
  isMobileLike: boolean
  isPortrait: boolean
  landscapeModeSupport?: LandscapeModeSupport
  theme: WorkbenchTheme
  title: string
  body: string
  onRetry: () => void | Promise<unknown>
}) {
  if (!active || !isMobileLike || !isPortrait) {
    return null
  }

  const isDark = theme === 'dark'
  const isUnsupported = landscapeModeSupport === 'unsupported'

  return (
    <div
      className={`fixed inset-x-3 top-3 z-[120] rounded-lg border px-4 py-3 shadow-2xl backdrop-blur ${
        isDark
          ? 'border-sky-500/40 bg-slate-950/92 text-slate-100'
          : 'border-sky-200 bg-white/95 text-slate-950'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-black">
            {isUnsupported ? '자동 가로모드를 지원하지 않는 브라우저입니다.' : title}
          </div>
          <div className={`mt-1 text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
            {isUnsupported ? '기기를 직접 가로로 돌린 뒤 전체화면을 사용해주세요.' : body}
          </div>
        </div>
        {!isUnsupported ? (
          <button
            type="button"
            onClick={onRetry}
            className={`rounded-md border px-3 py-2 text-xs font-black ${
              isDark
                ? 'border-sky-500/50 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25'
                : 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100'
            }`}
          >
            가로 모드 다시 시도
          </button>
        ) : null}
      </div>
    </div>
  )
}
