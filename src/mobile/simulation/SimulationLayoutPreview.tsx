import type { EditorEndpoint, EditorLayout, EditorLink, EditorNode } from '../editor/editorTypes'
import { memo, type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CANVAS_BOTTOM_PADDING, CANVAS_RIGHT_PADDING, PIPE_BORDER, PIPE_KIND_DEFINITIONS } from '../editor/editorDefinitions'
import { EDITOR_CANVAS_HEIGHT, EDITOR_CANVAS_WIDTH } from '../editor/defaultLayout'
import {
  getAttachedPortPoint,
  getElbowConnectorGeometry,
  getNodeFacilityDefinition,
  getNodeFacilityKind,
  getNodeManholeDefinition,
  getNodeOrientation,
  getNodeOutfallDefinition,
  getNodePipeKind,
  getNodePipeSize,
  getNodePort,
  getNodeTerrainDefinition,
  getPipePalette,
  getPipeSegmentRotation,
  getTeeConnectorGeometry,
} from '../editor/editorNodeHelpers'
import type { SwmmRealtimeSnapshot } from '../../services/swmm/client'
import { SoilBackground } from '../diagram/SoilBackground'
import { PipeBlockageDebrisSvg } from '../../shared/editor/pipeBlockageVisuals'

export interface SimulationBlockageTarget {
  swmmLinkId: string
  sourceEditorId?: string
  sourceEditorName?: string
  pipeKind?: string
}

interface SimulationLayoutPreviewProps {
  layout: EditorLayout
  snapshot: SwmmRealtimeSnapshot | null
  rainfallPercent: number
  animationSpeedMultiplier: number
  animationsActive?: boolean
  fullscreenZoom?: number
  fullscreenViewResetSignal?: number
  onFullscreenZoomChange?: (nextZoom: number | ((current: number) => number)) => void
  onFullscreenLiveZoomChange?: (nextZoom: number) => void
  theme?: 'light' | 'dark'
  isFullscreen?: boolean
  selectedPreviewNodeId?: string
  selectedBlockageId: string
  blockageTargets: SimulationBlockageTarget[]
  onToggleFullscreen?: () => void
  onClearSelection?: () => void
  onSelectPreviewNode?: (nodeId: string, targetSwmmId?: string) => void
  onSelectBlockageTarget: (swmmLinkId: string) => void
}

type RuntimeObjectState = SwmmRealtimeSnapshot['editorObjects'][string]
type RuntimeEditorObjects = SwmmRealtimeSnapshot['editorObjects']
type MobileFullscreenPinchZoomState = {
  startDistance: number
  startZoom: number
  anchorContentX: number
  anchorContentY: number
  anchorClientX: number
  anchorClientY: number
}
type MobileFullscreenPinchAnchor = {
  contentX: number
  contentY: number
  clientX: number
  clientY: number
}

interface ViewBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

interface LocalVisualBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const MIN_PREVIEW_HEIGHT = 560
const FLOW_ACTIVE_SPEED_THRESHOLD = 0.001
const FLOW_ACTIVE_CMS_THRESHOLD = 0.00005
const FULL_BLOCKAGE_RATIO_THRESHOLD = 0.999999
const FULLSCREEN_DRAG_THRESHOLD_PX = 3
const FULLSCREEN_ZOOM_MIN = 0.5
const FULLSCREEN_WHEEL_ZOOM_STEP = 0.15
const WHEEL_LINE_HEIGHT_PX = 16

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getWeatherPresetLabel(rainfallPercent: number) {
  if (rainfallPercent > 100) {
    return '폭우'
  }
  if (rainfallPercent >= 100) {
    return '호우'
  }
  if (rainfallPercent >= 10) {
    return '우천'
  }
  return '맑음'
}

function FullscreenToggleIcon({ isFullscreen }: { isFullscreen: boolean }) {
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
      {isFullscreen ? (
        <>
          <path d="M9 4v5H4" />
          <path d="M15 4v5h5" />
          <path d="M20 15h-5v5" />
          <path d="M4 15h5v5" />
        </>
      ) : (
        <>
          <path d="M4 10V4h6" />
          <path d="M14 4h6v6" />
          <path d="M20 14v6h-6" />
          <path d="M10 20H4v-6" />
        </>
      )}
    </svg>
  )
}
const DEFAULT_FLOW_REVERSE_CMS_THRESHOLD = 0.005
const FLOW_ARROW_SPACING = 104
const MAX_FLOW_ARROW_COUNT = 48
const UPSTREAM_EXTENSION_OVERLAP = 10
const PREVIEW_SCALE = 0.5
const FACILITY_VISIBLE_FILL_THRESHOLD = 0.001
const STORM_PUMP_START_RATIO = 0.6
const STORM_PUMP_ACTIVE_FLOW_THRESHOLD_CMS = 0.02
const PIPE_VISIBLE_FILL_THRESHOLD = 0.01
const PIPE_VISIBLE_FILL_MIN = 0.08
const OVERFLOW_GATE_OPEN_RATIO = 0.5
const OVERFLOW_GATE_PREVIEW_ANIMATION = false
const MANHOLE_CONNECTED_FILL_MIN = 0.03
const FLOOD_WARNING_CMS_THRESHOLD = 0.0005
const OBJECT_NAME_BADGE_HEIGHT = 23
const OBJECT_PERCENT_BADGE_HEIGHT = 16
const OBJECT_LABEL_ROW_GAP = 8

const WATER_TYPE_LEGEND = PIPE_KIND_DEFINITIONS.map((definition) => ({
  ...definition,
  color: getPipePalette(definition.id).fill,
  border: getPipePalette(definition.id).stroke,
}))

/** runtime 비율 값을 0~1 범위로 보정하고 잘못된 값은 0으로 처리한다. */
function clamp01(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(1, value))
}

function getEditorBlockageRatio(node: EditorNode) {
  const blockagePercent = Number(node.props.blockage ?? 0)
  if (!Number.isFinite(blockagePercent)) {
    return 0
  }

  return clamp01(blockagePercent / 100)
}

function getVisibleBlockageRatio(node: EditorNode, state: RuntimeObjectState | undefined) {
  if (state && state.maxBlockageRatio !== undefined) {
    return clamp01(state.maxBlockageRatio)
  }

  return getEditorBlockageRatio(node)
}

/** SVG clipPath/filter id로 안전하게 사용할 수 있는 문자열로 변환한다. */
function safeSvgId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

/** Django risk policy의 의미 있는 역류 기준을 React 흐름 방향 기준으로 그대로 사용한다. */
function getReverseFlowThreshold(snapshot: SwmmRealtimeSnapshot | null) {
  const value = snapshot?.risk?.policy?.reverseFlowMinAbsCms
  const parsed = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FLOW_REVERSE_CMS_THRESHOLD
}

/** 관 만관율과 노드 수위율 중 화면에 더 위험하게 보이는 값을 runtime 채움 비율로 사용한다. */
function getRuntimeFillRatio(state: RuntimeObjectState | undefined) {
  return Math.max(
    clamp01(state?.maxFullness),
    clamp01(state?.maxDepthRatio),
  )
}

function getPipeRuntimeFillRatio(state: RuntimeObjectState | undefined) {
  return clamp01(state?.maxFullness)
}

function isFullyBlockedRuntimeState(state: RuntimeObjectState | undefined) {
  return clamp01(state?.maxBlockageRatio) >= FULL_BLOCKAGE_RATIO_THRESHOLD
}

/** 채움 비율을 색상 경고 단계로 변환한다. */
function getFillRiskLevel(ratio: number) {
  const percent = clamp01(ratio) * 100
  if (percent >= 80) return 4
  if (percent >= 70) return 3
  if (percent >= 60) return 2
  if (percent >= 50) return 1
  return 0
}

/** 위험도에 따라 기본 물 색상을 경고색으로 덮어쓴다. */
function getRiskFillColor(baseFill: string, ratio: number) {
  const level = getFillRiskLevel(ratio)
  if (level >= 4) return 'rgba(239,68,68,.72)'
  if (level === 3) return 'rgba(249,115,22,.64)'
  if (level === 2) return 'rgba(245,158,11,.58)'
  if (level === 1) return 'rgba(250,204,21,.5)'
  return baseFill
}

/** 위험도에 따라 outline에 사용할 경고 stroke 색상을 반환한다. */
function getRiskStrokeColor(ratio: number) {
  const level = getFillRiskLevel(ratio)
  if (level >= 4) return '#ef4444'
  if (level === 3) return '#f97316'
  if (level === 2) return '#f59e0b'
  if (level === 1) return '#facc15'
  return null
}

/** SWMM runtime state에서 화면에 표시할 침수량이 있는지 확인한다. */
function hasFlooding(state: RuntimeObjectState | undefined) {
  return Math.abs(state?.maxFloodingCms ?? 0) > FLOOD_WARNING_CMS_THRESHOLD
}

/** 침수 경고 표시를 붙일 수 있는 노드 유형인지 확인한다. */
function canShowFlooding(node: EditorNode) {
  return node.type === 'manhole' || node.type === 'catchBasin'
}

/** 노드 유형과 runtime 침수량을 함께 보고 실제 침수 표시 여부를 결정한다. */
function hasVisibleFlooding(node: EditorNode, state: RuntimeObjectState | undefined) {
  return canShowFlooding(node) && hasFlooding(state)
}

/** 맨홀은 노드 수위가 낮아도 연결 관 만관율이 있으면 최소 채움 표시를 보정한다. */
function getManholeVisibleFillRatio(state: RuntimeObjectState | undefined) {
  const nodeDepthRatio = clamp01(state?.maxDepthRatio)
  const connectedPipeRatio = clamp01(state?.maxFullness)

  if (nodeDepthRatio > FACILITY_VISIBLE_FILL_THRESHOLD) {
    return nodeDepthRatio
  }

  if (connectedPipeRatio > PIPE_VISIBLE_FILL_THRESHOLD) {
    return Math.max(MANHOLE_CONNECTED_FILL_MIN, connectedPipeRatio)
  }

  return 0
}

/** runtime badge에 표시할 노드별 대표 비율을 계산한다. */
function getNodeBadgeRatio(node: EditorNode, state: RuntimeObjectState | undefined) {
  if (node.type === 'manhole') {
    return getManholeVisibleFillRatio(state)
  }

  if (node.type === 'pipeSegment') {
    return getPipeRuntimeFillRatio(state)
  }

  return getRuntimeFillRatio(state)
}

/** badge에 표시할 비율을 작은 값까지 읽기 쉬운 퍼센트 문자열로 포맷한다. */
function formatBadgePercent(ratio: number) {
  const percent = clamp01(ratio) * 100
  if (percent <= 0) {
    return '0%'
  }
  if (percent < 0.1) {
    return '<0.1%'
  }
  if (percent < 10) {
    return `${percent.toFixed(1)}%`
  }
  return `${Math.round(percent)}%`
}

/** 흐름, 유입, 수위 중 하나라도 움직임이 있으면 animation 최소 표시 대상으로 본다. */
function hasRuntimeActivity(state: RuntimeObjectState | undefined) {
  if (!state) {
    return false
  }

  return getRuntimeFillRatio(state) > 0.001
    || Math.abs(state.flowCms ?? 0) > FLOW_ACTIVE_CMS_THRESHOLD
    || Math.abs(state.totalInflowCms ?? 0) > FLOW_ACTIVE_CMS_THRESHOLD
}

/** 실제 비율이 너무 작아도 활동이 있으면 화면에서 보이는 최소 채움 높이를 준다. */
function getVisibleFillRatio(state: RuntimeObjectState | undefined, minimum = 0.06) {
  const ratio = getRuntimeFillRatio(state)
  if (ratio > 0.01) {
    return ratio
  }

  return hasRuntimeActivity(state) ? minimum : 0
}

/** 시뮬레이션 속도 배율에 맞춰 SVG animation 지속 시간을 계산한다. */
function animationDuration(baseSeconds: number, speedMultiplier: number) {
  return Math.max(0.12, baseSeconds / Math.max(1, speedMultiplier))
}

/** 커넥터 계열 노드인지 확인해 badge/outline 표시 예외 처리에 사용한다. */
function isConnectorNode(node: EditorNode) {
  return node.type === 'connector' || node.type === 'elbowConnector' || node.type === 'teeConnector'
}

function isPipeLabelNode(node: EditorNode) {
  return node.type === 'pipeSegment'
}

function shouldRenderObjectLabel(node: EditorNode) {
  return node.name.trim().length > 0 && !isConnectorNode(node)
}

function getObjectLabelWidth(name: string) {
  const weightedLength = Array.from(name).reduce((sum, char) => {
    if (/[가-힣]/.test(char)) return sum + 1.08
    if (char === ' ') return sum + 0.35
    return sum + 0.72
  }, 0)

  return Math.max(56, Math.min(280, weightedLength * 14 + 18))
}

