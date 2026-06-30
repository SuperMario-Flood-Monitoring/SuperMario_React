import type { SwmmRealtimeAlertPayload } from '../../services/swmm/client'

export const RUNTIME_ALERT_TOAST_DURATION_MS = 8000
export const RUNTIME_ALERT_REPEAT_GAP_MS = 30000

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isRuntimeAlertPayload(value: unknown): value is SwmmRealtimeAlertPayload {
  return (
    isRecordValue(value)
    && typeof value.kind === 'string'
    && typeof value.severity === 'string'
    && typeof value.title === 'string'
    && typeof value.message === 'string'
  )
}

export function runtimeAlertKey(alert: SwmmRealtimeAlertPayload) {
  return alert.key || `${alert.kind}:${alert.reason ?? ''}:${alert.message}`
}
