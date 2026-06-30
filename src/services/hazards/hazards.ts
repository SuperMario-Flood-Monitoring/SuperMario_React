import { API_BASE_URL, apiClient, joinApiUrl } from '../http/apiClient'

export type HazardDisplayStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'

export interface HazardLogRecord {
  id: number
  targetId: string
  pipeId: string | null
  source: string
  hazardLevel: string
  hazardType: string
  hazardDetail: string
  status: HazardDisplayStatus
  priorityScore: number
  priorityBand: string
  priorityReasons: string[]
  createdAt: string
  actionDetail?: string
  resultDetail?: string
  recurrenceNote?: string
}

export interface HazardActionRecord {
  id: number
  eventId: number
  actionDetail: string
  actionType: string
  resultDetail: string
  resultStatus: string
  recurrenceNote: string
}

export interface HazardLogDetail extends HazardLogRecord {
  runId: string | null
  stepIndex: number | null
  modelTime: string | null
  metricsSnapshot: Record<string, unknown>
  actions: HazardActionRecord[]
}

export interface StartHazardActionInput {
  actionDetail: string
  actionType?: string
}

export interface CompleteHazardActionInput {
  resultDetail: string
  recurrenceNote?: string
  resultStatus?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toStringValue(value: unknown, fallback = '') {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return fallback
}

function toNullableString(value: unknown) {
  const nextValue = toStringValue(value)
  return nextValue || null
}

function toNumberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeStatus(value: unknown): HazardDisplayStatus {
  if (value === 'IN_PROGRESS' || value === 'RESOLVED') {
    return value
  }

  return 'OPEN'
}

function normalizePriorityReasons(value: unknown) {
  return Array.isArray(value) ? value.map(String) : []
}

function normalizeHazardLog(value: unknown): HazardLogRecord | null {
  if (!isRecord(value)) {
    return null
  }

  const id = toNumberValue(value.id, Number.NaN)
  if (!Number.isFinite(id)) {
    return null
  }

  return {
    id,
    targetId: toStringValue(value.target_id ?? value.targetId, '-'),
    pipeId: toNullableString(value.pipe_id ?? value.pipeId),
    source: toStringValue(value.source, '-'),
    hazardLevel: toStringValue(value.hazard_level ?? value.hazardLevel, '-'),
    hazardType: toStringValue(value.hazard_type ?? value.hazardType, '-'),
    hazardDetail: toStringValue(value.hazard_detail ?? value.hazardDetail, '-'),
    status: normalizeStatus(value.status),
    priorityScore: toNumberValue(value.priorityScore ?? value.priority_score),
    priorityBand: toStringValue(value.priorityBand ?? value.priority_band, '-'),
    priorityReasons: normalizePriorityReasons(value.priorityReasons ?? value.priority_reasons),
    createdAt: toStringValue(value.created_at ?? value.createdAt),
    actionDetail: toStringValue(value.action_detail ?? value.actionDetail) || undefined,
    resultDetail: toStringValue(value.result_detail ?? value.resultDetail) || undefined,
    recurrenceNote: toStringValue(value.recurrence_note ?? value.recurrenceNote) || undefined,
  }
}

function normalizeHazardAction(value: unknown): HazardActionRecord | null {
  if (!isRecord(value)) {
    return null
  }

  const id = toNumberValue(value.id, Number.NaN)
  if (!Number.isFinite(id)) {
    return null
  }

  return {
    id,
    eventId: toNumberValue(value.event_id ?? value.eventId),
    actionDetail: toStringValue(value.action_detail ?? value.actionDetail),
    actionType: toStringValue(value.action_type ?? value.actionType),
    resultDetail: toStringValue(value.result_detail ?? value.resultDetail),
    resultStatus: toStringValue(value.result_status ?? value.resultStatus),
    recurrenceNote: toStringValue(value.recurrence_note ?? value.recurrenceNote),
  }
}

function extractHazardList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (!isRecord(payload)) {
    return []
  }

  const candidates = [payload.hazards, payload.items, payload.results, payload.data, payload.logs]
  const listPayload = candidates.find(Array.isArray)
  return Array.isArray(listPayload) ? listPayload : []
}

function extractHazardRecord(payload: unknown): Record<string, unknown> {
  if (isRecord(payload) && typeof payload.id !== 'undefined') {
    return payload
  }

  if (isRecord(payload)) {
    const candidates = [payload.hazard, payload.event, payload.action, payload.item, payload.result, payload.data]
    const detailPayload = candidates.find(isRecord)
    if (detailPayload) {
      return detailPayload
    }
  }

  throw new Error('위험 로그 응답 형식이 올바르지 않습니다.')
}

function normalizeHazardDetail(payload: unknown): HazardLogDetail {
  const record = extractHazardRecord(payload)
  const base = normalizeHazardLog(record)
  if (!base) {
    throw new Error('위험 로그 응답 형식이 올바르지 않습니다.')
  }

  const rawMetricsSnapshot = record.metrics_snapshot ?? record.metricsSnapshot
  const metricsSnapshot = isRecord(rawMetricsSnapshot) ? rawMetricsSnapshot : {}

  return {
    ...base,
    runId: toNullableString(record.run_id ?? record.runId),
    stepIndex: Number.isFinite(toNumberValue(record.step_index ?? record.stepIndex, Number.NaN))
      ? toNumberValue(record.step_index ?? record.stepIndex)
      : null,
    modelTime: toNullableString(record.model_time ?? record.modelTime),
    metricsSnapshot,
    actions: Array.isArray(record.actions)
      ? record.actions.map(normalizeHazardAction).filter((item): item is HazardActionRecord => Boolean(item))
      : [],
  }
}

function normalizeActionPayload(payload: unknown): HazardActionRecord {
  const record = isRecord(payload)
    ? extractHazardRecord(payload)
    : null
  const action = normalizeHazardAction(record)
  if (!action) {
    throw new Error('위험 조치 응답 형식이 올바르지 않습니다.')
  }
  return action
}

export async function listHazardLogs() {
  const response = await apiClient.get<unknown>(
    joinApiUrl(API_BASE_URL, '/api/hazards'),
  )

  return extractHazardList(response.data)
    .map(normalizeHazardLog)
    .filter((item): item is HazardLogRecord => Boolean(item))
}

export async function getHazardLogDetail(hazardId: number) {
  const response = await apiClient.get<unknown>(
    joinApiUrl(API_BASE_URL, `/api/hazards/${encodeURIComponent(String(hazardId))}`),
  )

  return normalizeHazardDetail(response.data)
}

export async function startHazardAction(hazardId: number, input: StartHazardActionInput) {
  const response = await apiClient.post<unknown>(
    joinApiUrl(API_BASE_URL, `/api/hazards/${encodeURIComponent(String(hazardId))}/actions`),
    {
      action_detail: input.actionDetail.trim(),
      action_type: input.actionType?.trim() || 'FIELD_CHECK',
    },
  )

  return normalizeActionPayload(response.data)
}

export async function completeHazardAction(
  hazardId: number,
  actionId: number,
  input: CompleteHazardActionInput,
) {
  const response = await apiClient.patch<unknown>(
    joinApiUrl(API_BASE_URL, `/api/hazards/${encodeURIComponent(String(hazardId))}/actions/${encodeURIComponent(String(actionId))}`),
    {
      result_detail: input.resultDetail.trim(),
      result_status: input.resultStatus?.trim() || 'RESOLVED',
      recurrence_note: input.recurrenceNote?.trim() || '',
    },
  )

  return normalizeActionPayload(response.data)
}