function getObjectStatusPercent(node: EditorNode, state: RuntimeObjectState | undefined) {
  if (node.type === 'road') {
    return null
  }

  const fullnessRatio = state ? getNodeBadgeRatio(node, state) : 0
  const blockageRatio = getVisibleBlockageRatio(node, state)
  const hasBlockage = blockageRatio > 0
  if (!state && !hasBlockage) {
    return null
  }

  return {
    text: formatBadgePercent(hasBlockage ? blockageRatio : fullnessRatio),
    hasBlockage,
  }
}

function getObjectInfoLabelWidth(name: string, percentText: string | null) {
  const nameWidth = getObjectLabelWidth(name)
  if (!percentText) {
    return nameWidth
  }

  const percentWidth = Math.max(48, percentText.length * 8 + 18)
  return Math.max(96, Math.min(320, Math.max(nameWidth, percentWidth + 20)))
}

function getObjectInfoLabelHeight(hasPercent: boolean) {
  return hasPercent
    ? OBJECT_NAME_BADGE_HEIGHT + OBJECT_LABEL_ROW_GAP + OBJECT_PERCENT_BADGE_HEIGHT
    : OBJECT_NAME_BADGE_HEIGHT
}

function getObjectLabelPalette(node: EditorNode) {
  if (isPipeLabelNode(node)) {
    const palette = getPipePalette(getNodePipeKind(node))
    return { fill: palette.fill, stroke: palette.stroke, text: '#0f172a' }
  }

  if (node.type === 'facility') {
    const definition = getNodeFacilityDefinition(node)
    const palette = getPipePalette(definition.waterKind)
    return { fill: palette.fill, stroke: definition.stroke, text: '#0f172a' }
  }

  if (node.type === 'outfall') {
    const definition = getNodeOutfallDefinition(node)
    const palette = getPipePalette(definition.waterKind)
    return { fill: palette.fill, stroke: definition.stroke, text: '#0f172a' }
  }

  if (node.type === 'catchBasin') {
    const palette = getPipePalette('storm')
    return { fill: palette.fill, stroke: palette.stroke, text: '#0f172a' }
  }

  if (node.type === 'manhole') {
    const definition = getNodeManholeDefinition(node)
    const palette = getPipePalette(definition.waterKind)
    return { fill: palette.fill, stroke: definition.stroke, text: '#0f172a' }
  }

  if (node.type === 'terrain') {
    const definition = getNodeTerrainDefinition(node)
    return { fill: definition.fill, stroke: definition.stroke, text: '#0f172a' }
  }

  if (node.type === 'road') {
    return { fill: '#111827', stroke: '#facc15', text: '#f8fafc' }
  }

  if (node.type === 'apartment') {
    return { fill: '#e0f2fe', stroke: '#0f5fc7', text: '#0f172a' }
  }

  if (node.type === 'house') {
    return { fill: '#fff3d6', stroke: '#f97316', text: '#0f172a' }
  }

  return { fill: '#f8fafc', stroke: '#64748b', text: '#0f172a' }
}

function getObjectLabelAlignment(node: EditorNode) {
  if (isPipeLabelNode(node) && getNodeOrientation(node) === 'vertical') {
    return 'left'
  }

  return 'center'
}

function getObjectVisualBounds(node: EditorNode): LocalVisualBounds {
  if (node.type === 'catchBasin') {
    const grateStrokePadding = 3 / 2
    return {
      minX: 0,
      minY: -16 - grateStrokePadding,
      maxX: node.width,
      maxY: node.height,
    }
  }

  if (node.type === 'house') {
    const roofStrokePadding = 3 / 2
    return {
      minX: 6 - roofStrokePadding,
      minY: -36 - roofStrokePadding,
      maxX: node.width - 6 + roofStrokePadding,
      maxY: node.height,
    }
  }

  if (node.type === 'manhole') {
    const lidRadius = Math.min(node.width * 0.9, 84) / 2
    const lidStrokePadding = 7 / 2
    return {
      minX: node.width / 2 - lidRadius - lidStrokePadding,
      minY: -lidRadius - lidStrokePadding,
      maxX: node.width / 2 + lidRadius + lidStrokePadding,
      maxY: node.height,
    }
  }

  return {
    minX: 0,
    minY: 0,
    maxX: node.width,
    maxY: node.height,
  }
}

function createVisualOutlineRect(node: EditorNode, padding: number) {
  const bounds = getObjectVisualBounds(node)
  return {
    x: bounds.minX - padding,
    y: bounds.minY - padding,
    width: bounds.maxX - bounds.minX + padding * 2,
    height: bounds.maxY - bounds.minY + padding * 2,
  }
}

function getObjectLabelPosition(node: EditorNode, labelWidth: number, labelHeight: number) {
  const visualBounds = getObjectVisualBounds(node)
  const visualCenterX = node.x + visualBounds.minX + (visualBounds.maxX - visualBounds.minX) / 2

  if (isPipeLabelNode(node)) {
    if (getNodeOrientation(node) === 'horizontal') {
      return {
        x: visualCenterX - labelWidth / 2,
        y: node.y + visualBounds.minY - labelHeight - 8,
      }
    }

    return {
      x: node.x + visualBounds.maxX + 12,
      y: node.y + visualBounds.minY + (visualBounds.maxY - visualBounds.minY) / 2 - labelHeight / 2,
    }
  }

  return {
    x: visualCenterX - labelWidth / 2,
    y: node.y + visualBounds.minY - labelHeight - 8,
  }
}

/** velocity가 없을 때 flow/inflow/fill 값을 fallback으로 사용해 animation 속도를 추정한다. */
function getRuntimeFlowSpeed(state: RuntimeObjectState | undefined) {
  if (isFullyBlockedRuntimeState(state)) {
    return 0
  }

  const velocity = Math.abs(state?.maxVelocityMps ?? 0)
  const flowFallback = Math.min(3, Math.abs(state?.flowCms ?? 0) * 12)
  const inflowFallback = Math.min(3, Math.abs(state?.totalInflowCms ?? 0) * 2)
  const fillFallback = getRuntimeFillRatio(state) * 0.6
  return Math.max(velocity, flowFallback, inflowFallback, fillFallback)
}

/** runtime 흐름 상태를 화살표 방향, 투명도, animation 속도 설정으로 변환한다. */
function getFlowAnimationConfig(state: RuntimeObjectState | undefined, reverseFlowThreshold: number) {
  const flowCms = state?.flowCms ?? 0
  const totalInflowCms = state?.totalInflowCms ?? 0
  const speed = getRuntimeFlowSpeed(state)
  const isFullyBlocked = isFullyBlockedRuntimeState(state)
  const isActive = !isFullyBlocked && (speed > FLOW_ACTIVE_SPEED_THRESHOLD
    || Math.abs(flowCms) > FLOW_ACTIVE_CMS_THRESHOLD
    || Math.abs(totalInflowCms) > FLOW_ACTIVE_CMS_THRESHOLD)
  const durationSeconds = isActive
    ? Math.max(0.35, Math.min(2.4, 2.25 / (1 + speed * 0.8)))
    : 2.8

  return {
    isActive,
    isReverse: flowCms <= -reverseFlowThreshold,
    opacity: isActive ? Math.min(1, 0.42 + speed * 0.18) : 0.28,
    durationSeconds,
  }
}

/** 파이프 내부 흐름 화살표의 고정 좌표/시작 시간을 생성한다. */
function createPipeFlowArrowItems(
  orientation: ReturnType<typeof getNodeOrientation>,
  nodeWidth: number,
  nodeHeight: number,
  arrowCount: number,
) {
  return Array.from({ length: arrowCount }, (_, index) => {
    const offset = -FLOW_ARROW_SPACING + index * FLOW_ARROW_SPACING

    return {
      index,
      x: orientation === 'horizontal' ? offset : nodeWidth / 2,
      y: orientation === 'horizontal' ? nodeHeight / 2 : offset,
      beginSeconds: index * 0.07,
    }
  })
}

/** 캔버스 bounds 기준으로 재사용 가능한 빗방울 좌표 배열을 만든다. */
function createRainDropItems(bounds: ViewBounds, groundSurfaceY: number) {
  const dropCount = Math.min(240, Math.max(16, Math.ceil(bounds.width / 54)))
  const laneWidth = bounds.width / dropCount
  const topY = bounds.minY + 20
  const fallDistance = Math.max(140, groundSurfaceY - topY + 80)

  return {
    fallDistance,
    drops: Array.from({ length: dropCount }, (_, index) => {
      const jitter = (((index * 37) % 100) / 100 - 0.5) * laneWidth * 0.72

      return {
        index,
        x: bounds.minX + laneWidth * (index + 0.5) + jitter,
        y: topY + ((index * 37) % 180),
        length: 24 + (index % 3) * 7,
        durationBaseSeconds: 1.15 + (index % 7) * 0.08,
        beginSeconds: (index % 11) * 0.1,
      }
    }),
  }
}

/** 시뮬레이션 SVG에서 노드 유형별 렌더링 레이어 순서를 반환한다. */
function getNodeLayer(node: EditorNode) {
  if (node.type === 'terrain') {
    return 0
  }

  if (node.type === 'road') {
    return 1
  }

  if (node.type === 'pipeSegment') {
    return 2
  }

  if (node.type === 'connector' || node.type === 'elbowConnector' || node.type === 'teeConnector') {
    return 3
  }

  if (node.type === 'facility' || node.type === 'outfall' || node.type === 'manhole' || node.type === 'catchBasin') {
    return 4
  }

  return 5
}

/** 사용자 편집 zOrder 값을 숫자로 안전하게 읽는다. */
function getNodeZOrder(node: EditorNode) {
  const zOrder = Number(node.props.zOrder ?? 0)
  return Number.isFinite(zOrder) ? zOrder : 0
}

/** 좌측으로 연장 표시가 필요한 본관/간선/차집 계열 파이프인지 판정한다. */
function isMainUpstreamPipe(node: EditorNode) {
  if (node.type !== 'pipeSegment' || getNodeOrientation(node) !== 'horizontal') {
    return false
  }

  const text = `${node.name} ${node.swmmId}`.toLowerCase()
  return /본관|간선|차집|main|trunk|interceptor/.test(text)
}

/** 노드 배열을 id lookup Map으로 변환해 relation endpoint 조회 비용을 줄인다. */
function createNodesById(nodes: EditorNode[]) {
  return new Map(nodes.map((node) => [node.id, node]))
}

/** left 포트에 relation이 붙은 노드 ID를 모아 upstream 연장 표시 여부 판단에 사용한다. */
function createLeftEndpointRelationNodeIds(links: EditorLink[]) {
  const nodeIds = new Set<string>()

  links.forEach((link) => {
    if (link.type !== 'relation') {
      return
    }

    if (link.from.portId === 'left') {
      nodeIds.add(link.from.nodeId)
    }
    if (link.to.portId === 'left') {
      nodeIds.add(link.to.nodeId)
    }
  })

  return nodeIds
}

/** 화면 왼쪽 경계 밖으로 이어지는 upstream 파이프 연장선을 그릴지 결정한다. */
function shouldRenderUpstreamExtension(node: EditorNode, bounds: ViewBounds, hasLeftEndpointRelation: boolean) {
  if (!isMainUpstreamPipe(node) || hasLeftEndpointRelation) {
    return false
  }

  return node.x - bounds.minX > 12
}

/** 모든 노드를 포함하는 SVG viewBox bounds를 여백과 최소 높이 기준으로 계산한다. */
function computeViewBounds(layout: EditorLayout): ViewBounds {
  if (layout.nodes.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: EDITOR_CANVAS_WIDTH,
      maxY: EDITOR_CANVAS_HEIGHT,
      width: EDITOR_CANVAS_WIDTH,
      height: EDITOR_CANVAS_HEIGHT,
    }
  }

  const contentRight = layout.nodes.reduce(
    (maxRight, node) => (
      node.type === 'terrain' ? maxRight : Math.max(maxRight, node.x + node.width)
    ),
    EDITOR_CANVAS_WIDTH,
  )
  const terrainRight = layout.nodes.reduce(
    (maxRight, node) => (
      node.type === 'terrain' ? Math.max(maxRight, node.x + node.width) : maxRight
    ),
    EDITOR_CANVAS_WIDTH,
  )
  const contentBottom = layout.nodes.reduce(
    (maxBottom, node) => (
      node.type === 'terrain' ? maxBottom : Math.max(maxBottom, node.y + node.height)
    ),
    layout.groundSurfaceY,
  )
  const terrainBottom = layout.nodes.reduce(
    (maxBottom, node) => (
      node.type === 'terrain' ? Math.max(maxBottom, node.y + node.height) : maxBottom
    ),
    layout.groundSurfaceY,
  )
  const width = Math.max(
    EDITOR_CANVAS_WIDTH,
    Math.ceil(contentRight + CANVAS_RIGHT_PADDING),
    Math.ceil(terrainRight),
  )
  const height = Math.max(
    EDITOR_CANVAS_HEIGHT,
    Math.ceil(contentBottom + CANVAS_BOTTOM_PADDING),
    Math.ceil(terrainBottom),
    MIN_PREVIEW_HEIGHT,
  )

  return {
    minX: 0,
    minY: 0,
    maxX: width,
    maxY: height,
    width,
    height,
  }
}

