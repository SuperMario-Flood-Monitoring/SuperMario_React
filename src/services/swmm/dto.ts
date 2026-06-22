import type { EditorLayout } from '../../components/editor/editorTypes'

export type SwmmSourceOfTruth = 'SWMM'
export type SwmmFlowDirection = 'forward' | 'reverse'
export type SwmmBlockagesById = Record<string, number>

export interface ErrorResponse {
  ok: false
  message: string
  detail?: unknown
}

export interface HealthResponse {
  ok: boolean
  engine: string
}

export interface EngineControlRequest {
  rainfall?: number
  rainfallRatio?: number
  rainfallPercent?: number
  maxRainfallMmPerHour?: number
  speedMultiplier?: number
  blockagesById?: Record<string, unknown>
  exceptions?: Array<Record<string, unknown>>
}

export interface SwmmEngineControl extends EngineControlRequest {
  rainfallRatio: number
  blockagesById: SwmmBlockagesById
}

export interface SwmmRuntimeControlState {
  rainfallRatio: number
  rainfallPercent: number
  blockagesById: SwmmBlockagesById
  maxRainfallMmPerHour: number
  speedMultiplier: number
}

export interface EngineStatusResponse {
  ok: boolean
  running?: boolean
  paused?: boolean
  hasSession?: boolean
  stepIndex?: number
  stepSeconds?: number
  websocketClients?: number
}

export interface SwmmEngineStatus extends EngineStatusResponse {
  running: boolean
  paused: boolean
  hasSession: boolean
  stepIndex: number
  stepSeconds: number
  modelTime: string | null
  websocketClients: number
  lastError: string | null
  runId?: string | null
  tickLogPath?: string | null
  lastLogError?: string | null
  control: SwmmRuntimeControlState
}

export interface SwmmNodeState {
  depthM: number
  headM: number
  invertElevationM: number
  depthRatio: number
  totalInflowCms: number
  floodingCms: number
}

export interface SwmmLinkState {
  kind: string
  flowCms: number
  velocityMps: number
  depthM: number
  fullness: number
  capacityCms: number
  capacityRatio: number
  direction: SwmmFlowDirection
  targetSetting: number
  currentSetting: number
  blockageRatio: number
}

export interface SwmmEditorObjectState {
  maxDepthRatio?: number
  maxFullness?: number
  maxCapacityRatio?: number
  maxBlockageRatio?: number
  maxFloodingCms?: number
  flowCms?: number
  maxVelocityMps?: number
  totalInflowCms?: number
}

export interface SwmmSnapshotSummary {
  nodeCount: number
  linkCount: number
  rainfallTargetCount: number
  blockageTargetCount: number
  activeBlockageCount: number
}

export interface SwmmRealtimeSnapshot {
  type: string
  ok: boolean
  sourceOfTruth: SwmmSourceOfTruth
  runId?: string
  tickLogPath?: string
  source: string
  modelPath: string
  runtimeModelPath: string
  modelTime: string | null
  stepSeconds: number
  stepIndex: number
  control: SwmmRuntimeControlState
  nodes: Record<string, SwmmNodeState>
  links: Record<string, SwmmLinkState>
  editorObjects: Record<string, SwmmEditorObjectState>
  summary: SwmmSnapshotSummary
}

export interface EngineStartRequest {
  layout?: EditorLayout
  stepSeconds: number
  maxRainfallMmPerHour?: number
  control?: EngineControlRequest
}

export type EngineResetRequest = EngineStartRequest

export interface SwmmRuntimeStartRequest extends EngineStartRequest {
  layout: EditorLayout
  control: SwmmEngineControl
}

export interface EngineStartResponse {
  ok: boolean
  running: boolean
  status: SwmmEngineStatus
  report: unknown
  mapping: unknown
  snapshot: SwmmRealtimeSnapshot
}

export type SwmmRuntimeStartResponse = EngineStartResponse

export interface EngineControlResponse {
  ok: boolean
  control: SwmmRuntimeControlState
  snapshot: SwmmRealtimeSnapshot
}

export interface EditorConvertRequest {
  layout?: EditorLayout
  title?: string
  filename?: string
}

export interface EditorConvertResponse {
  ok: boolean
  inpText: string
  report: unknown
  mapping: unknown
}

export interface ScenarioCreateRequest {
  title: string
  description?: string
  layoutJson: EditorLayout
}

export interface ScenarioUpdateRequest {
  title?: string
  description?: string
  layoutJson?: EditorLayout
  isActive?: boolean
}

export interface ScenarioResponse {
  id: number
  title: string
  description: string
  layoutJson: EditorLayout
  version: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ScenarioListResponse {
  ok: boolean
  scenarios: ScenarioResponse[]
}

export interface ScenarioDetailResponse {
  ok: boolean
  scenario: ScenarioResponse
  message?: string
}

export type SwmmScenario = ScenarioResponse
export type SwmmScenarioListResponse = ScenarioListResponse
export type SwmmScenarioDetailResponse = ScenarioDetailResponse
export type SwmmScenarioSavePayload = ScenarioCreateRequest
