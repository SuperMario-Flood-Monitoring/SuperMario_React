import type { SwmmRealtimeAlertPayload } from '../../services/swmm/client'

export function RuntimeAlertToast({
  alert,
  onDismiss,
}: {
  alert: SwmmRealtimeAlertPayload | null
  onDismiss: () => void
}) {
  if (!alert) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[240] flex justify-center px-4">
      <div
        role="alert"
        className="pointer-events-auto w-full max-w-xl rounded-md border border-red-300 bg-red-600 px-4 py-3 text-white shadow-[0_20px_60px_rgba(185,28,28,0.42)]"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-black leading-5">{alert.title || '지속적인 이상 현상 감지'}</p>
            <p className="mt-1 break-words text-xs font-bold leading-5 text-red-50">
              {alert.message || '지속적인 이상 현상이 감지되었습니다. 관로/시설 상태를 확인해주세요.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-md border border-red-200/70 px-2 py-1 text-[11px] font-black text-red-50 transition hover:bg-red-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