function createSvgBounds(bounds: ViewBounds, width: number, height: number): ViewBounds {
  return {
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.minX + width,
    maxY: bounds.minY + height,
    width,
    height,
  }
}

function computeBaseGroundBounds(layout: EditorLayout, bounds: ViewBounds) {
  const firstSideTerrainX = layout.nodes.reduce((leftMostTerrainX, node) => {
    if (node.type !== 'terrain') {
      return leftMostTerrainX
    }

    const startsAtGroundSurface = Math.abs(node.y - layout.groundSurfaceY) <= 1
    if (!startsAtGroundSurface || node.x <= 0) {
      return leftMostTerrainX
    }

    return Math.min(leftMostTerrainX, node.x)
  }, bounds.maxX)
  const firstBottomTerrainY = layout.nodes.reduce((topMostTerrainY, node) => {
    if (node.type !== 'terrain') {
      return topMostTerrainY
    }

    if (node.y <= layout.groundSurfaceY + 1) {
      return topMostTerrainY
    }

    return Math.min(topMostTerrainY, node.y)
  }, bounds.maxY)

  const left = bounds.minX
  const top = layout.groundSurfaceY
  const right = Math.max(left, firstSideTerrainX)
  const bottom = Math.max(top, firstBottomTerrainY)

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  }
}

function getEndpointPoint(
  nodesById: Map<string, EditorNode>,
  endpoint: EditorEndpoint,
  counterpart?: EditorEndpoint,
) {
  const node = nodesById.get(endpoint.nodeId)
  if (!node) {
    return null
  }

  const port = getNodePort(node, endpoint.portId)
  if (!port) {
    return {
      x: node.x + node.width / 2,
      y: node.y + node.height / 2,
    }
  }

  const counterpartNode = counterpart ? nodesById.get(counterpart.nodeId) ?? null : null
  const counterpartPort = counterpartNode && counterpart ? getNodePort(counterpartNode, counterpart.portId) : null
  return getAttachedPortPoint(node, port, counterpartNode, counterpartPort)
}

function getSelectedEditorId(selectedBlockageId: string, blockageTargets: SimulationBlockageTarget[]) {
  return blockageTargets.find((target) => target.swmmLinkId === selectedBlockageId)?.sourceEditorId ?? ''
}

/** 막힘 제어 대상 목록을 editor object id 기준 lookup으로 변환한다. */
function createBlockageTargetByEditorId(blockageTargets: SimulationBlockageTarget[]) {
  return new Map(
    blockageTargets
      .filter((target) => target.sourceEditorId)
      .map((target) => [target.sourceEditorId as string, target]),
  )
}

/** 물결/침수 효과에 사용할 반복 cubic SVG path를 만든다. */
function makeWavePath(x: number, y: number, width: number, amplitude: number, wavelength: number) {
  const startX = x - wavelength * 2
  const endX = x + width + wavelength * 2
  let path = `M${startX} ${y}`

  for (let cursor = startX; cursor <= endX; cursor += wavelength) {
    path += ` C${cursor + wavelength * 0.25} ${y - amplitude} ${cursor + wavelength * 0.75} ${
      y + amplitude
    } ${cursor + wavelength} ${y}`
  }

  return path
}

/** runtime 비율에 따라 사각 영역 내부에 물 채움과 흐름 물결을 렌더링한다. */
const WaterFillRect = memo(function WaterFillRect({
  id,
  x,
  y,
  width,
  height,
  ratio,
  fill,
  flowReverse = false,
  animationSpeedMultiplier = 1,
}: {
  id: string
  x: number
  y: number
  width: number
  height: number
  ratio: number
  fill: string
  flowReverse?: boolean
  animationSpeedMultiplier?: number
}) {
  const fillRatio = clamp01(ratio)
  const waterHeight = height * fillRatio
  const waterY = y + height - waterHeight
  const waveAmplitude = Math.max(2, Math.min(8, height * 0.08))
  const waveStrokeWidth = Math.max(2, Math.min(6, height * 0.08))
  const wavePath = useMemo(
    () => makeWavePath(x, waterY, width, waveAmplitude, 54),
    [waterY, waveAmplitude, width, x],
  )

  if (fillRatio <= 0.001 || width <= 0 || height <= 0) {
    return null
  }

  return (
    <g clipPath={`url(#${safeSvgId(id)}-clip)`}>
      <rect x={x} y={waterY} width={width} height={waterHeight} fill={fill} opacity="0.82">
      </rect>
      <path
        d={wavePath}
        fill="none"
        stroke="rgba(255,255,255,.72)"
        strokeWidth={waveStrokeWidth}
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="translate"
          from={flowReverse ? '0 0' : '-54 0'}
          to={flowReverse ? '-54 0' : '0 0'}
          dur={`${animationDuration(1.8, animationSpeedMultiplier)}s`}
          repeatCount="indefinite"
        />
      </path>
    </g>
  )
}, (previous, next) => (
  previous.id === next.id &&
  previous.x === next.x &&
  previous.y === next.y &&
  previous.width === next.width &&
  previous.height === next.height &&
  previous.ratio === next.ratio &&
  previous.fill === next.fill &&
  previous.flowReverse === next.flowReverse &&
  previous.animationSpeedMultiplier === next.animationSpeedMultiplier
))

