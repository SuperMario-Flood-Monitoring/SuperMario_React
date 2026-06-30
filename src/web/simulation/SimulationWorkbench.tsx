import {
  type ChangeEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createDefaultEditorLayout } from '../editor/defaultLayout'
import { PIPE_KIND_LABELS, SWMM_ENGINE_URL } from '../editor/editorDefinitions'
import { normalizeRelationAttachments } from '../editor/editorRelations'
import { getNodePipeKind } from '../editor/editorNodeHelpers'
import { isEditorLayout, loadEditorLayout, saveEditorLayout } from '../editor/layoutStorage'
import type { EditorLayout } from '../editor/editorTypes'
import { getInitialAppSurface, subscribeAppSurfaceChange } from '../../app/deviceSurface'
import {
  getSwmmScenarios,
  getSwmmEngineStatus,
  getSwmmWebSocketUrl,
  pauseSwmmEngine,
  resumeSwmmEngine,
  startSwmmEngine,
  stopSwmmEngine,
  updateSwmmEngineControl,
  type SwmmEngineControl,
  type SwmmEngineStatus,
  type SwmmRealtimeSnapshot,
  type SwmmScenario,
} from '../../services/swmm/client'
import {
  clearSelectedSwmmScenarioId,
  loadSelectedSwmmScenarioId,
  saveSelectedSwmmScenarioId,
} from '../../services/swmm/scenarioSelectionStorage'
import {
  asSwmmRuntimeMapping,
  buildSwmmRuntimeControl,
  clampPercent,
  isRealtimeSnapshot,
  isRecordValue,
  numericControlValue,
  type SwmmRuntimeMapping,
} from '../../services/swmm/editorRuntime'
import { useMobileLandscapePreference } from '../layout/mobileLandscape'
import { useLayoutIndexes } from '../diagram/useLayoutIndexes'
import { SimulationLayoutPreview } from './SimulationLayoutPreview'
import { downloadSvgAsPng } from './pngExport'
import { WORKBENCH_THEME_TOKENS, type WorkbenchTheme } from '../theme/workbenchTheme'
import { GearIcon } from '../ui/WebIcons'
import { WebPortal } from '../ui/WebPortal'
import { WebZoomControls } from '../ui/WebZoomControls'

interface RuntimeReport {
  ok: boolean
  counts: Record<string, number>
  warnings: string[]
  errors: string[]
  dynamicControls?: {
    rainfallTargets?: string[]
    blockageTargets?: Array<{
      swmmLinkId: string
      sourceEditorId?: string
      sourceEditorName?: string
      pipeKind?: string
    }>
  }
}

type BlockageTarget = NonNullable<NonNullable<RuntimeReport['dynamicControls']>['blockageTargets']>[number]

type SimulationLayoutSource = 'localStorage' | 'default' | 'scenario' | 'imported'

interface LoadedSimulationLayout {
  layout: EditorLayout
  source: SimulationLayoutSource
  scenarioId?: number
  scenarioTitle?: string
  scenarioVersion?: number
}

const SIMULATION_SPEED_OPTIONS = [1, 2, 3, 4, 10] as const
const RAINFALL_PRESET_OPTIONS = [
  { label: '맑음', value: 0 },
  { label: '우천', value: 10 },
  { label: '호우', value: 100 },
  { label: '폭우', value: 300 },
] as const
const RAINFALL_TEST_SLIDER_MAX = 300
const RAINFALL_TEST_SLIDER_STEP = 10
const FULLSCREEN_ZOOM_MIN = 1
const FULLSCREEN_ZOOM_STEP = 0.25

function forwardBackgroundWheelToElementBelow(event: ReactWheelEvent<HTMLElement>) {
  if (event.target !== event.currentTarget) {
    return
  }

  const overlay = event.currentTarget
  const previousPointerEvents = overlay.style.pointerEvents
  overlay.style.pointerEvents = 'none'
  const target = document.elementFromPoint(event.clientX, event.clientY)
  overlay.style.pointerEvents = previousPointerEvents

  if (!target || target === overlay || overlay.contains(target)) {
    return
  }

  event.preventDefault()
  const nativeEvent = event.nativeEvent
  target.dispatchEvent(new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaX: nativeEvent.deltaX,
    deltaY: nativeEvent.deltaY,
    deltaZ: nativeEvent.deltaZ,
    deltaMode: nativeEvent.deltaMode,
    clientX: nativeEvent.clientX,
    clientY: nativeEvent.clientY,
    screenX: nativeEvent.screenX,
    screenY: nativeEvent.screenY,
    ctrlKey: nativeEvent.ctrlKey,
    metaKey: nativeEvent.metaKey,
    shiftKey: nativeEvent.shiftKey,
    altKey: nativeEvent.altKey,
  }))
}

const NODE_TYPE_LABELS: Record<string, string> = {
  apartment: '아파트',
  catchBasin: '빗물받이',
  connector: '커넥터',
  elbowConnector: 'ㄱ자 커넥터',
  facility: '시설',
  house: '주거지',
  manhole: '맨홀',
  outfall: '방류구',
  pipeSegment: '관',
  road: '도로',
  teeConnector: 'T자 커넥터',
  terrain: '지형',
}

/** 시뮬레이션 시작 시 localStorage 저장본이 있으면 우선 사용하고 없으면 기본 layout을 사용한다. */
function loadSavedLayout(): LoadedSimulationLayout {
  const savedLayout = loadEditorLayout()
  if (savedLayout) {
    return {
      layout: savedLayout,
      source: 'localStorage',
    }
  }

  return {
    layout: createDefaultEditorLayout(),
    source: 'default',
  }
}

