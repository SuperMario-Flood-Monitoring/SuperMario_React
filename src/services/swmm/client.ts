import type { EditorLayout } from '../../components/editor/editorTypes'
import type {
  EngineControlResponse,
  EngineStartRequest,
  SwmmEngineControl,
  SwmmEngineStatus,
  SwmmRuntimeStartResponse,
  SwmmScenario,
  SwmmScenarioDetailResponse,
  SwmmScenarioListResponse,
  SwmmScenarioSavePayload,
} from './dto'

export type {
  EditorConvertRequest,
  EditorConvertResponse,
  EngineControlRequest,
  EngineControlResponse,
  EngineResetRequest,
  EngineStartRequest,
  EngineStartResponse,
  EngineStatusResponse,
  ErrorResponse,
  HealthResponse,
  ScenarioCreateRequest,
  ScenarioDetailResponse,
  ScenarioListResponse,
  ScenarioResponse,
  ScenarioUpdateRequest,
  SwmmEditorObjectState,
  SwmmEngineControl,
  SwmmEngineStatus,
  SwmmLinkState,
  SwmmNodeState,
  SwmmRealtimeSnapshot,
  SwmmRuntimeControlState,
  SwmmRuntimeStartRequest,
  SwmmRuntimeStartResponse,
  SwmmScenario,
  SwmmScenarioDetailResponse,
  SwmmScenarioListResponse,
  SwmmScenarioSavePayload,
  SwmmSnapshotSummary,
} from './dto'

export function getSwmmWebSocketUrl(baseUrl: string) {
  const url = new URL(baseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/ws/simulation'
  url.search = ''
  url.hash = ''
  return url.toString()
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as { detail?: unknown; message?: string } | T | null
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload ? payload.detail : undefined
    const message = typeof detail === 'string'
      ? detail
      : payload && typeof payload === 'object' && 'message' in payload
        ? payload.message
        : `SWMM 엔진 요청이 실패했습니다. (${response.status})`
    throw new Error(message)
  }
  if (!payload) {
    throw new Error('SWMM 엔진 응답이 비어 있습니다.')
  }
  return payload as T
}

export async function getSwmmEngineStatus(baseUrl: string): Promise<SwmmEngineStatus> {
  const response = await fetch(`${baseUrl}/engine/status`)
  return parseJsonResponse<SwmmEngineStatus>(response)
}

export async function getSwmmScenarios(baseUrl: string): Promise<SwmmScenario[]> {
  const response = await fetch(`${baseUrl}/api/scenarios`)
  const payload = await parseJsonResponse<SwmmScenarioListResponse>(response)
  return payload.scenarios
}

export async function createSwmmScenario(
  baseUrl: string,
  payload: SwmmScenarioSavePayload,
): Promise<SwmmScenario> {
  const response = await fetch(`${baseUrl}/api/scenarios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const result = await parseJsonResponse<SwmmScenarioDetailResponse>(response)
  return result.scenario
}

export async function updateSwmmScenario(
  baseUrl: string,
  scenarioId: number,
  payload: Partial<SwmmScenarioSavePayload>,
): Promise<SwmmScenario> {
  const response = await fetch(`${baseUrl}/api/scenarios/${scenarioId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const result = await parseJsonResponse<SwmmScenarioDetailResponse>(response)
  return result.scenario
}

export async function startSwmmEngine(
  baseUrl: string,
  layout: EditorLayout,
  control: SwmmEngineControl,
): Promise<SwmmRuntimeStartResponse> {
  const body: EngineStartRequest = {
    layout,
    stepSeconds: 1,
    maxRainfallMmPerHour: control.maxRainfallMmPerHour,
    control,
  }
  const response = await fetch(`${baseUrl}/engine/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return parseJsonResponse<SwmmRuntimeStartResponse>(response)
}

export async function stopSwmmEngine(baseUrl: string): Promise<SwmmEngineStatus> {
  const response = await fetch(`${baseUrl}/engine/stop`, { method: 'POST' })
  return parseJsonResponse<SwmmEngineStatus>(response)
}

export async function pauseSwmmEngine(baseUrl: string): Promise<SwmmEngineStatus> {
  const response = await fetch(`${baseUrl}/engine/pause`, { method: 'POST' })
  return parseJsonResponse<SwmmEngineStatus>(response)
}

export async function resumeSwmmEngine(baseUrl: string): Promise<SwmmEngineStatus> {
  const response = await fetch(`${baseUrl}/engine/resume`, { method: 'POST' })
  return parseJsonResponse<SwmmEngineStatus>(response)
}

export async function resetSwmmEngine(
  baseUrl: string,
  layout: EditorLayout,
  control: SwmmEngineControl,
): Promise<SwmmRuntimeStartResponse> {
  const body: EngineStartRequest = {
    layout,
    stepSeconds: 1,
    maxRainfallMmPerHour: control.maxRainfallMmPerHour,
    control,
  }
  const response = await fetch(`${baseUrl}/engine/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return parseJsonResponse<SwmmRuntimeStartResponse>(response)
}

export async function updateSwmmEngineControl(
  baseUrl: string,
  control: SwmmEngineControl,
): Promise<EngineControlResponse> {
  const response = await fetch(`${baseUrl}/engine/control`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(control),
  })
  return parseJsonResponse(response)
}