/** 맨홀/빗물받이 침수 상태를 물결과 튀는 물방울 animation으로 표시한다. */
const FloodOverflow = memo(function FloodOverflow({
  x,
  y,
  width,
  waterKind,
  animationSpeedMultiplier,
}: {
  x: number
  y: number
  width: number
  waterKind: string
  animationSpeedMultiplier: number
}) {
  const palette = getPipePalette(waterKind)
  const waveWidth = Math.max(52, width)
  const centerX = x + width / 2
  const duration = animationDuration(1.1, animationSpeedMultiplier)

  return (
    <g pointerEvents="none">
      <path
        d={makeWavePath(centerX - waveWidth / 2, y, waveWidth, 5, 40)}
        fill="none"
        stroke={palette.stroke}
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.95"
      >
        <animateTransform attributeName="transform" type="translate" from="-18 0" to="18 0" dur={`${duration}s`} repeatCount="indefinite" />
      </path>
      <path
        d={makeWavePath(centerX - waveWidth / 2, y + 7, waveWidth, 4, 36)}
        fill="none"
        stroke="rgba(255,255,255,.85)"
        strokeWidth="4"
        strokeLinecap="round"
      >
        <animateTransform attributeName="transform" type="translate" from="16 0" to="-16 0" dur={`${animationDuration(1.35, animationSpeedMultiplier)}s`} repeatCount="indefinite" />
      </path>
      {[-0.36, -0.12, 0.16, 0.38].map((offset, index) => (
        <circle key={index} cx={centerX + width * offset} cy={y - 12 - (index % 2) * 7} r={3 + (index % 2)} fill={palette.stroke} opacity="0.75">
          <animate attributeName="cy" values={`${y - 4};${y - 22};${y - 4}`} dur={`${animationDuration(0.95 + index * 0.14, animationSpeedMultiplier)}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values=".2;.9;.2" dur={`${animationDuration(0.95 + index * 0.14, animationSpeedMultiplier)}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  )
}, (previous, next) => (
  previous.x === next.x &&
  previous.y === next.y &&
  previous.width === next.width &&
  previous.waterKind === next.waterKind &&
  previous.animationSpeedMultiplier === next.animationSpeedMultiplier
))

const ObjectLabelItem = memo(function ObjectLabelItem({
  node,
  state,
}: {
  node: EditorNode
  state?: RuntimeObjectState
}) {
  return <ObjectLabel node={node} state={state} />
}, (previous, next) => (
  previous.node === next.node &&
  areRuntimeStatesEquivalent(previous.state, next.state)
))

const ObjectLabelLayer = memo(function ObjectLabelLayer({
  nodes,
  editorObjects,
}: {
  nodes: EditorNode[]
  editorObjects: RuntimeEditorObjects | null
}) {
  return (
    <g pointerEvents="none">
      {nodes.map((node) => (
        <ObjectLabelItem
          key={`${node.id}-object-label`}
          node={node}
          state={editorObjects?.[node.id]}
        />
      ))}
    </g>
  )
}, (previous, next) => (
  previous.nodes === next.nodes &&
  previous.editorObjects === next.editorObjects
))

function ObjectLabel({ node, state }: { node: EditorNode; state?: RuntimeObjectState }) {
  if (!shouldRenderObjectLabel(node)) {
    return null
  }

  const status = getObjectStatusPercent(node, state)
  const statusText = status?.text ?? null
  const statusWidth = statusText ? Math.max(48, statusText.length * 8 + 18) : 0
  const nameWidth = getObjectLabelWidth(node.name)
  const labelWidth = getObjectInfoLabelWidth(node.name, statusText)
  const labelHeight = getObjectInfoLabelHeight(Boolean(statusText))
  const position = getObjectLabelPosition(node, labelWidth, labelHeight)
  const palette = getObjectLabelPalette(node)
  const hasBlockage = status?.hasBlockage ?? false
  const alignment = getObjectLabelAlignment(node)
  const nameX = alignment === 'left' ? 0 : (labelWidth - nameWidth) / 2
  const statusX = alignment === 'left' ? 0 : (labelWidth - statusWidth) / 2

  return (
    <g transform={`translate(${position.x} ${position.y})`} pointerEvents="none">
      <g transform={`translate(${nameX} 0)`}>
        <rect
          width={nameWidth}
          height={OBJECT_NAME_BADGE_HEIGHT}
          rx="7"
          fill={palette.fill}
          stroke={palette.stroke}
          strokeWidth="2.25"
          opacity="0.96"
        />
        <rect
          x="4"
          y="4"
          width="7"
          height={OBJECT_NAME_BADGE_HEIGHT - 8}
          rx="3.5"
          fill={palette.stroke}
          opacity="0.9"
        />
        <text
          x={nameWidth / 2 + 2}
          y="16"
          textAnchor="middle"
          className="select-none text-[15px] font-black"
          fill={palette.text}
        >
          {node.name}
        </text>
      </g>
      {statusText ? (
        <g transform={`translate(${statusX} ${OBJECT_NAME_BADGE_HEIGHT + OBJECT_LABEL_ROW_GAP})`}>
          <rect
            width={statusWidth}
            height={OBJECT_PERCENT_BADGE_HEIGHT}
            rx="8"
            fill={hasBlockage ? '#fff1f2' : '#eff6ff'}
            stroke={hasBlockage ? '#fb7185' : '#60a5fa'}
            strokeWidth="1.5"
          />
          <text
            x={statusWidth / 2}
            y="12"
            textAnchor="middle"
            className="select-none text-[11px] font-black"
            fill={hasBlockage ? '#be123c' : '#1d4ed8'}
          >
            {statusText}
          </text>
        </g>
      ) : null}
    </g>
  )
}

/** 선택, 막힘, 만관 위험도, 침수 상태를 노드 외곽선으로 강조한다. */
function RuntimeOutline({ node, state, selected }: { node: EditorNode; state?: RuntimeObjectState; selected: boolean }) {
  const selectedGlowRect = createVisualOutlineRect(node, isConnectorNode(node) ? 8 : 10)
  const selectedStrokeRect = createVisualOutlineRect(node, 5)

  if (isConnectorNode(node)) {
    return selected ? (
      <g pointerEvents="none">
        <rect
          x={selectedGlowRect.x}
          y={selectedGlowRect.y}
          width={selectedGlowRect.width}
          height={selectedGlowRect.height}
          rx="12"
          fill="none"
          stroke="#fb923c"
          strokeWidth="9"
          opacity="0.32"
          filter="url(#selected-glow)"
        />
        <rect
          x={selectedStrokeRect.x}
          y={selectedStrokeRect.y}
          width={selectedStrokeRect.width}
          height={selectedStrokeRect.height}
          rx="10"
          fill="none"
          stroke="#ea580c"
          strokeWidth="5"
          opacity="0.98"
        />
      </g>
    ) : null
  }

  const blockage = getVisibleBlockageRatio(node, state)
  const fillRatio = getNodeBadgeRatio(node, state)
  const riskStroke = getRiskStrokeColor(fillRatio)
  const flooded = hasVisibleFlooding(node, state)
  if (!selected && blockage <= 0.01 && !riskStroke && !flooded) {
    return null
  }
  const stroke = selected ? '#ea580c' : riskStroke ?? (flooded ? '#ef4444' : '#ef4444')
  const urgent = getFillRiskLevel(fillRatio) >= 4
  const urgentRect = createVisualOutlineRect(node, 12)

  return (
    <g pointerEvents="none">
      {selected ? (
        <rect
          x={selectedGlowRect.x}
          y={selectedGlowRect.y}
          width={selectedGlowRect.width}
          height={selectedGlowRect.height}
          rx="14"
          fill="none"
          stroke="#fb923c"
          strokeWidth="11"
          opacity="0.34"
          filter="url(#selected-glow)"
        />
      ) : null}
      {urgent && !selected ? (
        <rect
          x={urgentRect.x}
          y={urgentRect.y}
          width={urgentRect.width}
          height={urgentRect.height}
          rx="14"
          fill="none"
          stroke="#ef4444"
          strokeWidth="10"
          opacity=".42"
          filter="url(#urgent-glow)"
        >
          <animate attributeName="opacity" values=".16;.62;.16" dur="0.9s" repeatCount="indefinite" />
        </rect>
      ) : null}
      <rect
        x={selectedStrokeRect.x}
        y={selectedStrokeRect.y}
        width={selectedStrokeRect.width}
        height={selectedStrokeRect.height}
        rx="10"
        fill="none"
        stroke={stroke}
        strokeWidth={selected ? 6 : Math.max(3, 3 + Math.max(blockage, getFillRiskLevel(fillRatio) / 4) * 6)}
        opacity={selected ? 0.98 : 0.42 + Math.max(blockage, getFillRiskLevel(fillRatio) / 4) * 0.45}
      >
        {urgent ? <animate attributeName="opacity" values=".35;1;.35" dur="0.9s" repeatCount="indefinite" /> : null}
      </rect>
    </g>
  )
}

function TerrainNode({ node }: { node: EditorNode }) {
  const definition = getNodeTerrainDefinition(node)
  const terrainWaves = useMemo(() => {
    const columns = Math.ceil(node.width / 260)
    const rows = Math.ceil(node.height / 44)

    return Array.from({ length: columns * rows }, (_, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const start = column * 260
      const baseY = 22 + row * 44

      return {
        index,
        path: `M${start} ${baseY} C${start + 36} ${baseY - 14} ${
          start + 76
        } ${baseY + 14} ${start + 116} ${baseY} S${
          start + 204
        } ${baseY - 14} ${start + 260} ${baseY}`,
      }
    })
  }, [node.height, node.width])

  return (
    <>
      <rect x="0" y="0" width={node.width} height={node.height} fill={definition.fill} stroke={definition.stroke} strokeWidth="3" />
      {terrainWaves.map((wave) => (
        <path
          key={wave.index}
          d={wave.path}
          fill="none"
          stroke={definition.waveStroke}
          strokeWidth="3"
        />
      ))}
    </>
  )
}

function RoadNode({ node }: { node: EditorNode }) {
  const dashCount = Math.max(3, Math.floor((node.width - 80) / 90))
  const dashSpacing = node.width / (dashCount + 1)
  const roadDashes = useMemo(() => (
    Array.from({ length: dashCount }, (_, index) => ({
      index,
      x1: (index + 1) * dashSpacing - 16,
      x2: (index + 1) * dashSpacing + 16,
    }))
  ), [dashCount, dashSpacing])

  return (
    <>
      <rect x="0" y="0" width={node.width} height={node.height} fill="#111827" stroke="#253244" strokeWidth="4" />
      <line x1="32" y1={node.height / 2} x2={node.width - 32} y2={node.height / 2} stroke="#facc15" strokeWidth="0" />
      {roadDashes.map((dash) => (
        <line
          key={dash.index}
          x1={dash.x1}
          y1={node.height / 2}
          x2={dash.x2}
          y2={node.height / 2}
          stroke="#facc15"
          strokeWidth="4"
        />
      ))}
    </>
  )
}

function ApartmentNode({ node }: { node: EditorNode }) {
  return (
    <>
      <rect x="0" y="0" width={node.width} height={node.height} rx="8" fill="#d9ecfb" stroke="#334155" strokeWidth="3" />
      {Array.from({ length: 9 }, (_, index) => {
        const col = index % 3
        const row = Math.floor(index / 3)
        return <rect key={index} x={28 + col * 40} y={28 + row * 38} width="22" height="24" fill="#fff8dc" stroke="#60a5fa" strokeWidth="2" />
      })}
      <rect x={node.width / 2 - 14} y={node.height - 34} width="28" height="34" fill="#9a6a34" />
    </>
  )
}

function HouseNode({ node }: { node: EditorNode }) {
  const bodyX = 6
  const bodyY = 18
  const bodyWidth = node.width - bodyX * 2
  const bodyHeight = node.height - bodyY

  return (
    <>
      <path
        d={`M${node.width / 2} -36 L${node.width - 12} ${bodyY} H12 Z`}
        fill="#f97316"
        stroke="#334155"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect x={bodyX} y={bodyY} width={bodyWidth} height={bodyHeight} rx="8" fill="#fff3d6" stroke="#334155" strokeWidth="3" />
      <rect x={bodyX + 10} y={bodyY - 5} width={bodyWidth - 20} height="8" rx="4" fill="#9a3412" />
      <rect x="26" y={bodyY + 28} width="23" height="25" fill="#d9ecfb" stroke="#60a5fa" strokeWidth="2" />
      <rect x={node.width - 49} y={bodyY + 28} width="23" height="25" fill="#d9ecfb" stroke="#60a5fa" strokeWidth="2" />
      <rect x={node.width / 2 - 15} y={node.height - 40} width="30" height="40" fill="#9a6a34" stroke="#6b4423" strokeWidth="2" />
    </>
  )
}

function CatchBasinNode({ node, state, animationSpeedMultiplier }: { node: EditorNode; state?: RuntimeObjectState; animationSpeedMultiplier: number }) {
  const ratio = getVisibleFillRatio(state)
  const waterFill = getRiskFillColor('rgba(56,189,248,.48)', getRuntimeFillRatio(state))
  const flooded = hasVisibleFlooding(node, state)

  return (
    <>
      <rect x="10" y="-16" width={node.width - 20} height="26" rx="3" fill="#475569" stroke="#1e293b" strokeWidth="3" />
      {Array.from({ length: 6 }, (_, index) => (
        <line key={index} x1={28 + index * 22} y1="-15" x2={28 + index * 22} y2="10" stroke="#cbd5e1" strokeWidth="4" />
      ))}
      <rect x="0" y="0" width={node.width} height={node.height} rx="8" fill="#111827" stroke="#020617" strokeWidth="3" />
      <defs>
        <clipPath id={`${safeSvgId(node.id)}-clip`}>
          <rect x="0" y="0" width={node.width} height={node.height} rx="8" />
        </clipPath>
      </defs>
      <WaterFillRect id={node.id} x={8} y={10} width={node.width - 16} height={node.height - 20} ratio={ratio} fill={waterFill} animationSpeedMultiplier={animationSpeedMultiplier} />
      {flooded ? (
        <FloodOverflow
          x={20}
          y={-20}
          width={node.width - 40}
          waterKind="storm"
          animationSpeedMultiplier={animationSpeedMultiplier}
        />
      ) : null}
      <line x1="34" y1="34" x2={node.width - 34} y2="34" stroke="#334155" strokeWidth="3" />
      <line x1="34" y1={node.height - 34} x2={node.width - 34} y2={node.height - 34} stroke="#334155" strokeWidth="3" />
    </>
  )
}

function ManholeNode({ node, state, animationSpeedMultiplier }: { node: EditorNode; state?: RuntimeObjectState; animationSpeedMultiplier: number }) {
  const definition = getNodeManholeDefinition(node)
  const palette = getPipePalette(definition.waterKind)
  const ratio = getManholeVisibleFillRatio(state)
  const waterFill = getRiskFillColor(palette.water, ratio)
  const flooded = hasVisibleFlooding(node, state)
  const lidDiameter = Math.min(node.width * 0.9, 84)

  return (
    <>
      <rect x="0" y="0" width={node.width} height={node.height} rx="10" fill={definition.fill} stroke={definition.stroke} strokeWidth="4" />
      <defs>
        <clipPath id={`${safeSvgId(node.id)}-clip`}>
          <rect x="8" y="8" width={node.width - 16} height={node.height - 16} rx="7" />
        </clipPath>
      </defs>
      <WaterFillRect id={node.id} x={10} y={18} width={node.width - 20} height={node.height - 28} ratio={ratio} fill={waterFill} animationSpeedMultiplier={animationSpeedMultiplier} />
      <circle cx={node.width / 2} cy="0" r={lidDiameter / 2} fill={palette.fill} stroke={definition.stroke} strokeWidth="7" />
      <circle cx={node.width / 2} cy="0" r={lidDiameter / 2 - 14} fill={palette.stroke} stroke="#172554" strokeWidth="5" />
      {[-12, 0, 12].map((offset) => (
        <line key={offset} x1={node.width / 2 - 20} y1={offset} x2={node.width / 2 + 20} y2={offset} stroke="rgba(255,255,255,.68)" strokeWidth="6" strokeLinecap="round" />
      ))}
      {flooded ? (
        <FloodOverflow
          x={node.width / 2 - lidDiameter / 2}
          y={-lidDiameter / 2 - 8}
          width={lidDiameter}
          waterKind={definition.waterKind}
          animationSpeedMultiplier={animationSpeedMultiplier}
        />
      ) : null}
    </>
  )
}

function PipeFlowArrows({
  node,
  palette,
  state,
  reverseFlowThreshold,
  animationSpeedMultiplier,
}: {
  node: EditorNode
  palette: ReturnType<typeof getPipePalette>
  state?: RuntimeObjectState
  reverseFlowThreshold: number
  animationSpeedMultiplier: number
}) {
  const orientation = getNodeOrientation(node)
  const rotation = getPipeSegmentRotation(node)
  const axisLength = orientation === 'horizontal' ? node.width : node.height
  const arrowSpacing = FLOW_ARROW_SPACING
  const arrowCount = Math.max(2, Math.min(MAX_FLOW_ARROW_COUNT, Math.ceil(axisLength / arrowSpacing) + 3))
  const flowConfig = getFlowAnimationConfig(state, reverseFlowThreshold)
  const arrowRotation = rotation + (flowConfig.isReverse ? 180 : 0)
  const arrowStroke = flowConfig.isReverse ? '#ef4444' : palette.stroke
  const radians = (arrowRotation * Math.PI) / 180
  const translateX = Math.cos(radians) * arrowSpacing
  const translateY = Math.sin(radians) * arrowSpacing
  const arrowItems = useMemo(
    () => createPipeFlowArrowItems(orientation, node.width, node.height, arrowCount),
    [arrowCount, node.height, node.width, orientation],
  )

  return (
    <g clipPath={`url(#${safeSvgId(node.id)}-clip)`} opacity={flowConfig.opacity}>
      {arrowItems.map((item) => (
          <g key={item.index} transform={`translate(${item.x} ${item.y})`}>
            {flowConfig.isActive ? (
              <animateTransform
                attributeName="transform"
                type="translate"
                additive="sum"
                from="0 0"
                to={`${translateX} ${translateY}`}
                dur={`${animationDuration(flowConfig.durationSeconds, animationSpeedMultiplier)}s`}
                begin={`${item.beginSeconds}s`}
                repeatCount="indefinite"
              />
            ) : null}
            <path
              d="M-13 -9 L0 0 L-13 9"
              transform={`rotate(${arrowRotation})`}
              fill="none"
              stroke={arrowStroke}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
      ))}
    </g>
  )
}

function PipeSegmentNode({
  node,
  state,
  reverseFlowThreshold,
  animationSpeedMultiplier,
}: {
  node: EditorNode
  state?: RuntimeObjectState
  reverseFlowThreshold: number
  animationSpeedMultiplier: number
}) {
  const size = getNodePipeSize(node)
  const palette = getPipePalette(getNodePipeKind(node))
  const innerInset = PIPE_BORDER[size]
  const innerWidth = Math.max(0, node.width - innerInset * 2)
  const innerHeight = Math.max(0, node.height - innerInset * 2)
  const orientation = getNodeOrientation(node)
  const blockageRatio = getVisibleBlockageRatio(node, state)
  const blockedCrossAxis = orientation === 'horizontal'
    ? innerHeight * blockageRatio
    : innerWidth * blockageRatio
  const flowWidth = orientation === 'horizontal' ? innerWidth : Math.max(0, innerWidth - blockedCrossAxis)
  const flowHeight = orientation === 'horizontal' ? Math.max(0, innerHeight - blockedCrossAxis) : innerHeight
  const flowX = orientation === 'horizontal' ? innerInset : innerInset + blockedCrossAxis
  const flowY = innerInset
  const runtimeRatio = getPipeRuntimeFillRatio(state)
  const ratio = runtimeRatio > PIPE_VISIBLE_FILL_THRESHOLD ? Math.max(runtimeRatio, PIPE_VISIBLE_FILL_MIN) : 0
  const flowConfig = getFlowAnimationConfig(state, reverseFlowThreshold)
  const waterFill = getRiskFillColor(palette.water, runtimeRatio)
  const hasBlockage = blockageRatio > 0.001

  return (
    <>
      <rect x="0" y="0" width={node.width} height={node.height} fill={palette.fill} stroke={palette.stroke} strokeWidth={PIPE_BORDER[size]} />
      <defs>
        <clipPath id={`${safeSvgId(node.id)}-clip`}>
          <rect x={flowX} y={flowY} width={flowWidth} height={flowHeight} />
        </clipPath>
      </defs>
      <WaterFillRect
        id={node.id}
        x={flowX}
        y={flowY}
        width={flowWidth}
        height={flowHeight}
        ratio={ratio}
        fill={waterFill}
        flowReverse={flowConfig.isReverse}
        animationSpeedMultiplier={animationSpeedMultiplier}
      />
      <PipeFlowArrows
        node={node}
        palette={palette}
        state={state}
        reverseFlowThreshold={reverseFlowThreshold}
        animationSpeedMultiplier={animationSpeedMultiplier}
      />
      {hasBlockage ? (
        <PipeBlockageDebrisSvg
          blockagePercent={blockageRatio * 100}
          orientation={orientation}
          innerX={innerInset}
          innerY={innerInset}
          innerWidth={innerWidth}
          innerHeight={innerHeight}
        />
      ) : null}
    </>
  )
}

const UpstreamPipeExtension = memo(function UpstreamPipeExtension({
  node,
  bounds,
  hasLeftEndpointRelation,
  state,
  reverseFlowThreshold,
  animationSpeedMultiplier,
}: {
  node: EditorNode
  bounds: ViewBounds
  hasLeftEndpointRelation: boolean
  state?: RuntimeObjectState
  reverseFlowThreshold: number
  animationSpeedMultiplier: number
}) {
  if (!shouldRenderUpstreamExtension(node, bounds, hasLeftEndpointRelation)) {
    return null
  }

  const border = PIPE_BORDER[getNodePipeSize(node)]
  const extensionX = bounds.minX - border * 2
  const extensionWidth = node.x - extensionX + UPSTREAM_EXTENSION_OVERLAP
  const extensionNode: EditorNode = {
    ...node,
    id: `${node.id}-upstream-extension`,
    swmmId: `${node.swmmId}_VISUAL_UPSTREAM`,
    name: '',
    x: extensionX,
    width: extensionWidth,
  }

  return (
    <g transform={`translate(${extensionX} ${node.y})`} pointerEvents="none" aria-hidden="true">
      <PipeSegmentNode
        node={extensionNode}
        state={state}
        reverseFlowThreshold={reverseFlowThreshold}
        animationSpeedMultiplier={animationSpeedMultiplier}
      />
    </g>
  )
}, (previous, next) => (
  previous.node === next.node &&
  previous.bounds === next.bounds &&
  previous.hasLeftEndpointRelation === next.hasLeftEndpointRelation &&
  previous.reverseFlowThreshold === next.reverseFlowThreshold &&
  previous.animationSpeedMultiplier === next.animationSpeedMultiplier &&
  areRuntimeStatesEquivalent(previous.state, next.state)
))

function ConnectorCap({
  x,
  y,
  width,
  height,
  orientation,
  palette,
}: {
  x: number
  y: number
  width: number
  height: number
  orientation: 'horizontal' | 'vertical'
  palette: ReturnType<typeof getPipePalette>
}) {
  return (
    <>
      <rect x={x} y={y} width={width} height={height} fill={palette.fill} stroke={palette.stroke} strokeWidth="4" />
      {[1, 2, 3].map((index) => {
        const ratio = index / 4
        if (orientation === 'horizontal') {
          const lineX = x + width * ratio
          return <line key={index} x1={lineX} y1={y + 6} x2={lineX} y2={y + height - 6} stroke="#f8fafc" strokeWidth="4" />
        }

        const lineY = y + height * ratio
        return <line key={index} x1={x + 6} y1={lineY} x2={x + width - 6} y2={lineY} stroke="#f8fafc" strokeWidth="4" />
      })}
    </>
  )
}

function ConnectorNode({ node }: { node: EditorNode; state?: RuntimeObjectState; animationSpeedMultiplier: number }) {
  const palette = getPipePalette(getNodePipeKind(node))
  const isHorizontal = node.width >= node.height

  return (
    <>
      <rect x="0" y="0" width={node.width} height={node.height} fill={palette.fill} stroke={palette.stroke} strokeWidth="4" />
      {[1, 2, 3].map((index) => {
        const stripeRatio = index / 4
        if (isHorizontal) {
          const x = node.width * stripeRatio
          return <line key={index} x1={x} y1="8" x2={x} y2={node.height - 8} stroke="#f8fafc" strokeWidth="5" />
        }
        const y = node.height * stripeRatio
        return <line key={index} x1="8" y1={y} x2={node.width - 8} y2={y} stroke="#f8fafc" strokeWidth="5" />
      })}
    </>
  )
}

function ElbowConnectorNode({ node }: { node: EditorNode; state?: RuntimeObjectState; animationSpeedMultiplier: number }) {
  const palette = getPipePalette(getNodePipeKind(node))
  const {
    pipeSize,
    outerStroke,
    capHorizontal,
    capVertical,
    startY,
    endX,
    pathData,
    rotation,
  } = getElbowConnectorGeometry(node)
  const rotationTransform = rotation ? `rotate(${rotation} ${node.width / 2} ${node.height / 2})` : undefined

  return (
    <>
      <g transform={rotationTransform}>
        <path d={pathData} fill="none" stroke={palette.stroke} strokeWidth={outerStroke} strokeLinecap="butt" strokeLinejoin="round" />
        <path d={pathData} fill="none" stroke={palette.fill} strokeWidth={pipeSize} strokeLinecap="butt" strokeLinejoin="round" />
        <ConnectorCap x={0} y={startY - capVertical.height / 2} width={capVertical.width} height={capVertical.height} orientation="vertical" palette={palette} />
        <ConnectorCap x={endX - capHorizontal.width / 2} y={node.height - capHorizontal.height} width={capHorizontal.width} height={capHorizontal.height} orientation="horizontal" palette={palette} />
      </g>
    </>
  )
}

function TeeConnectorNode({ node }: { node: EditorNode; state?: RuntimeObjectState; animationSpeedMultiplier: number }) {
  const palette = getPipePalette(getNodePipeKind(node))
  const {
    pipeSize,
    outerStroke,
    capHorizontal,
    capVertical,
    centerX,
    junctionY,
    horizontalPathData,
    verticalPathData,
    rotation,
  } = getTeeConnectorGeometry(node)
  const rotationTransform = rotation ? `rotate(${rotation} ${node.width / 2} ${node.height / 2})` : undefined

  return (
    <>
      <g transform={rotationTransform}>
        <path d={horizontalPathData} fill="none" stroke={palette.stroke} strokeWidth={outerStroke} strokeLinecap="butt" strokeLinejoin="round" />
        <path d={verticalPathData} fill="none" stroke={palette.stroke} strokeWidth={outerStroke} strokeLinecap="butt" strokeLinejoin="round" />
        <path d={horizontalPathData} fill="none" stroke={palette.fill} strokeWidth={pipeSize} strokeLinecap="butt" strokeLinejoin="round" />
        <path d={verticalPathData} fill="none" stroke={palette.fill} strokeWidth={pipeSize} strokeLinecap="butt" strokeLinejoin="round" />
        <ConnectorCap x={0} y={junctionY - capVertical.height / 2} width={capVertical.width} height={capVertical.height} orientation="vertical" palette={palette} />
        <ConnectorCap x={node.width - capVertical.width} y={junctionY - capVertical.height / 2} width={capVertical.width} height={capVertical.height} orientation="vertical" palette={palette} />
        <ConnectorCap x={centerX - capHorizontal.width / 2} y={0} width={capHorizontal.width} height={capHorizontal.height} orientation="horizontal" palette={palette} />
      </g>
    </>
  )
}

function FacilityNode({
  node,
  state,
  animationSpeedMultiplier,
}: {
  node: EditorNode
  state?: RuntimeObjectState
  animationSpeedMultiplier: number
}) {
  const definition = node.type === 'outfall' ? getNodeOutfallDefinition(node) : getNodeFacilityDefinition(node)
  const palette = getPipePalette(definition.waterKind)
  const ratio = getRuntimeFillRatio(state)
  const visibleRatio = ratio > FACILITY_VISIBLE_FILL_THRESHOLD ? ratio : 0
  const isOutfall = node.type === 'outfall'
  const facilityKind = node.type === 'facility' ? getNodeFacilityKind(node) : 'outfall'
  const pumpActive = facilityKind === 'stormPumpStation' && (
    visibleRatio >= STORM_PUMP_START_RATIO
    || Math.abs(state?.flowCms ?? 0) > STORM_PUMP_ACTIVE_FLOW_THRESHOLD_CMS
  )
  const centerX = node.width / 2
  const centerY = node.height * 0.62
  const overflowInnerX = 22
  const overflowInnerY = 44
  const overflowInnerWidth = Math.max(0, node.width - overflowInnerX * 2)
  const overflowInnerHeight = Math.max(0, node.height - overflowInnerY - 16)
  const overflowGrateWidth = Math.max(120, node.width - 72)
  const overflowGatePivotX = node.width * 0.43
  const overflowGatePivotY = overflowInnerY + overflowInnerHeight
  const overflowGateLength = Math.max(78, Math.min(node.width * 0.32, overflowInnerWidth * 0.42))
  const overflowGateThickness = Math.max(12, Math.min(20, node.height * 0.08))
  const overflowGateAngle = OVERFLOW_GATE_PREVIEW_ANIMATION
    ? -58
    : visibleRatio >= OVERFLOW_GATE_OPEN_RATIO ? 0 : -58
  const overflowGateStartAngle = visibleRatio >= OVERFLOW_GATE_OPEN_RATIO ? -58 : 0
  const overflowGateAnimationValues = OVERFLOW_GATE_PREVIEW_ANIMATION
    ? '-58;-58;0;0;-58;-58'
    : `${overflowGateStartAngle};${overflowGateAngle}`
  const overflowGateAnimationKeyTimes = OVERFLOW_GATE_PREVIEW_ANIMATION
    ? '0;0.18;0.42;0.68;0.92;1'
    : undefined
  const overflowGateAnimationSeconds = OVERFLOW_GATE_PREVIEW_ANIMATION ? 2.2 : 0.55
  const fillFrame = facilityKind === 'overflowChamber'
    ? {
      x: overflowInnerX,
      y: overflowInnerY,
      width: overflowInnerWidth,
      height: overflowInnerHeight,
    }
    : {
      x: 8,
      y: 8,
      width: node.width - 16,
      height: node.height - 16,
    }
  const facilityWaterOverlay = (
    <WaterFillRect
      id={node.id}
      x={fillFrame.x}
      y={fillFrame.y}
      width={fillFrame.width}
      height={fillFrame.height}
      ratio={visibleRatio}
      fill={palette.water}
      animationSpeedMultiplier={animationSpeedMultiplier}
    />
  )

  return (
    <>
      <rect x="0" y="0" width={node.width} height={node.height} rx="14" fill={definition.fill} stroke={definition.stroke} strokeWidth="4" />
      <defs>
        <clipPath id={`${safeSvgId(node.id)}-clip`}>
          <rect x="8" y="8" width={node.width - 16} height={node.height - 16} rx="10" />
        </clipPath>
      </defs>
      <rect x="8" y="8" width={node.width - 16} height={node.height - 16} rx="10" fill="rgba(255,255,255,.28)" />
      {isOutfall ? (
        <>
          <rect x={node.width - 78} y={node.height * 0.16} width="62" height={node.height * 0.68} rx="10" fill="#d6dce2" stroke="#6b7280" strokeWidth="4" />
          {[0.34, 0.5, 0.66].map((lineRatio) => (
            <line key={lineRatio} x1={node.width - 64} y1={node.height * lineRatio} x2={node.width - 30} y2={node.height * lineRatio} stroke="#6b7280" strokeWidth="6" strokeLinecap="round" />
          ))}
        </>
      ) : facilityKind === 'overflowChamber' ? (
        <>
          <rect x="36" y="12" width={overflowGrateWidth} height="18" rx="3" fill="#687383" stroke={definition.stroke} strokeWidth="2.5" />
          {Array.from({ length: 10 }, (_, index) => (
            <line
              key={index}
              x1={48 + index * (overflowGrateWidth - 24) / 9}
              y1="13"
              x2={48 + index * (overflowGrateWidth - 24) / 9}
              y2="29"
              stroke="#cbd5e1"
              strokeWidth="3"
            />
          ))}
          <rect
            x={overflowInnerX}
            y={overflowInnerY}
            width={overflowInnerWidth}
            height={overflowInnerHeight}
            rx="7"
            fill="#f8fafc"
            stroke="#94a3b8"
            strokeWidth="3"
          />
          <g transform={`translate(${overflowGatePivotX} ${overflowGatePivotY})`}>
            <g transform={`rotate(${overflowGateAngle})`}>
              <animateTransform
                attributeName="transform"
                begin="0s"
                type="rotate"
                values={overflowGateAnimationValues}
                keyTimes={overflowGateAnimationKeyTimes}
                dur={`${animationDuration(overflowGateAnimationSeconds, animationSpeedMultiplier)}s`}
                fill={OVERFLOW_GATE_PREVIEW_ANIMATION ? 'remove' : 'freeze'}
                repeatCount={OVERFLOW_GATE_PREVIEW_ANIMATION ? 'indefinite' : undefined}
              />
              <rect
                x="0"
                y={-overflowGateThickness}
                width={overflowGateLength}
                height={overflowGateThickness}
                rx="4"
                fill="#9ca3af"
                stroke={definition.stroke}
                strokeWidth="4"
              />
              <line
                x1="14"
                y1={-overflowGateThickness / 2}
                x2={overflowGateLength - 14}
                y2={-overflowGateThickness / 2}
                stroke="#dbeafe"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </g>
          </g>
          <text x={overflowInnerX + 64} y={overflowInnerY + overflowInnerHeight - 20} textAnchor="middle" className="select-none text-[13px] font-black" fill="#334155">일반 유량</text>
          <text x={node.width - 74} y={overflowInnerY + overflowInnerHeight - 42} textAnchor="middle" className="select-none text-[13px] font-black" fill="#334155">폭우 초과분</text>
        </>
      ) : facilityKind === 'stormPumpStation' ? (
        <>
          <rect x="28" y={centerY - 20} width={node.width * 0.26} height="40" rx="10" fill="#f8fbff" stroke="#8cc7ff" strokeWidth="3" />
          <rect x={node.width - node.width * 0.26 - 28} y={centerY - 20} width={node.width * 0.26} height="40" rx="20" fill="#f8fbff" stroke="#8cc7ff" strokeWidth="3" />
          <path d={`M${node.width * 0.28} ${centerY} H${centerX - 42} M${centerX + 42} ${centerY} H${node.width * 0.72}`} stroke={definition.stroke} strokeWidth="10" strokeLinecap="round" />
          <circle cx={centerX} cy={centerY} r="34" fill="#bfdbfe" stroke={definition.stroke} strokeWidth="6" />
          <g transform={`translate(${centerX} ${centerY})`}>
            <g>
              {pumpActive ? (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="360"
                  dur={`${animationDuration(1.3, animationSpeedMultiplier)}s`}
                  repeatCount="indefinite"
                />
              ) : null}
              <path d="M0 0 L25 -12 M0 0 L17 22 M0 0 L-25 12 M0 0 L-17 -22" stroke="#e9f5ff" strokeWidth="8" strokeLinecap="round" />
            </g>
            <circle r="14" fill="#1d4ed8" />
          </g>
        </>
      ) : facilityKind === 'waterReclamationCenter' ? (
        <>
          {Array.from({ length: 4 }, (_, index) => {
            const moduleWidth = Math.max(42, node.width * 0.16)
            const gap = Math.max(10, node.width * 0.035)
            const totalWidth = moduleWidth * 4 + gap * 3
            const startX = (node.width - totalWidth) / 2
            const moduleY = node.height * 0.58
            return (
              <rect
                key={index}
                x={startX + index * (moduleWidth + gap)}
                y={moduleY}
                width={moduleWidth}
                height="34"
                rx="7"
                fill="#f8fff9"
                stroke="#80d99b"
                strokeWidth="3"
              />
            )
          })}
        </>
      ) : (
        <circle cx={node.width / 2} cy={node.height * 0.62} r={Math.min(36, node.height * 0.25)} fill="rgba(255,255,255,.48)" stroke={definition.stroke} strokeWidth="5" />
      )}
      {facilityWaterOverlay}
    </>
  )
}

/** runtime state 중 실제 렌더링에 영향을 주는 값만 비교한다. */
function areRuntimeStatesEquivalent(first?: RuntimeObjectState, second?: RuntimeObjectState) {
  if (first === second) {
    return true
  }
  if (!first || !second) {
    return false
  }

  return (
    first.flowCms === second.flowCms &&
    first.maxVelocityMps === second.maxVelocityMps &&
    first.maxFullness === second.maxFullness &&
    first.maxDepthRatio === second.maxDepthRatio &&
    first.maxBlockageRatio === second.maxBlockageRatio &&
    first.maxCapacityRatio === second.maxCapacityRatio &&
    first.maxFloodingCms === second.maxFloodingCms &&
    first.totalInflowCms === second.totalInflowCms
  )
}

/** 노드 유형별 시각 요소와 runtime outline을 렌더링하는 시뮬레이션 노드 단위 컴포넌트다. */
const SimulationNode = memo(function SimulationNode({
  node,
  state,
  selected,
  targetSwmmId,
  reverseFlowThreshold,
  animationSpeedMultiplier,
  onSelectPreviewNode,
  onSelectBlockageTarget,
}: {
  node: EditorNode
  state?: RuntimeObjectState
  selected: boolean
  targetSwmmId?: string
  reverseFlowThreshold: number
  animationSpeedMultiplier: number
  onSelectPreviewNode?: (nodeId: string, targetSwmmId?: string) => void
  onSelectBlockageTarget: (swmmLinkId: string) => void
}) {
  const selectable = node.type !== 'terrain'

  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      onClick={selectable
        ? (event) => {
          event.stopPropagation()
          onSelectPreviewNode?.(node.id, targetSwmmId)
          if (targetSwmmId) {
            onSelectBlockageTarget(targetSwmmId)
          }
        }
        : undefined}
      className={selectable ? 'cursor-pointer' : undefined}
    >
      {node.type === 'terrain' ? <TerrainNode node={node} /> : null}
      {node.type === 'road' ? <RoadNode node={node} /> : null}
      {node.type === 'apartment' ? <ApartmentNode node={node} /> : null}
      {node.type === 'house' ? <HouseNode node={node} /> : null}
      {node.type === 'catchBasin' ? <CatchBasinNode node={node} state={state} animationSpeedMultiplier={animationSpeedMultiplier} /> : null}
      {node.type === 'manhole' ? <ManholeNode node={node} state={state} animationSpeedMultiplier={animationSpeedMultiplier} /> : null}
      {node.type === 'pipeSegment' ? (
        <PipeSegmentNode
          node={node}
          state={state}
          reverseFlowThreshold={reverseFlowThreshold}
          animationSpeedMultiplier={animationSpeedMultiplier}
        />
      ) : null}
      {node.type === 'connector' ? <ConnectorNode node={node} state={state} animationSpeedMultiplier={animationSpeedMultiplier} /> : null}
      {node.type === 'elbowConnector' ? <ElbowConnectorNode node={node} state={state} animationSpeedMultiplier={animationSpeedMultiplier} /> : null}
      {node.type === 'teeConnector' ? <TeeConnectorNode node={node} state={state} animationSpeedMultiplier={animationSpeedMultiplier} /> : null}
      {node.type === 'facility' || node.type === 'outfall' ? <FacilityNode node={node} state={state} animationSpeedMultiplier={animationSpeedMultiplier} /> : null}
      <RuntimeOutline node={node} state={state} selected={selected} />
    </g>
  )
}, (previous, next) => (
  previous.node === next.node &&
  previous.selected === next.selected &&
  previous.targetSwmmId === next.targetSwmmId &&
  previous.reverseFlowThreshold === next.reverseFlowThreshold &&
  previous.animationSpeedMultiplier === next.animationSpeedMultiplier &&
  previous.onSelectPreviewNode === next.onSelectPreviewNode &&
  previous.onSelectBlockageTarget === next.onSelectBlockageTarget &&
  areRuntimeStatesEquivalent(previous.state, next.state)
))

/** relation 링크를 희미한 가이드 선으로 표시해 편집 연결 구조를 보여준다. */
const RelationGuide = memo(function RelationGuide({
  nodesById,
  link,
}: {
  nodesById: Map<string, EditorNode>
  link: EditorLink
}) {
  if (link.type !== 'relation') {
    return null
  }

  const from = getEndpointPoint(nodesById, link.from, link.to)
  const to = getEndpointPoint(nodesById, link.to, link.from)
  if (!from || !to) {
    return null
  }

  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke="#475569"
      strokeWidth="2"
      strokeDasharray="7 7"
      opacity="0.16"
      pointerEvents="none"
    />
  )
}, (previous, next) => (
  previous.nodesById === next.nodesById &&
  previous.link === next.link
))

/** relation guide들을 별도 memo layer로 묶어 runtime tick 때 불필요한 재렌더를 줄인다. */
const RelationGuideLayer = memo(function RelationGuideLayer({
  relationLinks,
  nodesById,
}: {
  relationLinks: EditorLink[]
  nodesById: Map<string, EditorNode>
}) {
  return (
    <>
      {relationLinks.map((link) => <RelationGuide key={link.id} nodesById={nodesById} link={link} />)}
    </>
  )
}, (previous, next) => (
  previous.relationLinks === next.relationLinks &&
  previous.nodesById === next.nodesById
))

/** 본관/간선 파이프가 화면 왼쪽 밖으로 이어지는 표현을 독립 레이어로 렌더링한다. */
const UpstreamExtensionLayer = memo(function UpstreamExtensionLayer({
  nodes,
  bounds,
  leftEndpointRelationNodeIds,
  editorObjects,
  reverseFlowThreshold,
  animationSpeedMultiplier,
}: {
  nodes: EditorNode[]
  bounds: ViewBounds
  leftEndpointRelationNodeIds: Set<string>
  editorObjects: RuntimeEditorObjects | null
  reverseFlowThreshold: number
  animationSpeedMultiplier: number
}) {
  return (
    <>
      {nodes.map((node) => (
        <UpstreamPipeExtension
          key={`${node.id}-upstream-extension`}
          node={node}
          bounds={bounds}
          hasLeftEndpointRelation={leftEndpointRelationNodeIds.has(node.id)}
          state={editorObjects?.[node.id]}
          reverseFlowThreshold={reverseFlowThreshold}
          animationSpeedMultiplier={animationSpeedMultiplier}
        />
      ))}
    </>
  )
}, (previous, next) => (
  previous.nodes === next.nodes &&
  previous.bounds === next.bounds &&
  previous.leftEndpointRelationNodeIds === next.leftEndpointRelationNodeIds &&
  previous.editorObjects === next.editorObjects &&
  previous.reverseFlowThreshold === next.reverseFlowThreshold &&
  previous.animationSpeedMultiplier === next.animationSpeedMultiplier
))

/** 시뮬레이션 노드 목록을 runtime state와 막힘 target lookup에 연결해 렌더링한다. */
const SimulationNodeLayer = memo(function SimulationNodeLayer({
  nodes,
  editorObjects,
  selectedEditorId,
  selectedPreviewNodeId,
  blockageTargetByEditorId,
  reverseFlowThreshold,
  animationSpeedMultiplier,
  onSelectPreviewNode,
  onSelectBlockageTarget,
}: {
  nodes: EditorNode[]
  editorObjects: RuntimeEditorObjects | null
  selectedEditorId: string
  selectedPreviewNodeId?: string
  blockageTargetByEditorId: Map<string, SimulationBlockageTarget>
  reverseFlowThreshold: number
  animationSpeedMultiplier: number
  onSelectPreviewNode?: (nodeId: string, targetSwmmId?: string) => void
  onSelectBlockageTarget: (swmmLinkId: string) => void
}) {
  return (
    <>
      {nodes.map((node) => {
        const target = blockageTargetByEditorId.get(node.id)
        return (
          <SimulationNode
            key={node.id}
            node={node}
            state={editorObjects?.[node.id]}
            selected={Boolean(
              (selectedEditorId && selectedEditorId === node.id)
              || (selectedPreviewNodeId && selectedPreviewNodeId === node.id),
            )}
            targetSwmmId={target?.swmmLinkId}
            reverseFlowThreshold={reverseFlowThreshold}
            animationSpeedMultiplier={animationSpeedMultiplier}
            onSelectPreviewNode={onSelectPreviewNode}
            onSelectBlockageTarget={onSelectBlockageTarget}
          />
        )
      })}
    </>
  )
}, (previous, next) => (
  previous.nodes === next.nodes &&
  previous.editorObjects === next.editorObjects &&
  previous.selectedEditorId === next.selectedEditorId &&
  previous.selectedPreviewNodeId === next.selectedPreviewNodeId &&
  previous.blockageTargetByEditorId === next.blockageTargetByEditorId &&
  previous.reverseFlowThreshold === next.reverseFlowThreshold &&
  previous.animationSpeedMultiplier === next.animationSpeedMultiplier &&
  previous.onSelectPreviewNode === next.onSelectPreviewNode &&
  previous.onSelectBlockageTarget === next.onSelectBlockageTarget
))

/** 강수 비율에 따라 빗방울 animation overlay를 렌더링한다. */
const RainOverlay = memo(function RainOverlay({
  bounds,
  groundSurfaceY,
  rainfallPercent,
  animationSpeedMultiplier,
}: {
  bounds: ViewBounds
  groundSurfaceY: number
  rainfallPercent: number
  animationSpeedMultiplier: number
}) {
  const rainDropItems = useMemo(
    () => createRainDropItems(bounds, groundSurfaceY),
    [bounds, groundSurfaceY],
  )

  if (rainfallPercent <= 0) {
    return null
  }

  const opacity = Math.max(0.18, Math.min(0.75, rainfallPercent / 100))

  return (
    <g opacity={opacity} pointerEvents="none">
      {rainDropItems.drops.map((drop) => (
          <line key={drop.index} x1={drop.x} y1={drop.y} x2={drop.x - 8} y2={drop.y + drop.length} stroke="#3b82f6" strokeWidth="3" strokeLinecap="round">
            <animateTransform
              attributeName="transform"
              type="translate"
              from="0 -80"
              to={`0 ${rainDropItems.fallDistance}`}
              dur={`${animationDuration(drop.durationBaseSeconds, animationSpeedMultiplier)}s`}
              begin={`${drop.beginSeconds}s`}
              repeatCount="indefinite"
            />
          </line>
      ))}
    </g>
  )
}, (previous, next) => (
  previous.bounds === next.bounds &&
  previous.groundSurfaceY === next.groundSurfaceY &&
  previous.rainfallPercent === next.rainfallPercent &&
  previous.animationSpeedMultiplier === next.animationSpeedMultiplier
))

/** 저장된 배수도 layout과 runtime snapshot을 SVG 시뮬레이션 화면으로 렌더링한다. */
export function SimulationLayoutPreview({
  layout,
  snapshot,
  rainfallPercent,
  animationSpeedMultiplier,
  animationsActive = true,
  fullscreenZoom = 1,
  fullscreenViewResetSignal = 0,
  onFullscreenZoomChange,
  onFullscreenLiveZoomChange,
  theme = 'light',
  isFullscreen = false,
  selectedPreviewNodeId,
  selectedBlockageId,
  blockageTargets,
  onToggleFullscreen,
  onClearSelection,
  onSelectPreviewNode,
  onSelectBlockageTarget,
}: SimulationLayoutPreviewProps) {
  const isDark = theme === 'dark'
  const bounds = useMemo(() => computeViewBounds(layout), [layout])
  const svgWidth = Math.max(960, bounds.width)
  const svgHeight = bounds.height
  const svgBounds = useMemo(() => createSvgBounds(bounds, svgWidth, svgHeight), [bounds, svgHeight, svgWidth])
  const baseGroundBounds = useMemo(() => computeBaseGroundBounds(layout, svgBounds), [layout, svgBounds])
  const previewMaxHeight = Math.max(360, Math.min(680, svgHeight * PREVIEW_SCALE))
  const selectedEditorId = getSelectedEditorId(selectedBlockageId, blockageTargets)
  const reverseFlowThreshold = getReverseFlowThreshold(snapshot)
  const nodesById = useMemo(() => createNodesById(layout.nodes), [layout.nodes])
  const relationLinks = useMemo(
    () => layout.links.filter((link) => link.type === 'relation'),
    [layout.links],
  )
  const leftEndpointRelationNodeIds = useMemo(
    () => createLeftEndpointRelationNodeIds(relationLinks),
    [relationLinks],
  )
  const blockageTargetByEditorId = useMemo(
    () => createBlockageTargetByEditorId(blockageTargets),
    [blockageTargets],
  )
  const [fullscreenPan, setFullscreenPan] = useState({ x: 0, y: 0 })
  const fullscreenDragRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    screenToSvg: 1,
    hasMoved: false,
  })
  const suppressNextFullscreenClickRef = useRef(false)
  const fullscreenRootRef = useRef<HTMLDivElement | null>(null)
  const fullscreenContentRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const fullscreenZoomRef = useRef(1)
  const mobileFullscreenPinchZoomRef = useRef<MobileFullscreenPinchZoomState | null>(null)
  const mobileFullscreenPinchAnchorRef = useRef<MobileFullscreenPinchAnchor | null>(null)
  const mobileFullscreenPinchFrameRef = useRef<number | null>(null)
  const mobileFullscreenPendingZoomRef = useRef<number | null>(null)
  const [isMobileInput, setIsMobileInput] = useState(false)
  const applyMobileFullscreenZoom = useCallback((zoom: number, anchor?: MobileFullscreenPinchAnchor | null) => {
    const root = fullscreenRootRef.current
    const content = fullscreenContentRef.current
    if (!root || !content) {
      return
    }

    const scale = Math.max(FULLSCREEN_ZOOM_MIN, zoom)
    content.style.width = `${scale * 100}%`
    content.style.height = `${scale * 100}%`

    if (anchor) {
      const rect = root.getBoundingClientRect()
      root.scrollLeft = anchor.contentX * scale - (anchor.clientX - rect.left)
      root.scrollTop = anchor.contentY * scale - (anchor.clientY - rect.top)
    }
  }, [])

  useEffect(() => {
    fullscreenZoomRef.current = fullscreenZoom
    if (isFullscreen && isMobileInput && !mobileFullscreenPinchZoomRef.current) {
      applyMobileFullscreenZoom(fullscreenZoom)
    }
  }, [applyMobileFullscreenZoom, fullscreenZoom, isFullscreen, isMobileInput])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined
    }

    const mediaQuery = window.matchMedia('(pointer: coarse), (max-width: 1023px)')
    const syncInputMode = () => setIsMobileInput(mediaQuery.matches)
    syncInputMode()
    mediaQuery.addEventListener('change', syncInputMode)

    return () => mediaQuery.removeEventListener('change', syncInputMode)
  }, [])
  const runtimeViewBox = useMemo(() => {
    if (isFullscreen && isMobileInput) {
      return `${bounds.minX} ${bounds.minY} ${svgWidth} ${svgHeight}`
    }

    const safeZoom = Math.max(FULLSCREEN_ZOOM_MIN, isFullscreen ? fullscreenZoom : 1)
    const viewWidth = svgWidth / safeZoom
    const viewHeight = svgHeight / safeZoom
    const centerX = bounds.minX + svgWidth / 2 - (isFullscreen ? fullscreenPan.x : 0)
    const centerY = bounds.minY + svgHeight / 2 - (isFullscreen ? fullscreenPan.y : 0)

    return `${centerX - viewWidth / 2} ${centerY - viewHeight / 2} ${viewWidth} ${viewHeight}`
  }, [bounds.minX, bounds.minY, fullscreenPan.x, fullscreenPan.y, fullscreenZoom, isFullscreen, isMobileInput, svgHeight, svgWidth])
  const sortedNodes = useMemo(() => {
    const nodeIndex = new Map(layout.nodes.map((node, index) => [node.id, index]))
    return [...layout.nodes].sort((first, second) => {
      const layerDelta = getNodeLayer(first) - getNodeLayer(second)
      if (layerDelta !== 0) {
        return layerDelta
      }

      const zDelta = getNodeZOrder(first) - getNodeZOrder(second)
      if (zDelta !== 0) {
        return zDelta
      }

      return (nodeIndex.get(first.id) ?? 0) - (nodeIndex.get(second.id) ?? 0)
    })
  }, [layout.nodes])
  useEffect(() => {
    const svgElement = svgRef.current
    if (!svgElement) {
      return
    }

    if (animationsActive) {
      svgElement.unpauseAnimations()
    } else {
      svgElement.pauseAnimations()
    }
  }, [animationsActive, snapshot])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setFullscreenPan({ x: 0, y: 0 })
      if (isMobileInput) {
        fullscreenRootRef.current?.scrollTo({ left: 0, top: 0 })
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [fullscreenViewResetSignal, isMobileInput])

  useEffect(() => {
    const root = fullscreenRootRef.current
    if (!root || !isFullscreen || !isMobileInput || !onFullscreenZoomChange) {
      mobileFullscreenPinchZoomRef.current = null
      mobileFullscreenPinchAnchorRef.current = null
      mobileFullscreenPendingZoomRef.current = null
      if (mobileFullscreenPinchFrameRef.current !== null) {
        window.cancelAnimationFrame(mobileFullscreenPinchFrameRef.current)
        mobileFullscreenPinchFrameRef.current = null
      }
      return undefined
    }

    const flushPinchZoomFrame = () => {
      const nextZoom = mobileFullscreenPendingZoomRef.current
      if (nextZoom === null) {
        return fullscreenZoomRef.current
      }

      mobileFullscreenPendingZoomRef.current = null
      fullscreenZoomRef.current = nextZoom
      applyMobileFullscreenZoom(nextZoom, mobileFullscreenPinchAnchorRef.current)
      onFullscreenLiveZoomChange?.(nextZoom)
      return nextZoom
    }

    const schedulePinchZoomFrame = (nextZoom: number) => {
      mobileFullscreenPendingZoomRef.current = nextZoom
      if (mobileFullscreenPinchFrameRef.current !== null) {
        return
      }

      mobileFullscreenPinchFrameRef.current = window.requestAnimationFrame(() => {
        mobileFullscreenPinchFrameRef.current = null
        flushPinchZoomFrame()
      })
    }

    const finishPinchZoom = () => {
      const nextZoom = mobileFullscreenPendingZoomRef.current ?? fullscreenZoomRef.current
      if (mobileFullscreenPinchFrameRef.current !== null) {
        window.cancelAnimationFrame(mobileFullscreenPinchFrameRef.current)
        mobileFullscreenPinchFrameRef.current = null
      }
      mobileFullscreenPendingZoomRef.current = null
      mobileFullscreenPinchZoomRef.current = null
      fullscreenZoomRef.current = nextZoom
      applyMobileFullscreenZoom(nextZoom, mobileFullscreenPinchAnchorRef.current)
      onFullscreenLiveZoomChange?.(nextZoom)
      onFullscreenZoomChange(nextZoom)
      mobileFullscreenPinchAnchorRef.current = null
    }

    const getPinchDistance = (touches: TouchList) => {
      const first = touches[0]
      const second = touches[1]
      return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
    }

    const getPinchCenter = (touches: TouchList) => {
      const first = touches[0]
      const second = touches[1]
      return {
        clientX: (first.clientX + second.clientX) / 2,
        clientY: (first.clientY + second.clientY) / 2,
      }
    }

    const startPinchZoom = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        return
      }

      const distance = getPinchDistance(event.touches)
      if (!Number.isFinite(distance) || distance < 8) {
        return
      }

      event.preventDefault()
      const center = getPinchCenter(event.touches)
      const rect = root.getBoundingClientRect()
      const currentZoom = fullscreenZoomRef.current
      const currentScale = Math.max(FULLSCREEN_ZOOM_MIN, currentZoom)
      const anchorContentX = (root.scrollLeft + center.clientX - rect.left) / currentScale
      const anchorContentY = (root.scrollTop + center.clientY - rect.top) / currentScale

      mobileFullscreenPinchZoomRef.current = {
        startDistance: distance,
        startZoom: currentZoom,
        anchorContentX,
        anchorContentY,
        anchorClientX: center.clientX,
        anchorClientY: center.clientY,
      }
      mobileFullscreenPinchAnchorRef.current = {
        contentX: anchorContentX,
        contentY: anchorContentY,
        clientX: center.clientX,
        clientY: center.clientY,
      }
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        startPinchZoom(event)
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        finishPinchZoom()
        return
      }

      if (!mobileFullscreenPinchZoomRef.current) {
        startPinchZoom(event)
      }

      const pinch = mobileFullscreenPinchZoomRef.current
      if (!pinch) {
        return
      }

      const distance = getPinchDistance(event.touches)
      if (!Number.isFinite(distance) || distance <= 0) {
        return
      }

      event.preventDefault()
      const nextZoom = Math.max(FULLSCREEN_ZOOM_MIN, pinch.startZoom * (distance / pinch.startDistance))
      mobileFullscreenPinchAnchorRef.current = {
        contentX: pinch.anchorContentX,
        contentY: pinch.anchorContentY,
        clientX: pinch.anchorClientX,
        clientY: pinch.anchorClientY,
      }
      schedulePinchZoomFrame(nextZoom)
    }

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        finishPinchZoom()
      }
    }

    root.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true })
    root.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true })
    root.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true })
    root.addEventListener('touchcancel', handleTouchEnd, { passive: false, capture: true })

    return () => {
      if (mobileFullscreenPinchFrameRef.current !== null) {
        window.cancelAnimationFrame(mobileFullscreenPinchFrameRef.current)
        mobileFullscreenPinchFrameRef.current = null
      }
      mobileFullscreenPendingZoomRef.current = null
      root.removeEventListener('touchstart', handleTouchStart, { capture: true })
      root.removeEventListener('touchmove', handleTouchMove, { capture: true })
      root.removeEventListener('touchend', handleTouchEnd, { capture: true })
      root.removeEventListener('touchcancel', handleTouchEnd, { capture: true })
    }
  }, [applyMobileFullscreenZoom, isFullscreen, isMobileInput, onFullscreenLiveZoomChange, onFullscreenZoomChange])

  const handleFullscreenPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isFullscreen || isMobileInput || event.pointerType === 'mouse') {
      return
    }

    const rect = svgRef.current?.getBoundingClientRect()
    const safeZoom = Math.max(FULLSCREEN_ZOOM_MIN, fullscreenZoom)
    const viewWidth = svgWidth / safeZoom
    const viewHeight = svgHeight / safeZoom
    const viewportScale = rect
      ? Math.min(rect.width / viewWidth, rect.height / viewHeight)
      : 1

    fullscreenDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: fullscreenPan.x,
      originY: fullscreenPan.y,
      screenToSvg: viewportScale > 0 ? 1 / viewportScale : 1,
      hasMoved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleFullscreenPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = fullscreenDragRef.current
    if (drag.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (Math.abs(deltaX) > FULLSCREEN_DRAG_THRESHOLD_PX || Math.abs(deltaY) > FULLSCREEN_DRAG_THRESHOLD_PX) {
      drag.hasMoved = true
    }

    setFullscreenPan({
      x: drag.originX + deltaX * drag.screenToSvg,
      y: drag.originY + deltaY * drag.screenToSvg,
    })
  }

  const handleFullscreenPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const drag = fullscreenDragRef.current
    if (drag.pointerId !== event.pointerId) {
      return
    }

    suppressNextFullscreenClickRef.current = drag.hasMoved
    fullscreenDragRef.current = {
      pointerId: -1,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0,
      screenToSvg: 1,
      hasMoved: false,
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const getFullscreenViewportMetrics = useCallback((zoom: number, pan = fullscreenPan) => {
    const safeZoom = Math.max(FULLSCREEN_ZOOM_MIN, zoom)
    const viewWidth = svgWidth / safeZoom
    const viewHeight = svgHeight / safeZoom
    const centerX = bounds.minX + svgWidth / 2 - pan.x
    const centerY = bounds.minY + svgHeight / 2 - pan.y

    return {
      viewWidth,
      viewHeight,
      minX: centerX - viewWidth / 2,
      minY: centerY - viewHeight / 2,
    }
  }, [bounds.minX, bounds.minY, fullscreenPan, svgHeight, svgWidth])

  const getWheelDeltaPixels = useCallback((event: WheelEvent) => {
    if (event.deltaMode === window.WheelEvent.DOM_DELTA_LINE) {
      return {
        x: event.deltaX * WHEEL_LINE_HEIGHT_PX,
        y: event.deltaY * WHEEL_LINE_HEIGHT_PX,
      }
    }

    if (event.deltaMode === window.WheelEvent.DOM_DELTA_PAGE) {
      return {
        x: event.deltaX * window.innerWidth,
        y: event.deltaY * window.innerHeight,
      }
    }

    return {
      x: event.deltaX,
      y: event.deltaY,
    }
  }, [])

  const handleFullscreenWheel = useCallback((event: WheelEvent) => {
    if (!isFullscreen || isMobileInput) {
      return
    }

    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    event.preventDefault()
    const currentZoom = Math.max(FULLSCREEN_ZOOM_MIN, fullscreenZoom)
    const currentView = getFullscreenViewportMetrics(currentZoom)
    const viewportScale = Math.min(rect.width / currentView.viewWidth, rect.height / currentView.viewHeight)
    if (!Number.isFinite(viewportScale) || viewportScale <= 0) {
      return
    }

    if (event.ctrlKey || event.metaKey) {
      if (!onFullscreenZoomChange) {
        return
      }

      const direction = event.deltaY < 0 ? 1 : -1
      const nextZoom = Math.max(FULLSCREEN_ZOOM_MIN, currentZoom + direction * FULLSCREEN_WHEEL_ZOOM_STEP)
      const renderedWidth = currentView.viewWidth * viewportScale
      const renderedHeight = currentView.viewHeight * viewportScale
      const offsetX = (rect.width - renderedWidth) / 2
      const offsetY = (rect.height - renderedHeight) / 2
      const focusX = clamp((event.clientX - rect.left - offsetX) / renderedWidth, 0, 1)
      const focusY = clamp((event.clientY - rect.top - offsetY) / renderedHeight, 0, 1)
      const focusSvgX = currentView.minX + focusX * currentView.viewWidth
      const focusSvgY = currentView.minY + focusY * currentView.viewHeight
      const nextViewWidth = svgWidth / nextZoom
      const nextViewHeight = svgHeight / nextZoom
      const baseCenterX = bounds.minX + svgWidth / 2
      const baseCenterY = bounds.minY + svgHeight / 2

      setFullscreenPan({
        x: baseCenterX - focusSvgX + (focusX - 0.5) * nextViewWidth,
        y: baseCenterY - focusSvgY + (focusY - 0.5) * nextViewHeight,
      })
      onFullscreenZoomChange(nextZoom)
      return
    }

    const delta = getWheelDeltaPixels(event)
    setFullscreenPan((current) => ({
      x: current.x - delta.x / viewportScale,
      y: current.y - delta.y / viewportScale,
    }))
  }, [
    bounds.minX,
    bounds.minY,
    fullscreenZoom,
    getFullscreenViewportMetrics,
    getWheelDeltaPixels,
    isFullscreen,
    isMobileInput,
    onFullscreenZoomChange,
    svgHeight,
    svgWidth,
  ])

  useEffect(() => {
    const rootElement = fullscreenRootRef.current
    if (!isFullscreen || !rootElement) {
      return undefined
    }

    rootElement.addEventListener('wheel', handleFullscreenWheel, { passive: false })

    return () => {
      rootElement.removeEventListener('wheel', handleFullscreenWheel)
    }
  }, [handleFullscreenWheel, isFullscreen])

  const previewSvg = (
    <svg
      ref={svgRef}
      data-simulation-preview-svg="true"
      viewBox={runtimeViewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="편집 JSON 기반 실시간 시뮬레이션 미리보기"
      onClick={onClearSelection}
      className={isFullscreen ? 'block' : 'block h-auto w-full min-w-0'}
      style={isFullscreen ? {
        width: isMobileInput ? '100%' : '100vw',
        height: isMobileInput ? '100%' : '100dvh',
        maxWidth: isMobileInput ? 'none' : '100vw',
        maxHeight: isMobileInput ? 'none' : '100dvh',
      } : { maxHeight: previewMaxHeight }}
    >
      <defs>
        <filter id="urgent-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#ef4444" floodOpacity="0.9" />
        </filter>
        <filter id="selected-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#f97316" floodOpacity="0.95" />
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#7c2d12" floodOpacity="0.5" />
        </filter>
      </defs>
      <rect
        x={svgBounds.minX}
        y={svgBounds.minY}
        width={svgBounds.width}
        height={layout.groundSurfaceY - svgBounds.minY}
        fill="#e8f5ff"
      />
      <SoilBackground
        minX={baseGroundBounds.left}
        topY={baseGroundBounds.top}
        width={baseGroundBounds.width}
        height={baseGroundBounds.height}
      />
      <RelationGuideLayer relationLinks={relationLinks} nodesById={nodesById} />
      <UpstreamExtensionLayer
        nodes={sortedNodes}
        bounds={bounds}
        leftEndpointRelationNodeIds={leftEndpointRelationNodeIds}
        editorObjects={snapshot?.editorObjects ?? null}
        reverseFlowThreshold={reverseFlowThreshold}
        animationSpeedMultiplier={animationSpeedMultiplier}
      />
      <SimulationNodeLayer
        nodes={sortedNodes}
        editorObjects={snapshot?.editorObjects ?? null}
        selectedEditorId={selectedEditorId}
        selectedPreviewNodeId={selectedPreviewNodeId}
        blockageTargetByEditorId={blockageTargetByEditorId}
        reverseFlowThreshold={reverseFlowThreshold}
        animationSpeedMultiplier={animationSpeedMultiplier}
        onSelectPreviewNode={onSelectPreviewNode}
        onSelectBlockageTarget={onSelectBlockageTarget}
      />
      <RainOverlay bounds={svgBounds} groundSurfaceY={layout.groundSurfaceY} rainfallPercent={rainfallPercent} animationSpeedMultiplier={animationSpeedMultiplier} />
      <ObjectLabelLayer nodes={sortedNodes} editorObjects={snapshot?.editorObjects ?? null} />
    </svg>
  )

  if (isFullscreen) {
    const mobileFullscreenCanvasScale = isMobileInput ? Math.max(FULLSCREEN_ZOOM_MIN, fullscreenZoom) : 1

    return (
      <div
        ref={fullscreenRootRef}
        className={`fixed inset-0 z-[90] ${isDark ? 'bg-slate-950' : 'bg-white'} ${
          isMobileInput
            ? 'overflow-auto overscroll-contain'
            : 'flex touch-none cursor-grab items-center justify-center overflow-hidden active:cursor-grabbing'
        }`}
        style={isMobileInput ? { touchAction: 'pan-x pan-y' } : undefined}
        onPointerDown={handleFullscreenPointerDown}
        onPointerMove={handleFullscreenPointerMove}
        onPointerUp={handleFullscreenPointerEnd}
        onPointerCancel={handleFullscreenPointerEnd}
        onClickCapture={(event) => {
          if (suppressNextFullscreenClickRef.current) {
            suppressNextFullscreenClickRef.current = false
            event.preventDefault()
            event.stopPropagation()
          }
        }}
      >
        <div
          ref={fullscreenContentRef}
          className={isMobileInput ? 'h-full w-full' : 'will-change-transform'}
          style={isMobileInput ? {
            minWidth: '100%',
            minHeight: '100%',
            width: `${mobileFullscreenCanvasScale * 100}%`,
            height: `${mobileFullscreenCanvasScale * 100}%`,
          } : undefined}
        >
          {previewSvg}
        </div>
      </div>
    )
  }

  return (
    <div className={`mt-5 rounded-md border p-3 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className={`text-sm font-black ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>편집 JSON 런타임 뷰</h3>
          <div className={`mt-2 flex flex-wrap items-center gap-2 text-[11px] font-black ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>
            <span className={isDark ? 'text-slate-400' : 'text-slate-400'}>물 종류</span>
            {WATER_TYPE_LEGEND.map((item) => (
              <span key={item.id} className="inline-flex items-center gap-1">
                <span
                  className="h-3 w-5 rounded-sm border"
                  style={{ backgroundColor: item.color, borderColor: item.border }}
                />
                {item.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
          <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">날씨 {getWeatherPresetLabel(rainfallPercent)}</span>
          <span className="rounded-full bg-slate-200 px-2 py-1 text-slate-600">
            {snapshot ? `tick ${snapshot.stepIndex}` : '엔진 대기'}
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="min-w-0">
          <div className={`relative min-w-0 overflow-hidden rounded-md border px-2 py-16 sm:py-20 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-sky-50'}`}>
            {previewSvg}
            {onToggleFullscreen ? (
              <button
                type="button"
                onClick={onToggleFullscreen}
                aria-label="시뮬레이션 전체화면"
                title="시뮬레이션 전체화면"
                className={`absolute right-2 top-2 z-30 flex h-12 w-12 items-center justify-center rounded-full border shadow-xl backdrop-blur transition ${
                  isDark
                    ? 'border-white bg-white text-slate-950 hover:bg-slate-100'
                    : 'border-slate-950 bg-slate-950 text-white hover:bg-slate-900'
                }`}
              >
                <FullscreenToggleIcon isFullscreen={isFullscreen} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