function RainfallPresetButtons({
  value,
  onChange,
  isDark,
}: {
  value: number
  onChange: (value: number) => void
  isDark: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      {RAINFALL_PRESET_OPTIONS.map((option) => {
        const isActive = Math.round(value) === option.value

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-2 text-xs font-black leading-none transition ${
              isActive
                ? isDark
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-900 text-white shadow-sm'
                : isDark
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function RainfallTestSlider({
  value,
  onChange,
  isDark,
}: {
  value: number
  onChange: (value: number) => void
  isDark: boolean
}) {
  const clampedValue = Math.max(0, Math.min(RAINFALL_TEST_SLIDER_MAX, Math.round(value)))

  return (
    <label className="mt-3 block">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-black ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>강수 비율</span>
        <span className={`rounded-full px-2 py-1 text-[11px] font-black ${isDark ? 'bg-slate-950 text-blue-200' : 'bg-white text-slate-700'}`}>
          {clampedValue}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={RAINFALL_TEST_SLIDER_MAX}
        step={RAINFALL_TEST_SLIDER_STEP}
        value={clampedValue}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="mt-2 w-full accent-blue-600"
      />
      <div className={`mt-1 flex items-center justify-between text-[10px] font-black ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        <span>0</span>
        <span>10</span>
        <span>100</span>
        <span>300</span>
      </div>
    </label>
  )
}

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 5v14l11-7Z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    >
      <path d="M8 5v14" />
      <path d="M16 5v14" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="currentColor"
    >
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
    </svg>
  )
}

function MinimizeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 4v5H4" />
      <path d="M15 4v5h5" />
      <path d="M20 15h-5v5" />
      <path d="M4 15h5v5" />
    </svg>
  )
}

/** undefined/NaN 값을 대시로 표시하는 숫자 포맷 helper다. */
function formatNumber(value: number | undefined, digits = 3) {
  if (value === undefined || !Number.isFinite(value)) {
    return '-'
  }
  return value.toFixed(digits)
}

/** 0~1 비율 값을 소수점 포함 퍼센트 문자열로 표시한다. */
function formatPrecisePercent(value: number | undefined, digits = 2) {
  if (value === undefined || !Number.isFinite(value)) {
    return '-'
  }
  return `${(value * 100).toFixed(digits)}%`
}

/** 현재 시뮬레이션 layout이 어디에서 왔는지 패널에 표시할 문자열로 만든다. */
function getLayoutSourceLabel(loadedLayout: LoadedSimulationLayout) {
  if (loadedLayout.source === 'scenario') {
    return loadedLayout.scenarioTitle
      ? `scenario #${loadedLayout.scenarioId} / ${loadedLayout.scenarioTitle} v${loadedLayout.scenarioVersion ?? 1}`
      : `scenario #${loadedLayout.scenarioId ?? '-'}`
  }
  if (loadedLayout.source === 'imported') {
    return 'imported JSON'
  }
  return loadedLayout.source === 'localStorage' ? 'localStorage' : 'default fallback'
}

/** 정수 퍼센트와 세부 퍼센트를 함께 표시한다. */
function formatPercentWithDetail(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return '-'
  }
  return `${Math.round(value * 100)}% (${(value * 100).toFixed(2)}%)`
}

/** editor node type을 한국어 표시명으로 변환한다. */
function getNodeTypeLabel(type: string) {
  return NODE_TYPE_LABELS[type] ?? type
}

/** 서버 응답의 알 수 없는 report payload를 화면에서 쓰는 RuntimeReport 형태로 정규화한다. */
function runtimeReportFromUnknown(value: unknown): RuntimeReport | null {
  if (!isRecordValue(value) || !isRecordValue(value.counts)) {
    return null
  }
  return {
    ok: Boolean(value.ok),
    counts: Object.fromEntries(
      Object.entries(value.counts).map(([key, entryValue]) => [key, numericControlValue(entryValue)]),
    ),
    warnings: Array.isArray(value.warnings) ? value.warnings.map(String) : [],
    errors: Array.isArray(value.errors) ? value.errors.map(String) : [],
    dynamicControls: isRecordValue(value.dynamicControls)
      ? {
        rainfallTargets: Array.isArray(value.dynamicControls.rainfallTargets)
          ? value.dynamicControls.rainfallTargets.map(String)
          : [],
        blockageTargets: Array.isArray(value.dynamicControls.blockageTargets)
          ? value.dynamicControls.blockageTargets
            .filter(isRecordValue)
            .map((target) => ({
              swmmLinkId: String(target.swmmLinkId ?? ''),
              sourceEditorId: target.sourceEditorId === undefined ? undefined : String(target.sourceEditorId),
              sourceEditorName: target.sourceEditorName === undefined ? undefined : String(target.sourceEditorName),
              pipeKind: target.pipeKind === undefined ? undefined : String(target.pipeKind),
            }))
            .filter((target) => target.swmmLinkId)
          : [],
      }
      : undefined,
  }
}

/** editor object 기준 막힘 값을 SWMM link id 기준 막힘 payload로 합친다. */
function mergeEditorBlockagesIntoSwmmBlockages(
  manualBlockagesById: Record<string, number>,
  manualBlockagesByEditorId: Record<string, number>,
  blockageTargets: BlockageTarget[],
) {
  const next: Record<string, number> = { ...manualBlockagesById }

  blockageTargets.forEach((target) => {
    if (!target.sourceEditorId) {
      return
    }
    const editorBlockage = manualBlockagesByEditorId[target.sourceEditorId]
    if (editorBlockage === undefined) {
      return
    }
    const blockage = clampPercent(editorBlockage)
    if (blockage > 0) {
      next[target.swmmLinkId] = blockage
    } else {
      next[target.swmmLinkId] = 0
    }
  })

  return next
}

/** WebSocket으로 들어온 status payload를 기존 status fallback과 합쳐 안정적인 상태 객체로 만든다. */
function statusFromSocketPayload(payload: Record<string, unknown>, currentStatus: SwmmEngineStatus | null): SwmmEngineStatus {
  const payloadControl = isRecordValue(payload.control) ? payload.control : null
  const fallbackControl = currentStatus?.control ?? {
    rainfallRatio: 0,
    rainfallPercent: 0,
    blockagesById: {},
    maxRainfallMmPerHour: 100,
    speedMultiplier: 1,
  }

  return {
    ok: true,
    running: Boolean(payload.running),
    paused: Boolean(payload.paused),
    hasSession: Boolean(payload.hasSession),
    stepIndex: numericControlValue(payload.stepIndex),
    stepSeconds: numericControlValue(payload.stepSeconds) || 1,
    modelTime: typeof payload.modelTime === 'string' ? payload.modelTime : null,
    websocketClients: numericControlValue(payload.websocketClients),
    lastError: typeof payload.lastError === 'string' ? payload.lastError : null,
    runId: typeof payload.runId === 'string' ? payload.runId : currentStatus?.runId ?? null,
    tickLogPath: typeof payload.tickLogPath === 'string' ? payload.tickLogPath : currentStatus?.tickLogPath ?? null,
    lastLogError: typeof payload.lastLogError === 'string' ? payload.lastLogError : currentStatus?.lastLogError ?? null,
    control: {
      rainfallRatio: payloadControl ? numericControlValue(payloadControl.rainfallRatio) : fallbackControl.rainfallRatio,
      rainfallPercent: payloadControl ? numericControlValue(payloadControl.rainfallPercent) : fallbackControl.rainfallPercent,
      blockagesById: isRecordValue(payloadControl?.blockagesById)
        ? Object.fromEntries(
          Object.entries(payloadControl.blockagesById).map(([key, value]) => [key, numericControlValue(value)]),
        )
        : fallbackControl.blockagesById,
      maxRainfallMmPerHour: payloadControl
        ? numericControlValue(payloadControl.maxRainfallMmPerHour) || fallbackControl.maxRainfallMmPerHour
        : fallbackControl.maxRainfallMmPerHour,
      speedMultiplier: payloadControl
        ? numericControlValue(payloadControl.speedMultiplier) || fallbackControl.speedMultiplier
        : fallbackControl.speedMultiplier,
    },
  }
}

/** 실행 정보 패널의 작은 통계 셀을 렌더링한다. */
function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="runtime-stat-cell rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] font-black uppercase text-slate-400">{label}</div>
      <div className="mt-1 break-words text-sm font-black text-slate-800">{value}</div>
    </div>
  )
}

/** 실시간 SWMM 엔진 제어, 시나리오 선택, runtime snapshot 렌더링을 조립하는 시뮬레이션 화면이다. */
export const SimulationWorkbench = memo(function SimulationWorkbench({
  theme = 'light',
  renderHeader,
  fullscreenRouteActive = false,
  onFullscreenRouteChange,
}: {
  theme?: WorkbenchTheme
  renderHeader?: () => ReactNode
  fullscreenRouteActive?: boolean
  onFullscreenRouteChange?: (active: boolean) => void
}) {
  const isDark = theme === 'dark'
  const themeTokens = WORKBENCH_THEME_TOKENS[theme]
  const [loadedLayout, setLoadedLayout] = useState<LoadedSimulationLayout>(() => loadSavedLayout())
  const [scenarios, setScenarios] = useState<SwmmScenario[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null)
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false)
  const [scenarioError, setScenarioError] = useState<string | null>(null)
  const [status, setStatus] = useState<SwmmEngineStatus | null>(null)
  const [snapshot, setSnapshot] = useState<SwmmRealtimeSnapshot | null>(null)
  const [runtimeMapping, setRuntimeMapping] = useState<SwmmRuntimeMapping | null>(null)
  const [runtimeReport, setRuntimeReport] = useState<RuntimeReport | null>(null)
  const [rainfallPercent, setRainfallPercent] = useState(0)
  const [speedMultiplier, setSpeedMultiplier] = useState(1)
  const [isScenarioSettingsOpen, setIsScenarioSettingsOpen] = useState(false)
  const [isNodeStatsOpen, setIsNodeStatsOpen] = useState(false)
  const [internalFullscreen, setInternalFullscreen] = useState(false)
  const isFullscreen = onFullscreenRouteChange ? fullscreenRouteActive : internalFullscreen
  const [fullscreenZoom, setFullscreenZoom] = useState(FULLSCREEN_ZOOM_MIN)
  const [fullscreenViewResetSignal, setFullscreenViewResetSignal] = useState(0)
  const [isMobileInput, setIsMobileInput] = useState(() => getInitialAppSurface() === 'mobile')
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false)
  const [selectedBlockageId, setSelectedBlockageId] = useState('')
  const [selectedPreviewNodeId, setSelectedPreviewNodeId] = useState('')
  const [manualBlockagesById, setManualBlockagesById] = useState<Record<string, number>>({})
  const [manualBlockagesByEditorId, setManualBlockagesByEditorId] = useState<Record<string, number>>({})
  const [isSocketConnected, setIsSocketConnected] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isPausing, setIsPausing] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isExportingPng, setIsExportingPng] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const autoApplyTimerRef = useRef<number | null>(null)
  const layoutFileInputRef = useRef<HTMLInputElement | null>(null)
  const previewSelectionClearedRef = useRef(false)
  const runtimeSheetDragStartYRef = useRef<number | null>(null)

  useEffect(() => {
    const root = document.documentElement

    const updateVisualViewportVars = () => {
      const visualViewport = window.visualViewport
      const height = visualViewport?.height ?? window.innerHeight
      const offsetTop = visualViewport?.offsetTop ?? 0
      const bottomInset = Math.max(0, window.innerHeight - height - offsetTop)

      root.style.setProperty('--app-visual-height', `${height}px`)
      root.style.setProperty('--app-visual-offset-top', `${offsetTop}px`)
      root.style.setProperty('--app-visual-bottom-inset', `${bottomInset}px`)
    }

    updateVisualViewportVars()
    window.addEventListener('resize', updateVisualViewportVars)
    window.visualViewport?.addEventListener('resize', updateVisualViewportVars)
    window.visualViewport?.addEventListener('scroll', updateVisualViewportVars)

    return () => {
      window.removeEventListener('resize', updateVisualViewportVars)
      window.visualViewport?.removeEventListener('resize', updateVisualViewportVars)
      window.visualViewport?.removeEventListener('scroll', updateVisualViewportVars)
    }
  }, [])

  const layout = loadedLayout.layout
  const layoutSource = loadedLayout.source
  const hasActiveSimulationLayout = loadedLayout.source === 'imported' || (
    loadedLayout.source === 'scenario' && selectedScenarioId !== null
  )
  const shouldShowScenarioPrompt = !status?.hasSession && !hasActiveSimulationLayout
  const exportLayout = useMemo(() => normalizeRelationAttachments(layout), [layout])
  const { nodesById } = useLayoutIndexes(exportLayout)
  const blockageTargets = useMemo(
    () => runtimeReport?.dynamicControls?.blockageTargets ?? [],
    [runtimeReport?.dynamicControls?.blockageTargets],
  )
  const selectedPreviewNode = useMemo(
    () => nodesById.get(selectedPreviewNodeId) ?? null,
    [nodesById, selectedPreviewNodeId],
  )
  const selectedPreviewState = selectedPreviewNode ? snapshot?.editorObjects[selectedPreviewNode.id] : undefined
  const {
    landscapeModeSupport,
    requestLandscape,
  } = useMobileLandscapePreference(isFullscreen)
  const requestFullscreenRoute = useCallback((nextFullscreen: boolean) => {
    if (nextFullscreen && landscapeModeSupport === 'supported') {
      void requestLandscape()
    }

    if (onFullscreenRouteChange) {
      onFullscreenRouteChange(nextFullscreen)
      return
    }

    setInternalFullscreen(nextFullscreen)
  }, [landscapeModeSupport, onFullscreenRouteChange, requestLandscape])
  const toggleFullscreen = useCallback(() => {
    requestFullscreenRoute(!isFullscreen)
  }, [isFullscreen, requestFullscreenRoute])
  useEffect(() => {
    if (!isFullscreen || isMobileInput) {
      return undefined
    }

    const handleEscapeFullscreen = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      requestFullscreenRoute(false)
    }

    window.addEventListener('keydown', handleEscapeFullscreen)
    return () => window.removeEventListener('keydown', handleEscapeFullscreen)
  }, [isFullscreen, isMobileInput, requestFullscreenRoute])
  const handleSelectPreviewNode = useCallback((nodeId: string, targetSwmmId?: string) => {
    previewSelectionClearedRef.current = !targetSwmmId
    setSelectedPreviewNodeId(nodeId)
    if (!targetSwmmId) {
      setSelectedBlockageId('')
    }
    setIsInfoPanelOpen(true)
  }, [])
  const handleSelectBlockageTarget = useCallback((swmmLinkId: string) => {
    previewSelectionClearedRef.current = false
    setSelectedBlockageId(swmmLinkId)
    setIsInfoPanelOpen(true)
  }, [])
  const handleClearPreviewSelection = useCallback(() => {
    previewSelectionClearedRef.current = true
    setSelectedPreviewNodeId('')
    setSelectedBlockageId('')
  }, [])
  const selectedPreviewTarget = selectedPreviewNode
    ? blockageTargets.find((target) => target.sourceEditorId === selectedPreviewNode.id) ?? null
    : null
  const selectedPreviewBlockageTargets = useMemo(() => {
    if (!selectedPreviewTarget) {
      if (selectedPreviewNode) {
        return []
      }
      return selectedBlockageId
        ? blockageTargets.filter((target) => target.swmmLinkId === selectedBlockageId)
        : []
    }
    return selectedPreviewTarget.sourceEditorId
      ? blockageTargets.filter((target) => target.sourceEditorId === selectedPreviewTarget.sourceEditorId)
      : [selectedPreviewTarget]
  }, [blockageTargets, selectedBlockageId, selectedPreviewNode, selectedPreviewTarget])
  const selectedPendingEditorBlockage = selectedPreviewNode
    ? manualBlockagesByEditorId[selectedPreviewNode.id] ?? clampPercent(selectedPreviewNode.props.blockage)
    : 0
  const selectedPreviewBlockageValue = selectedPreviewBlockageTargets.length > 0
    ? Math.max(...selectedPreviewBlockageTargets.map((target) => (
      manualBlockagesById[target.swmmLinkId]
      ?? (target.sourceEditorId ? manualBlockagesByEditorId[target.sourceEditorId] : undefined)
      ?? (target.sourceEditorId ? clampPercent(nodesById.get(target.sourceEditorId)?.props.blockage) : undefined)
      ?? 0
    )))
    : selectedPendingEditorBlockage
  const canEditSelectedBlockage = Boolean(selectedPreviewNode || selectedPreviewBlockageTargets.length > 0)
  const selectedPreviewSwmmLinks = useMemo(() => {
    if (!selectedPreviewNode || !runtimeMapping?.swmmLinks) {
      return []
    }
    return Object.entries(runtimeMapping.swmmLinks)
      .filter(([, meta]) => meta.sourceEditorId === selectedPreviewNode.id)
      .map(([swmmId]) => swmmId)
  }, [runtimeMapping, selectedPreviewNode])
  const selectedPreviewSwmmNodes = useMemo(() => {
    if (!selectedPreviewNode || !runtimeMapping?.swmmNodes) {
      return []
    }
    return Object.entries(runtimeMapping.swmmNodes)
      .filter(([, meta]) => meta.sourceEditorId === selectedPreviewNode.id)
      .map(([swmmId]) => swmmId)
  }, [runtimeMapping, selectedPreviewNode])
  const effectiveBlockagesById = useMemo(
    () => mergeEditorBlockagesIntoSwmmBlockages(manualBlockagesById, manualBlockagesByEditorId, blockageTargets),
    [blockageTargets, manualBlockagesByEditorId, manualBlockagesById],
  )
  const controlPayload = useMemo(() => {
    return buildSwmmRuntimeControl(exportLayout, rainfallPercent, runtimeMapping, effectiveBlockagesById, speedMultiplier)
  }, [effectiveBlockagesById, exportLayout, rainfallPercent, runtimeMapping, speedMultiplier])
  const controlPayloadJsonText = useMemo(() => JSON.stringify(controlPayload, null, 2), [controlPayload])
  const animationsActive = Boolean(status?.running && !status.paused)
  const exportSimulationPng = useCallback(async () => {
    if (isExportingPng) {
      return
    }
    if (shouldShowScenarioPrompt) {
      setIsScenarioSettingsOpen(true)
      return
    }

    const svg = document.querySelector<SVGSVGElement>('[data-simulation-preview-svg="true"]')
    if (!svg) {
      window.alert('PNG로 내보낼 시뮬레이션 배수도를 찾지 못했습니다.')
      return
    }

    setIsExportingPng(true)
    try {
      await downloadSvgAsPng(svg, `simulation-drainage-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`, {
        backgroundColor: isDark ? '#020617' : '#e8f5ff',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`PNG 내보내기에 실패했습니다.\n\n${message}`)
    } finally {
      setIsExportingPng(false)
    }
  }, [isDark, isExportingPng, shouldShowScenarioPrompt])
  useEffect(() => {
    return subscribeAppSurfaceChange((surface) => setIsMobileInput(surface === 'mobile'))
  }, [])
  const closeSocket = useCallback(() => {
    socketRef.current?.close()
    socketRef.current = null
    setIsSocketConnected(false)
  }, [])

  const connectSocket = useCallback(() => {
    closeSocket()
    const socket = new WebSocket(getSwmmWebSocketUrl(SWMM_ENGINE_URL))
    socketRef.current = socket
    socket.onopen = () => setIsSocketConnected(true)
    socket.onclose = () => setIsSocketConnected(false)
    socket.onerror = () => setIsSocketConnected(false)
    socket.onmessage = (event) => {
      const payload: unknown = JSON.parse(event.data)
      if (isRealtimeSnapshot(payload)) {
        setSnapshot(payload)
        setStatus((currentStatus) => currentStatus ? {
          ...currentStatus,
          running: payload.type === 'paused' ? false : payload.type === 'control' ? currentStatus.running : true,
          paused: payload.type === 'paused' ? true : payload.type === 'control' ? currentStatus.paused : false,
          hasSession: true,
          stepIndex: payload.stepIndex,
          stepSeconds: payload.stepSeconds,
          modelTime: payload.modelTime,
          control: payload.control,
        } : currentStatus)
      } else if (isRecordValue(payload) && typeof payload.running === 'boolean') {
        setStatus((currentStatus) => statusFromSocketPayload(payload, currentStatus))
      }
    }
  }, [closeSocket])

  const resetRuntimeView = useCallback(() => {
    previewSelectionClearedRef.current = false
    setSnapshot(null)
    setRuntimeMapping(null)
    setRuntimeReport(null)
    setSelectedBlockageId('')
    setSelectedPreviewNodeId('')
    setManualBlockagesById({})
    setManualBlockagesByEditorId({})
  }, [])

  const applyScenarioLayout = useCallback((scenario: SwmmScenario) => {
    if (!isEditorLayout(scenario.layoutJson)) {
      window.alert('선택한 시나리오의 배수도 JSON 구조가 올바르지 않습니다.')
      return
    }

    setSelectedScenarioId(scenario.id)
    saveSelectedSwmmScenarioId(scenario.id)
    setLoadedLayout({
      layout: normalizeRelationAttachments(scenario.layoutJson),
      source: 'scenario',
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      scenarioVersion: scenario.version,
    })
    resetRuntimeView()
  }, [resetRuntimeView])

  const refreshScenarios = useCallback(async () => {
    setIsLoadingScenarios(true)
    setScenarioError(null)
    try {
      const nextScenarios = await getSwmmScenarios(SWMM_ENGINE_URL)
      setScenarios(nextScenarios)
      setSelectedScenarioId((currentScenarioId) => (
        currentScenarioId && nextScenarios.some((scenario) => scenario.id === currentScenarioId)
          ? currentScenarioId
          : null
      ))
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      setScenarioError(message)
    } finally {
      setIsLoadingScenarios(false)
    }
  }, [])

  useEffect(() => {
    if (selectedScenarioId !== null || status?.hasSession || scenarios.length === 0) {
      return
    }

    const storedScenarioId = loadSelectedSwmmScenarioId()
    if (!storedScenarioId) {
      return
    }

    const scenario = scenarios.find((item) => item.id === storedScenarioId)
    if (!scenario) {
      clearSelectedSwmmScenarioId()
      return
    }

    const timerId = window.setTimeout(() => {
      applyScenarioLayout(scenario)
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [applyScenarioLayout, scenarios, selectedScenarioId, status?.hasSession])

  useEffect(() => {
    getSwmmEngineStatus(SWMM_ENGINE_URL)
      .then((nextStatus) => {
        setStatus(nextStatus)
        if (nextStatus.hasSession) {
          connectSocket()
        }
      })
      .catch(() => {
        setStatus(null)
      })

    return () => closeSocket()
  }, [closeSocket, connectSocket])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      refreshScenarios()
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [refreshScenarios])

  useEffect(() => {
    if (!selectedBlockageId && blockageTargets.length > 0 && !previewSelectionClearedRef.current) {
      const timerId = window.setTimeout(() => {
        setSelectedBlockageId(blockageTargets[0].swmmLinkId)
      }, 0)

      return () => window.clearTimeout(timerId)
    }

    return undefined
  }, [blockageTargets, selectedBlockageId])

  useEffect(() => {
    if (!status?.hasSession || !runtimeMapping || isStarting || isStopping) {
      return undefined
    }

    if (autoApplyTimerRef.current !== null) {
      window.clearTimeout(autoApplyTimerRef.current)
    }

    autoApplyTimerRef.current = window.setTimeout(() => {
      updateSwmmEngineControl(SWMM_ENGINE_URL, controlPayload)
        .then((result) => {
          setSnapshot(result.snapshot)
          setStatus((currentStatus) => currentStatus ? { ...currentStatus, control: result.control } : currentStatus)
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
          setStatus((currentStatus) => currentStatus ? { ...currentStatus, lastError: message } : currentStatus)
        })
    }, 450)

    return () => {
      if (autoApplyTimerRef.current !== null) {
        window.clearTimeout(autoApplyTimerRef.current)
      }
    }
  }, [controlPayload, rainfallPercent, isStarting, isStopping, runtimeMapping, speedMultiplier, status?.hasSession])

  const handleScenarioSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const scenarioId = Number(event.target.value)
    if (!scenarioId) {
      clearSelectedSwmmScenarioId()
      setSelectedScenarioId(null)
      setLoadedLayout({
        layout: createDefaultEditorLayout(),
        source: 'default',
      })
      resetRuntimeView()
      return
    }

    const scenario = scenarios.find((item) => item.id === scenarioId)
    if (!scenario) {
      return
    }

    applyScenarioLayout(scenario)
  }

  const handleImportLayout = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsedValue: unknown = JSON.parse(text)
      if (!isEditorLayout(parsedValue)) {
        window.alert('편집 모드에서 내보낸 drainage-layout JSON 파일이 아닙니다.')
        return
      }

      const importedLayout = normalizeRelationAttachments(parsedValue)
      saveEditorLayout(importedLayout)
      clearSelectedSwmmScenarioId()
      setSelectedScenarioId(null)
      setLoadedLayout({
        layout: importedLayout,
        source: 'imported',
      })
      resetRuntimeView()
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`JSON 불러오기에 실패했습니다.\n\n${message}`)
    } finally {
      event.target.value = ''
    }
  }

  const startEngine = async () => {
    if (!hasActiveSimulationLayout) {
      setIsScenarioSettingsOpen(true)
      return
    }
    if (isStarting) {
      return
    }

    setIsStarting(true)
    try {
      previewSelectionClearedRef.current = false
      const initialControl = buildSwmmRuntimeControl(exportLayout, rainfallPercent, null, effectiveBlockagesById, speedMultiplier)
      const result = await startSwmmEngine(SWMM_ENGINE_URL, exportLayout, initialControl)
      const nextMapping = asSwmmRuntimeMapping(result.mapping)
      const nextReport = runtimeReportFromUnknown(result.report)
      setRuntimeMapping(nextMapping)
      setRuntimeReport(nextReport)
      setSnapshot(result.snapshot)
      setStatus(result.status)
      connectSocket()
      if (nextMapping) {
        const nextBlockageTargets = nextReport?.dynamicControls?.blockageTargets ?? []
        const mappedBlockages = mergeEditorBlockagesIntoSwmmBlockages(
          manualBlockagesById,
          manualBlockagesByEditorId,
          nextBlockageTargets,
        )
        const mappedControl = buildSwmmRuntimeControl(exportLayout, rainfallPercent, nextMapping, mappedBlockages, speedMultiplier)
        const controlResult = await updateSwmmEngineControl(SWMM_ENGINE_URL, mappedControl)
        setSnapshot(controlResult.snapshot)
        setStatus((currentStatus) => currentStatus ? { ...currentStatus, control: controlResult.control } : currentStatus)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`SWMM 엔진 시작에 실패했습니다.\n\n${message}`)
    } finally {
      setIsStarting(false)
    }
  }

  const stopEngine = async () => {
    if (isStopping) {
      return
    }

    setIsStopping(true)
    try {
      const nextStatus = await stopSwmmEngine(SWMM_ENGINE_URL)
      setStatus(nextStatus)
      resetRuntimeView()
      closeSocket()
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`SWMM 엔진 정지에 실패했습니다.\n\n${message}`)
    } finally {
      setIsStopping(false)
    }
  }

  const togglePauseEngine = async () => {
    if (isPausing || !status?.hasSession) {
      return
    }

    setIsPausing(true)
    try {
      const nextStatus = status.paused
        ? await resumeSwmmEngine(SWMM_ENGINE_URL)
        : await pauseSwmmEngine(SWMM_ENGINE_URL)
      setStatus(nextStatus)
      if (nextStatus.hasSession && !isSocketConnected) {
        connectSocket()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`SWMM 엔진 ${status.paused ? '재개' : '일시정지'}에 실패했습니다.\n\n${message}`)
    } finally {
      setIsPausing(false)
    }
  }

  async function applyControlPayload(nextControlPayload: SwmmEngineControl) {
    if (isApplying) {
      return
    }

    setIsApplying(true)
    try {
      const result = await updateSwmmEngineControl(SWMM_ENGINE_URL, nextControlPayload)
      setSnapshot(result.snapshot)
      setStatus((currentStatus) => currentStatus ? { ...currentStatus, control: result.control } : currentStatus)
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`SWMM 제어값 적용에 실패했습니다.\n\n${message}`)
    } finally {
      setIsApplying(false)
    }
  }

  function getSelectedBlockageTargetIds() {
    if (selectedPreviewBlockageTargets.length > 0) {
      return selectedPreviewBlockageTargets.map((target) => target.swmmLinkId)
    }

    if (!selectedBlockageId) {
      return []
    }

    const selectedTarget = blockageTargets.find((target) => target.swmmLinkId === selectedBlockageId)
    return selectedTarget?.sourceEditorId
      ? blockageTargets
        .filter((target) => target.sourceEditorId === selectedTarget.sourceEditorId)
        .map((target) => target.swmmLinkId)
      : [selectedBlockageId]
  }

  function getNextBlockageState(value: number) {
    const blockage = clampPercent(value)
    const nextManualBlockagesByEditorId = { ...manualBlockagesByEditorId }
    if (selectedPreviewNode) {
      nextManualBlockagesByEditorId[selectedPreviewNode.id] = blockage
    }

    const nextManualBlockagesById = { ...manualBlockagesById }
    getSelectedBlockageTargetIds().forEach((swmmLinkId) => {
      nextManualBlockagesById[swmmLinkId] = blockage
    })

    return {
      nextManualBlockagesByEditorId,
      nextManualBlockagesById,
    }
  }

  async function commitSelectedBlockage(value: number) {
    if (!status?.hasSession || !runtimeMapping || isStarting || isStopping) {
      return
    }

    const {
      nextManualBlockagesByEditorId,
      nextManualBlockagesById,
    } = getNextBlockageState(value)
    const nextEffectiveBlockages = mergeEditorBlockagesIntoSwmmBlockages(
      nextManualBlockagesById,
      nextManualBlockagesByEditorId,
      blockageTargets,
    )
    const nextControlPayload = buildSwmmRuntimeControl(
      exportLayout,
      rainfallPercent,
      runtimeMapping,
      nextEffectiveBlockages,
      speedMultiplier,
    )

    await applyControlPayload(nextControlPayload)
  }

  function updateSelectedBlockage(value: number) {
    const blockage = clampPercent(value)
    if (selectedPreviewNode) {
      setManualBlockagesByEditorId((current) => {
        const next = { ...current }
        next[selectedPreviewNode.id] = blockage
        return next
      })
    }

    const linkedTargetIds = getSelectedBlockageTargetIds()

    if (linkedTargetIds.length === 0) {
      return
    }

    setManualBlockagesById((current) => {
      const next = { ...current }
      linkedTargetIds.forEach((swmmLinkId) => {
        next[swmmLinkId] = blockage
      })
      return next
    })
  }

  const shouldRenderRuntimeInfo = isInfoPanelOpen
  const selectedObjectInfoPanel = shouldRenderRuntimeInfo ? (
    <div>
      <h3 className="text-sm font-black">선택 객체 정보</h3>
      {selectedPreviewNode ? (
        <div className="mt-3 space-y-3">
          <div className={`rounded-md px-3 py-2 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
            <div className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedPreviewNode.name}</div>
            <div className={`mt-1 text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
              {getNodeTypeLabel(selectedPreviewNode.type)}
              {selectedPreviewNode.type === 'pipeSegment'
                ? ` / ${PIPE_KIND_LABELS[getNodePipeKind(selectedPreviewNode)]}`
                : ''}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCell label="editor id" value={selectedPreviewNode.id} />
            <StatCell label="swmm id" value={selectedPreviewNode.swmmId || '-'} />
            <StatCell label="관 유량" value={formatNumber(selectedPreviewState?.flowCms)} />
            <StatCell label="유속" value={formatNumber(selectedPreviewState?.maxVelocityMps)} />
            <StatCell label="차오름" value={formatPercentWithDetail(Math.max(
              selectedPreviewState?.maxFullness ?? 0,
              selectedPreviewState?.maxDepthRatio ?? 0,
            ))} />
            <StatCell label="막힘" value={formatPercentWithDetail(selectedPreviewState?.maxBlockageRatio)} />
            <StatCell label="노드 수위" value={formatPrecisePercent(selectedPreviewState?.maxDepthRatio)} />
            <StatCell label="관 만관율" value={formatPrecisePercent(selectedPreviewState?.maxFullness)} />
            <StatCell label="용량" value={formatPrecisePercent(selectedPreviewState?.maxCapacityRatio)} />
            <StatCell label="외부 유입" value={formatNumber(selectedPreviewState?.totalInflowCms, 5)} />
          </div>
          <div className={`rounded-md border px-3 py-2 text-xs font-bold leading-5 ${
            isDark ? 'border-slate-800 bg-slate-950 text-slate-200' : 'border-slate-100 bg-slate-50 text-slate-600'
          }`}>
            <div>제어 대상: {selectedPreviewTarget?.swmmLinkId ?? '-'}</div>
            <div>매핑 link: {selectedPreviewSwmmLinks.length ? selectedPreviewSwmmLinks.join(', ') : '-'}</div>
            <div>매핑 node: {selectedPreviewSwmmNodes.length ? selectedPreviewSwmmNodes.join(', ') : '-'}</div>
          </div>
          <div className={`rounded-md border p-3 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <div className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>막힘 제어</div>
              {isApplying ? (
                <span className={`rounded-full px-2 py-1 text-[11px] font-black ${isDark ? 'bg-slate-900 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
                  적용 중
                </span>
              ) : null}
            </div>
            <label className="mt-3 block">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-black ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                  {selectedPreviewBlockageTargets.length > 1
                    ? `${selectedPreviewBlockageTargets.length}개 SWMM 링크 동시 제어`
                    : selectedPreviewBlockageTargets[0]?.swmmLinkId
                      ?? (selectedPreviewNode ? '엔진 시작 시 매핑 후 적용' : '제어 대상 없음')}
                </span>
                <span className="text-xs font-black text-rose-700">{Math.round(selectedPreviewBlockageValue)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                disabled={!canEditSelectedBlockage}
                value={selectedPreviewBlockageValue}
                onChange={(event) => updateSelectedBlockage(Number(event.target.value))}
                onPointerUp={(event) => commitSelectedBlockage(Number(event.currentTarget.value))}
                onKeyUp={(event) => {
                  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
                    commitSelectedBlockage(Number(event.currentTarget.value))
                  }
                }}
                className="mt-2 w-full accent-rose-600 disabled:opacity-50"
              />
              {!status?.hasSession && selectedPreviewNode ? (
                <div className={`mt-2 text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  엔진 시작 전 설정값은 저장해두었다가 시작 직후 SWMM 링크 매핑에 자동 반영됩니다.
                </div>
              ) : null}
            </label>
          </div>
        </div>
      ) : (
        <div className={`mt-3 rounded-md px-3 py-5 text-center text-xs font-bold ${isDark ? 'bg-slate-950 text-slate-400' : 'bg-slate-50 text-slate-400'}`}>
          실험 화면에서 관이나 시설을 클릭하면 정보가 표시됩니다.
        </div>
      )}
    </div>
  ) : null

  const shellClassName = 'relative flex min-h-screen min-w-0 items-stretch p-2 lg:p-4'
  const panelClassName = `flex min-h-0 min-w-0 flex-1 flex-col overflow-visible rounded-lg border p-3 shadow-sm lg:overflow-auto lg:p-4 ${themeTokens.panel}`
  const infoPanelContent = shouldRenderRuntimeInfo ? (
    <>
        <div className="space-y-2">
          <StatCell label="layout source" value={getLayoutSourceLabel(loadedLayout)} />
          <StatCell label="warnings" value={runtimeReport?.warnings.length ?? 0} />
          <StatCell label="errors" value={runtimeReport?.errors.length ?? 0} />
          <StatCell label="websocket clients" value={status?.websocketClients ?? 0} />
          <StatCell label="speed" value={`${speedMultiplier}x`} />
          <StatCell label="tick log" value={status?.tickLogPath ?? snapshot?.tickLogPath ?? '-'} />
          {status?.lastLogError ? <StatCell label="log error" value={status.lastLogError} /> : null}
        </div>

        {runtimeReport?.warnings.length ? (
          <div className="mt-4 rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
            <div className="text-xs font-black text-amber-700">warning</div>
            <ul className="mt-2 space-y-1">
              {runtimeReport.warnings.slice(0, 6).map((warning) => (
                <li key={warning} className="text-xs font-bold leading-5 text-amber-800">{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={`mt-4 rounded-md border p-4 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          {selectedObjectInfoPanel}
        </div>

        {status?.lastError ? (
          <div className="mt-4 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">
            {status.lastError}
          </div>
        ) : null}

        <div className="mt-4">
          <h3 className="text-sm font-black">제어 Payload</h3>
          <textarea
            readOnly
            value={controlPayloadJsonText}
            className="mt-2 h-56 w-full resize-none rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100"
          />
        </div>
    </>
  ) : null
  const scenarioSettingsSheet = isScenarioSettingsOpen ? (
    <div
      className={`fixed z-[220] flex ${
        isMobileInput
          ? 'bottom-0 left-0 right-0 top-[var(--app-visual-offset-top,0px)] h-[var(--app-visual-height,100dvh)] items-end justify-center'
          : 'inset-0 items-stretch justify-end'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="scenario-settings-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          setIsScenarioSettingsOpen(false)
        }
      }}
      onWheel={isMobileInput ? undefined : forwardBackgroundWheelToElementBelow}
    >
      <section
        className={`${isMobileInput ? 'max-h-[calc(var(--app-visual-height,100dvh)-16px)] w-screen rounded-t-2xl border-x-0 border-b-0 border-t' : 'h-screen w-[420px] max-w-[92vw] border-l'} overflow-hidden shadow-2xl ${
          isDark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-950'
        }`}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div>
            <h2 id="scenario-settings-title" className="text-base font-black">시나리오세팅</h2>
            <p className={`mt-1 text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              날씨, 실행 속도, 시나리오를 한 번에 설정합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsScenarioSettingsOpen(false)}
            className={`rounded-md border px-3 py-2 text-xs font-black transition ${themeTokens.buttonMuted}`}
          >
            닫기
          </button>
        </header>

        <div className={`${isMobileInput ? 'max-h-[calc(var(--app-visual-height,100dvh)-92px)] pb-4' : 'h-[calc(100vh-76px)] py-4'} overflow-y-auto px-5 pt-4`}>
          <div className="space-y-5">
            <section>
              <h3 className="text-sm font-black">시나리오</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                <select
                  value={selectedScenarioId ?? ''}
                  onChange={handleScenarioSelect}
                  disabled={Boolean(status?.hasSession)}
                  className={`h-11 min-w-0 rounded-md border px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
                    isDark
                      ? 'border-slate-700 bg-slate-950 text-slate-100'
                      : 'border-slate-300 bg-white text-slate-800'
                  }`}
                  title={status?.hasSession ? '엔진 정지 후 다른 시나리오를 선택할 수 있습니다.' : '저장된 시나리오 선택'}
                >
                  <option value="">시나리오 선택</option>
                  {scenarios.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.title} / v{scenario.version}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={refreshScenarios}
                  disabled={isLoadingScenarios}
                  className={`h-11 rounded-md border px-3 text-sm font-black transition-colors disabled:cursor-wait disabled:opacity-60 ${
                    isDark
                      ? 'border-emerald-700 bg-emerald-950 text-emerald-100 hover:border-emerald-300 hover:bg-emerald-800'
                      : 'border-emerald-400 bg-emerald-100 text-emerald-800 hover:border-emerald-600 hover:bg-emerald-200'
                  }`}
                >
                  {isLoadingScenarios ? '불러오는 중' : '새로고침'}
                </button>
                <button
                  type="button"
                  onClick={() => layoutFileInputRef.current?.click()}
                  className={`h-11 rounded-md border px-3 text-sm font-black transition-colors ${
                    isDark
                      ? 'border-blue-700 bg-blue-950 text-blue-100 hover:border-blue-300 hover:bg-blue-800'
                      : 'border-blue-400 bg-blue-100 text-blue-800 hover:border-blue-600 hover:bg-blue-200'
                  }`}
                >
                  JSON 불러오기
                </button>
                <input
                  ref={layoutFileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportLayout}
                />
              </div>
              {scenarioError ? (
                <div className="mt-3 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">
                  시나리오 목록을 불러오지 못했습니다. {scenarioError}
                </div>
              ) : null}
            </section>

            <section>
              <h3 className="text-sm font-black">이미지 내보내기</h3>
              <div className={`mt-3 rounded-lg border p-3 ${themeTokens.panelMuted}`}>
                <button
                  type="button"
                  onClick={exportSimulationPng}
                  disabled={isExportingPng || shouldShowScenarioPrompt}
                  className={`h-11 w-full rounded-md border px-3 text-sm font-black transition-colors disabled:cursor-wait disabled:opacity-60 ${
                    isDark
                      ? 'border-purple-700 bg-purple-950 text-purple-100 hover:border-purple-300 hover:bg-purple-800'
                      : 'border-purple-400 bg-purple-100 text-purple-800 hover:border-purple-600 hover:bg-purple-200'
                  }`}
                >
                  {isExportingPng ? 'PNG 인코딩 중' : '이미지로 내보내기'}
                </button>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-black">날씨</h3>
              <div className={`mt-3 rounded-lg border p-2 ${themeTokens.panelMuted}`}>
                <RainfallPresetButtons
                  value={rainfallPercent}
                  onChange={setRainfallPercent}
                  isDark={isDark}
                />
                <RainfallTestSlider
                  value={rainfallPercent}
                  onChange={setRainfallPercent}
                  isDark={isDark}
                />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-black">속도</h3>
              <div className={`mt-3 flex flex-wrap items-center gap-1 rounded-lg border p-2 ${themeTokens.panelMuted}`}>
                {SIMULATION_SPEED_OPTIONS.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => setSpeedMultiplier(speed)}
                    className={`rounded-md px-3 py-2 text-sm font-black ${
                      speedMultiplier === speed
                        ? isDark ? 'bg-blue-500 text-white' : 'bg-slate-900 text-white'
                        : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
        {isMobileInput ? <div className="h-[calc(env(safe-area-inset-bottom)+40px)] shrink-0" aria-hidden="true" /> : null}
      </section>
    </div>
  ) : null
  const runtimeInfoSheet = shouldRenderRuntimeInfo ? (
    <div
      className={`fixed z-[220] flex ${
        isMobileInput
          ? 'bottom-0 left-0 right-0 top-[var(--app-visual-offset-top,0px)] h-[var(--app-visual-height,100dvh)] items-end justify-center bg-slate-950/45'
          : 'pointer-events-none bottom-0 left-0 top-0 items-stretch justify-start'
      }`}
      role="dialog"
      aria-modal={isMobileInput ? 'true' : undefined}
      aria-labelledby="runtime-info-sheet-title"
    >
      <section
        className={`pointer-events-auto ${isMobileInput ? 'max-h-[calc(var(--app-visual-height,100dvh)-16px)] w-screen rounded-t-2xl border-x-0 border-b-0 border-t' : 'h-screen w-[430px] max-w-[92vw] border-r'} overflow-hidden shadow-2xl ${
          isDark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-950'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`cursor-grab touch-none justify-center px-5 pt-3 active:cursor-grabbing ${isMobileInput ? 'flex' : 'hidden'}`}
          onPointerDown={(event) => {
            runtimeSheetDragStartYRef.current = event.clientY
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerUp={(event) => {
            runtimeSheetDragStartYRef.current = null
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
          }}
          onPointerCancel={(event) => {
            runtimeSheetDragStartYRef.current = null
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
          }}
        >
          <span className={`h-1.5 w-12 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
        </div>
        <header className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div>
            <h2 id="runtime-info-sheet-title" className="text-base font-black">실행 정보</h2>
            <p className={`mt-1 text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              선택한 객체와 현재 엔진 상태를 확인합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsInfoPanelOpen(false)}
            className={`rounded-md border px-3 py-2 text-xs font-black transition ${themeTokens.buttonMuted}`}
          >
            접기
          </button>
        </header>
        <div className={`${isMobileInput ? 'max-h-[calc(var(--app-visual-height,100dvh)-112px)] pb-4' : 'h-[calc(100vh-80px)] py-4'} overflow-y-auto px-5 pt-4`}>
          {infoPanelContent}
        </div>
        {isMobileInput ? <div className="h-[calc(env(safe-area-inset-bottom)+40px)] shrink-0" aria-hidden="true" /> : null}
      </section>
    </div>
  ) : null
  const renderControlBar = (leadingControl?: ReactNode) => (
    <div className={`min-w-0 border-y px-3 py-3 shadow-sm lg:rounded-lg lg:border lg:px-4 ${themeTokens.controlBar}`}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {leadingControl}
        <button
          type="button"
          onClick={startEngine}
          disabled={isStarting || Boolean(status?.hasSession) || !hasActiveSimulationLayout}
          title={!hasActiveSimulationLayout ? '시나리오 선택 후 엔진을 시작할 수 있습니다.' : '엔진 시작'}
          className="rounded-md border border-emerald-200 bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-wait disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500"
        >
          {isStarting ? '시작 중' : '엔진 시작'}
        </button>
        <button
          type="button"
          onClick={togglePauseEngine}
          disabled={isPausing || !status?.hasSession}
          className={`rounded-md border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
            status?.paused
              ? isDark ? 'border-emerald-900 bg-slate-900 text-emerald-200 hover:bg-emerald-950' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : isDark ? 'border-amber-900 bg-slate-900 text-amber-200 hover:bg-amber-950' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          {isPausing ? '처리 중' : status?.paused ? '엔진 재개' : '엔진 일시정지'}
        </button>
        <button
          type="button"
          onClick={stopEngine}
          disabled={isStopping || !status?.hasSession}
          className={`rounded-md border px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
            isDark ? 'border-rose-900 bg-slate-900 hover:bg-rose-950' : 'border-rose-200 bg-white'
          }`}
        >
          {isStopping ? '정지 중' : '엔진 정지'}
        </button>
      </div>
    </div>
  )
  const controlBar = renderControlBar()
  const floatingSystemButtonClassName = isDark
    ? 'border-white bg-white text-slate-950 hover:bg-slate-100 focus-visible:ring-white'
    : 'border-slate-950 bg-slate-950 text-white hover:bg-slate-900 focus-visible:ring-slate-500'
  const fullscreenSystemButtonClassName = isDark
    ? floatingSystemButtonClassName
    : 'border-white/25 bg-slate-950/92 text-white ring-1 ring-white/10 hover:bg-slate-900 focus-visible:ring-white'
  const floatingButtonSizeClassName = isMobileInput ? 'h-12 w-12' : 'h-[58px] w-[58px]'
  const floatingButtonIconClassName = isMobileInput ? 'h-4 w-4' : 'h-6 w-6'
  const scenarioSelectionPulseClassName = shouldShowScenarioPrompt
    ? 'animate-pulse ring-4 ring-amber-300/80 shadow-[0_0_30px_rgba(245,158,11,0.85)]'
    : ''
  const scenarioSettingsFab = !isScenarioSettingsOpen && !isFullscreen ? (
    <button
      type="button"
      onClick={() => setIsScenarioSettingsOpen(true)}
      aria-label="시나리오세팅"
      title="시나리오세팅"
      className={`fixed bottom-5 right-8 z-[120] flex ${floatingButtonSizeClassName} items-center justify-center rounded-full border shadow-xl backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${floatingSystemButtonClassName} ${scenarioSelectionPulseClassName}`}
    >
      <GearIcon className={floatingButtonIconClassName} />
    </button>
  ) : null
  const fullscreenFloatingIconScaleClassName = isMobileInput ? '' : '[&>svg]:h-6 [&>svg]:w-6'
  const fullscreenMenuButtonClassName = `flex ${floatingButtonSizeClassName} items-center justify-center rounded-full border shadow-xl backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-55 ${fullscreenSystemButtonClassName} ${fullscreenFloatingIconScaleClassName}`
  const fullscreenSettingsButtonClassName = `flex ${floatingButtonSizeClassName} items-center justify-center rounded-full border shadow-xl backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-55 ${fullscreenSystemButtonClassName}`
  const fullscreenTopButtonBaseClassName = 'flex h-11 w-11 items-center justify-center rounded-md border shadow-xl backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-wait disabled:opacity-55'
  const fullscreenPlayButtonClassName = `${fullscreenTopButtonBaseClassName} border-emerald-300/60 bg-emerald-600/95 text-white hover:bg-emerald-500`
  const fullscreenPauseButtonClassName = `${fullscreenTopButtonBaseClassName} border-amber-300/60 bg-amber-500/95 text-slate-950 hover:bg-amber-400`
  const fullscreenResumeButtonClassName = `${fullscreenTopButtonBaseClassName} border-blue-300/60 bg-blue-600/95 text-white hover:bg-blue-500`
  const fullscreenStopButtonClassName = `${fullscreenTopButtonBaseClassName} border-rose-300/60 bg-rose-600/95 text-white hover:bg-rose-500`
  const fullscreenEngineControls = isFullscreen ? (
    <div className="fixed left-4 top-4 z-[150] flex items-center gap-2">
      {status?.hasSession ? (
        <>
          <button
            type="button"
            onClick={togglePauseEngine}
            disabled={isPausing}
            aria-label={status.paused ? '엔진 재개' : '엔진 일시정지'}
            title={status.paused ? '엔진 재개' : '엔진 일시정지'}
            className={status.paused ? fullscreenResumeButtonClassName : fullscreenPauseButtonClassName}
          >
            {status.paused ? <PlayIcon /> : <PauseIcon />}
          </button>
          <button
            type="button"
            onClick={stopEngine}
            disabled={isStopping}
            aria-label="엔진 정지"
            title="엔진 정지"
            className={fullscreenStopButtonClassName}
          >
            <StopIcon />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={startEngine}
          disabled={isStarting || !hasActiveSimulationLayout}
          aria-label="엔진 시작"
          title={!hasActiveSimulationLayout ? '시나리오 선택 후 엔진을 시작할 수 있습니다.' : '엔진 시작'}
          className={fullscreenPlayButtonClassName}
        >
          <PlayIcon />
        </button>
      )}
    </div>
  ) : null
  const isFullscreenZoomMin = fullscreenZoom <= FULLSCREEN_ZOOM_MIN + 0.001
  const fullscreenZoomControls = isFullscreen ? (
    <WebZoomControls
      className="fixed right-4 top-4 z-[150]"
      isDark={isDark}
      percentLabel={`${Math.round(fullscreenZoom * 100)}%`}
      canZoomOut={!isFullscreenZoomMin}
      canReset={!isFullscreenZoomMin}
      onZoomOut={() => setFullscreenZoom((current) => Math.max(FULLSCREEN_ZOOM_MIN, current - FULLSCREEN_ZOOM_STEP))}
      onReset={() => {
        setFullscreenZoom(FULLSCREEN_ZOOM_MIN)
        setFullscreenViewResetSignal((current) => current + 1)
      }}
      onZoomIn={() => setFullscreenZoom((current) => current + FULLSCREEN_ZOOM_STEP)}
    />
  ) : null
  const fullscreenActionMenu = isFullscreen ? (
    <div className="fixed bottom-5 right-8 z-[150] flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setIsScenarioSettingsOpen(true)}
        aria-label="시나리오세팅"
        title="시나리오세팅"
        className={`${fullscreenSettingsButtonClassName} ${scenarioSelectionPulseClassName}`}
      >
        <GearIcon className={floatingButtonIconClassName} />
      </button>
      <button
        type="button"
        onClick={() => requestFullscreenRoute(false)}
        aria-label="전체화면 종료"
        title="전체화면 종료"
        className={fullscreenMenuButtonClassName}
      >
        <MinimizeIcon />
      </button>
    </div>
  ) : null
  const headerElement = renderHeader ? renderHeader() : null
  const runtimeScenarioPrompt = shouldShowScenarioPrompt ? (
    <div className={`flex min-h-[360px] flex-1 items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center ${
      isDark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-950'
    }`}>
      <div className="max-w-sm">
        <div className={`mx-auto flex h-14 w-14 animate-pulse items-center justify-center rounded-full border shadow-[0_0_28px_rgba(245,158,11,0.75)] ${
          isDark ? 'border-amber-300 bg-amber-400 text-slate-950' : 'border-amber-300 bg-amber-100 text-amber-700'
        }`}>
          <GearIcon className="h-6 w-6" />
        </div>
        <h3 className="mt-5 text-lg font-black">시나리오를 선택해주세요</h3>
        <p className={`mt-2 text-sm font-bold leading-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          저장된 시나리오를 선택하면 런타임 뷰가 표시됩니다.
        </p>
        <button
          type="button"
          onClick={() => setIsScenarioSettingsOpen(true)}
          className={`mt-5 rounded-md border px-4 py-2 text-sm font-black transition ${themeTokens.buttonActive}`}
        >
          시나리오세팅 열기
        </button>
      </div>
    </div>
  ) : null

  return (
    <section className={shellClassName} data-swmm-theme={theme}>
      <WebPortal>
        {scenarioSettingsSheet}
        {runtimeInfoSheet}
        {scenarioSettingsFab}
        {fullscreenEngineControls}
        {fullscreenZoomControls}
        {fullscreenActionMenu}
      </WebPortal>

      <div className="flex min-h-[calc(100vh-16px)] min-w-0 flex-1 flex-col gap-3 lg:h-[calc(100vh-32px)] lg:min-h-[640px] lg:gap-4">
        {!isFullscreen ? (
          <div className="min-w-0 lg:space-y-4">
            {headerElement ? (
              <>
                <div className="fixed inset-x-0 top-0 z-50 lg:static lg:inset-x-auto lg:z-auto">
                  {headerElement}
                </div>
                <div className="pointer-events-none invisible lg:hidden" aria-hidden="true">
                  {headerElement}
                </div>
              </>
            ) : null}
            {controlBar}
          </div>
        ) : null}
        <div className={panelClassName}>
          {!isFullscreen ? (
            <>
              <div className={`hidden flex-wrap items-center justify-between gap-3 border-b pb-4 lg:flex ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <div>
                  <h2 className="text-base font-black">실시간 시뮬레이션</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-black ${
                      status?.running
                        ? 'bg-emerald-100 text-emerald-700'
                        : status?.paused
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}>
                      {status?.running ? 'RUNNING' : status?.paused ? 'PAUSED' : 'STOPPED'}
                    </span>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-black ${isSocketConnected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                      {isSocketConnected ? 'WS ON' : 'WS OFF'}
                    </span>
                    <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500 sm:max-w-[260px]">
                      {SWMM_ENGINE_URL}
                    </span>
                  </div>
                </div>
              </div>

              <div className={`mt-3 overflow-visible rounded-md border lg:mt-4 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                <button
                  type="button"
                  onClick={() => setIsNodeStatsOpen((current) => !current)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition ${
                    isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <h3 className="text-sm font-black">노드 정보</h3>
                    <p className={`mt-1 text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      노드, 링크, SWMM 매핑 통계를 확인합니다.
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                    isDark ? 'bg-slate-950 text-slate-300' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {isNodeStatsOpen ? '접기' : '펼치기'}
                  </span>
                </button>

                {isNodeStatsOpen ? (
                  <div className={`border-t p-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <StatCell label="nodes" value={shouldShowScenarioPrompt ? 0 : layout.nodes.length} />
                      <StatCell label="links" value={shouldShowScenarioPrompt ? 0 : layout.links.length} />
                      <StatCell label="step" value={snapshot?.stepIndex ?? status?.stepIndex ?? 0} />
                      <StatCell label="time" value={snapshot?.modelTime ?? status?.modelTime ?? '-'} />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <StatCell label="swmm nodes" value={snapshot?.summary.nodeCount ?? runtimeReport?.counts.junctions ?? '-'} />
                      <StatCell label="swmm links" value={snapshot?.summary.linkCount ?? runtimeReport?.counts.conduits ?? '-'} />
                      <StatCell label="rain targets" value={snapshot?.summary.rainfallTargetCount ?? runtimeReport?.dynamicControls?.rainfallTargets?.length ?? '-'} />
                      <StatCell label="blocked" value={snapshot?.summary.activeBlockageCount ?? 0} />
                    </div>
                  </div>
                ) : null}
              </div>

              {layoutSource === 'default' && !shouldShowScenarioPrompt ? (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">
                  저장된 편집 설계를 찾지 못해 기본 레이아웃이 표시되고 있습니다. 이전 설계 JSON을 불러오면 실험 화면과
                  localStorage 저장본이 그 설계로 복구됩니다.
                </div>
              ) : null}
            </>
          ) : null}

          {runtimeScenarioPrompt ?? (
            <SimulationLayoutPreview
              layout={exportLayout}
              snapshot={snapshot}
              rainfallPercent={rainfallPercent}
              animationsActive={animationsActive}
              theme={theme}
              isFullscreen={isFullscreen}
              fullscreenZoom={fullscreenZoom}
              fullscreenViewResetSignal={fullscreenViewResetSignal}
              onFullscreenZoomChange={setFullscreenZoom}
              selectedPreviewNodeId={selectedPreviewNodeId}
              selectedBlockageId={selectedBlockageId}
              blockageTargets={blockageTargets}
              onToggleFullscreen={toggleFullscreen}
              onClearSelection={handleClearPreviewSelection}
              onSelectPreviewNode={handleSelectPreviewNode}
              onSelectBlockageTarget={handleSelectBlockageTarget}
              animationSpeedMultiplier={speedMultiplier}
            />
          )}
        </div>
      </div>
    </section>
  )
})
