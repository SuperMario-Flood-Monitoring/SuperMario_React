import type { EditorLayout } from '../../shared/editor/editorTypes'
import { apiClient, joinApiUrl } from '../http/apiClient'
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
  SwmmLlmTriggerPayload,
  SwmmLinkState,
  SwmmNodeState,
  SwmmRealtimeSnapshot,
  SwmmRiskEvent,
  SwmmRiskPayload,
  SwmmRiskSeverity,
  SwmmRuntimeControlState,
  SwmmRuntimeStartRequest,
  SwmmRuntimeStartResponse,
  SwmmScenario,
  SwmmScenarioDetailResponse,
  SwmmScenarioListResponse,
  SwmmScenarioSavePayload,
  SwmmSnapshotSummary,
} from './dto'

export function joinSwmmApiUrl(baseUrl: string, path: string) {
  return joinApiUrl(baseUrl, path)
}

export function getSwmmWebSocketUrl(baseUrl: string) {
  const url = new URL(baseUrl || '/', window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = joinSwmmApiUrl(url.pathname, '/ws/simulation')
  url.search = ''
  url.hash = ''
  return url.toString()
}

function requirePayload<T>(payload: T | null | undefined): T {
  if (!payload) {
    throw new Error('SWMM 엔진 응답이 비어 있습니다.')
  }
  return payload
}

export async function getSwmmEngineStatus(baseUrl: string): Promise<SwmmEngineStatus> {
  const response = await apiClient.get<SwmmEngineStatus>(joinSwmmApiUrl(baseUrl, '/engine/status'))
  return requirePayload(response.data)
}

export async function getSwmmScenarios(baseUrl: string): Promise<SwmmScenario[]> {
  const response = await apiClient.get<SwmmScenarioListResponse>(joinSwmmApiUrl(baseUrl, '/scenarios'))
  const payload = requirePayload(response.data)
  return payload.scenarios
}

export async function createSwmmScenario(
  baseUrl: string,
  payload: SwmmScenarioSavePayload,
): Promise<SwmmScenario> {
  const response = await apiClient.post<SwmmScenarioDetailResponse>(
    joinSwmmApiUrl(baseUrl, '/scenarios'),
    payload,
  )
  const result = requirePayload(response.data)
  return result.scenario
}

export async function updateSwmmScenario(
  baseUrl: string,
  scenarioId: number,
  payload: Partial<SwmmScenarioSavePayload>,
): Promise<SwmmScenario> {
  const response = await apiClient.put<SwmmScenarioDetailResponse>(
    joinSwmmApiUrl(baseUrl, `/scenarios/${scenarioId}`),
    payload,
  )
  const result = requirePayload(response.data)
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
  const response = await apiClient.post<SwmmRuntimeStartResponse>(joinSwmmApiUrl(baseUrl, '/engine/start'), body)
  return requirePayload(response.data)
}

export async function stopSwmmEngine(baseUrl: string): Promise<SwmmEngineStatus> {
  const response = await apiClient.post<SwmmEngineStatus>(joinSwmmApiUrl(baseUrl, '/engine/stop'))
  return requirePayload(response.data)
}

export async function pauseSwmmEngine(baseUrl: string): Promise<SwmmEngineStatus> {
  const response = await apiClient.post<SwmmEngineStatus>(joinSwmmApiUrl(baseUrl, '/engine/pause'))
  return requirePayload(response.data)
}

export async function resumeSwmmEngine(baseUrl: string): Promise<SwmmEngineStatus> {
  const response = await apiClient.post<SwmmEngineStatus>(joinSwmmApiUrl(baseUrl, '/engine/resume'))
  return requirePayload(response.data)
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
  const response = await apiClient.post<SwmmRuntimeStartResponse>(joinSwmmApiUrl(baseUrl, '/engine/reset'), body)
  return requirePayload(response.data)
}

export async function updateSwmmEngineControl(
  baseUrl: string,
  control: SwmmEngineControl,
): Promise<EngineControlResponse> {
  const response = await apiClient.post<EngineControlResponse>(joinSwmmApiUrl(baseUrl, '/engine/control'), control)
  return requirePayload(response.data)
}
