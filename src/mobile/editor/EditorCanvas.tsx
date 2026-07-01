import {
  type CSSProperties,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  EDITOR_CANVAS_HEIGHT,
  EDITOR_CANVAS_WIDTH,
  EDITOR_CONNECTOR_LONG_SIDE,
  EDITOR_CONNECTOR_SHORT_SIDE,
  createDefaultEditorLayout,
  createEditorNode,
  createEditorPorts,
} from './defaultLayout'
import {
  ATTACH_ANCHOR_EDGE_EPSILON,
  ATTACH_ANCHOR_GUARD_FIXED_BRANCH_TYPES,
  ATTACH_ANCHOR_RESIZE_MARGIN,
  CANVAS_BOTTOM_PADDING,
  CANVAS_RIGHT_PADDING,
  CONNECTOR_TYPE_OPTIONS,
  CONNECTOR_PORTS,
  DEFAULT_PIPE_KIND,
  ENABLE_ATTACH_ANCHOR_RESIZE_GUARD,
  ENABLE_BASIC_PIPE_MANHOLE_RESIZE_RULE,
  ENABLE_FIXED_Y_VERTICAL_TOP_RESIZE_AS_BOTTOM_RULE,
  ENABLE_PARENT_CHILD_PROPAGATION_RULE,
  ENABLE_REVERSE_PARENT_PROPAGATION_RULE,
  FACILITY_KIND_LABELS,
  FACILITY_TYPE_OPTIONS,
  LOWER_SIDE_PORT_BOTTOM_GAP,
  MANHOLE_KIND_LABELS,
  MANHOLE_KIND_OPTIONS,
  MIN_MANHOLE_HEIGHT,
  MIN_PIPE_SEGMENT_LENGTH,
  MIN_ROAD_WIDTH,
  MIN_TERRAIN_HEIGHT,
  MIN_TERRAIN_WIDTH,
  NODE_LABELS,
  OUTFALL_KIND_LABELS,
  OUTFALL_KIND_OPTIONS,
  PIPE_BORDER,
  PIPE_KIND_LABELS,
  PIPE_KIND_OPTIONS,
  PIPE_SIZE_LABELS,
  PIPE_SIZE_OPTIONS,
  PIPE_THICKNESS,
  SELECTABLE_FACILITY_KIND_OPTIONS,
  SWMM_ENGINE_URL,
  TERRAIN_KIND_BY_ID,
  TERRAIN_KIND_LABELS,
  TERRAIN_KIND_OPTIONS,
  type LayoutAddKind,
} from './editorDefinitions'
import {
  clampNumber,
  getNodeCenter,
  getSvgCursor,
  normalizeRect,
} from './editorGeometry'
import { SoilBackground } from '../diagram/SoilBackground'
import { useLayoutIndexes } from '../diagram/useLayoutIndexes'
import { useRafCoalescedCallback } from '../diagram/useRafCoalescedCallback'
import { downloadSvgAsPng } from '../simulation/pngExport'
import { EditorActionToolbar } from './EditorActionToolbar'
import { LayoutAddHandles, MobileLayoutAddEdgeButtons, PipeResizeHandles } from './EditorAffordances'
import { EditorContextMenu } from './EditorContextMenu'
import { EditableNode } from './EditableNode'
import { EditorScenarioToolbar } from './EditorScenarioToolbar'
import { SelectionPanel, SummaryCard } from './EditorSelectionPanel'
import { apiClient } from '../../services/http/apiClient'
import { isDemoControlLocked } from '../../services/demoControlLock'
import { getInitialAppSurface, subscribeAppSurfaceChange } from '../../app/deviceSurface'
import {
  endpointKey,
  getEndpointPoint,
  getEndpointPointWithCounterpart,
  getEndpointPort,
  getEndpointForNode,
  getOtherRelationEndpoint,
  getRelationAncestorNodeIds,
  getRelationIdForEndpointPair,
  getRelationLinkForPort,
  getRelationLinksForNode,
  getRelationSideNodeIds,
  normalizeRelationAttachments,
  shouldUseStraightRoute,
  wouldCreateRelationCycle,
} from './editorRelations'
import {
  isFixedYNode,
  hasFixedYNodeInNodeIds,
  getElbowConnectorRotation,
  getTeeConnectorRotation,
  getPipeSegmentRotation,
  rotateSideClockwise,
  getElbowConnectorPorts,
  getTeeConnectorPorts,
  getTeeBaseSideForPort,
  getNodePort,
  getPortPoint,
  getLowerSideAttachmentCounterpartHalfSpan,
  getHeightForLowerSideAttachmentOffset,
  getAttachedPortPoint,
  isEditorPipeSize,
  normalizePipeKind,
  normalizeFacilityKind,
  normalizeOutfallKind,
  normalizeManholeKind,
  normalizeTerrainKind,
  getNodeOrientation,
  getAttachCandidatePorts,
  getNodeFacilityKind,
  getNodeManholeKind,
  getNodeOutfallKind,
  getNodePipeKind,
  getNodePipeSize,
  getNodeTerrainKind,
  normalizeNodeGeometryForPipePreset,
  normalizeNodePorts,
  resizeNodeForFacilityKind,
  resizeNodeForManholeKind,
  resizeNodeForOutfallKind,
  resizeNodeForPipeSize,
  resizeNodeForTerrainKind,
  resizeNodeForType,
} from './editorNodeHelpers'
import { clearEditorLayout, isEditorLayout } from './layoutStorage'
import { EditableLink } from './EditorLinkRenderer'
import {
  createRenderedPortRelationLookup,
  getAttachResizableEdges,
  getManualResizableEdges,
  getNodeRenderablePorts,
  getRenderedPortPoint,
  getRenderedPortPointFromLookup,
  hasManualResizableEdge,
  type RenderedPortRelationLookup,
} from './editorNodeRenderData'
import {
  createRenderedNodes,
  reorderNodesByZOrder,
  type NodeZOrderAction,
} from './editorRenderOrder'
import { snapNodeToGround } from './editorNodePlacement'
import {
  createCopiedEditorSelection,
  getExpandedRelationGroupNodeIds,
  getMarqueeSelectedNodeIds,
  getOriginNodes,
  getRelationGroupNodeIds,
  getSelectionNodeIds,
  pasteCopiedEditorSelection,
} from './editorSelection'
import { useEditorLayoutState } from './useEditorLayoutState'
import { EditableNodeLayer } from './EditableNodeLayer'
import {
  createSwmmScenario,
  deleteSwmmScenario,
  getSwmmScenarios,
  joinSwmmApiUrl,
  updateSwmmScenario,
  type SwmmScenario,
} from '../../services/swmm/client'
import {
  clearSelectedSwmmScenarioId,
  loadSelectedSwmmScenarioId,
  saveSelectedSwmmScenarioId,
} from '../../services/swmm/scenarioSelectionStorage'
import { InfoPanelFrame } from '../layout/InfoPanelLayout'
import { WORKBENCH_THEME_TOKENS, type WorkbenchTheme } from '../theme/workbenchTheme'
import { MobileBottomSheet } from '../ui/MobileBottomSheet'
import { MobileFloatingActionButton } from '../ui/MobileFloatingActionButton'
import { CloseIcon, GearIcon, MapPinIcon, PlusIcon, RedoIcon, UndoIcon } from '../ui/MobileIcons'
import { MobilePortal } from '../ui/MobilePortal'
import { MobileZoomControls, type MobileZoomControlsHandle } from '../ui/MobileZoomControls'
import { useBodyScrollLock } from '../ui/useBodyScrollLock'
import {
  type EditorEndpoint,
  type EditorLayout,
  type EditorLink,
  type EditorNode,
  type EditorNodeType,
  type EditorPipeSize,
  type EditorPort,
  type EditorPortSelection,
  type EditorSelection,
} from './editorTypes'
import type {
  ChangeAxis,
  ChildPropagationOptions,
  ContextMenuState,
  CoordinateEditState,
  CoordinateEditableRelationInfo,
  CopiedEditorSelection,
  DragState,
  LayoutAddSide,
  MarqueeSelectionState,
  Point,
  RectBounds,
  RelationPortRole,
  ResizeAnchorBounds,
  ResizeAnchorPoint,
  ResizeEdge,
  ResizeState,
} from './editorInternalTypes'

const EDITOR_ZOOM_MIN = 0.5
const EDITOR_ZOOM_STEP = 0.25
const EDITOR_ZOOM_DEFAULT = 1
const EDITOR_WHEEL_ZOOM_STEP = 0.15
const EDITOR_WHEEL_LINE_HEIGHT_PX = 16
const RELATION_PREVIEW_ZOOM_MIN = 0.5
const RELATION_PREVIEW_ZOOM_STEP = 0.25
const RELATION_PREVIEW_ZOOM_DEFAULT = 1
const MOBILE_TAP_MAX_DISTANCE_PX = 10
const MOBILE_RESIZE_STEP = 40
const MOBILE_MOVE_STEP = 40
const MOBILE_ADD_PREVIEW_OFFSET_Y_PX = 32
const MOBILE_QUICK_EDIT_CAPSULE_WIDTH = 1120
const MOBILE_QUICK_EDIT_CAPSULE_HEIGHT = 360
const MOBILE_QUICK_EDIT_CAPSULE_GAP = 36
// 테스트 기간에는 기존 바텀시트형 quick edit를 끄고 객체 근처 캡슐 UI를 노출한다.
const ENABLE_MOBILE_QUICK_EDIT_SHEET = false
type MobileEditorInteractionMode = 'idle' | 'move' | 'resize'
type MobileQuickEditPanel = 'type' | 'detail' | 'size'
type MobileQuickEditActionKey = 'type' | 'detail' | 'size' | 'length' | 'relation' | 'move' | 'info' | 'delete'
const MOBILE_QUICK_EDIT_TYPE_OPTIONS: EditorNodeType[] = FACILITY_TYPE_OPTIONS
type MobilePinchZoomState = {
  startDistance: number
  startZoom: number
  anchorContentX: number
  anchorContentY: number
  anchorClientX: number
  anchorClientY: number
}
type MobilePinchScrollAnchor = {
  contentX: number
  contentY: number
  clientX: number
  clientY: number
}
type RelationPreviewMode = 'parent' | 'child'

function MobileQuickEditOptionButton({
  label,
  active,
  isDark,
  onClick,
}: {
  label: string
  active: boolean
  isDark: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-black leading-tight transition ${
        active
          ? isDark
            ? 'border-blue-300 bg-blue-500 text-white'
            : 'border-slate-950 bg-slate-950 text-white'
          : isDark
            ? 'border-slate-700 bg-slate-950 text-slate-200 active:bg-slate-900'
            : 'border-slate-200 bg-slate-50 text-slate-700 active:bg-white'
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  )
}

function MobileQuickEditSvgActionButton({
  x,
  y,
  width,
  height,
  label,
  icon,
  active = false,
  disabled = false,
  tone = 'default',
  isDark,
  onClick,
}: {
  x: number
  y: number
  width: number
  height: number
  label: string
  icon: string
  active?: boolean
  disabled?: boolean
  tone?: 'default' | 'destructive'
  isDark: boolean
  onClick: () => void
}) {
  const activeFill = isDark ? '#3b82f6' : '#020617'
  const idleFill = isDark ? '#0f172a' : '#ffffff'
  const isDestructive = tone === 'destructive'
  const fill = isDestructive ? '#dc2626' : active ? activeFill : idleFill
  const stroke = isDestructive
    ? '#fca5a5'
    : active
      ? isDark ? '#93c5fd' : '#020617'
      : isDark ? '#334155' : '#e2e8f0'
  const textFill = disabled
    ? isDark ? '#475569' : '#94a3b8'
    : isDestructive
      ? '#ffffff'
    : active
      ? '#ffffff'
      : isDark ? '#f8fafc' : '#334155'

  return (
    <g
      transform={`translate(${x} ${y})`}
      opacity={disabled ? 0.45 : 1}
      role="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        if (!disabled) {
          onClick()
        }
      }}
    >
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="28"
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
      />
      <text
        x={width / 2}
        y="54"
        textAnchor="middle"
        fill={textFill}
        fontSize="44"
        fontWeight="900"
        pointerEvents="none"
      >
        {icon}
      </text>
      <text
        x={width / 2}
        y="106"
        textAnchor="middle"
        fill={textFill}
        fontSize="28"
        fontWeight="900"
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  )
}

function formatZoomPercentLabel(zoom: number, defaultZoom = 1) {
  return `${Math.round((zoom / defaultZoom) * 100)}%`
}

function isPointInsideRectBounds(point: Point, bounds: RectBounds) {
  return (
    point.x >= bounds.left &&
    point.x <= bounds.right &&
    point.y >= bounds.top &&
    point.y <= bounds.bottom
  )
}

function truncateMobileQuickEditText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`
}

function isMobileQuickEditableNode(node: EditorNode | null | undefined) {
  if (!node) {
    return false
  }

  return (
    FACILITY_TYPE_OPTIONS.includes(node.type) ||
    CONNECTOR_TYPE_OPTIONS.includes(node.type) ||
    node.type === 'pipeSegment' ||
    node.type === 'terrain'
  )
}

function getMobileKindSheetLabel(node: EditorNode | null | undefined) {
  if (!node) {
    return '객체 종류 변경'
  }

  if (node.type === 'pipeSegment') {
    return '파이프 종류 변경'
  }

  if (CONNECTOR_TYPE_OPTIONS.includes(node.type)) {
    return '커넥터 종류 변경'
  }

  if (node.type === 'terrain') {
    return '레이아웃 종류 변경'
  }

  return '객체 종류 변경'
}

function isMobileRotatableNode(node: EditorNode | null | undefined) {
  return Boolean(
    node &&
    (
      node.type === 'pipeSegment' ||
      CONNECTOR_TYPE_OPTIONS.includes(node.type)
    ),
  )
}

// ---------------------------------------------------------------------------
// relation 포트/attach 좌표 계산 helper
// ---------------------------------------------------------------------------
/** 노드 몸통 클릭으로 attach할 때 커서와 가장 가까운 사용 가능한 포트를 찾는다. */
function getNearestAttachCandidatePort(
  layout: EditorLayout,
  node: EditorNode,
  point: Point,
) {
  const candidates = getAttachCandidatePorts(node)
  const openCandidates = candidates.filter((port) => (
    !getRelationLinkForPort(layout, { nodeId: node.id, portId: port.id })
  ))
  const usableCandidates = openCandidates.length > 0 ? openCandidates : candidates

  return usableCandidates.reduce<EditorPort | null>((nearestPort, port) => {
    const localPoint = getRenderedPortPoint(layout, node, port)
    const portPoint = {
      x: node.x + localPoint.x,
      y: node.y + localPoint.y,
    }
    const distance = (portPoint.x - point.x) ** 2 + (portPoint.y - point.y) ** 2

    if (!nearestPort) {
      return port
    }

    const nearestLocalPoint = getRenderedPortPoint(layout, node, nearestPort)
    const nearestPoint = {
      x: node.x + nearestLocalPoint.x,
      y: node.y + nearestLocalPoint.y,
    }
    const nearestDistance = (nearestPoint.x - point.x) ** 2 + (nearestPoint.y - point.y) ** 2

    return distance < nearestDistance ? port : nearestPort
  }, null)
}

/** child 포트 면을 기준으로 좌표 변경이 움직일 축을 결정한다. */
function getCoordinateAxisForChildPort(port: EditorPort | null): ChangeAxis | null {
  if (!port) {
    return null
  }

  if (port.side === 'top' || port.side === 'bottom') {
    return 'x'
  }

  if (port.side === 'left' || port.side === 'right') {
    return 'y'
  }

  return null
}

/** 좌표 변경 메뉴를 허용할 parent가 커넥터 계열인지 판정한다. */
function isCoordinateEditConnectorParent(node: EditorNode | null | undefined) {
  return node?.type === 'connector' || node?.type === 'elbowConnector' || node?.type === 'teeConnector'
}

/** 좌표 변경 대상 child 파이프가 실제 길이축을 따라 조정 가능한지 확인한다. */
function getCoordinateEditablePipeAxis(childNode: EditorNode, childPort: EditorPort | null): ChangeAxis | null {
  if (childNode.type !== 'pipeSegment') {
    return null
  }

  const axis = getCoordinateAxisForChildPort(childPort)
  if (!axis) {
    return null
  }

  const orientation = getNodeOrientation(childNode)
  const isPipeLengthAxis =
    (orientation === 'horizontal' && axis === 'x') ||
    (orientation === 'vertical' && axis === 'y')
  if (!isPipeLengthAxis) {
    return null
  }

  const resizableEdges = getAttachResizableEdges(childNode)
  const canResizeOnAxis = (Object.keys(resizableEdges) as ResizeEdge[]).some((edge) => (
    resizableEdges[edge] && isResizeEdgeOnAxis(edge, axis)
  ))

  return canResizeOnAxis ? axis : null
}

type TeeTrunkSide = 'min' | 'max'

type TeeTrunkPipeAttachment = {
  relation: EditorLink
  teeEndpoint: EditorEndpoint
  teePort: EditorPort
  pipeEndpoint: EditorEndpoint
  pipeNode: EditorNode
  pipePort: EditorPort
  pipeEdge: ResizeEdge
  side: TeeTrunkSide
}

/** T자 커넥터의 ㅡ 축이 현재 화면에서 움직일 축을 계산한다. */
function getTeeTrunkAxis(node: EditorNode): ChangeAxis {
  const rotation = getTeeConnectorRotation(node)
  return rotation === 90 || rotation === 270 ? 'y' : 'x'
}

/** T자 커넥터 포트가 ㅡ 축의 좌/우 또는 상/하 중 어느 쪽인지 판정한다. */
function getTeeTrunkSideForPort(node: EditorNode, port: EditorPort): TeeTrunkSide | null {
  if (node.type !== 'teeConnector') {
    return null
  }

  const baseSide = getTeeBaseSideForPort(node, port.side)
  if (baseSide !== 'left' && baseSide !== 'right') {
    return null
  }

  const axis = getTeeTrunkAxis(node)
  if (axis === 'x') {
    if (port.side === 'left') {
      return 'min'
    }
    if (port.side === 'right') {
      return 'max'
    }
    return null
  }

  if (port.side === 'top') {
    return 'min'
  }
  if (port.side === 'bottom') {
    return 'max'
  }

  return null
}

/** 파이프 edge가 최소 길이를 유지하며 이동할 수 있는 좌표 범위다. */
function getPipeResizeEdgeCoordinateBounds(node: EditorNode, edge: ResizeEdge) {
  if (edge === 'left') {
    return {
      min: Number.NEGATIVE_INFINITY,
      max: node.x + node.width - MIN_PIPE_SEGMENT_LENGTH,
    }
  }

  if (edge === 'right') {
    return {
      min: node.x + MIN_PIPE_SEGMENT_LENGTH,
      max: Number.POSITIVE_INFINITY,
    }
  }

  if (edge === 'top') {
    return {
      min: Number.NEGATIVE_INFINITY,
      max: node.y + node.height - MIN_PIPE_SEGMENT_LENGTH,
    }
  }

  return {
    min: node.y + MIN_PIPE_SEGMENT_LENGTH,
    max: Number.POSITIVE_INFINITY,
  }
}

/** T자 ㅡ 축 양쪽에 연결된 파이프와 resize edge를 수집한다. */
function getTeeTrunkPipeAttachments(layout: EditorLayout, teeNode: EditorNode): TeeTrunkPipeAttachment[] {
  if (teeNode.type !== 'teeConnector') {
    return []
  }

  const axis = getTeeTrunkAxis(teeNode)
  const attachments: TeeTrunkPipeAttachment[] = []

  getRelationLinksForNode(layout, teeNode.id).forEach((relation) => {
    const teeEndpoint = getEndpointForNode(relation, teeNode.id)
    const pipeEndpoint = getOtherRelationEndpoint(relation, teeNode.id)
    if (!teeEndpoint || !pipeEndpoint) {
      return
    }

    const teePort = getNodePort(teeNode, teeEndpoint.portId)
    const side = teePort ? getTeeTrunkSideForPort(teeNode, teePort) : null
    if (!teePort || !side) {
      return
    }

    const pipeNode = layout.nodes.find((candidate) => candidate.id === pipeEndpoint.nodeId)
    const pipePort = pipeNode ? getNodePort(pipeNode, pipeEndpoint.portId) : null
    const pipeEdge = pipePort ? getAttachResizeEdgeForPort(pipePort) : null
    if (
      !pipeNode ||
      pipeNode.type !== 'pipeSegment' ||
      !pipePort ||
      !pipeEdge ||
      !isResizeEdgeOnAxis(pipeEdge, axis)
    ) {
      return
    }

    attachments.push({
      relation,
      teeEndpoint,
      teePort,
      pipeEndpoint,
      pipeNode,
      pipePort,
      pipeEdge,
      side,
    })
  })

  return attachments
}

/** T자 ㅡ 축이 양쪽 pipe를 모두 가지고 있는지 확인하고 한 쌍으로 반환한다. */
function getTeeTrunkPipeAttachmentPair(layout: EditorLayout, teeNode: EditorNode) {
  const attachments = getTeeTrunkPipeAttachments(layout, teeNode)
  const min = attachments.find((attachment) => attachment.side === 'min') ?? null
  const max = attachments.find((attachment) => attachment.side === 'max') ?? null

  return min && max ? { min, max } : null
}

/** T자 branch 쪽에 붙은 객체들은 T자 슬라이드와 함께 이동해야 한다. */
function getTeeBranchSideNodeIds(layout: EditorLayout, teeNode: EditorNode) {
  const branchNodeIds = new Set<string>()

  getRelationLinksForNode(layout, teeNode.id).forEach((relation) => {
    const teeEndpoint = getEndpointForNode(relation, teeNode.id)
    if (!teeEndpoint) {
      return
    }

    const teePort = getNodePort(teeNode, teeEndpoint.portId)
    if (!teePort || getTeeTrunkSideForPort(teeNode, teePort)) {
      return
    }

    getRelationSideNodeIds(layout, teeEndpoint).forEach((nodeId) => {
      branchNodeIds.add(nodeId)
    })
  })

  return Array.from(branchNodeIds)
}

/** 우클릭 좌표 변경에 필요한 parent/child/port/axis 정보를 모은다. */
function getCoordinateEditableRelationInfo(
  layout: EditorLayout,
  relation: EditorLink | undefined,
  sourceEndpoint?: EditorPortSelection,
): CoordinateEditableRelationInfo | null {
  if (relation?.type !== 'relation') {
    return null
  }

  const parentNode = layout.nodes.find((node) => node.id === relation.from.nodeId)
  const childNode = layout.nodes.find((node) => node.id === relation.to.nodeId)
  const parentPort = parentNode ? getNodePort(parentNode, relation.from.portId) : null
  const childPort = childNode ? getNodePort(childNode, relation.to.portId) : null
  if (!parentNode || !parentPort || !childNode || !childPort) {
    return null
  }

  const getTeeInfoForEndpoint = (endpoint: EditorEndpoint): CoordinateEditableRelationInfo | null => {
    const teeNode = layout.nodes.find((node) => node.id === endpoint.nodeId)
    const teePort = teeNode ? getNodePort(teeNode, endpoint.portId) : null
    if (!teeNode || teeNode.type !== 'teeConnector' || !teePort || !getTeeTrunkSideForPort(teeNode, teePort)) {
      return null
    }

    if (!getTeeTrunkPipeAttachmentPair(layout, teeNode)) {
      return null
    }

    const counterpartEndpoint = endpointKey(relation.from) === endpointKey(endpoint)
      ? relation.to
      : relation.from
    const counterpartNode = layout.nodes.find((node) => node.id === counterpartEndpoint.nodeId)
    const counterpartPort = counterpartNode ? getNodePort(counterpartNode, counterpartEndpoint.portId) : null
    if (!counterpartNode || !counterpartPort) {
      return null
    }

    return {
      relation,
      parentNode: teeNode,
      parentPort: teePort,
      childNode: counterpartNode,
      childPort: counterpartPort,
      axis: getTeeTrunkAxis(teeNode),
      mode: 'teeSlide',
      teeEndpoint: endpoint,
    }
  }

  if (sourceEndpoint) {
    const sourceKey = endpointKey(sourceEndpoint)
    if (sourceKey !== endpointKey(relation.from) && sourceKey !== endpointKey(relation.to)) {
      return null
    }

    const teeInfo = getTeeInfoForEndpoint(sourceEndpoint)
    if (teeInfo) {
      return teeInfo
    }

    if (endpointKey(relation.from) !== sourceKey) {
      return null
    }
  } else {
    const teeInfo = getTeeInfoForEndpoint(relation.from) ?? getTeeInfoForEndpoint(relation.to)
    if (teeInfo) {
      return teeInfo
    }
  }

  if (!isCoordinateEditConnectorParent(parentNode)) {
    return null
  }

  const axis = getCoordinateEditablePipeAxis(childNode, childPort)
  if (!axis) {
    return null
  }

  return { relation, parentNode, parentPort, childNode, childPort, axis, mode: 'pipeAttach' }
}

/** T자 객체 우클릭 메뉴에서 trunk 좌표 변경을 시작할 relation을 찾는다. */
function getCoordinateEditableTeeRelationInfo(layout: EditorLayout, nodeId: string) {
  const node = layout.nodes.find((candidate) => candidate.id === nodeId)
  if (!node || node.type !== 'teeConnector') {
    return null
  }

  for (const relation of getRelationLinksForNode(layout, nodeId)) {
    const teeEndpoint = getEndpointForNode(relation, nodeId)
    if (!teeEndpoint) {
      continue
    }

    const info = getCoordinateEditableRelationInfo(layout, relation, teeEndpoint)
    if (info?.mode === 'teeSlide') {
      return info
    }
  }

  return null
}

/** 좌표 객체에서 지정 축의 값을 읽는다. */
function getAxisCoordinate(point: Point, axis: ChangeAxis) {
  return axis === 'x' ? point.x : point.y
}

/** 좌표 변경 중 attach 지점을 다른 anchor 너머로 끌지 못하게 축 범위를 계산한다. */
function getCoordinateEditAxisBounds(
  layout: EditorLayout,
  info: CoordinateEditableRelationInfo,
): { min: number; max: number } | null {
  const { relation, parentNode, parentPort, childNode, childPort, axis } = info
  const currentChildPoint = getEndpointPointWithCounterpart(layout, relation.to, relation.from)
  if (!currentChildPoint) {
    return null
  }

  const minEdge: ResizeEdge = axis === 'x' ? 'left' : 'top'
  const maxEdge: ResizeEdge = axis === 'x' ? 'right' : 'bottom'
  const movingMinClearance = getCounterpartResizeClearance(childNode, childPort, parentNode, parentPort, minEdge)
  const movingMaxClearance = getCounterpartResizeClearance(childNode, childPort, parentNode, parentPort, maxEdge)
  let min = (axis === 'x' ? childNode.x : childNode.y) + movingMinClearance
  let max = (axis === 'x' ? childNode.x + childNode.width : childNode.y + childNode.height) - movingMaxClearance
  const currentCoordinate = getAxisCoordinate(currentChildPoint, axis)

  layout.links.forEach((candidateRelation) => {
    if (candidateRelation.type !== 'relation' || candidateRelation.id === relation.id) {
      return
    }

    const endpoint = getEndpointForNode(candidateRelation, childNode.id)
    const counterpartEndpoint = getOtherRelationEndpoint(candidateRelation, childNode.id)
    if (!endpoint || !counterpartEndpoint) {
      return
    }

    const endpointPort = getNodePort(childNode, endpoint.portId)
    if (!endpointPort || endpointPort.side !== childPort.side) {
      return
    }

    const anchorPoint = getEndpointPointWithCounterpart(layout, endpoint, counterpartEndpoint)
    if (!anchorPoint) {
      return
    }

    const anchorCoordinate = getAxisCoordinate(anchorPoint, axis)
    if (anchorCoordinate < currentCoordinate - ATTACH_ANCHOR_EDGE_EPSILON) {
      const counterpartNode = layout.nodes.find((candidate) => candidate.id === counterpartEndpoint.nodeId)
      const counterpartPort = counterpartNode ? getNodePort(counterpartNode, counterpartEndpoint.portId) : null
      const anchorClearance = getCounterpartResizeClearance(
        childNode,
        endpointPort,
        counterpartNode ?? null,
        counterpartPort,
        maxEdge,
      )
      min = Math.max(min, anchorCoordinate + anchorClearance + movingMinClearance + ATTACH_ANCHOR_RESIZE_MARGIN)
      return
    }

    if (anchorCoordinate > currentCoordinate + ATTACH_ANCHOR_EDGE_EPSILON) {
      const counterpartNode = layout.nodes.find((candidate) => candidate.id === counterpartEndpoint.nodeId)
      const counterpartPort = counterpartNode ? getNodePort(counterpartNode, counterpartEndpoint.portId) : null
      const anchorClearance = getCounterpartResizeClearance(
        childNode,
        endpointPort,
        counterpartNode ?? null,
        counterpartPort,
        minEdge,
      )
      max = Math.min(max, anchorCoordinate - anchorClearance - movingMaxClearance - ATTACH_ANCHOR_RESIZE_MARGIN)
    }
  })

  if (max < min) {
    return { min: currentCoordinate, max: currentCoordinate }
  }

  return { min, max }
}

/** T자 커넥터의 ㅡ 축을 따라 슬라이드하고 양쪽 trunk 파이프 길이를 재분배한다. */
function updateTeeConnectorSlide(
  layout: EditorLayout,
  info: CoordinateEditableRelationInfo,
  point: Point,
): EditorLayout {
  const teeNode = info.parentNode
  if (info.mode !== 'teeSlide' || teeNode.type !== 'teeConnector') {
    return layout
  }

  const trunkPair = getTeeTrunkPipeAttachmentPair(layout, teeNode)
  const centerPort = getNodePort(teeNode, 'center')
  if (!trunkPair || !centerPort) {
    return layout
  }

  const axis = info.axis
  const currentCenterPoint = getPortPoint(teeNode, centerPort)
  const currentAxisPoint = getAxisCoordinate(currentCenterPoint, axis)
  const requestedAxisPoint = getAxisCoordinate(point, axis)
  let min = Number.NEGATIVE_INFINITY
  let max = Number.POSITIVE_INFINITY

  ;[trunkPair.min, trunkPair.max].forEach((attachment) => {
    const currentTeePortPoint = getPortPoint(teeNode, attachment.teePort)
    const currentTeePortCoordinate = getAxisCoordinate(currentTeePortPoint, axis)
    const edgeBounds = getPipeResizeEdgeCoordinateBounds(attachment.pipeNode, attachment.pipeEdge)

    min = Math.max(min, edgeBounds.min - currentTeePortCoordinate + currentAxisPoint)
    max = Math.min(max, edgeBounds.max - currentTeePortCoordinate + currentAxisPoint)
  })

  if (max < min) {
    return layout
  }

  const nextAxisPoint = clampNumber(requestedAxisPoint, min, max)
  const delta = nextAxisPoint - currentAxisPoint
  if (Math.abs(delta) < 0.5) {
    return layout
  }

  const move = getAxisMove(axis, delta)
  const movingNodeIds = Array.from(new Set([
    teeNode.id,
    ...getTeeBranchSideNodeIds(layout, teeNode),
  ]))
  let nextLayout = moveNodeIdsBy(layout, movingNodeIds, move.dx, move.dy)
  const movedTeeNode = nextLayout.nodes.find((node) => node.id === teeNode.id)
  const movedTrunkPair = movedTeeNode ? getTeeTrunkPipeAttachmentPair(nextLayout, movedTeeNode) : null
  if (!movedTeeNode || !movedTrunkPair) {
    return nextLayout
  }

  ;[movedTrunkPair.min, movedTrunkPair.max].forEach((attachment) => {
    const currentPipeNode = nextLayout.nodes.find((node) => node.id === attachment.pipeNode.id)
    if (!currentPipeNode) {
      return
    }

    const movedTeePort = getNodePort(movedTeeNode, attachment.teeEndpoint.portId)
    const movedTeePortPoint = movedTeePort
      ? getPortPoint(movedTeeNode, movedTeePort)
      : getPortPoint(movedTeeNode, attachment.teePort)
    const edgeCoordinate = getAxisCoordinate(movedTeePortPoint, axis)
    const resizedPipeNode = resizeNodeEdgeToCoordinate(currentPipeNode, attachment.pipeEdge, edgeCoordinate)
    nextLayout = replaceNodeInLayout(nextLayout, resizedPipeNode)
  })

  return nextLayout
}

/** 좌표 변경 드래그 입력을 relation endpoint와 parent-side 그룹 이동으로 반영한다. */
function updateCoordinateEditEndpoint(
  layout: EditorLayout,
  linkId: string,
  point: Point,
): EditorLayout {
  const relation = layout.links.find((link) => link.id === linkId)
  const coordinateEditInfo = getCoordinateEditableRelationInfo(layout, relation)
  if (!coordinateEditInfo) {
    return layout
  }

  if (coordinateEditInfo.mode === 'teeSlide') {
    return updateTeeConnectorSlide(layout, coordinateEditInfo, point)
  }

  const { relation: editableRelation, axis } = coordinateEditInfo
  const currentParentPoint = getEndpointPointWithCounterpart(layout, editableRelation.from, editableRelation.to)
  if (!currentParentPoint) {
    return layout
  }

  const currentAxisPoint = axis === 'x' ? currentParentPoint.x : currentParentPoint.y
  const axisBounds = getCoordinateEditAxisBounds(layout, coordinateEditInfo)
  const requestedAxisPoint = axis === 'x' ? point.x : point.y
  const nextAxisPoint = axisBounds
    ? clampNumber(requestedAxisPoint, axisBounds.min, axisBounds.max)
    : requestedAxisPoint
  const delta = nextAxisPoint - currentAxisPoint
  if (Math.abs(delta) < 0.5) {
    return layout
  }

  const move = getAxisMove(axis, delta)
  const parentSideNodeIds = getRelationSideNodeIds(layout, editableRelation.to)
  const movingNodeIds = parentSideNodeIds.length > 0 ? parentSideNodeIds : [editableRelation.from.nodeId]
  if (axis === 'y' && hasFixedYNodeInNodeIds(layout, movingNodeIds)) {
    const adjustedLayout = applyRelationEndpointDelta(
      layout,
      editableRelation.from,
      editableRelation.to,
      move.dx,
      move.dy,
      layout,
    )

    return propagateAttachEndpointChanges(
      layout,
      adjustedLayout,
      [editableRelation.from.nodeId],
      new Set([editableRelation.to.nodeId]),
    )
  }

  return moveNodeIdsBy(layout, movingNodeIds, move.dx, move.dy)
}

// ---------------------------------------------------------------------------
// 레이아웃 정규화와 legacy 데이터 마이그레이션
// ---------------------------------------------------------------------------
/** 저장 JSON과 legacy 데이터를 현재 에디터 스키마로 정리한다. */
function normalizeEditorLayout(layout: EditorLayout): EditorLayout {
  const migratedPipeLinks = layout.links.filter((link) => link.id.startsWith('pipe_free_'))
  const migratedConnectorIds = new Set<string>()
  const migratedPipeNodes = migratedPipeLinks.flatMap((link): EditorNode[] => {
    const startNode = layout.nodes.find((node) => node.id === link.from.nodeId)
    const endNode = layout.nodes.find((node) => node.id === link.to.nodeId)
    const start = getEndpointPoint(layout, link.from)
    const end = getEndpointPoint(layout, link.to)
    if (!startNode || !endNode || !start || !end) {
      return []
    }

    if (startNode.id.startsWith('pipe_free_start_')) {
      migratedConnectorIds.add(startNode.id)
    }
    if (endNode.id.startsWith('pipe_free_end_')) {
      migratedConnectorIds.add(endNode.id)
    }

    const size = link.size
    const height = PIPE_THICKNESS[size] + PIPE_BORDER[size] * 2
    const width = Math.max(160, Math.abs(end.x - start.x))
    const x = Math.min(start.x, end.x)
    const y = (start.y + end.y) / 2 - height / 2

    return [{
      id: link.id,
      swmmId: link.swmmId,
      name: link.name,
      type: 'pipeSegment',
      x,
      y,
      width,
      height,
      ports: CONNECTOR_PORTS,
      props: {
        size,
        pipeKind: normalizePipeKind(link.props.pipeKind),
        slope: link.props.slope ?? 0.001154,
        blockage: link.props.blockage ?? 0,
      },
    }]
  })

  const links = migratedPipeLinks.length
    ? layout.links.filter((link) => !link.id.startsWith('pipe_free_'))
    : layout.links

  const normalizedLinks: EditorLink[] = links.map((link): EditorLink => {
    const normalizedLink = link.type !== 'relation'
      ? {
          ...link,
          props: {
            ...link.props,
            pipeKind: normalizePipeKind(link.props.pipeKind),
          },
        }
      : link

    if (!normalizedLink.id.startsWith('link_')) {
      return normalizedLink
    }

    return {
      ...normalizedLink,
      name: normalizedLink.name === '직선 관' || normalizedLink.name === 'ㄱ자 관' ? '관계' : normalizedLink.name,
      type: 'relation',
    }
  })

  const normalizedLayout: EditorLayout = {
    ...layout,
    links: normalizedLinks,
    nodes: [
      ...layout.nodes.filter((node) => !migratedConnectorIds.has(node.id)).map((node) => {
        const normalizedNode = node.type !== 'connector' || node.width > 30 || node.height > 30
          ? node
          : {
              ...node,
              width: EDITOR_CONNECTOR_SHORT_SIDE,
              height: EDITOR_CONNECTOR_LONG_SIDE,
            }

        const nodeWithProps = (() => {
          if (
            normalizedNode.type === 'connector' ||
            normalizedNode.type === 'elbowConnector' ||
            normalizedNode.type === 'teeConnector' ||
            normalizedNode.type === 'pipeSegment'
          ) {
            return {
              ...normalizedNode,
              props: {
                ...normalizedNode.props,
                size: isEditorPipeSize(normalizedNode.props.size) ? normalizedNode.props.size : 'medium',
                pipeKind: normalizePipeKind(normalizedNode.props.pipeKind),
              },
            }
          }

          if (normalizedNode.type === 'facility') {
            return {
              ...normalizedNode,
              props: {
                ...normalizedNode.props,
                facilityKind: normalizeFacilityKind(normalizedNode.props.facilityKind),
              },
            }
          }

          if (normalizedNode.type === 'outfall') {
            return {
              ...normalizedNode,
              props: {
                ...normalizedNode.props,
                outfallKind: normalizeOutfallKind(normalizedNode.props.outfallKind),
              },
            }
          }

          if (normalizedNode.type === 'manhole') {
            return {
              ...normalizedNode,
              props: {
                ...normalizedNode.props,
                manholeKind: normalizeManholeKind(normalizedNode.props.manholeKind),
              },
            }
          }

          if (normalizedNode.type === 'terrain') {
            return {
              ...normalizedNode,
              props: {
                ...normalizedNode.props,
                terrainKind: normalizeTerrainKind(normalizedNode.props.terrainKind),
              },
            }
          }

          return normalizedNode
        })()

        return snapNodeToGround(
          normalizeNodePorts(normalizeNodeGeometryForPipePreset(nodeWithProps)),
          layout.groundSurfaceY,
        )
      }),
        ...migratedPipeNodes,
      ],
  }

  return normalizeRelationAttachments(normalizedLayout)
}


// ---------------------------------------------------------------------------
// relation 생성, 선택 그룹, 복사/붙여넣기 helper
// ---------------------------------------------------------------------------
/** 두 포트 선택으로 새 링크 또는 relation 객체를 생성한다. */
function createLink(layout: EditorLayout, from: EditorPortSelection, to: EditorPortSelection): EditorLink {
  const fromPort = getEndpointPort(layout, from)
  const toPort = getEndpointPort(layout, to)
  const route = shouldUseStraightRoute(fromPort, toPort) ? 'straight' : 'elbow'
  const id = `link_${Date.now()}`

  return {
    id,
    swmmId: id,
    name: '관계',
    type: 'relation',
    from,
    to,
    size: 'medium',
    props: {
      route,
      slope: route === 'straight' ? 0.001154 : 0.03,
      blockage: 0,
    },
  }
}

// ---------------------------------------------------------------------------
// relation 전파와 길이/좌표 보정 규칙
// ---------------------------------------------------------------------------
/** layout 안의 특정 노드를 새 노드 값으로 교체한다. */
function replaceNodeInLayout(layout: EditorLayout, nextNode: EditorNode): EditorLayout {
  return {
    ...layout,
    nodes: layout.nodes.map((node) => (node.id === nextNode.id ? nextNode : node)),
  }
}

/** 축과 delta를 dx/dy 이동량으로 변환한다. */
function getAxisMove(axis: ChangeAxis, delta: number) {
  return axis === 'x'
    ? { dx: delta, dy: 0 }
    : { dx: 0, dy: delta }
}

/** resize edge가 특정 축의 길이 변경에 해당하는지 판정한다. */
function isResizeEdgeOnAxis(edge: ResizeEdge, axis: ChangeAxis) {
  return axis === 'x'
    ? edge === 'left' || edge === 'right'
    : edge === 'top' || edge === 'bottom'
}

/** 전파 대상 노드에서 지정 축을 조정할 수 있는 endpoint edge를 찾는다. */
function getResizableEndpointForAxis(
  layout: EditorLayout,
  endpoint: EditorPortSelection,
  axis: ChangeAxis,
) {
  const node = layout.nodes.find((candidate) => candidate.id === endpoint.nodeId)
  const port = node ? getNodePort(node, endpoint.portId) : null
  if (!node || !port) {
    return null
  }

  const resizeEdge = getAttachResizeEdgeForPort(port)
  const resizableEdges = getAttachResizableEdges(node)
  if (!resizeEdge || !resizableEdges[resizeEdge] || !isResizeEdgeOnAxis(resizeEdge, axis)) {
    return null
  }

  return { node, port, resizeEdge }
}

/** 노드의 위치나 크기가 실제로 변경되었는지 비교한다. */
function hasNodeLayoutChanged(first: EditorNode, second: EditorNode) {
  return (
    first.x !== second.x ||
    first.y !== second.y ||
    first.width !== second.width ||
    first.height !== second.height
  )
}

/** relation endpoint 변화량을 노드 resize 또는 이동으로 해소한다. */
function resizeRelationEndpointOnAxisByDelta(
  layout: EditorLayout,
  endpoint: EditorPortSelection,
  counterpartEndpoint: EditorPortSelection,
  axis: ChangeAxis,
  delta: number,
  anchorLayout = layout,
) {
  if (Math.abs(delta) < 0.5) {
    return null
  }

  const currentPoint = getEndpointPointWithCounterpart(layout, endpoint, counterpartEndpoint)
  const node = layout.nodes.find((candidate) => candidate.id === endpoint.nodeId)
  if (!currentPoint || !node) {
    return null
  }

  const activeRelationId = getRelationIdForEndpointPair(anchorLayout, endpoint, counterpartEndpoint)
  const ignoredAnchorRelationIds = activeRelationId ? new Set([activeRelationId]) : undefined

  if (axis === 'y') {
    const endpointPort = getNodePort(node, endpoint.portId)
    const anchorNode = anchorLayout.nodes.find((candidate) => candidate.id === endpoint.nodeId)
    const anchorBounds = anchorNode
      ? getResizeAnchorBoundsForNode(anchorLayout, anchorNode, ignoredAnchorRelationIds)
      : undefined
    const counterpartNode = layout.nodes.find((candidate) => candidate.id === counterpartEndpoint.nodeId)
    const counterpartPort = counterpartNode ? getNodePort(counterpartNode, counterpartEndpoint.portId) : null
    const resizedBranchNode = resizeBranchNodeToEndpointY(
      node,
      node,
      endpoint,
      currentPoint.y + delta,
      counterpartNode,
      counterpartPort,
    )
    if (resizedBranchNode && endpointPort) {
      const resizeEdge = node.type === 'manhole' && (endpointPort.side === 'left' || endpointPort.side === 'right')
        ? 'bottom'
        : getAttachResizeEdgeForPort(endpointPort)
      const guardedBranchNode = resizeEdge
        ? clampNodeResizeByInternalRelationAnchors(
            anchorLayout,
            anchorNode ?? node,
            resizedBranchNode,
            resizeEdge,
            anchorBounds,
          )
        : resizedBranchNode
      const resizedLayout = replaceNodeInLayout(layout, guardedBranchNode)
      const nextPoint = getEndpointPointWithCounterpart(resizedLayout, endpoint, counterpartEndpoint)
      const achievedDelta = nextPoint ? nextPoint.y - currentPoint.y : 0
      if (Math.abs(achievedDelta) >= 0.5 && Math.sign(achievedDelta) === Math.sign(delta)) {
        return {
          layout: resizedLayout,
          achievedDelta,
        }
      }
    }
  }

  const target = getResizableEndpointForAxis(layout, endpoint, axis)
  if (!target) {
    return null
  }

  const desiredCoordinate = axis === 'x' ? currentPoint.x + delta : currentPoint.y + delta
  const resizedNode = resizeNodeEdgeToCoordinate(target.node, target.resizeEdge, desiredCoordinate)
  const anchorNode = anchorLayout.nodes.find((candidate) => candidate.id === endpoint.nodeId)
  const guardedNode = clampNodeResizeByInternalRelationAnchors(
    anchorLayout,
    anchorNode ?? target.node,
    resizedNode,
    target.resizeEdge,
    anchorNode ? getResizeAnchorBoundsForNode(anchorLayout, anchorNode, ignoredAnchorRelationIds) : undefined,
  )
  const resizedLayout = replaceNodeInLayout(layout, guardedNode)
  const nextPoint = getEndpointPointWithCounterpart(resizedLayout, endpoint, counterpartEndpoint)
  if (!nextPoint) {
    return null
  }

  const achievedDelta = axis === 'x'
    ? nextPoint.x - currentPoint.x
    : nextPoint.y - currentPoint.y
  if (Math.abs(achievedDelta) < 0.5 || Math.sign(achievedDelta) !== Math.sign(delta)) {
    return null
  }

  return {
    layout: resizedLayout,
    achievedDelta,
  }
}

/** 특정 축의 endpoint delta를 layout에 적용한다. */
function applyRelationEndpointAxisDelta(
  layout: EditorLayout,
  endpoint: EditorPortSelection,
  counterpartEndpoint: EditorPortSelection,
  axis: ChangeAxis,
  delta: number,
  anchorLayout = layout,
) {
  if (Math.abs(delta) < 0.5) {
    return layout
  }

  let nextLayout = layout
  let remainingDelta = delta
  const resizeResult = resizeRelationEndpointOnAxisByDelta(
    nextLayout,
    endpoint,
    counterpartEndpoint,
    axis,
    remainingDelta,
    anchorLayout,
  )
  if (resizeResult) {
    nextLayout = resizeResult.layout
    remainingDelta -= resizeResult.achievedDelta
  }

  if (Math.abs(remainingDelta) < 0.5) {
    return nextLayout
  }

  const move = getAxisMove(axis, remainingDelta)
  return moveNodeIdsBy(nextLayout, [endpoint.nodeId], move.dx, move.dy)
}

/** x/y endpoint delta를 순서대로 적용해 노드를 맞춘다. */
function applyRelationEndpointDelta(
  layout: EditorLayout,
  endpoint: EditorPortSelection,
  counterpartEndpoint: EditorPortSelection,
  dx: number,
  dy: number,
  anchorLayout = layout,
) {
  let nextLayout = applyRelationEndpointAxisDelta(layout, endpoint, counterpartEndpoint, 'x', dx, anchorLayout)
  nextLayout = applyRelationEndpointAxisDelta(nextLayout, endpoint, counterpartEndpoint, 'y', dy, anchorLayout)

  return nextLayout
}

/** parent-to-child 전파 중 child endpoint를 보정한다. */
function applyPropagatedRelationEndpointDelta(
  layout: EditorLayout,
  endpoint: EditorPortSelection,
  counterpartEndpoint: EditorPortSelection,
  dx: number,
  dy: number,
  anchorLayout = layout,
  options: ChildPropagationOptions = {},
) {
  if (options.sourceLengthAxis !== 'x') {
    return applyRelationEndpointDelta(layout, endpoint, counterpartEndpoint, dx, dy, anchorLayout)
  }

  return moveNodeIdsBy(layout, [endpoint.nodeId], dx, dy)
}

/** 다중 parent child에서 다른 parent 쪽 endpoint를 1단계 보정한다. */
function applyReverseParentEndpointDelta(
  layout: EditorLayout,
  endpoint: EditorPortSelection,
  counterpartEndpoint: EditorPortSelection,
  dx: number,
  dy: number,
  anchorLayout = layout,
  sourceLengthAxis?: ChangeAxis | null,
) {
  if (sourceLengthAxis === 'x') {
    return moveNodeIdsBy(layout, [endpoint.nodeId], dx, dy)
  }

  if (sourceLengthAxis === 'y') {
    return applyRelationEndpointDelta(layout, endpoint, counterpartEndpoint, dx, dy, anchorLayout)
  }

  let nextLayout = layout

  if (Math.abs(dx) >= 0.5) {
    const move = getAxisMove('x', dx)
    nextLayout = moveNodeIdsBy(nextLayout, [endpoint.nodeId], move.dx, move.dy)
  }

  nextLayout = applyRelationEndpointAxisDelta(
    nextLayout,
    endpoint,
    counterpartEndpoint,
    'y',
    dy,
    anchorLayout,
  )

  return nextLayout
}

/** attach/resize 이후 parent 변경을 child 체인으로 전파한다. */
function propagateAttachEndpointChanges(
  baseLayout: EditorLayout,
  nextLayout: EditorLayout,
  changedNodeIds: string[],
  blockedNodeIds = new Set<string>(),
  options: ChildPropagationOptions = {},
) {
  if (
    !ENABLE_PARENT_CHILD_PROPAGATION_RULE ||
    changedNodeIds.length === 0
  ) {
    return nextLayout
  }

  let propagatedLayout = nextLayout
  const queue = [...new Set(changedNodeIds.filter((nodeId) => !blockedNodeIds.has(nodeId)))]
  const processedRelationIds = new Set<string>()

  while (queue.length > 0) {
    const changedNodeId = queue.shift()
    if (!changedNodeId || blockedNodeIds.has(changedNodeId)) {
      continue
    }

    getRelationLinksForNode(baseLayout, changedNodeId).forEach((relation) => {
      if (processedRelationIds.has(relation.id)) {
        return
      }
      processedRelationIds.add(relation.id)

      const changedEndpoint = getEndpointForNode(relation, changedNodeId)
      const targetEndpoint = getOtherRelationEndpoint(relation, changedNodeId)
      if (!changedEndpoint || !targetEndpoint || blockedNodeIds.has(targetEndpoint.nodeId)) {
        return
      }

      const baseChangedPoint = getEndpointPointWithCounterpart(baseLayout, changedEndpoint, targetEndpoint)
      const nextChangedPoint = getEndpointPointWithCounterpart(
        propagatedLayout,
        changedEndpoint,
        targetEndpoint,
      )
      if (!baseChangedPoint || !nextChangedPoint) {
        return
      }

      const dx = nextChangedPoint.x - baseChangedPoint.x
      const dy = nextChangedPoint.y - baseChangedPoint.y
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        return
      }

      const targetBefore = propagatedLayout.nodes.find((node) => node.id === targetEndpoint.nodeId)
      if (!targetBefore) {
        return
      }

      propagatedLayout = applyPropagatedRelationEndpointDelta(
        propagatedLayout,
        targetEndpoint,
        changedEndpoint,
        dx,
        dy,
        baseLayout,
        options,
      )

      const targetAfter = propagatedLayout.nodes.find((node) => node.id === targetEndpoint.nodeId)
      if (targetAfter && hasNodeLayoutChanged(targetBefore, targetAfter)) {
        queue.push(targetAfter.id)
      }
    })
  }

  return propagatedLayout
}

/** child가 움직였을 때 다중 parent 보정이 필요한 incoming parent를 처리한다. */
function propagateIncomingParentEndpointChanges(
  baseLayout: EditorLayout,
  nextLayout: EditorLayout,
  changedChildNodeId: string,
  ignoredRelationId: string,
  processedRelationIds: Set<string>,
  options: ChildPropagationOptions = {},
) {
  let propagatedLayout = nextLayout
  const processedIncomingRelationIds = new Set<string>()

  baseLayout.links.forEach((incomingRelation) => {
    if (
      incomingRelation.type !== 'relation' ||
      incomingRelation.to.nodeId !== changedChildNodeId ||
      incomingRelation.id === ignoredRelationId ||
      processedRelationIds.has(incomingRelation.id) ||
      processedIncomingRelationIds.has(incomingRelation.id)
    ) {
      return
    }
    processedIncomingRelationIds.add(incomingRelation.id)

    const baseChildPoint = getEndpointPointWithCounterpart(
      baseLayout,
      incomingRelation.to,
      incomingRelation.from,
    )
    const nextChildPoint = getEndpointPointWithCounterpart(
      propagatedLayout,
      incomingRelation.to,
      incomingRelation.from,
    )
    if (!baseChildPoint || !nextChildPoint) {
      return
    }

    const dx = nextChildPoint.x - baseChildPoint.x
    const dy = nextChildPoint.y - baseChildPoint.y
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      return
    }

    const parentBefore = propagatedLayout.nodes.find((node) => node.id === incomingRelation.from.nodeId)
    if (!parentBefore) {
      return
    }

    propagatedLayout = applyReverseParentEndpointDelta(
      propagatedLayout,
      incomingRelation.from,
      incomingRelation.to,
      dx,
      dy,
      baseLayout,
      options.sourceLengthAxis,
    )

    const parentAfter = propagatedLayout.nodes.find((node) => node.id === incomingRelation.from.nodeId)
    if (!parentAfter || !hasNodeLayoutChanged(parentBefore, parentAfter)) {
      return
    }

    propagatedLayout = propagateAttachEndpointChanges(
      baseLayout,
      propagatedLayout,
      [parentAfter.id],
      new Set([changedChildNodeId]),
      options,
    )

    processedRelationIds.add(incomingRelation.id)
  })

  return propagatedLayout
}

/** 특정 child가 현재 relation 외의 parent를 더 가지고 있는지 확인한다. */
function hasOtherIncomingParentRelation(
  layout: EditorLayout,
  childNodeId: string,
  ignoredRelationId: string,
) {
  return layout.links.some((relation) => (
    relation.type === 'relation' &&
    relation.to.nodeId === childNodeId &&
    relation.id !== ignoredRelationId
  ))
}

/** 한 노드 변경 후 직결 child와 필요한 parent 보정을 queue로 전파한다. */
function propagateChildEndpointChanges(
  baseLayout: EditorLayout,
  nextLayout: EditorLayout,
  changedParentNodeIds: string[],
  options: ChildPropagationOptions = {},
) {
  if (
    !ENABLE_PARENT_CHILD_PROPAGATION_RULE ||
    changedParentNodeIds.length === 0
  ) {
    return nextLayout
  }

  let propagatedLayout = nextLayout
  const queue = [...new Set(changedParentNodeIds)]
  const processedRelationIds = new Set<string>()

  while (queue.length > 0) {
    const parentNodeId = queue.shift()
    if (!parentNodeId) {
      continue
    }

    baseLayout.links.forEach((relation) => {
      if (
        relation.type !== 'relation' ||
        relation.from.nodeId !== parentNodeId ||
        processedRelationIds.has(relation.id)
      ) {
        return
      }
      processedRelationIds.add(relation.id)

      const baseParentPoint = getEndpointPointWithCounterpart(baseLayout, relation.from, relation.to)
      const nextParentPoint = getEndpointPointWithCounterpart(propagatedLayout, relation.from, relation.to)
      if (!baseParentPoint || !nextParentPoint) {
        return
      }

      const dx = nextParentPoint.x - baseParentPoint.x
      const dy = nextParentPoint.y - baseParentPoint.y
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        return
      }

      const childBefore = propagatedLayout.nodes.find((node) => node.id === relation.to.nodeId)
      if (!childBefore) {
        return
      }

      propagatedLayout = applyPropagatedRelationEndpointDelta(
        propagatedLayout,
        relation.to,
        relation.from,
        dx,
        dy,
        baseLayout,
        options,
      )

      const childAfter = propagatedLayout.nodes.find((node) => node.id === relation.to.nodeId)
      if (childAfter && hasNodeLayoutChanged(childBefore, childAfter)) {
        if (
          ENABLE_REVERSE_PARENT_PROPAGATION_RULE &&
          hasOtherIncomingParentRelation(baseLayout, childAfter.id, relation.id)
        ) {
          const reverseResult = propagateIncomingParentEndpointChanges(
            baseLayout,
            propagatedLayout,
            childAfter.id,
            relation.id,
            processedRelationIds,
            options,
          )
          propagatedLayout = reverseResult
        }
        queue.push(childAfter.id)
      }
    })
  }

  return propagatedLayout
}


// ---------------------------------------------------------------------------
// 노드 이동, drag, resize helper
// ---------------------------------------------------------------------------
/** 노드 ID 목록을 같은 dx/dy만큼 이동하고 relation 전파를 실행한다. */
/** 지정한 노드 그룹을 같은 delta만큼 이동하고 지상 고정 규칙을 다시 적용한다. */
function moveNodeIdsBy(layout: EditorLayout, nodeIds: string[], dx: number, dy: number): EditorLayout {
  if (nodeIds.length === 0 || (dx === 0 && dy === 0)) {
    return layout
  }

  const movingNodeIds = new Set(nodeIds)

  return {
    ...layout,
    nodes: layout.nodes.map((node) => (
      movingNodeIds.has(node.id) && node.type !== 'terrain'
        ? snapNodeToGround({ ...node, x: node.x + dx, y: node.y + dy }, layout.groundSurfaceY)
        : node
    )),
  }
}

function rangesOverlap(firstStart: number, firstEnd: number, secondStart: number, secondEnd: number) {
  return Math.min(firstEnd, secondEnd) - Math.max(firstStart, secondStart) > 1
}

function applyTerrainResizeChain(layout: EditorLayout, originNode: EditorNode, resizedNode: EditorNode): EditorLayout {
  if (originNode.type !== 'terrain' || resizedNode.type !== 'terrain') {
    return {
      ...layout,
      nodes: layout.nodes.map((node) => (node.id === resizedNode.id ? resizedNode : node)),
    }
  }

  const originRight = originNode.x + originNode.width
  const originBottom = originNode.y + originNode.height
  const resizedRight = resizedNode.x + resizedNode.width
  const resizedBottom = resizedNode.y + resizedNode.height
  const leftDelta = resizedNode.x - originNode.x
  const rightDelta = resizedRight - originRight
  const bottomDelta = resizedBottom - originBottom

  return {
    ...layout,
    nodes: layout.nodes.map((node) => {
      if (node.id === resizedNode.id) {
        return resizedNode
      }

      if (node.type !== 'terrain') {
        return node
      }

      const verticallyOverlaps = rangesOverlap(originNode.y, originBottom, node.y, node.y + node.height)
      const horizontallyOverlaps = rangesOverlap(originNode.x, originRight, node.x, node.x + node.width)

      if (rightDelta !== 0 && verticallyOverlaps && node.x >= originRight - 1) {
        return { ...node, x: node.x + rightDelta }
      }

      if (leftDelta !== 0 && verticallyOverlaps && node.x + node.width <= originNode.x + 1) {
        return { ...node, x: node.x + leftDelta }
      }

      if (bottomDelta !== 0 && horizontallyOverlaps && node.y >= originBottom - 1) {
        return { ...node, y: node.y + bottomDelta }
      }

      return node
    }),
  }
}

/** 고정 y branch의 세로 길이를 endpoint y 위치에 맞춰 역산한다. */
function resizeBranchNodeToEndpointY(
  baseNode: EditorNode,
  currentNode: EditorNode,
  endpoint: EditorPortSelection,
  desiredY: number,
  counterpartNode?: EditorNode | null,
  counterpartPort?: EditorPort | null,
): EditorNode | null {
  const port = getNodePort(baseNode, endpoint.portId)
  if (!port) {
    return null
  }

  if (baseNode.type === 'pipeSegment') {
    if (getNodeOrientation(baseNode) !== 'vertical') {
      return null
    }

    if (port.side === 'bottom') {
      return normalizeNodePorts({
        ...currentNode,
        x: baseNode.x,
        y: baseNode.y,
        width: baseNode.width,
        height: Math.max(MIN_PIPE_SEGMENT_LENGTH, desiredY - baseNode.y),
      })
    }

    if (port.side === 'top') {
      const bottom = baseNode.y + baseNode.height
      const height = Math.max(MIN_PIPE_SEGMENT_LENGTH, bottom - desiredY)

      return normalizeNodePorts({
        ...currentNode,
        x: baseNode.x,
        y: bottom - height,
        width: baseNode.width,
        height,
      })
    }

    return null
  }

  if (baseNode.type === 'manhole') {
    if (port.side === 'bottom') {
      return normalizeNodePorts({
        ...currentNode,
        x: baseNode.x,
        y: baseNode.y,
        width: baseNode.width,
        height: Math.max(MIN_MANHOLE_HEIGHT, desiredY - baseNode.y),
      })
    }

    if (port.side === 'left' || port.side === 'right') {
      const counterpartHalfSpan = counterpartNode && counterpartPort
        ? getLowerSideAttachmentCounterpartHalfSpan(counterpartNode, counterpartPort)
        : LOWER_SIDE_PORT_BOTTOM_GAP
      const height = getHeightForLowerSideAttachmentOffset(
        desiredY - baseNode.y,
        counterpartHalfSpan,
        MIN_MANHOLE_HEIGHT,
      )

      return normalizeNodePorts({
        ...currentNode,
        x: baseNode.x,
        y: baseNode.y,
        width: baseNode.width,
        height,
      })
    }
  }

  return null
}

/** 드래그 중 relation 그룹의 목표 좌표를 계산하고 이동 제약을 적용한다. */
function createDragDraftPositions(layout: EditorLayout, dragState: DragState, x: number, y: number): Map<string, Point> {
  const rootOrigin = dragState.originNodes[dragState.nodeId]
  if (!rootOrigin) {
    return new Map()
  }

  const dx = x - rootOrigin.x
  const dy = dragState.hasFixedYNode ? 0 : y - rootOrigin.y
  const draftPositions = new Map<string, Point>()

  layout.nodes.forEach((node) => {
    if (!dragState.groupNodeIdSet.has(node.id)) {
      return
    }

    if (node.type === 'terrain') {
      return
    }

    const originNode = dragState.originNodes[node.id]
    if (!originNode) {
      return
    }

    const movedNode = {
      ...node,
      x: originNode.x + dx,
      y: originNode.y + dy,
    }
    const constrainedNode = dragState.hasFixedYNode ? movedNode : snapNodeToGround(movedNode, layout.groundSurfaceY)

    draftPositions.set(node.id, {
      x: constrainedNode.x,
      y: constrainedNode.y,
    })
  })

  return draftPositions
}

/** pointer up 시점에 드래그 preview 좌표를 실제 layout에 한 번만 반영한다. */
function applyDragDraftPositions(layout: EditorLayout, draftPositions: Map<string, Point>): EditorLayout {
  if (draftPositions.size === 0) {
    return layout
  }

  return {
    ...layout,
    nodes: layout.nodes.map((node) => {
      const draftPosition = draftPositions.get(node.id)
      return draftPosition && node.type !== 'terrain'
        ? {
            ...node,
            x: draftPosition.x,
            y: draftPosition.y,
          }
        : node
    }),
  }
}

/** resize preview 비교에서 포트 직렬화 비용을 피하기 위한 얕은 비교다. */
function haveSamePortRenderState(first: EditorPort[], second: EditorPort[]) {
  if (first === second) {
    return true
  }

  if (first.length !== second.length) {
    return false
  }

  for (let index = 0; index < first.length; index += 1) {
    const firstPort = first[index]
    const secondPort = second[index]
    if (
      firstPort.id !== secondPort.id ||
      firstPort.side !== secondPort.side ||
      firstPort.label !== secondPort.label ||
      firstPort.offset !== secondPort.offset
    ) {
      return false
    }
  }

  return true
}

/** resize preview 비교에서 props 직렬화 비용을 피하기 위한 얕은 비교다. */
function haveSameNodeRenderProps(firstProps: EditorNode['props'], secondProps: EditorNode['props']) {
  if (firstProps === secondProps) {
    return true
  }

  const firstRecord = firstProps as Record<string, unknown>
  const secondRecord = secondProps as Record<string, unknown>
  const firstKeys = Object.keys(firstRecord)
  const secondKeys = Object.keys(secondRecord)

  if (firstKeys.length !== secondKeys.length) {
    return false
  }

  for (const key of firstKeys) {
    if (firstRecord[key] !== secondRecord[key]) {
      return false
    }
  }

  return true
}

/** draft 비교용으로 렌더링에 영향을 주는 노드 좌표/크기/포트/props가 같은지 확인한다. */
function haveSameNodeRenderState(first: EditorNode, second: EditorNode) {
  return (
    first === second ||
    (
      first.id === second.id &&
      first.x === second.x &&
      first.y === second.y &&
      first.width === second.width &&
      first.height === second.height &&
      haveSamePortRenderState(first.ports, second.ports) &&
      haveSameNodeRenderProps(first.props, second.props)
    )
  )
}

/** resize 중 화면 preview에 필요한 변경 노드만 Map으로 추려낸다. */
function createResizeDraftNodes(
  layout: EditorLayout,
  resizeState: ResizeState,
  cursor: Point,
): Map<string, EditorNode> {
  const resizedLayout = resizeLayoutFromState(layout, resizeState, cursor)
  const originalNodesById = new Map(layout.nodes.map((node) => [node.id, node]))
  const draftNodesById = new Map<string, EditorNode>()

  resizedLayout.nodes.forEach((node) => {
    const originalNode = originalNodesById.get(node.id)
    if (!originalNode || !haveSameNodeRenderState(originalNode, node)) {
      draftNodesById.set(node.id, node)
    }
  })

  return draftNodesById
}

/** pointer up 시점에 resize draft 노드들을 실제 layout에 한 번만 반영한다. */
function applyResizeDraftNodes(layout: EditorLayout, draftNodesById: Map<string, EditorNode>): EditorLayout {
  if (draftNodesById.size === 0) {
    return layout
  }

  return {
    ...layout,
    nodes: layout.nodes.map((node) => draftNodesById.get(node.id) ?? node),
  }
}

/** drag/resize draft 때문에 포트 relation lookup을 다시 계산해야 하는 노드 범위를 구한다. */
function getDraftAffectedNodeIds(
  dragDraftPositionsByNodeId: Map<string, Point> | null,
  resizeDraftNodesById: Map<string, EditorNode> | null,
  relationLinksByNodeId: Map<string, EditorLink[]>,
) {
  const affectedNodeIds = new Set<string>()

  const addNodeAndRelationCounterparts = (nodeId: string) => {
    affectedNodeIds.add(nodeId)
    relationLinksByNodeId.get(nodeId)?.forEach((relation) => {
      affectedNodeIds.add(relation.from.nodeId)
      affectedNodeIds.add(relation.to.nodeId)
    })
  }

  dragDraftPositionsByNodeId?.forEach((_position, nodeId) => {
    addNodeAndRelationCounterparts(nodeId)
  })
  resizeDraftNodesById?.forEach((_node, nodeId) => {
    addNodeAndRelationCounterparts(nodeId)
  })

  return affectedNodeIds
}

/** 커서 위치 기준으로 노드의 특정 edge를 직접 resize한다. */
function resizeNodeFromEdge(node: EditorNode, edge: ResizeEdge, cursor: Point): EditorNode {
  if (!ENABLE_BASIC_PIPE_MANHOLE_RESIZE_RULE) {
    return node
  }

  if (node.type === 'road') {
    if (edge === 'right') {
      return {
        ...node,
        width: Math.max(MIN_ROAD_WIDTH, cursor.x - node.x),
      }
    }

    if (edge === 'left') {
      const right = node.x + node.width
      const width = Math.max(MIN_ROAD_WIDTH, right - cursor.x)

      return {
        ...node,
        x: right - width,
        width,
      }
    }

    return node
  }

  if (node.type === 'terrain') {
    if (edge === 'right') {
      return {
        ...node,
        width: Math.max(MIN_TERRAIN_WIDTH, cursor.x - node.x),
      }
    }

    if (edge === 'left') {
      const right = node.x + node.width
      const width = Math.max(MIN_TERRAIN_WIDTH, right - cursor.x)

      return {
        ...node,
        x: right - width,
        width,
      }
    }

    if (edge === 'bottom') {
      return {
        ...node,
        height: Math.max(MIN_TERRAIN_HEIGHT, cursor.y - node.y),
      }
    }

    return node
  }

  if (node.type === 'manhole') {
    if (edge !== 'bottom') {
      return node
    }

    return {
      ...node,
      height: Math.max(MIN_MANHOLE_HEIGHT, cursor.y - node.y),
    }
  }

  if (node.type !== 'pipeSegment') {
    return node
  }

  const isHorizontal = getNodeOrientation(node) === 'horizontal'
  const size = isEditorPipeSize(node.props.size) ? node.props.size : 'medium'
  const minPipeLength = Math.max(MIN_PIPE_SEGMENT_LENGTH, PIPE_THICKNESS[size] + PIPE_BORDER[size] * 2)

  if (isHorizontal) {
    if (edge === 'right') {
      return {
        ...node,
        width: Math.max(minPipeLength, cursor.x - node.x),
      }
    }

    if (edge === 'left') {
      const right = node.x + node.width
      const width = Math.max(minPipeLength, right - cursor.x)

      return {
        ...node,
        x: right - width,
        width,
      }
    }

    return node
  }

  if (edge === 'bottom') {
    return {
      ...node,
      height: Math.max(minPipeLength, cursor.y - node.y),
    }
  }

  if (edge === 'top') {
    const bottom = node.y + node.height
    const height = Math.max(minPipeLength, bottom - cursor.y)

    return {
      ...node,
      y: bottom - height,
      height,
    }
  }

  return node
}

/** resize edge가 담당하는 축을 반환한다. */
function getResizeEdgeAxis(edge: ResizeEdge): ChangeAxis {
  return edge === 'left' || edge === 'right' ? 'x' : 'y'
}

/** 노드의 x/y 축 길이를 읽는다. */
function getNodeLengthOnAxis(node: EditorNode, axis: ChangeAxis) {
  return axis === 'x' ? node.width : node.height
}

/** 노드 특정 edge에 길이 delta를 적용한다. */
function resizeNodeFromEdgeByLengthDelta(
  node: EditorNode,
  edge: ResizeEdge,
  deltaLength: number,
): EditorNode {
  if (!ENABLE_BASIC_PIPE_MANHOLE_RESIZE_RULE) {
    return node
  }

  if (Math.abs(deltaLength) < 0.5) {
    return node
  }

  if (edge === 'right') {
    return resizeNodeEdgeToCoordinate(node, edge, node.x + node.width + deltaLength)
  }

  if (edge === 'left') {
    return resizeNodeEdgeToCoordinate(node, edge, node.x - deltaLength)
  }

  if (edge === 'bottom') {
    return resizeNodeEdgeToCoordinate(node, edge, node.y + node.height + deltaLength)
  }

  return resizeNodeEdgeToCoordinate(node, edge, node.y - deltaLength)
}

/** 길이 변경을 child 방향으로 보낼 때 사용할 edge를 고른다. */
function getChildResizeEdgeForLengthChange(
  layout: EditorLayout,
  node: EditorNode,
  requestedEdge: ResizeEdge,
): ResizeEdge | null {
  const axis = getResizeEdgeAxis(requestedEdge)
  const resizableEdges = getAttachResizableEdges(node)

  for (const relation of layout.links) {
    if (relation.type !== 'relation' || relation.from.nodeId !== node.id) {
      continue
    }

    const port = getNodePort(node, relation.from.portId)
    const childEdge = port ? getAttachResizeEdgeForPort(port) : null
    if (
      childEdge &&
      resizableEdges[childEdge] &&
      isResizeEdgeOnAxis(childEdge, axis)
    ) {
      return childEdge
    }
  }

  return null
}

/** 수동 resize 결과를 relation child 방향 edge 변경으로 보정한다. */
function redirectLengthResizeTowardChildEdge(
  layout: EditorLayout,
  originNode: EditorNode,
  requestedEdge: ResizeEdge,
  requestedResizeNode: EditorNode,
  anchorBounds?: ResizeAnchorBounds,
  childEdgeOverride?: ResizeEdge | null,
): { node: EditorNode; movedEdge: ResizeEdge } {
  const childEdge = childEdgeOverride === undefined
    ? getChildResizeEdgeForLengthChange(layout, originNode, requestedEdge)
    : childEdgeOverride
  if (!childEdge) {
    return {
      node: clampNodeResizeByInternalRelationAnchors(
        layout,
        originNode,
        requestedResizeNode,
        requestedEdge,
        anchorBounds,
      ),
      movedEdge: requestedEdge,
    }
  }

  if (childEdge === requestedEdge) {
    return {
      node: clampNodeResizeByInternalRelationAnchors(
        layout,
        originNode,
        requestedResizeNode,
        childEdge,
        anchorBounds,
      ),
      movedEdge: childEdge,
    }
  }

  const axis = getResizeEdgeAxis(requestedEdge)
  const deltaLength = getNodeLengthOnAxis(requestedResizeNode, axis) - getNodeLengthOnAxis(originNode, axis)

  return {
    node: clampNodeResizeByInternalRelationAnchors(
      layout,
      originNode,
      resizeNodeFromEdgeByLengthDelta(originNode, childEdge, deltaLength),
      childEdge,
      anchorBounds,
    ),
    movedEdge: childEdge,
  }
}

/** 명시적 길이 입력에서 기본으로 사용할 resize edge를 고른다. */
function getDefaultLengthResizeEdge(node: EditorNode): ResizeEdge | null {
  if (node.type === 'manhole') {
    return 'bottom'
  }

  if (node.type !== 'pipeSegment') {
    return null
  }

  return getNodeOrientation(node) === 'horizontal' ? 'right' : 'bottom'
}

/** 모바일 버튼식 resize에서 우선 조작할 edge를 고른다. */
function getPreferredMobileResizeEdge(node: EditorNode): ResizeEdge | null {
  const edges = getManualResizableEdges(node)
  const orientation = node.type === 'pipeSegment' ? getNodeOrientation(node) : null

  if (orientation === 'horizontal') {
    return edges.right ? 'right' : edges.left ? 'left' : null
  }

  if (orientation === 'vertical') {
    return edges.bottom ? 'bottom' : edges.top ? 'top' : null
  }

  if (edges.right) {
    return 'right'
  }

  if (edges.bottom) {
    return 'bottom'
  }

  if (edges.left) {
    return 'left'
  }

  return edges.top ? 'top' : null
}

function getMobileResizeCapability(node: EditorNode) {
  const edges = getManualResizableEdges(node)
  const horizontalEdge: ResizeEdge | null = edges.right ? 'right' : edges.left ? 'left' : null
  const verticalEdge: ResizeEdge | null = edges.bottom ? 'bottom' : edges.top ? 'top' : null

  return {
    canResizeX: Boolean(horizontalEdge),
    canResizeY: Boolean(verticalEdge),
    horizontalEdge,
    verticalEdge,
    preferredEdge: getPreferredMobileResizeEdge(node),
  }
}

function getMobileMoveCapability(layout: EditorLayout, node: EditorNode) {
  const groupNodeIds = getRelationGroupNodeIds(layout, node.id)
  const groupNodeIdSet = new Set(groupNodeIds)
  const hasFixedYNode = layout.nodes.some((candidate) => (
    groupNodeIdSet.has(candidate.id) && isFixedYNode(candidate)
  ))

  return {
    groupNodeIds,
    canMoveX: true,
    canMoveY: !hasFixedYNode,
  }
}

/** 패널 숫자 입력으로 바뀐 길이를 child 방향 변경으로 재해석한다. */
function redirectExplicitLengthUpdateTowardChildEdge(
  layout: EditorLayout,
  currentNode: EditorNode,
  nextNode: EditorNode,
): EditorNode {
  const defaultEdge = getDefaultLengthResizeEdge(currentNode)
  if (!defaultEdge) {
    return nextNode
  }

  const childEdge = getChildResizeEdgeForLengthChange(layout, currentNode, defaultEdge)
  if (!childEdge) {
    return nextNode
  }

  const axis = getResizeEdgeAxis(defaultEdge)
  const deltaLength = getNodeLengthOnAxis(nextNode, axis) - getNodeLengthOnAxis(currentNode, axis)
  if (Math.abs(deltaLength) < 0.5) {
    return nextNode
  }

  const resizedNode = clampNodeResizeByInternalRelationAnchors(
    layout,
    currentNode,
    resizeNodeFromEdgeByLengthDelta(currentNode, childEdge, deltaLength),
    childEdge,
  )
  return normalizeNodePorts({
    ...nextNode,
    x: resizedNode.x,
    y: resizedNode.y,
    width: resizedNode.width,
    height: resizedNode.height,
    ports: resizedNode.ports,
  })
}

/** 수동 resize가 어떤 축의 길이 변경인지 판정한다. */
function getNodeLengthChangeAxisForResize(
  currentNode: EditorNode,
  nextNode: EditorNode,
): ChangeAxis | null {
  if (currentNode.type === 'pipeSegment') {
    const isHorizontal = getNodeOrientation(currentNode) === 'horizontal'
    const lengthChanged = isHorizontal
      ? nextNode.width !== currentNode.width
      : nextNode.height !== currentNode.height

    return lengthChanged ? (isHorizontal ? 'x' : 'y') : null
  }

  if (currentNode.type === 'manhole' && nextNode.height !== currentNode.height) {
    return 'y'
  }

  return null
}

/** 노드 길이 변경을 layout에 넣고 relation 전파를 실행한다. */
function applyConnectedPortResizeToLayout(
  layout: EditorLayout,
  currentNode: EditorNode,
  nextNode: EditorNode,
): EditorLayout {
  let nextLayout: EditorLayout = {
    ...layout,
    nodes: layout.nodes.map((node) => (node.id === currentNode.id ? nextNode : node)),
  }

  nextLayout = propagateChildEndpointChanges(layout, nextLayout, [currentNode.id], {
    sourceLengthAxis: getNodeLengthChangeAxisForResize(currentNode, nextNode),
  })

  return nextLayout
}

/** 파이프 resize를 기본 규칙에 맞춰 layout에 적용한다. */
function applyPipeResizeToLayout(
  layout: EditorLayout,
  currentPipeNode: EditorNode,
  nextPipeNode: EditorNode,
): EditorLayout {
  return applyConnectedPortResizeToLayout(layout, currentPipeNode, nextPipeNode)
}

/** resize 전후 노드 차이를 기준으로 파이프 최종 resize 결과를 만든다. */
function getPipeResizeResult(
  layout: EditorLayout,
  resizeState: ResizeState,
  cursor: Point,
): { node: EditorNode; movedEdge: ResizeEdge } {
  const originNode = resizeState.originNode
  if (originNode.type !== 'pipeSegment') {
    const requestedResizeNode = resizeNodeFromEdge(originNode, resizeState.edge, cursor)
    const resizeResult = redirectLengthResizeTowardChildEdge(
      layout,
      originNode,
      resizeState.edge,
      requestedResizeNode,
      resizeState.anchorBounds,
    )

    return {
      node: resizeResult.node,
      movedEdge: resizeResult.movedEdge,
    }
  }

  const requestedResizeNode = resizeNodeFromEdge(originNode, resizeState.edge, cursor)
  const childResizeEdge = resizeState.childResizeEdge ?? null
  const childResizeResult = redirectLengthResizeTowardChildEdge(
    layout,
    originNode,
    resizeState.edge,
    requestedResizeNode,
    resizeState.anchorBounds,
    childResizeEdge,
  )
  if (childResizeEdge) {
    return childResizeResult
  }

  const isVertical = getNodeOrientation(originNode) === 'vertical'

  if (
    ENABLE_FIXED_Y_VERTICAL_TOP_RESIZE_AS_BOTTOM_RULE &&
    isVertical &&
    resizeState.hasFixedYNode &&
    resizeState.edge === 'top'
  ) {
    const requestedTopDelta = cursor.y - originNode.y
    const bottomCursor = {
      ...cursor,
      y: originNode.y + originNode.height - requestedTopDelta,
    }
    const bottomResizedNode = resizeNodeFromEdge(originNode, 'bottom', bottomCursor)

    return {
      node: clampNodeResizeByInternalRelationAnchors(
        layout,
        originNode,
        bottomResizedNode,
        'bottom',
        resizeState.anchorBounds,
      ),
      movedEdge: 'bottom',
    }
  }

  return {
    node: childResizeResult.node,
    movedEdge: childResizeResult.movedEdge,
  }
}

/** 현재 resize interaction 상태와 커서 좌표로 layout을 갱신한다. */
function resizeLayoutFromState(layout: EditorLayout, resizeState: ResizeState, cursor: Point): EditorLayout {
  const currentNode = layout.nodes.find((node) => node.id === resizeState.nodeId)
  if (!currentNode) {
    return layout
  }

  if (resizeState.originNode.type !== 'pipeSegment') {
    const requestedResizeNode = resizeNodeFromEdge(resizeState.originNode, resizeState.edge, cursor)
    const childDirectedNode = redirectLengthResizeTowardChildEdge(
      layout,
      resizeState.originNode,
      resizeState.edge,
      requestedResizeNode,
      resizeState.anchorBounds,
    ).node
    const nextNode = snapNodeToGround(
      normalizeNodePorts(childDirectedNode),
      layout.groundSurfaceY,
    )

    if (resizeState.originNode.type === 'terrain') {
      return applyTerrainResizeChain(layout, resizeState.originNode, nextNode)
    }

    return resizeState.originNode.type === 'manhole'
      ? applyConnectedPortResizeToLayout(layout, currentNode, nextNode)
      : {
          ...layout,
          nodes: layout.nodes.map((node) => (node.id === resizeState.nodeId ? nextNode : node)),
        }
  }

  const { node: resizedPipeNode } = getPipeResizeResult(layout, resizeState, cursor)
  const nextPipeNode = normalizeNodePorts(resizedPipeNode)
  return applyPipeResizeToLayout(layout, currentNode, nextPipeNode)
}

/** resize 시작 시 커서와 edge 사이의 오프셋을 보관한다. */
function getResizeEdgePointerOffset(node: EditorNode, edge: ResizeEdge, cursor: Point) {
  if (edge === 'right') {
    return node.x + node.width - cursor.x
  }

  if (edge === 'left') {
    return cursor.x - node.x
  }

  if (edge === 'bottom') {
    return node.y + node.height - cursor.y
  }

  return cursor.y - node.y
}

/** 저장된 edge 오프셋을 반영한 resize용 커서 좌표를 계산한다. */
function getResizeEdgeCursor(resizeState: ResizeState, cursor: Point): Point {
  if (resizeState.edge === 'right') {
    return { ...cursor, x: cursor.x + resizeState.edgePointerOffset }
  }

  if (resizeState.edge === 'left') {
    return { ...cursor, x: cursor.x - resizeState.edgePointerOffset }
  }

  if (resizeState.edge === 'bottom') {
    return { ...cursor, y: cursor.y + resizeState.edgePointerOffset }
  }

  return { ...cursor, y: cursor.y - resizeState.edgePointerOffset }
}


// ---------------------------------------------------------------------------
// 회전, resize 가능 edge, z-index helper
// ---------------------------------------------------------------------------
/** 파이프 세그먼트를 오른쪽 90도로 회전한다. */
function rotatePipeSegmentClockwise(node: EditorNode): EditorNode {
  if (node.type !== 'pipeSegment') {
    return node
  }

  const center = getNodeCenter(node)
  const nextWidth = node.height
  const nextHeight = node.width
  const nextRotation = (getPipeSegmentRotation(node) + 90) % 360

  return {
    ...node,
    x: center.x - nextWidth / 2,
    y: center.y - nextHeight / 2,
    width: nextWidth,
    height: nextHeight,
    props: {
      ...node.props,
      rotation: nextRotation,
    },
  }
}

/** 일반 커넥터를 오른쪽 90도로 회전한다. */
function rotateConnectorClockwise(node: EditorNode): EditorNode {
  if (node.type !== 'connector') {
    return node
  }

  const center = getNodeCenter(node)
  const nextWidth = node.height
  const nextHeight = node.width

  return {
    ...node,
    x: center.x - nextWidth / 2,
    y: center.y - nextHeight / 2,
    width: nextWidth,
    height: nextHeight,
  }
}

/** ㄱ자 커넥터를 회전하고 relation endpoint 포트 ID remap 정보를 만든다. */
function rotateElbowConnectorClockwise(node: EditorNode): { node: EditorNode; portMap: Record<string, string> } {
  if (node.type !== 'elbowConnector') {
    return { node, portMap: {} }
  }

  const currentRotation = getElbowConnectorRotation(node)
  const nextRotation = (currentRotation + 90) % 360
  const portMap = Object.fromEntries(
    node.ports.map((port) => [port.id, rotateSideClockwise(port.side)]),
  )

  return {
    node: {
      ...node,
      ports: getElbowConnectorPorts(nextRotation),
      props: {
        ...node.props,
        rotation: nextRotation,
      },
    },
    portMap,
  }
}

/** T자 커넥터를 회전하고 relation endpoint 포트 ID remap 정보를 만든다. */
function rotateTeeConnectorClockwise(node: EditorNode): { node: EditorNode; portMap: Record<string, string> } {
  if (node.type !== 'teeConnector') {
    return { node, portMap: {} }
  }

  const currentRotation = getTeeConnectorRotation(node)
  const nextRotation = (currentRotation + 90) % 360
  const portMap = Object.fromEntries(
    node.ports.map((port) => [port.id, port.side === 'center' ? 'center' : rotateSideClockwise(port.side)]),
  )

  return {
    node: {
      ...node,
      ports: getTeeConnectorPorts(nextRotation),
      props: {
        ...node.props,
        rotation: nextRotation,
      },
    },
    portMap,
  }
}
// ---------------------------------------------------------------------------
// 레이아웃 삽입과 attach-anchor guard helper
// ---------------------------------------------------------------------------
/** 레이아웃 + 핸들 위치에서 새 지형이 붙을 기준 좌표를 계산한다. */
function getLayoutAddPoint(source: ContextMenuState['layoutAdd']): Point {
  if (!source) {
    return { x: 0, y: 0 }
  }

  if (source.side === 'left') {
    return {
      x: source.bounds.left,
      y: (source.bounds.top + source.bounds.bottom) / 2,
    }
  }

  if (source.side === 'right') {
    return {
      x: source.bounds.right,
      y: (source.bounds.top + source.bounds.bottom) / 2,
    }
  }

  return {
    x: (source.bounds.left + source.bounds.right) / 2,
    y: source.bounds.bottom,
  }
}

/** 포트 면을 그에 대응하는 resize edge로 바꾼다. */
function getAttachResizeEdgeForPort(port: EditorPort): ResizeEdge | null {
  return port.side === 'top' ||
    port.side === 'right' ||
    port.side === 'bottom' ||
    port.side === 'left'
    ? port.side
    : null
}

/** 노드 edge가 지정 좌표에 오도록 크기와 위치를 조정한다. */
function resizeNodeEdgeToCoordinate(node: EditorNode, edge: ResizeEdge, coordinate: number): EditorNode {
  const minLength = (() => {
    if (node.type === 'pipeSegment') {
      const size = isEditorPipeSize(node.props.size) ? node.props.size : 'medium'
      return Math.max(MIN_PIPE_SEGMENT_LENGTH, PIPE_THICKNESS[size] + PIPE_BORDER[size] * 2)
    }

    if (node.type === 'manhole') {
      return MIN_MANHOLE_HEIGHT
    }

    if (node.type === 'road') {
      return MIN_ROAD_WIDTH
    }

    if (node.type === 'terrain') {
      return edge === 'top' || edge === 'bottom' ? MIN_TERRAIN_HEIGHT : MIN_TERRAIN_WIDTH
    }

    return MIN_PIPE_SEGMENT_LENGTH
  })()

  if (edge === 'top') {
    const bottom = node.y + node.height
    const height = Math.max(minLength, bottom - coordinate)

    return normalizeNodePorts({
      ...node,
      y: bottom - height,
      height,
    })
  }

  if (edge === 'bottom') {
    return normalizeNodePorts({
      ...node,
      height: Math.max(minLength, coordinate - node.y),
    })
  }

  if (edge === 'left') {
    const right = node.x + node.width
    const width = Math.max(minLength, right - coordinate)

    return normalizeNodePorts({
      ...node,
      x: right - width,
      width,
    })
  }

  return normalizeNodePorts({
    ...node,
    width: Math.max(minLength, coordinate - node.x),
  })
}

/** 노드 특정 edge의 현재 좌표를 반환한다. */
function getNodeEdgeCoordinate(node: EditorNode, edge: ResizeEdge) {
  if (edge === 'left') {
    return node.x
  }

  if (edge === 'right') {
    return node.x + node.width
  }

  if (edge === 'top') {
    return node.y
  }

  return node.y + node.height
}

/** 좌표가 노드 특정 resize edge 위에 있는지 확인한다. */
function isPointOnResizeEdge(point: Point, node: EditorNode, edge: ResizeEdge) {
  const edgeCoordinate = getNodeEdgeCoordinate(node, edge)
  const pointCoordinate = edge === 'left' || edge === 'right' ? point.x : point.y

  return Math.abs(pointCoordinate - edgeCoordinate) <= ATTACH_ANCHOR_EDGE_EPSILON
}

/** 상대 객체 크기를 고려해 attach edge 주변에 필요한 여유를 계산한다. */
function getCounterpartResizeClearance(
  node: EditorNode,
  port: EditorPort,
  counterpartNode: EditorNode | null,
  counterpartPort: EditorPort | null,
  edge: ResizeEdge,
) {
  if (!counterpartNode || !counterpartPort) {
    return 0
  }

  const counterpartPoint = getAttachedPortPoint(counterpartNode, counterpartPort, node, port)
  const axis = getResizeEdgeAxis(edge)
  if (axis === 'x') {
    if (counterpartPort.side !== 'top' && counterpartPort.side !== 'bottom' && counterpartPort.side !== 'center') {
      return 0
    }

    return edge === 'right'
      ? Math.max(0, counterpartNode.x + counterpartNode.width - counterpartPoint.x)
      : Math.max(0, counterpartPoint.x - counterpartNode.x)
  }

  if (counterpartPort.side !== 'left' && counterpartPort.side !== 'right' && counterpartPort.side !== 'center') {
    return 0
  }

  return edge === 'bottom'
    ? Math.max(0, counterpartNode.y + counterpartNode.height - counterpartPoint.y)
    : Math.max(0, counterpartPoint.y - counterpartNode.y)
}

/** 노드 내부 relation anchor 중 resize guard 후보를 수집한다. */
function getInternalRelationAnchorPointsForResize(
  layout: EditorLayout,
  node: EditorNode,
  edge: ResizeEdge,
  ignoredRelationIds?: Set<string>,
) {
  const points: ResizeAnchorPoint[] = []

  layout.links.forEach((link) => {
    if (link.type !== 'relation' || ignoredRelationIds?.has(link.id)) {
      return
    }

    const endpoint = getEndpointForNode(link, node.id)
    const counterpartEndpoint = getOtherRelationEndpoint(link, node.id)
    if (!endpoint || !counterpartEndpoint) {
      return
    }

    const port = getNodePort(node, endpoint.portId)
    const point = getEndpointPointWithCounterpart(layout, endpoint, counterpartEndpoint)
    if (!port || !point || isPointOnResizeEdge(point, node, edge)) {
      return
    }

    const counterpartNode = layout.nodes.find((candidate) => candidate.id === counterpartEndpoint.nodeId)
    const counterpartPort = counterpartNode ? getNodePort(counterpartNode, counterpartEndpoint.portId) : null

    points.push({
      point,
      clearance: getCounterpartResizeClearance(node, port, counterpartNode ?? null, counterpartPort, edge),
    })
  })

  return points
}

/** 특정 edge가 넘어가면 안 되는 anchor 경계를 계산한다. */
function getResizeAnchorBoundForEdge(
  layout: EditorLayout,
  node: EditorNode,
  edge: ResizeEdge,
  ignoredRelationIds?: Set<string>,
) {
  if (!shouldUseAttachAnchorResizeGuard(layout, node)) {
    return undefined
  }

  const anchors = getInternalRelationAnchorPointsForResize(layout, node, edge, ignoredRelationIds)
  if (anchors.length === 0) {
    return undefined
  }

  if (edge === 'right') {
    return Math.max(...anchors.map((anchor) => (
      anchor.point.x + anchor.clearance + ATTACH_ANCHOR_RESIZE_MARGIN
    )))
  }

  if (edge === 'left') {
    return Math.min(...anchors.map((anchor) => (
      anchor.point.x - anchor.clearance - ATTACH_ANCHOR_RESIZE_MARGIN
    )))
  }

  if (edge === 'bottom') {
    return Math.max(...anchors.map((anchor) => (
      anchor.point.y + anchor.clearance + ATTACH_ANCHOR_RESIZE_MARGIN
    )))
  }

  return Math.min(...anchors.map((anchor) => (
    anchor.point.y - anchor.clearance - ATTACH_ANCHOR_RESIZE_MARGIN
  )))
}

/** 현재 노드에 attach-anchor resize 보호 규칙을 적용할지 판정한다. */
function shouldUseAttachAnchorResizeGuard(layout: EditorLayout, node: EditorNode) {
  if (!ENABLE_ATTACH_ANCHOR_RESIZE_GUARD) {
    return false
  }

  const ancestorNodeIds = getRelationAncestorNodeIds(layout, node.id).filter((nodeId) => nodeId !== node.id)
  let hasFixedBranchRoot = false
  let hasManholeAncestor = node.type === 'manhole'

  for (const ancestorNodeId of ancestorNodeIds) {
    const ancestorNode = layout.nodes.find((candidate) => candidate.id === ancestorNodeId)
    if (!ancestorNode) {
      continue
    }

    if (ancestorNode.type === 'manhole') {
      hasManholeAncestor = true
    }

    if (ATTACH_ANCHOR_GUARD_FIXED_BRANCH_TYPES.has(ancestorNode.type)) {
      hasFixedBranchRoot = true
    }
  }

  return hasFixedBranchRoot && !hasManholeAncestor
}

/** resize 시작 시 노드의 anchor guard 경계를 계산해 저장한다. */
function getResizeAnchorBoundsForNode(
  layout: EditorLayout,
  node: EditorNode,
  ignoredRelationIds?: Set<string>,
): ResizeAnchorBounds {
  return {
    top: getResizeAnchorBoundForEdge(layout, node, 'top', ignoredRelationIds),
    right: getResizeAnchorBoundForEdge(layout, node, 'right', ignoredRelationIds),
    bottom: getResizeAnchorBoundForEdge(layout, node, 'bottom', ignoredRelationIds),
    left: getResizeAnchorBoundForEdge(layout, node, 'left', ignoredRelationIds),
  }
}

/** 저장된 anchor 경계를 기준으로 resize 결과를 clamp한다. */
function clampNodeResizeByAnchorBound(
  resizedNode: EditorNode,
  edge: ResizeEdge,
  bound: number | undefined,
) {
  if (bound === undefined) {
    return resizedNode
  }

  if (edge === 'right') {
    const resizedRight = resizedNode.x + resizedNode.width

    return resizedRight < bound
      ? resizeNodeEdgeToCoordinate(resizedNode, edge, bound)
      : resizedNode
  }

  if (edge === 'left') {
    return resizedNode.x > bound
      ? resizeNodeEdgeToCoordinate(resizedNode, edge, bound)
      : resizedNode
  }

  if (edge === 'bottom') {
    const resizedBottom = resizedNode.y + resizedNode.height

    return resizedBottom < bound
      ? resizeNodeEdgeToCoordinate(resizedNode, edge, bound)
      : resizedNode
  }

  return resizedNode.y > bound
    ? resizeNodeEdgeToCoordinate(resizedNode, edge, bound)
    : resizedNode
}

/** 노드 내부 relation anchor를 기준으로 resize 결과를 추가 clamp한다. */
function clampNodeResizeByInternalRelationAnchors(
  layout: EditorLayout,
  originNode: EditorNode,
  resizedNode: EditorNode,
  edge: ResizeEdge,
  anchorBounds?: ResizeAnchorBounds,
): EditorNode {
  const bound = anchorBounds?.[edge] ?? getResizeAnchorBoundForEdge(layout, originNode, edge)

  return clampNodeResizeByAnchorBound(resizedNode, edge, bound)
}


// ---------------------------------------------------------------------------
// attach 실행 규칙
// ---------------------------------------------------------------------------
/** parent는 유지하고 child/child-group을 attach 목표 위치로 맞춘다. */
function snapChildToParentByAttachRule(
  layout: EditorLayout,
  parentEndpoint: EditorPortSelection,
  childEndpoint: EditorPortSelection,
  parentNode: EditorNode,
  childNode: EditorNode,
  parentPort: EditorPort,
  childPort: EditorPort,
) {
  const anchorPoint = getAttachedPortPoint(parentNode, parentPort, childNode, childPort)
  const movingPoint = getAttachedPortPoint(childNode, childPort, parentNode, parentPort)
  const dx = anchorPoint.x - movingPoint.x
  const dy = anchorPoint.y - movingPoint.y
  const adjustedLayout = applyRelationEndpointDelta(
    layout,
    childEndpoint,
    parentEndpoint,
    dx,
    dy,
  )
  const parentGroupNodeIds = new Set(getRelationGroupNodeIds(layout, parentEndpoint.nodeId))

  return propagateAttachEndpointChanges(
    layout,
    adjustedLayout,
    [childEndpoint.nodeId],
    parentGroupNodeIds,
  )
}

/** 두 포트 선택으로 attach할 때 snapping과 전파를 한 번에 적용한다. */
function snapRelationEndpoints(
  layout: EditorLayout,
  parentEndpoint: EditorPortSelection,
  childEndpoint: EditorPortSelection,
): EditorLayout {
  if (
    parentEndpoint.nodeId === childEndpoint.nodeId ||
    wouldCreateRelationCycle(layout, parentEndpoint.nodeId, childEndpoint.nodeId)
  ) {
    return layout
  }

  const parentNode = layout.nodes.find((node) => node.id === parentEndpoint.nodeId)
  const childNode = layout.nodes.find((node) => node.id === childEndpoint.nodeId)
  const parentPort = parentNode ? getNodePort(parentNode, parentEndpoint.portId) : null
  const childPort = childNode ? getNodePort(childNode, childEndpoint.portId) : null
  if (!parentNode || !childNode || !parentPort || !childPort) {
    return layout
  }

  return snapChildToParentByAttachRule(
    layout,
    parentEndpoint,
    childEndpoint,
    parentNode,
    childNode,
    parentPort,
    childPort,
  )
}


// ---------------------------------------------------------------------------
// 키보드, 파일 다운로드 helper
// ---------------------------------------------------------------------------
/** 키보드 단축키가 입력 필드 편집을 방해하지 않도록 대상 요소를 판정한다. */
function isTextEditingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

/** 현재 editor layout을 JSON 파일로 내려받는다. */
function downloadLayout(layout: EditorLayout) {
  const exportLayout = normalizeRelationAttachments(layout)
  const blob = new Blob([JSON.stringify(exportLayout, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'drainage-layout.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

/** axios header 값을 단일 문자열로 정규화한다. */
function getHeaderValue(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : null
  }
  return typeof value === 'string' ? value : null
}

/** 서버 응답 header에서 다운로드 파일명을 추출한다. */
function getDownloadFilename(contentDisposition: string | null, fallback: string) {
  const disposition = contentDisposition
  const filenameMatch = disposition?.match(/filename="([^"]+)"/)

  return filenameMatch?.[1] ?? fallback
}

/** 텍스트 Blob을 만들어 브라우저 다운로드를 실행한다. */
function downloadTextFile(text: string, filename: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/** 서버 warning header를 사용자에게 보여줄 문자열 목록으로 파싱한다. */
function parseWarningHeader(value: string | null): string[] {
  if (!value) {
    return []
  }

  try {
    const parsedValue: unknown = JSON.parse(value)
    return Array.isArray(parsedValue) ? parsedValue.map(String) : []
  } catch {
    return [value]
  }
}

/** 현재 layout을 서버에 전달해 SWMM INP 텍스트로 변환한 뒤 다운로드한다. */
async function downloadSwmmInp(layout: EditorLayout) {
  const exportLayout = normalizeRelationAttachments(layout)
  const response = await apiClient.post<string>(
    joinSwmmApiUrl(SWMM_ENGINE_URL, '/editor/export-inp'),
    {
      layout: exportLayout,
      filename: 'generated_from_editor.inp',
      title: 'SWMM model generated from React editor layout',
    },
    {
      responseType: 'text',
      transformResponse: [(data) => data],
    },
  )

  const text = response.data
  const filename = getDownloadFilename(getHeaderValue(response.headers['content-disposition']), 'generated_from_editor.inp')
  downloadTextFile(text, filename)

  return parseWarningHeader(getHeaderValue(response.headers['x-editor-inp-warnings']))
}

/** 배수도 편집 화면의 상태 연결, 편집 이벤트, SVG 렌더 조립을 담당하는 최상위 컴포넌트다. */
export const EditorCanvas = memo(function EditorCanvas({
  theme = 'light',
  renderHeader,
}: {
  theme?: WorkbenchTheme
  renderHeader?: (controls: {
    isInfoPanelOpen: boolean
    toggleInfoPanel: () => void
  }) => ReactNode
}) {
  const isDark = theme === 'dark'
  const themeTokens = WORKBENCH_THEME_TOKENS[theme]
  // layout hook은 localStorage 저장, undo/redo history, batch 기록을 한곳에서 관리한다.
  const [layout, setLayout, layoutHistory] = useEditorLayoutState(normalizeEditorLayout)
  const {
    beginLayoutHistoryBatch,
    commitLayoutHistoryBatch,
    undoLayout,
    redoLayout,
    replaceLayout,
    canUndo,
    canRedo,
  } = layoutHistory

  // 선택/attach/좌표 변경/drag/resize는 동시에 겹치면 안 되는 사용자 인터랙션 상태다.
  const [selection, setSelection] = useState<EditorSelection>(null)
  const [pendingPort, setPendingPort] = useState<EditorPortSelection | null>(null)
  const [attachTargetNodeId, setAttachTargetNodeId] = useState<string | null>(null)
  const [coordinateEditState, setCoordinateEditState] = useState<CoordinateEditState | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dragDraftPositionsByNodeId, setDragDraftPositionsByNodeId] = useState<Map<string, Point> | null>(null)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)
  const [resizeDraftNodesById, setResizeDraftNodesById] = useState<Map<string, EditorNode> | null>(null)
  const [marqueeSelectionState, setMarqueeSelectionState] = useState<MarqueeSelectionState | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [isExportingInp, setIsExportingInp] = useState(false)
  const [isExportingPng, setIsExportingPng] = useState(false)
  const [isEditorInfoPanelOpen, setIsEditorInfoPanelOpen] = useState(false)
  const [isEditorSettingsOpen, setIsEditorSettingsOpen] = useState(false)
  const [relationPreviewNodeId, setRelationPreviewNodeId] = useState<string | null>(null)
  const [relationPreviewMode, setRelationPreviewMode] = useState<RelationPreviewMode>('parent')
  const [relationPreviewZoom, setRelationPreviewZoom] = useState(RELATION_PREVIEW_ZOOM_DEFAULT)
  const [isMobileInput, setIsMobileInput] = useState(() => getInitialAppSurface() === 'mobile')
  const [mobileContextSheetHeight, setMobileContextSheetHeight] = useState(0)
  const [mobileModalSheetHeight, setMobileModalSheetHeight] = useState(0)
  const [mobileMoveArmedNodeId, setMobileMoveArmedNodeId] = useState<string | null>(null)
  const [mobileEditorMode, setMobileEditorMode] = useState<MobileEditorInteractionMode>('idle')
  const [mobileActiveNodeId, setMobileActiveNodeId] = useState<string | null>(null)
  const [mobileQuickEditNodeId, setMobileQuickEditNodeId] = useState<string | null>(null)
  const [mobileQuickEditPanel, setMobileQuickEditPanel] = useState<MobileQuickEditPanel | null>(null)
  const [mobileQuickEditAnchorPoint, setMobileQuickEditAnchorPoint] = useState<Point | null>(null)
  const [editorZoom, setEditorZoom] = useState(EDITOR_ZOOM_DEFAULT)
  const [editorPan, setEditorPan] = useState({ x: 0, y: 0 })
  const [scenarios, setScenarios] = useState<SwmmScenario[]>([])
  const [selectedScenario, setSelectedScenario] = useState<SwmmScenario | null>(null)
  const [scenarioEditBaseline, setScenarioEditBaseline] = useState<EditorLayout | null>(null)
  const [scenarioCancelBaseline, setScenarioCancelBaseline] = useState<EditorLayout | null>(null)
  useBodyScrollLock(isMobileInput)
  const [isScenarioEditMode, setIsScenarioEditMode] = useState(false)
  const [scenarioTitle, setScenarioTitle] = useState('')
  const [scenarioDescription, setScenarioDescription] = useState('')
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false)
  const [isSavingScenario, setIsSavingScenario] = useState(false)
  const [isDeletingScenario, setIsDeletingScenario] = useState(false)
  const [scenarioError, setScenarioError] = useState<string | null>(null)
  const suppressScenarioAutoRestoreRef = useRef(false)

  // ref는 브라우저 파일 입력, SVG 좌표 변환, 좌표 변경 후속 클릭 억제를 위해 사용한다.
  const copiedSelectionRef = useRef<CopiedEditorSelection | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const editorCanvasViewportRef = useRef<HTMLDivElement | null>(null)
  const mobileCanvasContentRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const editorZoomRef = useRef(EDITOR_ZOOM_DEFAULT)
  const mobilePinchZoomRef = useRef<MobilePinchZoomState | null>(null)
  const mobilePinchScrollAnchorRef = useRef<MobilePinchScrollAnchor | null>(null)
  const mobilePinchFrameRef = useRef<number | null>(null)
  const mobilePendingPinchZoomRef = useRef<number | null>(null)
  const editorZoomControlsRef = useRef<MobileZoomControlsHandle | null>(null)
  const mobileCanvasScrollInitializedRef = useRef(false)
  const mobileCanvasGutterPaddingRef = useRef(0)
  const mobileNodeMoveRef = useRef<{
    pointerId: number
    groupNodeIds: string[]
    hasFixedYNode: boolean
    lastCursor: Point
  } | null>(null)
  const mobileEditorSettingsSheetRef = useRef<HTMLElement | null>(null)
  const mobileEditorInfoSheetRef = useRef<HTMLElement | null>(null)
  const mobileRelationPreviewSheetRef = useRef<HTMLElement | null>(null)
  const relationPreviewPinchRef = useRef<{
    startDistance: number
    startZoom: number
    anchorContentX: number
    anchorContentY: number
  } | null>(null)
  const relationPreviewPinchFrameRef = useRef<number | null>(null)
  const mobileNodeTapCandidateRef = useRef<{
    pointerId: number
    node: EditorNode
    point: Point
    startClientX: number
    startClientY: number
    lastClientX: number
    lastClientY: number
  } | null>(null)
  const mobileContextMenuCloseTapCandidateRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
  } | null>(null)
  const mobileMoveArmedNodeIdRef = useRef<string | null>(null)
  const isMobileAddMenuPreviewOpen = Boolean(
    contextMenu &&
    isMobileInput &&
    !contextMenu.nodeId &&
    !contextMenu.relationPort &&
    !contextMenu.layoutAdd,
  )

  const applyMobileCanvasZoom = useCallback((zoom: number, anchor?: MobilePinchScrollAnchor | null) => {
    const viewport = editorCanvasViewportRef.current
    const content = mobileCanvasContentRef.current
    if (!viewport || !content) {
      return
    }

    const scale = Math.max(EDITOR_ZOOM_MIN, zoom / EDITOR_ZOOM_DEFAULT)
    const horizontalPadding = isMobileAddMenuPreviewOpen ? viewport.clientWidth / 2 : 0
    content.style.width = horizontalPadding > 0
      ? `calc(${scale * 100}% + ${horizontalPadding * 2}px)`
      : `${scale * 100}%`
    content.style.height = `${scale * 100}%`
    content.style.paddingLeft = horizontalPadding > 0 ? `${horizontalPadding}px` : ''
    content.style.paddingRight = horizontalPadding > 0 ? `${horizontalPadding}px` : ''

    if (anchor) {
      const rect = viewport.getBoundingClientRect()
      viewport.scrollLeft = horizontalPadding + anchor.contentX * scale - (anchor.clientX - rect.left)
      viewport.scrollTop = anchor.contentY * scale - (anchor.clientY - rect.top)
    }
  }, [isMobileAddMenuPreviewOpen])

  useEffect(() => {
    editorZoomRef.current = editorZoom
    if (isMobileInput && !mobilePinchZoomRef.current) {
      applyMobileCanvasZoom(editorZoom)
    }
  }, [applyMobileCanvasZoom, editorZoom, isMobileInput])

  useLayoutEffect(() => {
    const viewport = editorCanvasViewportRef.current
    if (!isMobileInput || !viewport) {
      mobileCanvasScrollInitializedRef.current = false
      mobileCanvasGutterPaddingRef.current = 0
      return undefined
    }

    if (!isMobileAddMenuPreviewOpen) {
      if (mobileCanvasScrollInitializedRef.current) {
        const horizontalPadding = mobileCanvasGutterPaddingRef.current || viewport.clientWidth / 2
        viewport.scrollLeft = Math.max(0, viewport.scrollLeft - horizontalPadding)
      }
      mobileCanvasScrollInitializedRef.current = false
      mobileCanvasGutterPaddingRef.current = 0
      return undefined
    }

    if (mobileCanvasScrollInitializedRef.current) {
      return undefined
    }

    const horizontalPadding = viewport.clientWidth / 2
    viewport.scrollLeft += horizontalPadding
    mobileCanvasGutterPaddingRef.current = horizontalPadding
    mobileCanvasScrollInitializedRef.current = true
    return undefined
  }, [isMobileAddMenuPreviewOpen, isMobileInput])

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
  const suppressCoordinateEditFollowUpClickUntilRef = useRef(0)
  const nextNodeIndex = layout.nodes.length + 1
  const demoControlLocked = isDemoControlLocked()
  const demoScenarioLockMessage = 'demo/admin 시연 모드에서는 편집세팅의 기존 시나리오 선택/수정을 할 수 없습니다.'
  const isScenarioReadOnly = Boolean(selectedScenario && !isScenarioEditMode)
  const isScenarioReadOnlyRef = useRef(isScenarioReadOnly)
  const editorToastTimerRef = useRef<number | null>(null)
  const [editorToastMessage, setEditorToastMessage] = useState<string | null>(null)
  const showEditorToast = useCallback((message: string) => {
    if (editorToastTimerRef.current !== null) {
      window.clearTimeout(editorToastTimerRef.current)
    }

    setEditorToastMessage(message)
    editorToastTimerRef.current = window.setTimeout(() => {
      setEditorToastMessage(null)
      editorToastTimerRef.current = null
    }, 2200)
  }, [])
  const blockReadOnlyScenarioAction = useCallback(() => {
    if (!isScenarioReadOnlyRef.current) {
      return false
    }

    showEditorToast('시나리오 수정 버튼을 누른 뒤 편집할 수 있습니다.')
    return true
  }, [showEditorToast])

  useEffect(() => {
    isScenarioReadOnlyRef.current = isScenarioReadOnly
  }, [isScenarioReadOnly])

  useEffect(() => () => {
    if (editorToastTimerRef.current !== null) {
      window.clearTimeout(editorToastTimerRef.current)
    }

    if (relationPreviewPinchFrameRef.current !== null) {
      window.cancelAnimationFrame(relationPreviewPinchFrameRef.current)
    }
  }, [])

  const { nodesById, linksById, relationLinksByNodeId } = useLayoutIndexes(layout)
  const renderNodesById = useMemo(() => {
    if (
      (!dragDraftPositionsByNodeId || dragDraftPositionsByNodeId.size === 0) &&
      (!resizeDraftNodesById || resizeDraftNodesById.size === 0)
    ) {
      return nodesById
    }

    const draftNodesById = new Map(nodesById)
    resizeDraftNodesById?.forEach((node, nodeId) => {
      draftNodesById.set(nodeId, node)
    })
    dragDraftPositionsByNodeId?.forEach((position, nodeId) => {
      const node = nodesById.get(nodeId)
      if (node) {
        draftNodesById.set(nodeId, {
          ...node,
          x: position.x,
          y: position.y,
        })
      }
    })

    return draftNodesById
  }, [dragDraftPositionsByNodeId, nodesById, resizeDraftNodesById])

  useEffect(() => {
    return subscribeAppSurfaceChange((surface) => setIsMobileInput(surface === 'mobile'))
  }, [])

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  useEffect(() => clearLongPressTimer, [clearLongPressTimer])

  useEffect(() => {
    if (!isMobileInput) {
      return undefined
    }

    const sheet = isEditorSettingsOpen
      ? mobileEditorSettingsSheetRef.current
      : isEditorInfoPanelOpen
        ? mobileEditorInfoSheetRef.current
        : relationPreviewNodeId
          ? mobileRelationPreviewSheetRef.current
          : null

    if (!sheet) {
      return undefined
    }

    const updateSheetHeight = () => {
      setMobileModalSheetHeight(sheet.getBoundingClientRect().height)
    }

    updateSheetHeight()
    const resizeObserver = new ResizeObserver(updateSheetHeight)
    resizeObserver.observe(sheet)

    return () => {
      resizeObserver.disconnect()
    }
  }, [isMobileInput, isEditorSettingsOpen, isEditorInfoPanelOpen, relationPreviewNodeId])

  const resetEditorInteractionState = useCallback(() => {
    setSelection(null)
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setContextMenu(null)
    setMobileQuickEditNodeId(null)
    setMobileQuickEditPanel(null)
    setMobileQuickEditAnchorPoint(null)
    setDragState(null)
    setDragDraftPositionsByNodeId(null)
    setResizeState(null)
    setResizeDraftNodesById(null)
    setMarqueeSelectionState(null)
    setRelationPreviewNodeId(null)
    setRelationPreviewMode('parent')
    setMobileMoveArmedNodeId(null)
  }, [])

  const refreshScenarios = useCallback(async () => {
    setIsLoadingScenarios(true)
    setScenarioError(null)
    try {
      const nextScenarios = await getSwmmScenarios(SWMM_ENGINE_URL)
      setScenarios(nextScenarios)
      setSelectedScenario((currentScenario) => {
        if (!currentScenario) {
          return null
        }
        const nextSelectedScenario = nextScenarios.find((scenario) => scenario.id === currentScenario.id) ?? null
        if (!nextSelectedScenario) {
          clearSelectedSwmmScenarioId()
        }
        return nextSelectedScenario
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      setScenarioError(message)
    } finally {
      setIsLoadingScenarios(false)
    }
  }, [])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      refreshScenarios()
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [refreshScenarios])

  const selectScenario = useCallback((scenarioId: number) => {
    const scenario = scenarios.find((item) => item.id === scenarioId)
    if (!scenario) {
      return
    }

    if (!isEditorLayout(scenario.layoutJson)) {
      window.alert('선택한 시나리오의 배수도 JSON 구조가 올바르지 않습니다.')
      return
    }

    const normalizedLayout = normalizeEditorLayout(scenario.layoutJson)
    suppressScenarioAutoRestoreRef.current = false
    replaceLayout(normalizedLayout)
    setSelectedScenario(scenario)
    saveSelectedSwmmScenarioId(scenario.id)
    setScenarioEditBaseline(normalizedLayout)
    setScenarioCancelBaseline(null)
    setScenarioTitle(scenario.title)
    setScenarioDescription(scenario.description)
    setIsScenarioEditMode(false)
    resetEditorInteractionState()
  }, [replaceLayout, resetEditorInteractionState, scenarios])

  useEffect(() => {
    if (suppressScenarioAutoRestoreRef.current || selectedScenario || isScenarioEditMode || scenarios.length === 0) {
      return
    }

    const storedScenarioId = loadSelectedSwmmScenarioId()
    if (!storedScenarioId) {
      return
    }

    if (!scenarios.some((scenario) => scenario.id === storedScenarioId)) {
      clearSelectedSwmmScenarioId()
      return
    }

    const timerId = window.setTimeout(() => {
      selectScenario(storedScenarioId)
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [isScenarioEditMode, scenarios, selectScenario, selectedScenario])

  const handleScenarioSelect = (scenarioIdValue: string) => {
    if (demoControlLocked) {
      showEditorToast(demoScenarioLockMessage)
      return
    }

    suppressScenarioAutoRestoreRef.current = false
    const scenarioId = Number(scenarioIdValue)
    if (!scenarioId) {
      clearSelectedSwmmScenarioId()
      setSelectedScenario(null)
      setScenarioEditBaseline(null)
      setScenarioCancelBaseline(null)
      setScenarioTitle('')
      setScenarioDescription('')
      setIsScenarioEditMode(false)
      resetEditorInteractionState()
      return
    }
    selectScenario(scenarioId)
  }

  const createNewScenario = () => {
    const nextLayout = normalizeEditorLayout(createDefaultEditorLayout())
    setScenarioCancelBaseline(normalizeEditorLayout(layout))
    replaceLayout(nextLayout)
    clearSelectedSwmmScenarioId()
    setSelectedScenario(null)
    setScenarioEditBaseline(nextLayout)
    setScenarioTitle('새 시나리오')
    setScenarioDescription('')
    setIsScenarioEditMode(true)
    resetEditorInteractionState()
  }

  const beginScenarioEdit = () => {
    if (demoControlLocked) {
      showEditorToast(demoScenarioLockMessage)
      return
    }

    if (!selectedScenario) {
      return
    }
    setScenarioEditBaseline(normalizeEditorLayout(selectedScenario.layoutJson))
    setScenarioCancelBaseline(null)
    setScenarioTitle(selectedScenario.title)
    setScenarioDescription(selectedScenario.description)
    setIsScenarioEditMode(true)
  }

  const resetScenarioChanges = () => {
    const baseline = scenarioEditBaseline
    if (!baseline) {
      return
    }
    replaceLayout(baseline)
    setScenarioTitle(selectedScenario?.title ?? '새 시나리오')
    setScenarioDescription(selectedScenario?.description ?? '')
    resetEditorInteractionState()
  }

  const cancelScenarioEdit = () => {
    if (selectedScenario) {
      const selectedLayout = normalizeEditorLayout(selectedScenario.layoutJson)
      replaceLayout(selectedLayout)
      setScenarioEditBaseline(selectedLayout)
      setScenarioTitle(selectedScenario.title)
      setScenarioDescription(selectedScenario.description)
    } else if (scenarioCancelBaseline) {
      replaceLayout(scenarioCancelBaseline)
      setScenarioEditBaseline(null)
      setScenarioTitle('')
      setScenarioDescription('')
    } else {
      setScenarioEditBaseline(null)
      setScenarioTitle('')
      setScenarioDescription('')
    }

    setScenarioCancelBaseline(null)
    setIsScenarioEditMode(false)
    resetEditorInteractionState()
  }

  const saveScenario = async () => {
    if (isSavingScenario) {
      return
    }
    if (demoControlLocked && selectedScenario) {
      showEditorToast(demoScenarioLockMessage)
      return
    }

    const title = scenarioTitle.trim()
    if (!title) {
      window.alert('시나리오 제목을 입력해주세요.')
      return
    }

    setIsSavingScenario(true)
    setScenarioError(null)
    try {
      const exportLayout = normalizeRelationAttachments(layout)
      const savedScenario = selectedScenario
        ? await updateSwmmScenario(SWMM_ENGINE_URL, selectedScenario.id, {
            title,
            description: scenarioDescription,
            layoutJson: exportLayout,
          })
        : await createSwmmScenario(SWMM_ENGINE_URL, {
            title,
            description: scenarioDescription,
            layoutJson: exportLayout,
          })

      setSelectedScenario(savedScenario)
      saveSelectedSwmmScenarioId(savedScenario.id)
      setScenarioEditBaseline(normalizeEditorLayout(savedScenario.layoutJson))
      setScenarioCancelBaseline(null)
      setScenarioTitle(savedScenario.title)
      setScenarioDescription(savedScenario.description)
      setIsScenarioEditMode(false)
      setScenarios((currentScenarios) => [
        savedScenario,
        ...currentScenarios.filter((scenario) => scenario.id !== savedScenario.id),
      ])
      await refreshScenarios()
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      setScenarioError(message)
      window.alert(`시나리오 저장에 실패했습니다.\n\n${message}`)
    } finally {
      setIsSavingScenario(false)
    }
  }

  const deleteScenario = async () => {
    if (isSavingScenario || isDeletingScenario || !selectedScenario) {
      return
    }
    if (demoControlLocked) {
      showEditorToast(demoScenarioLockMessage)
      return
    }

    const scenarioToDelete = selectedScenario
    const confirmed = window.confirm(`시나리오 "${scenarioToDelete.title}"을 삭제할까요?`)
    if (!confirmed) {
      return
    }

    setIsDeletingScenario(true)
    setScenarioError(null)
    try {
      await deleteSwmmScenario(SWMM_ENGINE_URL, scenarioToDelete.id)
      suppressScenarioAutoRestoreRef.current = true
      setScenarios((currentScenarios) => currentScenarios.filter((scenario) => scenario.id !== scenarioToDelete.id))
      clearSelectedSwmmScenarioId()
      setSelectedScenario(null)
      setScenarioEditBaseline(null)
      setScenarioCancelBaseline(null)
      setScenarioTitle('')
      setScenarioDescription('')
      setIsScenarioEditMode(false)
      resetEditorInteractionState()
      showEditorToast('시나리오를 삭제했습니다.')
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      setScenarioError(message)
      window.alert(`시나리오 삭제에 실패했습니다.\n\n${message}`)
    } finally {
      setIsDeletingScenario(false)
    }
  }

  // 좌표 변경 완료 직후 port click이 한 번 더 들어오는 브라우저 이벤트 중복을 막는다.
  const suppressCoordinateEditFollowUpClick = useCallback(() => {
    suppressCoordinateEditFollowUpClickUntilRef.current = window.performance.now() + 500
  }, [])

  // 선택 상태에서 오른쪽 패널과 캔버스 렌더링이 공통으로 참조하는 파생 데이터를 계산한다.
  const selectedNode = useMemo(() => {
    if (selection?.kind !== 'node') {
      return null
    }

    return nodesById.get(selection.id) ?? null
  }, [nodesById, selection])

  const selectedLink = useMemo(() => {
    if (selection?.kind !== 'link') {
      return null
    }

    return linksById.get(selection.id) ?? null
  }, [linksById, selection])

  // multi selection도 단일 node처럼 빠르게 포함 여부를 확인하기 위해 Set으로 바꾼다.
  const selectedNodeIds = useMemo(() => {
    return new Set(getSelectionNodeIds(selection))
  }, [selection])
  const selectedOutlineNodes = useMemo(() => {
    if (selectedNodeIds.size === 0) {
      return []
    }

    return layout.nodes.filter((node) => selectedNodeIds.has(node.id))
  }, [layout.nodes, selectedNodeIds])

  // 캔버스 크기는 일반 객체에는 여백을 주고, terrain은 자기 경계까지만 확장한다.
  const canvasHeight = useMemo(() => {
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

    return Math.max(
      EDITOR_CANVAS_HEIGHT,
      Math.ceil(contentBottom + CANVAS_BOTTOM_PADDING),
      Math.ceil(terrainBottom),
    )
  }, [layout.groundSurfaceY, layout.nodes])

  const canvasWidth = useMemo(() => {
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

    return Math.max(
      EDITOR_CANVAS_WIDTH,
      Math.ceil(contentRight + CANVAS_RIGHT_PADDING),
      Math.ceil(terrainRight),
    )
  }, [layout.nodes])

  // 기본 땅 배경은 첫 side/bottom terrain 전까지만 남겨, 하천/바다 아래에 땅이 깔리지 않게 한다.
  const baseGroundBounds = useMemo<RectBounds>(() => {
    const firstSideTerrainX = layout.nodes.reduce((leftMostTerrainX, node) => {
      if (node.type !== 'terrain') {
        return leftMostTerrainX
      }

      const startsAtGroundSurface = Math.abs(node.y - layout.groundSurfaceY) <= 1
      if (!startsAtGroundSurface) {
        return leftMostTerrainX
      }

      return Math.min(leftMostTerrainX, Math.max(0, node.x))
    }, canvasWidth)
    const firstBottomTerrainY = layout.nodes.reduce((topMostTerrainY, node) => {
      if (node.type !== 'terrain') {
        return topMostTerrainY
      }

      if (node.y <= layout.groundSurfaceY + 1) {
        return topMostTerrainY
      }

      return Math.min(topMostTerrainY, node.y)
    }, canvasHeight)

    return {
      left: 0,
      top: layout.groundSurfaceY,
      right: Math.max(0, firstSideTerrainX),
      bottom: Math.max(layout.groundSurfaceY, firstBottomTerrainY),
    }
  }, [canvasHeight, canvasWidth, layout.groundSurfaceY, layout.nodes])
  const baseGroundWidth = Math.max(0, baseGroundBounds.right - baseGroundBounds.left)
  const baseGroundHeight = Math.max(0, baseGroundBounds.bottom - baseGroundBounds.top)
  const hasVisibleBaseGround = baseGroundWidth > 1 && baseGroundHeight > 1
  const hasGroundTerrainNode = useMemo(() => (
    layout.nodes.some((node) => node.type === 'terrain' && normalizeTerrainKind(node.props.terrainKind) === 'ground')
  ), [layout.nodes])

  const createSelectableBaseGroundNode = useCallback(() => {
    if (!hasVisibleBaseGround || hasGroundTerrainNode) {
      return null
    }

    const nodeType: EditorNodeType = 'terrain'
    const createdNode = normalizeNodeGeometryForPipePreset(
      createEditorNode(nodeType, nextNodeIndex, layout.groundSurfaceY),
    )
    const width = Math.max(MIN_TERRAIN_WIDTH, baseGroundWidth)
    const height = Math.max(MIN_TERRAIN_HEIGHT, baseGroundHeight)
    const nextNode = normalizeNodePorts({
      ...createdNode,
      name: `${TERRAIN_KIND_BY_ID.ground.nodeName} ${nextNodeIndex}`,
      x: baseGroundBounds.left,
      y: baseGroundBounds.top,
      width,
      height,
      ports: createEditorPorts(nodeType, width, height),
      props: { terrainKind: 'ground' },
    })

    setLayout((currentLayout) => {
      const currentHasGroundTerrainNode = currentLayout.nodes.some((node) => (
        node.type === 'terrain' && normalizeTerrainKind(node.props.terrainKind) === 'ground'
      ))

      if (currentHasGroundTerrainNode) {
        return currentLayout
      }

      return {
        ...currentLayout,
        nodes: [...currentLayout.nodes, nextNode],
      }
    })

    return nextNode
  }, [
    baseGroundBounds.left,
    baseGroundBounds.top,
    baseGroundHeight,
    baseGroundWidth,
    hasGroundTerrainNode,
    hasVisibleBaseGround,
    layout.groundSurfaceY,
    nextNodeIndex,
    setLayout,
  ])

  // 선택된 노드에 연결된 relation/link 목록은 포트 색상과 오른쪽 패널 표시에서 사용한다.
  const selectedConnectedLinks = useMemo(() => {
    if (!selectedNode) {
      return []
    }

    return layout.links.filter(
      (link) => link.from.nodeId === selectedNode.id || link.to.nodeId === selectedNode.id,
    )
  }, [layout.links, selectedNode])

  // 이미 relation이 붙은 포트는 파란색으로 표시해야 하므로 endpoint key를 모아둔다.
  const connectedPortKeys = useMemo(() => {
    const portKeys = new Set<string>()

    layout.links.forEach((link) => {
      if (link.type !== 'relation') {
        return
      }

      portKeys.add(endpointKey(link.from))
      portKeys.add(endpointKey(link.to))
    })

    return portKeys
  }, [layout.links])

  // relation 링크 선택 시 양 끝 포트에 parent/child 역할 표시를 붙인다.
  const selectedRelationPortRoles = useMemo(() => {
    const roles = new Map<string, RelationPortRole>()

    if (selectedLink?.type === 'relation') {
      roles.set(endpointKey(selectedLink.from), 'parent')
      roles.set(endpointKey(selectedLink.to), 'child')
    }

    return roles
  }, [selectedLink])

  // parent 노드를 선택했을 때 우클릭 가능한 파란 relation 포트를 구분한다.
  const selectedParentPortKeys = useMemo(() => {
    const portKeys = new Set<string>()
    if (!selectedNode) {
      return portKeys
    }

    layout.links.forEach((link) => {
      if (link.type === 'relation' && link.from.nodeId === selectedNode.id) {
        portKeys.add(endpointKey(link.from))
      }
    })

    return portKeys
  }, [layout.links, selectedNode])

  const hasParentRelationForNode = useCallback((nodeId: string) => {
    return layout.links.some((link) => link.type === 'relation' && link.from.nodeId === nodeId)
  }, [layout.links])

  // terrain/road 같은 레이어, 사용자가 지정한 zOrder, relation depth 순서로 실제 렌더 순서를 정한다.
  const renderedNodes = useMemo(() => createRenderedNodes(layout), [layout])
  const terrainNodes = useMemo(
    () => renderedNodes.filter((node) => node.type === 'terrain'),
    [renderedNodes],
  )
  const drawableNodes = useMemo(
    () => renderedNodes.filter((node) => node.type !== 'terrain'),
    [renderedNodes],
  )
  const baseRenderedPortRelationLookupByNodeId = useMemo(() => {
    const lookupByNodeId = new Map<string, RenderedPortRelationLookup>()

    renderedNodes.forEach((node) => {
      lookupByNodeId.set(
        node.id,
        createRenderedPortRelationLookup(
          node,
          relationLinksByNodeId.get(node.id) ?? [],
          nodesById,
        ),
      )
    })

    return lookupByNodeId
  }, [nodesById, relationLinksByNodeId, renderedNodes])
  const draftAffectedNodeIds = useMemo(
    () => getDraftAffectedNodeIds(
      dragDraftPositionsByNodeId,
      resizeDraftNodesById,
      relationLinksByNodeId,
    ),
    [dragDraftPositionsByNodeId, relationLinksByNodeId, resizeDraftNodesById],
  )
  const renderedPortRelationLookupByNodeId = useMemo(() => {
    if (draftAffectedNodeIds.size === 0) {
      return baseRenderedPortRelationLookupByNodeId
    }

    const lookupByNodeId = new Map(baseRenderedPortRelationLookupByNodeId)

    draftAffectedNodeIds.forEach((nodeId) => {
      const node = renderNodesById.get(nodeId)
      if (!node) {
        return
      }

      lookupByNodeId.set(
        nodeId,
        createRenderedPortRelationLookup(
          node,
          relationLinksByNodeId.get(nodeId) ?? [],
          renderNodesById,
        ),
      )
    })

    return lookupByNodeId
  }, [
    baseRenderedPortRelationLookupByNodeId,
    draftAffectedNodeIds,
    relationLinksByNodeId,
    renderNodesById,
  ])
  const canNodeStartRelation = useCallback((node: EditorNode | null | undefined) => {
    return Boolean(node && node.type !== 'terrain')
  }, [])

  // 좌표 변경 모드의 커서 모양을 x/y 축에 맞춰 바꾸기 위한 파생 상태다.
  const coordinateEditAxis = useMemo(() => {
    if (!coordinateEditState) {
      return null
    }

    const relation = layout.links.find((link) => link.id === coordinateEditState.linkId)
    if (relation?.type !== 'relation') {
      return null
    }

    return getCoordinateEditableRelationInfo(layout, relation)?.axis ?? null
  }, [coordinateEditState, layout])

  // 좌표 변경 모드에서 브라우저 pointer 위치를 SVG 좌표로 바꾸고 relation endpoint를 갱신한다.
  const updateCoordinateEditFromClientPoint = useCallback((clientX: number, clientY: number) => {
    if (!coordinateEditState || !svgRef.current) {
      return false
    }

    const cursor = getSvgCursor(svgRef.current, clientX, clientY)
    setLayout(
      (currentLayout) => updateCoordinateEditEndpoint(currentLayout, coordinateEditState.linkId, cursor),
      { recordHistory: false },
    )
    return true
  }, [coordinateEditState, setLayout])

  // 좌표 변경 모드는 마우스를 누르지 않아도 포인터를 따라가고, 클릭/마우스업으로 확정한다.
  useEffect(() => {
    if (!coordinateEditState) {
      return
    }

    const handleWindowPointerMove = (event: PointerEvent) => {
      updateCoordinateEditFromClientPoint(event.clientX, event.clientY)
    }

    window.addEventListener('pointermove', handleWindowPointerMove)
    return () => window.removeEventListener('pointermove', handleWindowPointerMove)
  }, [coordinateEditState, updateCoordinateEditFromClientPoint])

  // 오른쪽 선택 패널에서 발생하는 노드 편집 액션이다. 길이 변경은 relation 전파 규칙으로 넘긴다.
  const updateNode = (nodeId: string, updates: Partial<EditorNode>) => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    const currentNodeForFocus = nodesById.get(nodeId)
    const shouldFocusAfterUpdate = Boolean(
      currentNodeForFocus &&
      (
        updates.type !== undefined ||
        updates.x !== undefined ||
        updates.y !== undefined ||
        updates.width !== undefined ||
        updates.height !== undefined
      ),
    )
    const focusTargetNode = currentNodeForFocus && shouldFocusAfterUpdate
      ? snapNodeToGround(
        normalizeNodePorts({
          ...currentNodeForFocus,
          ...updates,
          ...(currentNodeForFocus.type === 'terrain'
            ? { x: currentNodeForFocus.x, y: currentNodeForFocus.y }
            : {}),
        }),
        layout.groundSurfaceY,
      )
      : null

    setLayout((currentLayout) => {
      const currentNode = currentLayout.nodes.find((node) => node.id === nodeId)
      if (!currentNode) {
        return currentLayout
      }

      const nextNode = snapNodeToGround(
        normalizeNodePorts({
          ...currentNode,
          ...updates,
          ...(currentNode.type === 'terrain'
            ? { x: currentNode.x, y: currentNode.y }
            : {}),
        }),
        currentLayout.groundSurfaceY,
      )

      if (currentNode.type === 'terrain') {
        return applyTerrainResizeChain(currentLayout, currentNode, nextNode)
      }

      if (currentNode.type === 'pipeSegment') {
        const isHorizontal = getNodeOrientation(currentNode) === 'horizontal'
        const axisLengthChanged = isHorizontal
          ? nextNode.width !== currentNode.width
          : nextNode.height !== currentNode.height

        if (axisLengthChanged) {
          const childDirectedNode = redirectExplicitLengthUpdateTowardChildEdge(
            currentLayout,
            currentNode,
            nextNode,
          )
          return applyPipeResizeToLayout(currentLayout, currentNode, childDirectedNode)
        }
      }

      if (currentNode.type === 'manhole' && nextNode.height !== currentNode.height) {
        const childDirectedNode = redirectExplicitLengthUpdateTowardChildEdge(
          currentLayout,
          currentNode,
          nextNode,
        )
        return applyConnectedPortResizeToLayout(currentLayout, currentNode, childDirectedNode)
      }

      return {
        ...currentLayout,
        nodes: currentLayout.nodes.map((node) => (node.id === nodeId ? nextNode : node)),
      }
    })

    if (focusTargetNode) {
      focusEditorNodeOnCanvas(focusTargetNode)
    }
  }

  const applyMobileResizeStep = useCallback((nodeId: string, edge: ResizeEdge, direction: 'shrink' | 'grow') => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    const deltaLength = direction === 'grow' ? MOBILE_RESIZE_STEP : -MOBILE_RESIZE_STEP
    setLayout((currentLayout) => {
      const currentNode = currentLayout.nodes.find((node) => node.id === nodeId)
      if (!currentNode) {
        return currentLayout
      }

      if (!getManualResizableEdges(currentNode)[edge]) {
        return currentLayout
      }

      const requestedNode = resizeNodeFromEdgeByLengthDelta(currentNode, edge, deltaLength)
      const childDirectedNode = redirectLengthResizeTowardChildEdge(
        currentLayout,
        currentNode,
        edge,
        requestedNode,
        getResizeAnchorBoundsForNode(currentLayout, currentNode),
      ).node
      const nextNode = snapNodeToGround(
        normalizeNodePorts(childDirectedNode),
        currentLayout.groundSurfaceY,
      )

      if (currentNode.type === 'pipeSegment') {
        return applyPipeResizeToLayout(currentLayout, currentNode, nextNode)
      }

      if (currentNode.type === 'manhole') {
        return applyConnectedPortResizeToLayout(currentLayout, currentNode, nextNode)
      }

      return {
        ...currentLayout,
        nodes: currentLayout.nodes.map((node) => (node.id === nodeId ? nextNode : node)),
      }
    })
  }, [blockReadOnlyScenarioAction, setLayout])

  const applyMobileMoveStep = useCallback((nodeId: string, direction: 'left' | 'right' | 'up' | 'down') => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    setLayout((currentLayout) => {
      const currentNode = currentLayout.nodes.find((node) => node.id === nodeId)
      if (!currentNode) {
        return currentLayout
      }

      const capability = getMobileMoveCapability(currentLayout, currentNode)
      const dx = direction === 'left' ? -MOBILE_MOVE_STEP : direction === 'right' ? MOBILE_MOVE_STEP : 0
      const dy = direction === 'up' ? -MOBILE_MOVE_STEP : direction === 'down' ? MOBILE_MOVE_STEP : 0

      if (dy !== 0 && !capability.canMoveY) {
        return currentLayout
      }

      return moveNodeIdsBy(currentLayout, capability.groupNodeIds, dx, dy)
    })
  }, [blockReadOnlyScenarioAction, setLayout])

  // 회전 버튼 액션이다. ㄱ자 커넥터는 회전 후 포트 ID도 함께 재매핑해야 한다.
  const rotateNodeClockwise = (nodeId: string) => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    setLayout((currentLayout) => {
      let rotatedPortMap: Record<string, string> = {}

      const nodes = currentLayout.nodes.map((node) => {
        if (node.id !== nodeId) {
          return node
        }

        if (node.type === 'elbowConnector') {
          const rotated = rotateElbowConnectorClockwise(node)
          rotatedPortMap = rotated.portMap
          return rotated.node
        }

        if (node.type === 'teeConnector') {
          const rotated = rotateTeeConnectorClockwise(node)
          rotatedPortMap = rotated.portMap
          return rotated.node
        }

        if (node.type === 'connector') {
          return rotateConnectorClockwise(node)
        }

        return rotatePipeSegmentClockwise(node)
      })

      const remapEndpoint = (endpoint: EditorEndpoint): EditorEndpoint => (
        endpoint.nodeId === nodeId && rotatedPortMap[endpoint.portId]
          ? { ...endpoint, portId: rotatedPortMap[endpoint.portId] }
          : endpoint
      )

      return {
        ...currentLayout,
        nodes,
        links: Object.keys(rotatedPortMap).length > 0
          ? currentLayout.links.map((link) => ({
              ...link,
              from: remapEndpoint(link.from),
              to: remapEndpoint(link.to),
            }))
          : currentLayout.links,
      }
    })
  }

  // link 본문 필드와 props 필드는 오른쪽 패널에서 따로 갱신한다.
  const updateLink = (linkId: string, updates: Partial<Omit<EditorLink, 'props'>>) => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    setLayout((currentLayout) => ({
      ...currentLayout,
      links: currentLayout.links.map((link) => (link.id === linkId ? { ...link, ...updates } : link)),
    }))
  }

  // link props는 relation/pipe link의 확장 메타데이터를 안전하게 병합한다.
  const updateLinkProps = (linkId: string, updates: Partial<EditorLink['props']>) => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    setLayout((currentLayout) => ({
      ...currentLayout,
      links: currentLayout.links.map((link) => (
        link.id === linkId
          ? {
              ...link,
              props: {
                ...link.props,
                ...updates,
              },
            }
          : link
      )),
    }))
  }

  // Backspace/Delete와 버튼 삭제가 공유하는 선택 삭제 액션이다.
  const deleteSelection = useCallback(() => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    if (!selection) {
      return
    }

    setLayout((currentLayout) => {
      if (selection.kind === 'link') {
        return {
          ...currentLayout,
          links: currentLayout.links.filter((link) => link.id !== selection.id),
        }
      }

      if (selection.kind === 'multi') {
        const selectedIds = new Set(selection.ids)

        return {
          ...currentLayout,
          nodes: currentLayout.nodes.filter((node) => !selectedIds.has(node.id)),
          links: currentLayout.links.filter(
            (link) => !selectedIds.has(link.from.nodeId) && !selectedIds.has(link.to.nodeId),
          ),
        }
      }

      return {
        ...currentLayout,
        nodes: currentLayout.nodes.filter((node) => node.id !== selection.id),
        links: currentLayout.links.filter(
          (link) => link.from.nodeId !== selection.id && link.to.nodeId !== selection.id,
        ),
      }
    })
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setMarqueeSelectionState(null)
    setSelection(null)
  }, [blockReadOnlyScenarioAction, selection, setLayout])

  // undo/redo나 pointer 종료 전에 임시 인터랙션 상태를 닫고 history batch를 확정한다.
  const clearTransientEditorState = useCallback(() => {
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setContextMenu(null)
    setDragState(null)
    setDragDraftPositionsByNodeId(null)
    setResizeState(null)
    setResizeDraftNodesById(null)
    setMarqueeSelectionState(null)
    setMobileMoveArmedNodeId(null)
    commitLayoutHistoryBatch()
  }, [commitLayoutHistoryBatch])

  // undo/redo는 drag/resize/attach 같은 임시 상태를 먼저 정리한 뒤 layout history만 이동한다.
  const undoEditorLayout = useCallback(() => {
    if (blockReadOnlyScenarioAction()) {
      return
    }
    clearTransientEditorState()
    undoLayout()
  }, [blockReadOnlyScenarioAction, clearTransientEditorState, undoLayout])

  const redoEditorLayout = useCallback(() => {
    if (blockReadOnlyScenarioAction()) {
      return
    }
    clearTransientEditorState()
    redoLayout()
  }, [blockReadOnlyScenarioAction, clearTransientEditorState, redoLayout])

  const handleLinkSelect = useCallback((linkId: string) => {
    setSelection({ kind: 'link', id: linkId })
    if (!isMobileInput || isScenarioReadOnly) {
      setIsEditorInfoPanelOpen(true)
    }
  }, [isMobileInput, isScenarioReadOnly])

  // 복사/붙여넣기는 현재 선택을 relation 그룹 단위로 확장한 뒤 새 ID로 복제한다.
  const copySelection = useCallback(() => {
    const copiedSelection = createCopiedEditorSelection(layout, selection)
    if (!copiedSelection) {
      return false
    }

    copiedSelectionRef.current = copiedSelection
    return true
  }, [layout, selection])

  const pasteSelection = useCallback(() => {
    if (blockReadOnlyScenarioAction()) {
      return false
    }

    const copiedSelection = copiedSelectionRef.current
    if (!copiedSelection) {
      return false
    }

    const result = pasteCopiedEditorSelection(layout, copiedSelection)
    const pastedNodeIds = result.selectedNodeIds
    setLayout(result.layout)

    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setContextMenu(null)
    setDragState(null)
    setDragDraftPositionsByNodeId(null)
    setResizeState(null)
    setResizeDraftNodesById(null)
    setMarqueeSelectionState(null)
    setSelection(pastedNodeIds.length === 1
      ? { kind: 'node', id: pastedNodeIds[0] }
      : { kind: 'multi', ids: pastedNodeIds })
    return true
  }, [blockReadOnlyScenarioAction, layout, setLayout])

  // 전역 키보드 단축키는 입력 필드 편집 중에는 동작하지 않게 제한한다.
  useEffect(() => {
    const handleDeleteKey = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') {
        return
      }

      if (isTextEditingTarget(event.target) || !selection) {
        return
      }

      if (isScenarioReadOnly) {
        event.preventDefault()
        blockReadOnlyScenarioAction()
        return
      }

      event.preventDefault()
      deleteSelection()
    }

    window.addEventListener('keydown', handleDeleteKey)
    return () => window.removeEventListener('keydown', handleDeleteKey)
  }, [blockReadOnlyScenarioAction, deleteSelection, isScenarioReadOnly, selection])

  // macOS Command와 Windows/Linux Ctrl을 모두 같은 undo/redo modifier로 취급한다.
  useEffect(() => {
    const handleHistoryKey = (event: KeyboardEvent) => {
      const isPrimaryModifier = event.metaKey || event.ctrlKey
      const isUndoRedoKey = event.key.toLowerCase() === 'z'
      if (!isPrimaryModifier || !isUndoRedoKey || event.altKey || isTextEditingTarget(event.target)) {
        return
      }

      if (isScenarioReadOnly) {
        event.preventDefault()
        blockReadOnlyScenarioAction()
        return
      }

      event.preventDefault()
      if (event.shiftKey) {
        redoEditorLayout()
      } else {
        undoEditorLayout()
      }
    }

    window.addEventListener('keydown', handleHistoryKey)
    return () => window.removeEventListener('keydown', handleHistoryKey)
  }, [blockReadOnlyScenarioAction, isScenarioReadOnly, redoEditorLayout, undoEditorLayout])

  // Cmd/Ctrl+C/V는 브라우저 기본 텍스트 복사 대신 editor selection 복사를 수행한다.
  useEffect(() => {
    const handleClipboardKey = (event: KeyboardEvent) => {
      const isPrimaryModifier = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (!isPrimaryModifier || event.altKey || isTextEditingTarget(event.target)) {
        return
      }

      if (key === 'c') {
        if (copySelection()) {
          event.preventDefault()
        }
        return
      }

      if (key === 'v') {
        if (pasteSelection()) {
          event.preventDefault()
        }
      }
    }

    window.addEventListener('keydown', handleClipboardKey)
    return () => window.removeEventListener('keydown', handleClipboardKey)
  }, [copySelection, pasteSelection])

  // 우클릭 메뉴는 Escape로 닫을 수 있게 전역 keydown을 연결한다.
  useEffect(() => {
    if (!contextMenu) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [contextMenu])

  // 웹 우클릭 메뉴는 메뉴 바깥을 좌클릭하는 순간 먼저 닫는다.
  useEffect(() => {
    if (!contextMenu || isMobileInput) {
      return undefined
    }

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return
      }

      const target = event.target
      if (target instanceof Element && target.closest('[data-editor-context-menu="true"]')) {
        return
      }

      setContextMenu(null)
    }

    window.addEventListener('pointerdown', handleOutsidePointerDown, { capture: true })
    return () => window.removeEventListener('pointerdown', handleOutsidePointerDown, { capture: true })
  }, [contextMenu, isMobileInput])

  // 아래 함수들은 SVG 캔버스에서 직접 발생하는 pointer/context menu 액션의 진입점이다.
  const openMobileNodeActionMenu = useCallback((node: EditorNode, point: Point) => {
    if (!pendingPort && mobileQuickEditNodeId === node.id) {
      setSelection({ kind: 'node', id: node.id })
      setContextMenu(null)
      setMobileQuickEditNodeId(null)
      setMobileQuickEditPanel(null)
      setMobileQuickEditAnchorPoint(null)
      return
    }

    setSelection({ kind: 'node', id: node.id })
    setIsEditorInfoPanelOpen(false)
    mobileMoveArmedNodeIdRef.current = null
    setMobileMoveArmedNodeId(null)
    setMobileEditorMode('idle')
    setMobileActiveNodeId(node.id)
    if (pendingPort) {
      setAttachTargetNodeId(node.id)
    } else {
      setPendingPort(null)
      setAttachTargetNodeId(null)
    }
    setCoordinateEditState(null)
    setDragState(null)
    setDragDraftPositionsByNodeId(null)
    setResizeState(null)
    setResizeDraftNodesById(null)
    setMarqueeSelectionState(null)
    setRelationPreviewNodeId(null)
    setContextMenu(null)
    setMobileQuickEditNodeId(isMobileQuickEditableNode(node) ? node.id : null)
    setMobileQuickEditPanel(null)
    setMobileQuickEditAnchorPoint(isMobileQuickEditableNode(node) ? point : null)
  }, [mobileQuickEditNodeId, pendingPort])

  const openAddMenuAtViewportCenter = useCallback(() => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    const svg = svgRef.current
    if (!svg) {
      return
    }

    const rootStyles = getComputedStyle(document.documentElement)
    const visualHeight = Number.parseFloat(rootStyles.getPropertyValue('--app-visual-height')) || window.visualViewport?.height || window.innerHeight
    const visualOffsetTop = Number.parseFloat(rootStyles.getPropertyValue('--app-visual-offset-top')) || 0
    const clientX = window.innerWidth / 2
    const clientY = visualOffsetTop + visualHeight / 2
    const point = getSvgCursor(svg, clientX, clientY)

    clearLongPressTimer()
    setSelection(null)
    setIsEditorInfoPanelOpen(false)
    setMobileQuickEditNodeId(null)
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setDragState(null)
    setDragDraftPositionsByNodeId(null)
    setResizeState(null)
    setResizeDraftNodesById(null)
    setMarqueeSelectionState(null)
    setRelationPreviewNodeId(null)
    mobileMoveArmedNodeIdRef.current = null
    setMobileMoveArmedNodeId(null)
    setMobileEditorMode('idle')
    setMobileActiveNodeId(null)
    setContextMenu({
      x: clientX,
      y: clientY,
      point,
    })
  }, [blockReadOnlyScenarioAction, clearLongPressTimer])

  const handleCanvasPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) {
      return
    }

    if (isScenarioReadOnly) {
      setContextMenu(null)
      return
    }

    const cursor = getSvgCursor(event.currentTarget, event.clientX, event.clientY)
    if (hasVisibleBaseGround && isPointInsideRectBounds(cursor, baseGroundBounds)) {
      const baseGroundNode = createSelectableBaseGroundNode()
      if (baseGroundNode) {
        event.preventDefault()
        clearLongPressTimer()
        setPendingPort(null)
        setAttachTargetNodeId(null)
        setCoordinateEditState(null)
        setDragState(null)
        setDragDraftPositionsByNodeId(null)
        setResizeState(null)
        setResizeDraftNodesById(null)
        setMarqueeSelectionState(null)
        setRelationPreviewNodeId(null)
        mobileMoveArmedNodeIdRef.current = null
        setMobileMoveArmedNodeId(null)
        setMobileEditorMode('idle')
        setMobileActiveNodeId(baseGroundNode.id)
        if (event.pointerType === 'touch' || event.pointerType === 'pen' || isMobileInput) {
          openMobileNodeActionMenu(baseGroundNode, cursor)
        } else {
          setSelection({ kind: 'node', id: baseGroundNode.id })
          setIsEditorInfoPanelOpen(true)
          setMobileQuickEditNodeId(null)
          setMobileQuickEditPanel(null)
          setMobileQuickEditAnchorPoint(null)
          setContextMenu(null)
        }
        return
      }
    }

    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      const shouldKeepMobileActionSheetOpen = Boolean(
        isMobileInput &&
        (
          mobileQuickEditPanel ||
          mobileEditorMode !== 'idle' ||
          isEditorInfoPanelOpen ||
          relationPreviewNodeId
        ),
      )

      if (shouldKeepMobileActionSheetOpen) {
        clearLongPressTimer()
        setContextMenu(null)
        return
      }

      if (
        isMobileInput &&
        contextMenu &&
        !contextMenu.nodeId &&
        !contextMenu.baseGround &&
        !contextMenu.relationPort &&
        !contextMenu.layoutAdd
      ) {
        return
      }

      if (
        isMobileInput &&
        (
          Boolean(contextMenu && (contextMenu.nodeId || contextMenu.baseGround)) ||
          Boolean(mobileQuickEditNodeId)
        )
      ) {
        clearLongPressTimer()
        mobileContextMenuCloseTapCandidateRef.current = {
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startClientY: event.clientY,
        }
        return
      }

      if (mobileEditorMode !== 'idle') {
        clearLongPressTimer()
        setContextMenu(null)
        setMobileQuickEditNodeId(null)
        return
      }

      if (hasSelection && !mobileMoveArmedNodeId) {
        event.preventDefault()
        clearLongPressTimer()
        setSelection(null)
        setIsEditorInfoPanelOpen(false)
        mobileMoveArmedNodeIdRef.current = null
        setMobileMoveArmedNodeId(null)
        setMobileEditorMode('idle')
        setMobileActiveNodeId(null)
        setPendingPort(null)
        setAttachTargetNodeId(null)
        setCoordinateEditState(null)
        setContextMenu(null)
        setMobileQuickEditNodeId(null)
        return
      }

      setSelection(null)
      setIsEditorInfoPanelOpen(false)
      mobileMoveArmedNodeIdRef.current = null
      setMobileMoveArmedNodeId(null)
      setMobileEditorMode('idle')
      setMobileActiveNodeId(null)
      setPendingPort(null)
      setAttachTargetNodeId(null)
      setCoordinateEditState(null)
      setContextMenu(null)
      setMobileQuickEditNodeId(null)
      return
    }

    if (coordinateEditState) {
      suppressCoordinateEditFollowUpClick()
      updateCoordinateEditFromClientPoint(event.clientX, event.clientY)
      setContextMenu(null)
      setMobileQuickEditNodeId(null)
      return
    }

    setSelection(null)
    setIsEditorInfoPanelOpen(false)
    setMobileMoveArmedNodeId(null)
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setContextMenu(null)
    setMobileQuickEditNodeId(null)
    setMarqueeSelectionState({
      start: cursor,
      current: cursor,
    })
  }

  const handleCanvasContextMenu = (event: ReactMouseEvent<SVGSVGElement>) => {
    event.preventDefault()
    if (isScenarioReadOnly) {
      setContextMenu(null)
      return
    }

    const cursor = getSvgCursor(event.currentTarget, event.clientX, event.clientY)
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      point: cursor,
    })
  }

  // 우클릭 z-order는 multi selection 안의 노드를 누른 경우 선택 그룹 전체에 적용한다.
  const getZOrderTargetNodeIds = useCallback((nodeId: string) => {
    if (selection?.kind === 'multi' && selectedNodeIds.has(nodeId)) {
      return selection.ids
    }

    return [nodeId]
  }, [selectedNodeIds, selection])

  const handleNodeContextMenu = (
    node: EditorNode,
    event: ReactMouseEvent<SVGGElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    if (isScenarioReadOnly) {
      setSelection({ kind: 'node', id: node.id })
      setIsEditorInfoPanelOpen(true)
      setContextMenu(null)
      setMobileQuickEditNodeId(null)
      return
    }

    const svg = event.currentTarget.ownerSVGElement
    const point = svg ? getSvgCursor(svg, event.clientX, event.clientY) : { x: node.x, y: node.y }

    if (!isMobileInput && node.type === 'terrain') {
      setSelection({ kind: 'node', id: node.id })
      setPendingPort(null)
      setAttachTargetNodeId(null)
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        point,
      })
      return
    }

    if (!(selection?.kind === 'multi' && selectedNodeIds.has(node.id))) {
      setSelection({ kind: 'node', id: node.id })
    }
    if (pendingPort) {
      setAttachTargetNodeId(node.id)
    } else {
      setPendingPort(null)
      setAttachTargetNodeId(null)
    }
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      point,
      nodeId: node.id,
    })
  }

  // 선택 객체 또는 선택 그룹의 z-order를 바꾼다.
  const changeNodeZOrder = (nodeId: string, action: NodeZOrderAction) => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    const targetNodeIds = getZOrderTargetNodeIds(nodeId)
    setLayout((currentLayout) => ({
      ...currentLayout,
      nodes: reorderNodesByZOrder(currentLayout.nodes, targetNodeIds, action),
    }))
  }

  // 객체 우클릭 메뉴에서 선택 객체 또는 선택 그룹의 z-order를 바꾼다.
  const changeContextNodeZOrder = (action: NodeZOrderAction) => {
    if (!contextMenu?.nodeId) {
      return
    }

    changeNodeZOrder(contextMenu.nodeId, action)
    setContextMenu(null)
  }

  // 선택된 객체의 파란 relation 포트를 우클릭했을 때 해체 메뉴를 연다.
  const handlePortContextMenu = (
    nodeId: string,
    portId: string,
    event: ReactMouseEvent<SVGElement>,
  ) => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    const endpoint = { nodeId, portId }
    const relation = layout.links.find((link) => (
      link.type === 'relation' &&
      (endpointKey(link.from) === endpointKey(endpoint) || endpointKey(link.to) === endpointKey(endpoint)) &&
      selection?.kind === 'node' &&
      selection.id === nodeId
    ))

    if (!relation) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    const point = svg ? getSvgCursor(svg, event.clientX, event.clientY) : { x: 0, y: 0 }

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      point,
      relationPort: {
        linkId: relation.id,
        endpoint,
      },
    })
  }

  // terrain edge의 + 핸들을 누르면 땅/하천/바다 추가 메뉴를 같은 context menu 시스템으로 연다.
  const openLayoutAddMenu = useCallback((
    source: ContextMenuState['layoutAdd'],
    event: ReactPointerEvent<SVGGElement>,
  ) => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    if (!source) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      point: getLayoutAddPoint(source),
      layoutAdd: source,
    })
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setDragState(null)
    setResizeState(null)
    setMarqueeSelectionState(null)
  }, [blockReadOnlyScenarioAction])

  // 기본 땅 배경의 좌/우/하단 edge에서 새 terrain을 이어 붙이는 진입점이다.
  const handleBaseLayoutAddPointerDown = useCallback((
    side: LayoutAddSide,
    event: ReactPointerEvent<SVGGElement>,
  ) => {
    openLayoutAddMenu({
      side,
      bounds: baseGroundBounds,
    }, event)
  }, [baseGroundBounds, openLayoutAddMenu])

  // 이미 추가된 terrain 노드의 좌/우/하단 edge에서 새 terrain을 체인으로 이어 붙인다.
  const handleNodeLayoutAddPointerDown = useCallback((
    node: EditorNode,
    side: LayoutAddSide,
    event: ReactPointerEvent<SVGGElement>,
  ) => {
    openLayoutAddMenu({
      side,
      bounds: {
        left: node.x,
        top: node.y,
        right: node.x + node.width,
        bottom: node.y + node.height,
      },
      sourceNodeId: node.id,
    }, event)
  }, [openLayoutAddMenu])

  // relation 포트 우클릭 메뉴에서 해체를 실행한다.
  const detachContextRelation = () => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    const relationPort = contextMenu?.relationPort
    if (!relationPort) {
      return
    }

    if (!window.confirm('관계를 해제할까요?')) {
      return
    }

    setLayout((currentLayout) => ({
      ...currentLayout,
      links: currentLayout.links.filter((link) => link.id !== relationPort.linkId),
    }))
    setContextMenu(null)
    setCoordinateEditState(null)
  }

  const detachRelationByPortClick = (
    relationId: string,
    nodeId: string,
    options: { keepPendingPort?: boolean } = {},
  ) => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    if (!window.confirm('관계를 해제할까요?')) {
      return
    }

    setLayout((currentLayout) => ({
      ...currentLayout,
      links: currentLayout.links.filter((link) => link.id !== relationId),
    }))
    if (options.keepPendingPort) {
      setAttachTargetNodeId(nodeId)
    } else {
      setPendingPort(null)
      setAttachTargetNodeId(null)
    }
    setContextMenu(null)
    setCoordinateEditState(null)
    setSelection({ kind: 'node', id: nodeId })
  }

  // 모바일 객체 액션에서 parent 노드 기준으로 연결된 relation들을 한 번에 해체한다.
  const detachContextNodeParentRelations = () => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    const nodeId = contextMenu?.nodeId
    if (!nodeId) {
      return
    }

    const hasParentRelation = layout.links.some((link) => link.type === 'relation' && link.from.nodeId === nodeId)
    if (!hasParentRelation || !window.confirm('관계를 해제할까요?')) {
      return
    }

    setLayout((currentLayout) => ({
      ...currentLayout,
      links: currentLayout.links.filter((link) => !(link.type === 'relation' && link.from.nodeId === nodeId)),
    }))
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setRelationPreviewNodeId(null)
    setContextMenu(null)
    setCoordinateEditState(null)
  }

  // T자 객체 우클릭 메뉴에서 trunk 축 좌표 변경 모드로 진입한다.
  const startContextTeeCoordinateEdit = () => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    const nodeId = contextMenu?.nodeId
    if (!nodeId) {
      return
    }

    const coordinateInfo = getCoordinateEditableTeeRelationInfo(layout, nodeId)
    if (!coordinateInfo) {
      setContextMenu(null)
      return
    }

    beginLayoutHistoryBatch()
    setSelection({ kind: 'node', id: coordinateInfo.parentNode.id })
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState({ linkId: coordinateInfo.relation.id })
    setContextMenu(null)
  }

  const processCanvasPointerMove = useCallback(({
    svg,
    clientX,
    clientY,
  }: {
    svg: SVGSVGElement
    clientX: number
    clientY: number
  }) => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    const cursor = getSvgCursor(svg, clientX, clientY)

    if (coordinateEditState) {
      updateCoordinateEditFromClientPoint(clientX, clientY)
      return
    }

    if (marqueeSelectionState) {
      setMarqueeSelectionState({
        ...marqueeSelectionState,
        current: cursor,
      })
      return
    }

    if (resizeState) {
      const resizeCursor = getResizeEdgeCursor(resizeState, cursor)

      setResizeDraftNodesById(createResizeDraftNodes(layout, resizeState, resizeCursor))
      return
    }

    if (!dragState) {
      return
    }

    setDragDraftPositionsByNodeId(
      createDragDraftPositions(layout, dragState, cursor.x - dragState.offsetX, cursor.y - dragState.offsetY),
    )
  }, [
    coordinateEditState,
    dragState,
    blockReadOnlyScenarioAction,
    layout,
    marqueeSelectionState,
    resizeState,
    updateCoordinateEditFromClientPoint,
  ])

  const {
    schedule: scheduleCanvasPointerMove,
    cancel: cancelCanvasPointerMove,
  } = useRafCoalescedCallback(processCanvasPointerMove)

  const clearPointerInteractionState = useCallback(() => {
    clearLongPressTimer()
    cancelCanvasPointerMove()
    mobileNodeTapCandidateRef.current = null
    mobileContextMenuCloseTapCandidateRef.current = null
    mobileNodeMoveRef.current = null
    setCoordinateEditState(null)
    setDragState(null)
    setDragDraftPositionsByNodeId(null)
    setResizeState(null)
    setResizeDraftNodesById(null)
    setMarqueeSelectionState(null)
  }, [cancelCanvasPointerMove, clearLongPressTimer])

  useEffect(() => {
    const viewport = editorCanvasViewportRef.current
    if (!viewport || !isMobileInput) {
      mobilePinchZoomRef.current = null
      mobilePinchScrollAnchorRef.current = null
      mobilePendingPinchZoomRef.current = null
      if (mobilePinchFrameRef.current !== null) {
        window.cancelAnimationFrame(mobilePinchFrameRef.current)
        mobilePinchFrameRef.current = null
      }
      return undefined
    }

    const flushPinchZoomFrame = () => {
      const nextZoom = mobilePendingPinchZoomRef.current
      if (nextZoom === null) {
        return editorZoomRef.current
      }

      mobilePendingPinchZoomRef.current = null
      editorZoomRef.current = nextZoom
      applyMobileCanvasZoom(nextZoom, mobilePinchScrollAnchorRef.current)
      editorZoomControlsRef.current?.setPercentLabel(formatZoomPercentLabel(nextZoom, EDITOR_ZOOM_DEFAULT))
      return nextZoom
    }

    const schedulePinchZoomFrame = (nextZoom: number) => {
      mobilePendingPinchZoomRef.current = nextZoom
      if (mobilePinchFrameRef.current !== null) {
        return
      }

      mobilePinchFrameRef.current = window.requestAnimationFrame(() => {
        mobilePinchFrameRef.current = null
        flushPinchZoomFrame()
      })
    }

    const finishPinchZoom = () => {
      const nextZoom = mobilePendingPinchZoomRef.current ?? editorZoomRef.current
      if (mobilePinchFrameRef.current !== null) {
        window.cancelAnimationFrame(mobilePinchFrameRef.current)
        mobilePinchFrameRef.current = null
      }
      mobilePendingPinchZoomRef.current = null
      mobilePinchZoomRef.current = null
      editorZoomRef.current = nextZoom
      applyMobileCanvasZoom(nextZoom, mobilePinchScrollAnchorRef.current)
      editorZoomControlsRef.current?.setPercentLabel(formatZoomPercentLabel(nextZoom, EDITOR_ZOOM_DEFAULT))
      setEditorZoom((current) => (
        Math.abs(current - nextZoom) < 0.001 ? current : nextZoom
      ))
      mobilePinchScrollAnchorRef.current = null
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
      commitLayoutHistoryBatch()
      clearPointerInteractionState()

      const center = getPinchCenter(event.touches)
      const rect = viewport.getBoundingClientRect()
      const currentZoom = editorZoomRef.current
      const currentScale = Math.max(EDITOR_ZOOM_MIN, currentZoom / EDITOR_ZOOM_DEFAULT)
      const horizontalPadding = isMobileAddMenuPreviewOpen ? viewport.clientWidth / 2 : 0
      const anchorContentX = (viewport.scrollLeft + center.clientX - rect.left - horizontalPadding) / currentScale
      const anchorContentY = (viewport.scrollTop + center.clientY - rect.top) / currentScale

      mobilePinchZoomRef.current = {
        startDistance: distance,
        startZoom: currentZoom,
        anchorContentX,
        anchorContentY,
        anchorClientX: center.clientX,
        anchorClientY: center.clientY,
      }
      mobilePinchScrollAnchorRef.current = {
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

      if (!mobilePinchZoomRef.current) {
        startPinchZoom(event)
      }

      const pinch = mobilePinchZoomRef.current
      if (!pinch) {
        return
      }

      const distance = getPinchDistance(event.touches)
      if (!Number.isFinite(distance) || distance <= 0) {
        return
      }

      event.preventDefault()
      const nextZoom = Math.max(EDITOR_ZOOM_MIN, pinch.startZoom * (distance / pinch.startDistance))
      mobilePinchScrollAnchorRef.current = {
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

    viewport.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true })
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true })
    viewport.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true })
    viewport.addEventListener('touchcancel', handleTouchEnd, { passive: false, capture: true })

    return () => {
      if (mobilePinchFrameRef.current !== null) {
        window.cancelAnimationFrame(mobilePinchFrameRef.current)
        mobilePinchFrameRef.current = null
      }
      mobilePendingPinchZoomRef.current = null
      viewport.removeEventListener('touchstart', handleTouchStart, { capture: true })
      viewport.removeEventListener('touchmove', handleTouchMove, { capture: true })
      viewport.removeEventListener('touchend', handleTouchEnd, { capture: true })
      viewport.removeEventListener('touchcancel', handleTouchEnd, { capture: true })
    }
  }, [applyMobileCanvasZoom, clearPointerInteractionState, commitLayoutHistoryBatch, isMobileAddMenuPreviewOpen, isMobileInput])

  // pointer up/leave에서 좌표 변경, marquee, drag, resize batch를 확정한다.
  const finishPointerInteraction = useCallback((event?: ReactPointerEvent<SVGSVGElement>) => {
    clearLongPressTimer()
    cancelCanvasPointerMove()
    const mobileTapCandidate = event?.type === 'pointerup' && (event.pointerType === 'touch' || event.pointerType === 'pen')
      ? mobileNodeTapCandidateRef.current
      : null
    if (mobileTapCandidate && mobileTapCandidate.pointerId === event?.pointerId) {
      const finalClientX = event.clientX
      const finalClientY = event.clientY
      if (
        Math.hypot(
          finalClientX - mobileTapCandidate.startClientX,
          finalClientY - mobileTapCandidate.startClientY,
        ) <= MOBILE_TAP_MAX_DISTANCE_PX
      ) {
        openMobileNodeActionMenu(
          mobileTapCandidate.node,
          mobileTapCandidate.point,
        )
      }
    }
    mobileNodeTapCandidateRef.current = null
    const mobileContextMenuCloseTapEvent = event?.type === 'pointerup' && (event.pointerType === 'touch' || event.pointerType === 'pen')
      ? event
      : null
    const mobileContextMenuCloseTapCandidate = mobileContextMenuCloseTapEvent
      ? mobileContextMenuCloseTapCandidateRef.current
      : null
    if (mobileContextMenuCloseTapCandidate && mobileContextMenuCloseTapEvent && mobileContextMenuCloseTapCandidate.pointerId === mobileContextMenuCloseTapEvent.pointerId) {
      const movedDistance = Math.hypot(
        mobileContextMenuCloseTapEvent.clientX - mobileContextMenuCloseTapCandidate.startClientX,
        mobileContextMenuCloseTapEvent.clientY - mobileContextMenuCloseTapCandidate.startClientY,
      )
      if (movedDistance <= MOBILE_TAP_MAX_DISTANCE_PX) {
        setContextMenu(null)
        setMobileQuickEditNodeId(null)
        setMobileQuickEditPanel(null)
        setMobileQuickEditAnchorPoint(null)
      }
    }
    mobileContextMenuCloseTapCandidateRef.current = null
    mobileNodeMoveRef.current = null

    if (coordinateEditState) {
      suppressCoordinateEditFollowUpClick()
      setCoordinateEditState(null)
      commitLayoutHistoryBatch()
      return
    }

    if (marqueeSelectionState) {
      const marqueeRect = normalizeRect(marqueeSelectionState.start, marqueeSelectionState.current)
      const isIntentionalMarquee = marqueeRect.right - marqueeRect.left > 4 || marqueeRect.bottom - marqueeRect.top > 4
      const selectedIds = isIntentionalMarquee
        ? getExpandedRelationGroupNodeIds(layout, getMarqueeSelectedNodeIds(layout, marqueeRect))
        : []

      setSelection(selectedIds.length === 0
        ? null
        : selectedIds.length === 1
          ? { kind: 'node', id: selectedIds[0] }
          : { kind: 'multi', ids: selectedIds })
      setMarqueeSelectionState(null)
      setDragState(null)
      setDragDraftPositionsByNodeId(null)
      setResizeState(null)
      setResizeDraftNodesById(null)
      commitLayoutHistoryBatch()
      return
    }

    if (dragState && dragDraftPositionsByNodeId) {
      setLayout((currentLayout) => applyDragDraftPositions(currentLayout, dragDraftPositionsByNodeId), {
        recordHistory: false,
      })
    }

    if (resizeState && resizeDraftNodesById) {
      setLayout((currentLayout) => applyResizeDraftNodes(currentLayout, resizeDraftNodesById), {
        recordHistory: false,
      })
    }

    setCoordinateEditState(null)
    setDragState(null)
    setDragDraftPositionsByNodeId(null)
    setResizeState(null)
    setResizeDraftNodesById(null)
    setMarqueeSelectionState(null)
    commitLayoutHistoryBatch()
  }, [
    cancelCanvasPointerMove,
    clearLongPressTimer,
    commitLayoutHistoryBatch,
    coordinateEditState,
    dragDraftPositionsByNodeId,
    dragState,
    layout,
    marqueeSelectionState,
    openMobileNodeActionMenu,
    resizeDraftNodesById,
    resizeState,
    setLayout,
    suppressCoordinateEditFollowUpClick,
  ])

  const handleCanvasPointerLeave = useCallback(() => {
    if (coordinateEditState) {
      return
    }

    if (dragState || resizeState || mobileNodeMoveRef.current) {
      return
    }

    finishPointerInteraction()
  }, [coordinateEditState, dragState, finishPointerInteraction, resizeState])

  // pointer move는 현재 모드에 따라 좌표 변경, 영역 선택, resize, drag 중 하나만 수행한다.
  const handleCanvasPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      clearLongPressTimer()
      const tapCandidate = mobileNodeTapCandidateRef.current
      if (tapCandidate?.pointerId === event.pointerId) {
        const movedDistance = Math.hypot(
          event.clientX - tapCandidate.startClientX,
          event.clientY - tapCandidate.startClientY,
        )
        if (movedDistance > MOBILE_TAP_MAX_DISTANCE_PX) {
          mobileNodeTapCandidateRef.current = null
        } else {
          mobileNodeTapCandidateRef.current = {
            ...tapCandidate,
            lastClientX: event.clientX,
            lastClientY: event.clientY,
          }
        }
      }
      const contextMenuCloseTapCandidate = mobileContextMenuCloseTapCandidateRef.current
      if (contextMenuCloseTapCandidate?.pointerId === event.pointerId) {
        const movedDistance = Math.hypot(
          event.clientX - contextMenuCloseTapCandidate.startClientX,
          event.clientY - contextMenuCloseTapCandidate.startClientY,
        )
        if (movedDistance > MOBILE_TAP_MAX_DISTANCE_PX) {
          mobileContextMenuCloseTapCandidateRef.current = null
        }
      }
    }

    if (
      (event.pointerType === 'touch' || event.pointerType === 'pen') &&
      mobileNodeMoveRef.current?.pointerId === event.pointerId
    ) {
      event.preventDefault()
      const cursor = getSvgCursor(event.currentTarget, event.clientX, event.clientY)
      const moveState = mobileNodeMoveRef.current
      const dx = cursor.x - moveState.lastCursor.x
      const dy = moveState.hasFixedYNode ? 0 : cursor.y - moveState.lastCursor.y
      mobileNodeMoveRef.current = {
        ...moveState,
        lastCursor: cursor,
      }

      if (dx !== 0 || dy !== 0) {
        setLayout(
          (currentLayout) => moveNodeIdsBy(currentLayout, moveState.groupNodeIds, dx, dy),
          { recordHistory: false },
        )
      }
      return
    }

    if (isScenarioReadOnly || (!coordinateEditState && !marqueeSelectionState && !resizeState && !dragState)) {
      return
    }

    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      event.preventDefault()
    }

    scheduleCanvasPointerMove({
      svg: event.currentTarget,
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  // attach 모드의 두 번째 선택을 검증하고, snap 후 relation 링크 생성까지 마무리한다.
  const completePendingAttach = (nextPort: EditorPortSelection) => {
    if (blockReadOnlyScenarioAction()) {
      return false
    }

    if (!pendingPort) {
      return false
    }

    if (
      pendingPort.nodeId === nextPort.nodeId ||
      endpointKey(pendingPort) === endpointKey(nextPort)
    ) {
      setPendingPort(null)
      setAttachTargetNodeId(null)
      setSelection({ kind: 'node', id: nextPort.nodeId })
      return true
    }

    if (getRelationLinkForPort(layout, nextPort)) {
      setAttachTargetNodeId(nextPort.nodeId)
      setSelection({ kind: 'node', id: nextPort.nodeId })
      return true
    }

    if (wouldCreateRelationCycle(layout, pendingPort.nodeId, nextPort.nodeId)) {
      setPendingPort(null)
      setAttachTargetNodeId(null)
      setSelection({ kind: 'node', id: nextPort.nodeId })
      return true
    }

    setLayout((currentLayout) => {
      if (wouldCreateRelationCycle(currentLayout, pendingPort.nodeId, nextPort.nodeId)) {
        return currentLayout
      }

      const snappedLayout = snapRelationEndpoints(currentLayout, pendingPort, nextPort)

      return {
        ...snappedLayout,
        links: [...snappedLayout.links, createLink(snappedLayout, pendingPort, nextPort)],
      }
    })
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setSelection({ kind: 'node', id: nextPort.nodeId })
    return true
  }

  // 노드 클릭은 attach 중이면 target 선택, 일반 상태면 relation group drag 시작으로 분기한다.
  const handleNodePointerDown = (node: EditorNode, event: ReactPointerEvent<SVGGElement>) => {
    if (event.button !== 0) {
      return
    }

    event.stopPropagation()
    if (event.pointerType === 'mouse' && !isMobileInput && contextMenu) {
      setContextMenu(null)
    }

    if (isScenarioReadOnly) {
      setSelection({ kind: 'node', id: node.id })
      setIsEditorInfoPanelOpen(true)
      setContextMenu(null)
      setMobileQuickEditNodeId(null)
      return
    }

    const svg = event.currentTarget.ownerSVGElement
    if (!svg) {
      return
    }

    const cursor = getSvgCursor(svg, event.clientX, event.clientY)
    if (
      (event.pointerType === 'touch' || event.pointerType === 'pen') &&
      isMobileInput &&
      (
        mobileQuickEditPanel ||
        mobileEditorMode !== 'idle' ||
        isEditorInfoPanelOpen ||
        relationPreviewNodeId
      )
    ) {
      clearLongPressTimer()
      setContextMenu(null)
      return
    }

    if (node.type === 'terrain') {
      event.preventDefault()
      setPendingPort(null)
      setAttachTargetNodeId(null)
      setDragState(null)
      setDragDraftPositionsByNodeId(null)
      setResizeState(null)
      setResizeDraftNodesById(null)
      mobileMoveArmedNodeIdRef.current = null
      setMobileMoveArmedNodeId(null)
      setMobileEditorMode('idle')
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        clearLongPressTimer()
        setIsEditorInfoPanelOpen(false)
        mobileNodeTapCandidateRef.current = {
          pointerId: event.pointerId,
          node,
          point: cursor,
          startClientX: event.clientX,
          startClientY: event.clientY,
          lastClientX: event.clientX,
          lastClientY: event.clientY,
        }
        return
      }

      setSelection({ kind: 'node', id: node.id })
      setMobileActiveNodeId(node.id)
      if (event.pointerType === 'mouse' && !isMobileInput) {
        setIsEditorInfoPanelOpen(true)
        setMobileQuickEditNodeId(null)
        setMobileQuickEditAnchorPoint(null)
      }
      return
    }

    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      setIsEditorInfoPanelOpen(false)

      if (pendingPort) {
        event.preventDefault()
        clearLongPressTimer()
        setContextMenu(null)
        setMobileQuickEditNodeId(null)
        setMobileQuickEditPanel(null)
        setMobileQuickEditAnchorPoint(null)
        mobileNodeTapCandidateRef.current = {
          pointerId: event.pointerId,
          node,
          point: cursor,
          startClientX: event.clientX,
          startClientY: event.clientY,
          lastClientX: event.clientX,
          lastClientY: event.clientY,
        }
        return
      }

      if (mobileEditorMode !== 'idle') {
        clearLongPressTimer()
        mobileNodeTapCandidateRef.current = null
        setContextMenu(null)
        setMobileQuickEditNodeId(null)
        return
      }

      const armedNodeId = mobileMoveArmedNodeIdRef.current ?? mobileMoveArmedNodeId

      if (armedNodeId !== node.id) {
        mobileNodeTapCandidateRef.current = {
          pointerId: event.pointerId,
          node,
          point: cursor,
          startClientX: event.clientX,
          startClientY: event.clientY,
          lastClientX: event.clientX,
          lastClientY: event.clientY,
        }
        return
      }

      event.preventDefault()
      svg.setPointerCapture(event.pointerId)
      setIsEditorInfoPanelOpen(false)
      mobileMoveArmedNodeIdRef.current = null
      setMobileMoveArmedNodeId(null)
      setMobileEditorMode('move')
      setMobileActiveNodeId(node.id)
      setMobileQuickEditNodeId(null)
      const groupNodeIds = getRelationGroupNodeIds(layout, node.id)
      const groupNodeIdSet = new Set(groupNodeIds)
      const hasFixedYNode = layout.nodes.some((candidate) => groupNodeIdSet.has(candidate.id) && isFixedYNode(candidate))
      beginLayoutHistoryBatch()
      mobileNodeMoveRef.current = {
        pointerId: event.pointerId,
        groupNodeIds,
        hasFixedYNode,
        lastCursor: cursor,
      }
      setDragState(null)
      setDragDraftPositionsByNodeId(null)
      setResizeState(null)
      setResizeDraftNodesById(null)
      return
    } else if (event.pointerType === 'mouse' && !isMobileInput) {
      if (!svg.hasPointerCapture(event.pointerId)) {
        svg.setPointerCapture(event.pointerId)
      }
      setIsEditorInfoPanelOpen(true)
    }

    if (coordinateEditState) {
      suppressCoordinateEditFollowUpClick()
      updateCoordinateEditFromClientPoint(event.clientX, event.clientY)
      setDragState(null)
      setDragDraftPositionsByNodeId(null)
      setResizeState(null)
      setResizeDraftNodesById(null)
      return
    }

    const shouldDragCurrentMultiSelection = selection?.kind === 'multi' && selectedNodeIds.has(node.id) && !pendingPort
    if (!shouldDragCurrentMultiSelection) {
      setSelection({ kind: 'node', id: node.id })
    }

    if (pendingPort) {
      const nearestPort = getNearestAttachCandidatePort(layout, node, cursor)
      if (nearestPort) {
        completePendingAttach({ nodeId: node.id, portId: nearestPort.id })
        return
      }

      setAttachTargetNodeId(node.id)
      setDragState(null)
      setDragDraftPositionsByNodeId(null)
      setResizeState(null)
      setResizeDraftNodesById(null)
      return
    }

    beginLayoutHistoryBatch()
    setDragDraftPositionsByNodeId(null)
    setResizeDraftNodesById(null)

    const groupNodeIds = shouldDragCurrentMultiSelection
      ? selection.ids
      : getRelationGroupNodeIds(layout, node.id)
    const groupNodeIdSet = new Set(groupNodeIds)
    const originNodes = getOriginNodes(layout, groupNodeIds)
    const hasFixedYNode = layout.nodes.some((candidate) => groupNodeIdSet.has(candidate.id) && isFixedYNode(candidate))

    setDragState({
      nodeId: node.id,
      offsetX: cursor.x - node.x,
      offsetY: cursor.y - node.y,
      groupNodeIds,
      groupNodeIdSet,
      originNodes,
      hasFixedYNode,
    })
  }

  // attach 중 다른 노드 위에 올라가면 선택 가능한 target 하이라이트를 표시한다.
  const handleNodePointerEnter = (node: EditorNode) => {
    if (!pendingPort || pendingPort.nodeId === node.id) {
      return
    }

    setAttachTargetNodeId(node.id)
  }

  // 파이프/맨홀 resize handle을 누르면 수동 길이 변경 batch를 시작한다.
  const handlePipeResizePointerDown = (
    node: EditorNode,
    edge: ResizeEdge,
    event: ReactPointerEvent<SVGRectElement>,
  ) => {
    if (event.button !== 0) {
      return
    }

    event.stopPropagation()
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      event.preventDefault()
    }
    if (
      (event.pointerType === 'touch' || event.pointerType === 'pen') &&
      (mobileEditorMode !== 'resize' || mobileActiveNodeId !== node.id)
    ) {
      return
    }

    if (isScenarioReadOnly) {
      setSelection({ kind: 'node', id: node.id })
      setIsEditorInfoPanelOpen(true)
      return
    }

    if (pendingPort) {
      setSelection({ kind: 'node', id: node.id })
      setAttachTargetNodeId(node.id)
      setDragState(null)
      setDragDraftPositionsByNodeId(null)
      setResizeState(null)
      setResizeDraftNodesById(null)
      return
    }

    if (!getManualResizableEdges(node)[edge]) {
      return
    }

    const svg = event.currentTarget.ownerSVGElement
    if (!svg) {
      return
    }
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    const cursor = getSvgCursor(svg, event.clientX, event.clientY)
    const childResizeEdge = node.type === 'pipeSegment'
      ? getChildResizeEdgeForLengthChange(layout, node, edge)
      : null
    const groupNodeIds = node.type === 'pipeSegment' ? getRelationGroupNodeIds(layout, node.id) : [node.id]
    const groupNodeIdSet = new Set(groupNodeIds)
    const hasFixedYNode = layout.nodes.some((candidate) => groupNodeIdSet.has(candidate.id) && isFixedYNode(candidate))
    setSelection({ kind: 'node', id: node.id })
    setDragState(null)
    setDragDraftPositionsByNodeId(null)
    setResizeDraftNodesById(null)
    beginLayoutHistoryBatch()
    setResizeState({
      nodeId: node.id,
      edge,
      originNode: node,
      edgePointerOffset: getResizeEdgePointerOffset(node, edge, cursor),
      anchorBounds: getResizeAnchorBoundsForNode(layout, node),
      childResizeEdge,
      hasFixedYNode,
    })
  }

  // 포트 클릭은 attach 시작/완료를 담당하고, 이미 연결된 포트는 클릭으로 바로 해제한다.
  const handlePortClick = (nodeId: string, portId: string, event: ReactMouseEvent<SVGElement>) => {
    event.stopPropagation()
    if (isScenarioReadOnly) {
      setSelection({ kind: 'node', id: nodeId })
      setIsEditorInfoPanelOpen(true)
      setContextMenu(null)
      return
    }

    if (coordinateEditState || window.performance.now() < suppressCoordinateEditFollowUpClickUntilRef.current) {
      suppressCoordinateEditFollowUpClickUntilRef.current = 0
      return
    }

    const nextPort = { nodeId, portId }

    if (isMobileInput) {
      if (!relationPreviewNodeId || relationPreviewNodeId !== nodeId) {
        return
      }

      if (relationPreviewMode === 'parent') {
        const existingRelation = getRelationLinkForPort(layout, nextPort)
        if (existingRelation) {
          detachRelationByPortClick(existingRelation.id, nodeId)
          return
        }

        setPendingPort(nextPort)
        setAttachTargetNodeId(null)
        setCoordinateEditState(null)
        setSelection({ kind: 'node', id: nodeId })
        setRelationPreviewNodeId(null)
        return
      }

      if (!pendingPort) {
        setRelationPreviewNodeId(null)
        setRelationPreviewMode('parent')
        return
      }

      const existingRelation = getRelationLinkForPort(layout, nextPort)
      if (existingRelation) {
        detachRelationByPortClick(existingRelation.id, nodeId, { keepPendingPort: true })
        return
      }

      completePendingAttach(nextPort)
      setRelationPreviewNodeId(null)
      setRelationPreviewMode('parent')
      return
    }

    if (pendingPort) {
      completePendingAttach(nextPort)
      setRelationPreviewNodeId(null)
      return
    }

    const existingRelation = getRelationLinkForPort(layout, nextPort)
    if (existingRelation) {
      detachRelationByPortClick(existingRelation.id, nodeId)
      return
    }

    setPendingPort(nextPort)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setSelection({ kind: 'node', id: nodeId })
    if (isMobileInput) {
      setRelationPreviewNodeId(null)
    }
  }

  // 우클릭 메뉴에서 시설/커넥터 같은 기본 노드를 추가하는 액션이다.
  const addNode = (type: EditorNodeType, point?: Point) => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    const node = normalizeNodeGeometryForPipePreset(createEditorNode(type, nextNodeIndex, layout.groundSurfaceY))
    const positionedNode = point
      ? {
          ...node,
          x: point.x - node.width / 2,
          y: point.y - node.height / 2,
        }
      : node

    setLayout((currentLayout) => ({
      ...currentLayout,
      nodes: [
        ...currentLayout.nodes,
        snapNodeToGround(
          positionedNode,
          currentLayout.groundSurfaceY,
        ),
      ],
    }))
    setSelection({ kind: 'node', id: node.id })
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
  }

  // 우클릭 메뉴의 독립 파이프 추가 액션이다.
  const addStandalonePipe = (point?: Point) => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    const timestamp = Date.now()
    const pipeId = `pipe_free_${timestamp}`

    setLayout((currentLayout) => {
      const row = currentLayout.nodes.length % 5
      const x = point ? point.x - 160 : 180 + row * 70
      const y = point ? point.y - (PIPE_THICKNESS.medium + PIPE_BORDER.medium * 2) / 2 : currentLayout.groundSurfaceY + 270 + row * 28
      const pipeNode: EditorNode = {
        id: pipeId,
        swmmId: pipeId,
        name: '파이프',
        type: 'pipeSegment',
        x,
        y,
        width: 320,
        height: PIPE_THICKNESS.medium + PIPE_BORDER.medium * 2,
        ports: CONNECTOR_PORTS,
        props: {
          size: 'medium',
          rotation: 0,
          pipeKind: DEFAULT_PIPE_KIND,
          slope: 0.001154,
          blockage: 0,
        },
      }

      return {
        ...currentLayout,
        nodes: [...currentLayout.nodes, pipeNode],
      }
    })
    setSelection({ kind: 'node', id: pipeId })
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
  }

  // 레이아웃 + 핸들에서 땅/하천/바다 terrain을 기존 레이아웃과 같은 높이로 체인 추가한다.
  const addLayoutNode = (kind: LayoutAddKind, source: ContextMenuState['layoutAdd']) => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    if (!source) {
      return
    }

    const nodeType: EditorNodeType = 'terrain'
    const createdNode = normalizeNodeGeometryForPipePreset(
      createEditorNode(nodeType, nextNodeIndex, layout.groundSurfaceY),
    )
    const sourceWidth = Math.max(80, source.bounds.right - source.bounds.left)
    const baseTerrainHeight = Math.max(MIN_TERRAIN_HEIGHT, canvasHeight - layout.groundSurfaceY)
    const width = Math.max(
      MIN_TERRAIN_WIDTH,
      source.side === 'bottom'
        ? sourceWidth
        : Math.min(Math.max(sourceWidth, createdNode.width), 1400),
    )
    const height = baseTerrainHeight
    const x = source.side === 'left'
      ? source.bounds.left - width
      : source.side === 'right'
        ? source.bounds.right
        : source.bounds.left
    const y = source.side === 'bottom'
      ? source.bounds.bottom
      : source.bounds.top
    const props: Record<string, string | number | boolean> = { terrainKind: kind }
    const nodeName = `${TERRAIN_KIND_BY_ID[kind].nodeName} ${nextNodeIndex}`
    const nextNode = normalizeNodePorts({
      ...createdNode,
      name: nodeName,
      x,
      y,
      width,
      height,
      ports: createEditorPorts(nodeType, width, height),
      props,
    })

    setLayout((currentLayout) => ({
      ...currentLayout,
      nodes: [...currentLayout.nodes, nextNode],
    }))
    setSelection({ kind: 'node', id: nextNode.id })
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setContextMenu(null)
  }

  // localStorage를 지우고 기본 editor layout으로 되돌린다.
  const resetLayout = () => {
    if (isScenarioEditMode && scenarioEditBaseline) {
      resetScenarioChanges()
      return
    }

    if (blockReadOnlyScenarioAction()) {
      return
    }

    clearEditorLayout()
    clearSelectedSwmmScenarioId()
    setSelectedScenario(null)
    setScenarioEditBaseline(null)
    setScenarioTitle('')
    setScenarioDescription('')
    setIsScenarioEditMode(false)
    resetEditorInteractionState()
    replaceLayout(normalizeEditorLayout(createDefaultEditorLayout()))
  }

  // JSON 파일을 불러와 legacy 값을 보정한 뒤 현재 layout으로 적용한다.
  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    if (isScenarioReadOnly) {
      event.target.value = ''
      return
    }

    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const text = await file.text()
    const parsedValue: unknown = JSON.parse(text)
    if (isEditorLayout(parsedValue)) {
      const importedLayout = normalizeEditorLayout(parsedValue)
      replaceLayout(importedLayout)
      clearSelectedSwmmScenarioId()
      setSelectedScenario(null)
      setScenarioEditBaseline(importedLayout)
      setScenarioTitle('가져온 시나리오')
      setScenarioDescription('')
      setIsScenarioEditMode(true)
      resetEditorInteractionState()
    }

    event.target.value = ''
  }

  // 현재 editor layout을 서버 변환 API에 보내 SWMM INP 파일로 내려받는다.
  const handleExportSwmmInp = async () => {
    if (isExportingInp) {
      return
    }

    setIsExportingInp(true)
    try {
      const warnings = await downloadSwmmInp(layout)
      if (warnings.length > 0) {
        window.alert(`SWMM INP를 생성했지만 확인할 내용이 있습니다.\n\n${warnings.join('\n')}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`SWMM INP 내보내기에 실패했습니다.\n\n${message}\n\nSWMM 엔진 서버(${SWMM_ENGINE_URL})가 실행 중인지 확인해주세요.`)
    } finally {
      setIsExportingInp(false)
    }
  }

  // 현재 편집 SVG를 브라우저에서 PNG로 인코딩한 뒤 내려받는다.
  const handleExportEditorPng = async () => {
    if (isExportingPng) {
      return
    }

    const svg = svgRef.current
    if (!svg) {
      window.alert('PNG로 내보낼 편집 배수도를 찾지 못했습니다.')
      return
    }

    setIsExportingPng(true)
    try {
      await downloadSvgAsPng(svg, `editor-drainage-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`, {
        backgroundColor: isDark ? '#020617' : '#e8f5ff',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`PNG 내보내기에 실패했습니다.\n\n${message}`)
    } finally {
      setIsExportingPng(false)
    }
  }

  // 렌더링에서만 쓰는 최종 UI 파생 상태다.
  const hasSelection = Boolean(selectedNode || selectedLink || selection?.kind === 'multi')
  const marqueeRect = marqueeSelectionState
    ? normalizeRect(marqueeSelectionState.start, marqueeSelectionState.current)
    : null
  const editorViewBox = useMemo(() => {
    const safeZoom = Math.max(EDITOR_ZOOM_MIN, editorZoom)
    const viewWidth = canvasWidth / safeZoom
    const viewHeight = canvasHeight / safeZoom
    const centerX = canvasWidth / 2 - editorPan.x
    const centerY = canvasHeight / 2 - editorPan.y

    return `${centerX - viewWidth / 2} ${centerY - viewHeight / 2} ${viewWidth} ${viewHeight}`
  }, [canvasHeight, canvasWidth, editorPan.x, editorPan.y, editorZoom])
  const mobileScrollViewBox = `0 0 ${canvasWidth} ${canvasHeight}`

  const getEditorViewportMetrics = useCallback((zoom: number, pan = editorPan) => {
    const safeZoom = Math.max(EDITOR_ZOOM_MIN, zoom)
    const viewWidth = canvasWidth / safeZoom
    const viewHeight = canvasHeight / safeZoom
    const centerX = canvasWidth / 2 - pan.x
    const centerY = canvasHeight / 2 - pan.y

    return {
      viewWidth,
      viewHeight,
      minX: centerX - viewWidth / 2,
      minY: centerY - viewHeight / 2,
    }
  }, [canvasHeight, canvasWidth, editorPan])

  const focusEditorNodeOnCanvas = useCallback((node: EditorNode) => {
    const center = getNodeCenter(node)

    window.requestAnimationFrame(() => {
      if (isMobileInput) {
        const viewport = editorCanvasViewportRef.current
        const svgElement = svgRef.current
        if (!viewport || !svgElement) {
          return
        }

        const svgRect = svgElement.getBoundingClientRect()
        const viewportRect = viewport.getBoundingClientRect()
        const viewportScale = Math.min(svgRect.width / canvasWidth, svgRect.height / canvasHeight)
        if (!Number.isFinite(viewportScale) || viewportScale <= 0) {
          return
        }

        const renderedWidth = canvasWidth * viewportScale
        const renderedHeight = canvasHeight * viewportScale
        const offsetX = (svgRect.width - renderedWidth) / 2
        const offsetY = (svgRect.height - renderedHeight) / 2
        const targetClientX = svgRect.left + offsetX + center.x * viewportScale
        const targetClientY = svgRect.top + offsetY + center.y * viewportScale
        const visibleViewportHeight = Math.max(1, viewport.clientHeight - mobileModalSheetHeight)
        const targetViewportY = viewportRect.top + visibleViewportHeight / 2

        viewport.scrollTo({
          left: Math.max(0, viewport.scrollLeft + targetClientX - viewportRect.left - viewport.clientWidth / 2),
          top: Math.max(0, viewport.scrollTop + targetClientY - targetViewportY),
          behavior: 'smooth',
        })
        return
      }

      setEditorPan({
        x: canvasWidth / 2 - center.x,
        y: canvasHeight / 2 - center.y,
      })
    })
  }, [canvasHeight, canvasWidth, isMobileInput, mobileModalSheetHeight])

  const getEditorWheelDeltaPixels = useCallback((event: WheelEvent) => {
    if (event.deltaMode === window.WheelEvent.DOM_DELTA_LINE) {
      return {
        x: event.deltaX * EDITOR_WHEEL_LINE_HEIGHT_PX,
        y: event.deltaY * EDITOR_WHEEL_LINE_HEIGHT_PX,
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

  const setAnchoredEditorZoom = useCallback((nextZoomValue: number, anchor?: { clientX: number; clientY: number }) => {
    const nextZoom = Math.max(EDITOR_ZOOM_MIN, nextZoomValue)
    const svgElement = svgRef.current
    if (!svgElement || !anchor) {
      setEditorZoom(nextZoom)
      return
    }

    const rect = svgElement.getBoundingClientRect()
    const currentZoom = Math.max(EDITOR_ZOOM_MIN, editorZoom)
    const currentView = getEditorViewportMetrics(currentZoom)
    const viewportScale = Math.min(rect.width / currentView.viewWidth, rect.height / currentView.viewHeight)
    if (!Number.isFinite(viewportScale) || viewportScale <= 0) {
      setEditorZoom(nextZoom)
      return
    }

    const renderedWidth = currentView.viewWidth * viewportScale
    const renderedHeight = currentView.viewHeight * viewportScale
    const offsetX = (rect.width - renderedWidth) / 2
    const offsetY = (rect.height - renderedHeight) / 2
    const focusX = clampNumber((anchor.clientX - rect.left - offsetX) / renderedWidth, 0, 1)
    const focusY = clampNumber((anchor.clientY - rect.top - offsetY) / renderedHeight, 0, 1)
    const focusSvgX = currentView.minX + focusX * currentView.viewWidth
    const focusSvgY = currentView.minY + focusY * currentView.viewHeight
    const nextViewWidth = canvasWidth / nextZoom
    const nextViewHeight = canvasHeight / nextZoom
    setEditorZoom(nextZoom)
    setEditorPan({
      x: canvasWidth / 2 - focusSvgX + (focusX - 0.5) * nextViewWidth,
      y: canvasHeight / 2 - focusSvgY + (focusY - 0.5) * nextViewHeight,
    })
  }, [canvasHeight, canvasWidth, editorZoom, getEditorViewportMetrics])

  useEffect(() => {
    const viewport = editorCanvasViewportRef.current
    if (!viewport || isMobileInput) {
      return undefined
    }

    const handleWheel = (event: WheelEvent) => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) {
        return
      }

      event.preventDefault()
      const currentZoom = Math.max(EDITOR_ZOOM_MIN, editorZoom)
      const currentView = getEditorViewportMetrics(currentZoom)
      const viewportScale = Math.min(rect.width / currentView.viewWidth, rect.height / currentView.viewHeight)
      if (!Number.isFinite(viewportScale) || viewportScale <= 0) {
        return
      }

      if (event.ctrlKey || event.metaKey) {
        const direction = event.deltaY < 0 ? 1 : -1
        setAnchoredEditorZoom(currentZoom + direction * EDITOR_WHEEL_ZOOM_STEP, {
          clientX: event.clientX,
          clientY: event.clientY,
        })
        return
      }

      const delta = getEditorWheelDeltaPixels(event)
      setEditorPan((current) => ({
        x: current.x - delta.x / viewportScale,
        y: current.y - delta.y / viewportScale,
      }))
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [editorZoom, getEditorViewportMetrics, getEditorWheelDeltaPixels, isMobileInput, setAnchoredEditorZoom])

  const toggleEditorInfoPanel = useCallback(() => {
    clearPointerInteractionState()
    setIsEditorInfoPanelOpen((current) => !current)
  }, [clearPointerInteractionState])
  const EditorHeader = renderHeader

  const actionToolbar = (
    <EditorActionToolbar
      isDark={isDark}
      controlBarClassName={themeTokens.controlBar}
      isScenarioReadOnly={isScenarioReadOnly}
      isScenarioEditMode={isScenarioEditMode}
      isExportingInp={isExportingInp}
      isExportingPng={isExportingPng}
      swmmEngineUrl={SWMM_ENGINE_URL}
      fileInputRef={fileInputRef}
      onExportJson={() => downloadLayout(layout)}
      onExportInp={handleExportSwmmInp}
      onExportPng={handleExportEditorPng}
      onImport={handleImport}
      onResetLayout={resetLayout}
      isSheet
    />
  )

  const scenarioToolbar = (
    <EditorScenarioToolbar
      isDark={isDark}
      buttonClassName={themeTokens.button}
      scenarios={scenarios}
      selectedScenario={selectedScenario}
      scenarioError={scenarioError}
      isScenarioEditMode={isScenarioEditMode}
      isLoadingScenarios={isLoadingScenarios}
      isSavingScenario={isSavingScenario}
      isDeletingScenario={isDeletingScenario}
      scenarioTitle={scenarioTitle}
      scenarioDescription={scenarioDescription}
      onScenarioTitleChange={setScenarioTitle}
      onScenarioDescriptionChange={setScenarioDescription}
      onSaveScenario={saveScenario}
      onDeleteScenario={deleteScenario}
      onResetScenarioChanges={resetScenarioChanges}
      onCancelScenarioEdit={cancelScenarioEdit}
      onScenarioSelect={handleScenarioSelect}
      onRefreshScenarios={refreshScenarios}
      onCreateNewScenario={createNewScenario}
      onBeginScenarioEdit={beginScenarioEdit}
      isScenarioSelectionLocked={demoControlLocked}
      isScenarioEditLocked={demoControlLocked}
      scenarioLockMessage={demoScenarioLockMessage}
    />
  )
  const editorSettingsSheet = isEditorSettingsOpen ? (
    <div
      className={`fixed z-[220] flex ${
        isMobileInput
          ? 'bottom-0 left-0 right-0 top-[var(--app-visual-offset-top,0px)] h-[var(--app-visual-height,100dvh)] items-end'
          : 'inset-0 items-stretch justify-end'
      }`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          setIsEditorSettingsOpen(false)
        }
      }}
    >
      <section
        ref={isMobileInput ? mobileEditorSettingsSheetRef : undefined}
        className={`${isMobileInput ? 'flex max-h-[calc(var(--app-visual-height,100dvh)-16px)] w-screen flex-col rounded-t-2xl border-t' : 'h-screen w-[460px] max-w-[92vw] border-l'} overflow-hidden shadow-2xl ${
          isDark ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={`flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div>
            <h2 id="editor-settings-title" className="text-base font-black">편집 세팅</h2>
            <p className={`mt-1 text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              시나리오와 JSON/INP 입출력을 관리합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsEditorSettingsOpen(false)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border ${
              isDark ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
            }`}
            aria-label="편집 세팅 닫기"
            title="닫기"
          >
            <CloseIcon />
          </button>
        </header>
        <div className={`${isMobileInput ? 'min-h-0 max-h-[calc(var(--app-visual-height,100dvh)-101px)] pb-4' : 'h-[calc(100vh-85px)]'} overflow-y-auto`}>
          {scenarioToolbar}
          {actionToolbar}
        </div>
        {isMobileInput ? <div className="h-[calc(env(safe-area-inset-bottom)+40px)] shrink-0" aria-hidden="true" /> : null}
      </section>
    </div>
  ) : null
  const layoutJsonText = useMemo(() => JSON.stringify(layout, null, 2), [layout])
  const editorInfoPanelContent = (
    <>
      {hasSelection ? (
        <>
          <p className={`mt-2 text-sm font-semibold leading-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            현재 편집 상태는 localStorage에 자동 저장됩니다. 내보낸 JSON은 다음 단계의 SWMM 모델/React 렌더링
            기준 데이터로 사용할 수 있습니다.
          </p>

          <div className={`mt-5 rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-300 bg-slate-200/70'}`}>
            <div className={`text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>포트 연결 상태</div>
            <div className={`mt-1 text-sm font-black ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
              {coordinateEditState
                ? `좌표 변경 중 (${coordinateEditAxis === 'x' ? 'x축' : coordinateEditAxis === 'y' ? 'y축' : '축 미확인'})`
                : pendingPort
                ? `${pendingPort.nodeId} / ${pendingPort.portId} 선택됨`
                : selection?.kind === 'multi'
                ? `${selectedNodeIds.size}개 객체 선택됨`
                : '첫 번째 포트를 선택하세요'}
            </div>
            {coordinateEditState ? (
              <div className="mt-2 text-xs font-semibold leading-5 text-blue-700">
                마우스를 움직여 붙는 위치를 조정하고, 원하는 위치에서 한 번 클릭하면 종료됩니다.
              </div>
            ) : null}
          </div>

          {selection?.kind === 'multi' ? (
            <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-slate-800">여러 객체 선택</h3>
                <button
                  type="button"
                  disabled={isScenarioReadOnly}
                  onClick={deleteSelection}
                  className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-black text-rose-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
              <p className="mt-2 text-sm font-bold leading-6 text-blue-700">
                {selectedNodeIds.size}개 객체가 선택되었습니다. 드래그하면 선택된 relation 그룹 전체가 함께 이동하고,
                Command/Ctrl + C, Command/Ctrl + V로 복사/붙여넣기할 수 있습니다.
              </p>
            </div>
          ) : (
            <SelectionPanel
              theme={theme}
              readOnly={isScenarioReadOnly}
              node={selectedNode}
              link={selectedLink}
              connectedLinks={selectedConnectedLinks}
              groundSurfaceY={layout.groundSurfaceY}
              onUpdateNode={updateNode}
              onUpdateLink={updateLink}
              onUpdateLinkProps={updateLinkProps}
              onDeleteSelection={deleteSelection}
            />
          )}
        </>
      ) : null}

      <div className="mt-5">
        <h3 className="text-sm font-black">모델 요약</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <SummaryCard theme={theme} label="nodes" value={layout.nodes.length} />
          <SummaryCard theme={theme} label="links" value={layout.links.length} />
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-black">drainage-layout.json</h3>
        <textarea
          readOnly
          value={layoutJsonText}
          className="mt-2 h-72 w-full resize-none rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100"
        />
      </div>
    </>
  )
  const editorInfoSheet = isMobileInput && isEditorInfoPanelOpen ? (
    <MobileBottomSheet
      theme={theme}
      title="편집 정보"
      titleId="editor-info-sheet-title"
      closeLabel="편집 정보 닫기"
      zIndexClassName="z-[234]"
      overlayClassName="pointer-events-none fixed left-0 right-0 top-[var(--app-visual-offset-top,0px)] flex h-[var(--app-visual-height,100dvh)] items-end"
      backdropClassName="bg-transparent"
      sectionRef={mobileEditorInfoSheetRef}
      sheetClassName={`pointer-events-auto flex max-h-[50dvh] w-screen flex-col overflow-hidden rounded-t-2xl border-t shadow-2xl ${
        isDark ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
      }`}
      bodyClassName="min-h-0 overflow-y-auto px-5 pb-4 pt-4"
      ariaModal={false}
      lockBodyScroll={false}
      onClose={() => setIsEditorInfoPanelOpen(false)}
    >
      {editorInfoPanelContent}
    </MobileBottomSheet>
  ) : null
  const relationPreviewNode = relationPreviewNodeId ? renderNodesById.get(relationPreviewNodeId) ?? null : null
  const relationPreviewPadding = relationPreviewNode
    ? Math.max(48, Math.max(relationPreviewNode.width, relationPreviewNode.height) * 0.32)
    : 0
  const relationPreviewBaseWidth = relationPreviewNode
    ? relationPreviewNode.width + relationPreviewPadding * 2
    : 0
  const relationPreviewBaseHeight = relationPreviewNode
    ? relationPreviewNode.height + relationPreviewPadding * 2
    : 0
  const relationPreviewSafeZoom = clampNumber(
    relationPreviewZoom,
    RELATION_PREVIEW_ZOOM_MIN,
    Number.MAX_SAFE_INTEGER,
  )
  const getRelationPreviewTouchDistance = (touches: ReactTouchEvent<HTMLDivElement>['touches']) => {
    const firstTouch = touches.item(0)
    const secondTouch = touches.item(1)

    if (!firstTouch || !secondTouch) {
      return 0
    }

    return Math.hypot(
      firstTouch.clientX - secondTouch.clientX,
      firstTouch.clientY - secondTouch.clientY,
    )
  }
  const getRelationPreviewTouchFocalPoint = (
    touches: ReactTouchEvent<HTMLDivElement>['touches'],
    container: HTMLDivElement,
  ) => {
    const firstTouch = touches.item(0)
    const secondTouch = touches.item(1)

    if (!firstTouch || !secondTouch) {
      return null
    }

    const rect = container.getBoundingClientRect()

    return {
      x: (firstTouch.clientX + secondTouch.clientX) / 2 - rect.left,
      y: (firstTouch.clientY + secondTouch.clientY) / 2 - rect.top,
    }
  }
  const handleRelationPreviewTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) {
      return
    }

    const distance = getRelationPreviewTouchDistance(event.touches)
    const focalPoint = getRelationPreviewTouchFocalPoint(event.touches, event.currentTarget)

    if (distance <= 0 || !focalPoint) {
      return
    }

    event.preventDefault()
    relationPreviewPinchRef.current = {
      startDistance: distance,
      startZoom: relationPreviewSafeZoom,
      anchorContentX: (event.currentTarget.scrollLeft + focalPoint.x) / relationPreviewSafeZoom,
      anchorContentY: (event.currentTarget.scrollTop + focalPoint.y) / relationPreviewSafeZoom,
    }
  }
  const handleRelationPreviewTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const pinchState = relationPreviewPinchRef.current

    if (!pinchState || event.touches.length < 2) {
      return
    }

    const distance = getRelationPreviewTouchDistance(event.touches)
    const focalPoint = getRelationPreviewTouchFocalPoint(event.touches, event.currentTarget)

    if (distance <= 0 || !focalPoint) {
      return
    }

    event.preventDefault()
    const nextZoom = Math.max(
      RELATION_PREVIEW_ZOOM_MIN,
      pinchState.startZoom * (distance / pinchState.startDistance),
    )
    const container = event.currentTarget

    setRelationPreviewZoom(nextZoom)

    if (relationPreviewPinchFrameRef.current !== null) {
      window.cancelAnimationFrame(relationPreviewPinchFrameRef.current)
    }

    relationPreviewPinchFrameRef.current = window.requestAnimationFrame(() => {
      container.scrollLeft = Math.max(0, pinchState.anchorContentX * nextZoom - focalPoint.x)
      container.scrollTop = Math.max(0, pinchState.anchorContentY * nextZoom - focalPoint.y)
      relationPreviewPinchFrameRef.current = null
    })
  }
  const handleRelationPreviewTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) {
      relationPreviewPinchRef.current = null
    }
  }
  const relationPreviewViewBox = relationPreviewNode
    ? [
        relationPreviewNode.x - relationPreviewPadding,
        relationPreviewNode.y - relationPreviewPadding,
        relationPreviewBaseWidth,
        relationPreviewBaseHeight,
      ].join(' ')
    : ''
  const relationPreviewZoomRatioText = `${Number(relationPreviewSafeZoom.toFixed(2))}x`
  const relationPreviewSheet = relationPreviewNode ? (
    <MobileBottomSheet
      theme={theme}
      title="관계형성"
      description={relationPreviewMode === 'child'
        ? '자식 객체에서 연결할 포트를 선택하세요.'
        : '부모 객체에서 관계를 시작할 포트를 선택하세요.'}
      titleId="relation-preview-sheet-title"
      closeLabel="관계형성 미리보기 닫기"
      zIndexClassName="z-[235]"
      overlayClassName="pointer-events-none fixed left-0 right-0 top-[var(--app-visual-offset-top,0px)] flex h-[var(--app-visual-height,100dvh)] items-end"
      backdropClassName="bg-transparent"
      sectionRef={mobileRelationPreviewSheetRef}
      sheetClassName={`pointer-events-auto flex max-h-[calc(var(--app-visual-height,100dvh)-16px)] w-screen flex-col overflow-hidden rounded-t-2xl border-t shadow-2xl ${
        isDark ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
      }`}
      ariaModal={false}
      lockBodyScroll={false}
      onClose={() => {
        setRelationPreviewNodeId(null)
        setRelationPreviewMode('parent')
      }}
    >
      <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50'}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className={`min-w-0 truncate text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {relationPreviewNode.name || relationPreviewNode.swmmId}
              </div>
              <div className={`inline-flex shrink-0 overflow-hidden rounded-lg border text-sm font-black ${
                isDark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
              }`}>
                <button
                  type="button"
                  disabled={relationPreviewSafeZoom <= RELATION_PREVIEW_ZOOM_MIN}
                  onClick={() => setRelationPreviewZoom((current) => Math.max(
                    RELATION_PREVIEW_ZOOM_MIN,
                    current - RELATION_PREVIEW_ZOOM_STEP,
                  ))}
                  className={`flex h-9 w-10 items-center justify-center border-r font-black ${
                    isDark ? 'border-slate-800 hover:bg-slate-900' : 'border-slate-200 hover:bg-slate-50'
                  } disabled:cursor-not-allowed disabled:text-slate-500 disabled:opacity-60`}
                  aria-label="관계형성 미리보기 축소"
                  title="축소"
                >
                  -
                </button>
                <button
                  type="button"
                  disabled={Math.abs(relationPreviewSafeZoom - RELATION_PREVIEW_ZOOM_DEFAULT) < 0.001}
                  onClick={() => setRelationPreviewZoom(RELATION_PREVIEW_ZOOM_DEFAULT)}
                  className={`flex h-9 w-16 items-center justify-center border-r px-2 text-xs ${
                    isDark ? 'border-slate-800 hover:bg-slate-900' : 'border-slate-200 hover:bg-slate-50'
                  } disabled:cursor-not-allowed disabled:text-slate-500 disabled:opacity-60`}
                  aria-label="관계형성 미리보기 확대 초기화"
                  title="확대 초기화"
                >
                  {relationPreviewZoomRatioText}
                </button>
                <button
                  type="button"
                  onClick={() => setRelationPreviewZoom((current) => current + RELATION_PREVIEW_ZOOM_STEP)}
                  className={`flex h-9 w-10 items-center justify-center font-black ${
                    isDark ? 'hover:bg-slate-900' : 'hover:bg-slate-50'
                  }`}
                  aria-label="관계형성 미리보기 확대"
                  title="확대"
                >
                  +
                </button>
              </div>
            </div>
            <div
              className={`min-h-[18rem] max-h-[min(48dvh,30rem)] overflow-auto rounded-lg border ${
                isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'
              }`}
              onTouchStart={handleRelationPreviewTouchStart}
              onTouchMove={handleRelationPreviewTouchMove}
              onTouchEnd={handleRelationPreviewTouchEnd}
              onTouchCancel={handleRelationPreviewTouchEnd}
              style={{ touchAction: 'pan-x pan-y' }}
            >
              <svg
                viewBox={relationPreviewViewBox}
                preserveAspectRatio="xMidYMid meet"
                className="block"
                style={{
                  width: `${relationPreviewSafeZoom * 100}%`,
                  height: `${relationPreviewSafeZoom * 18}rem`,
                  minWidth: '100%',
                  minHeight: '18rem',
                }}
                onContextMenu={(event) => event.preventDefault()}
              >
                <EditableNode
                  node={relationPreviewNode}
                  selected
                  renderedPortRelationLookup={
                    renderedPortRelationLookupByNodeId.get(relationPreviewNode.id) ?? new Map()
                  }
                  connectedPortKeys={connectedPortKeys}
                  selectedRelationPortRoles={selectedRelationPortRoles}
                  selectedParentPortKeys={selectedParentPortKeys}
                  pendingPort={pendingPort}
                  attachTargetNodeId={relationPreviewNode.id}
                  coordinateEditActive={false}
                  getRenderablePorts={(node, candidatePendingPort, _includeAttachCandidatePorts, candidateConnectedPortKeys, candidateSelectedRelationPortRoles) =>
                    getNodeRenderablePorts(
                      node,
                      candidatePendingPort,
                      true,
                      candidateConnectedPortKeys,
                      candidateSelectedRelationPortRoles,
                    )
                  }
                  getRenderedPortPoint={getRenderedPortPointFromLookup}
                  hasManualResizableEdge={() => false}
                  renderResizeHandles={() => null}
                  onPointerDown={(node, event) => {
                    event.stopPropagation()
                    setSelection({ kind: 'node', id: node.id })
                  }}
                  onPointerEnter={() => undefined}
                  onNodeContextMenu={(_node, event) => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                  onPortClick={(nodeId, portId, event) => {
                    handlePortClick(nodeId, portId, event)
                    setRelationPreviewNodeId(null)
                  }}
                  onPortContextMenu={(_nodeId, _portId, event) => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                  onResizePointerDown={(_node, _edge, event) => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                />
              </svg>
            </div>
      </div>
    </MobileBottomSheet>
  ) : null
  const mobileActiveEditorNode = mobileActiveNodeId ? nodesById.get(mobileActiveNodeId) ?? null : null
  const mobileResizeCapability = mobileActiveEditorNode ? getMobileResizeCapability(mobileActiveEditorNode) : null
  const mobileMoveCapability = mobileActiveEditorNode ? getMobileMoveCapability(layout, mobileActiveEditorNode) : null
  const mobileResizeButtonClassName = isDark
    ? 'border-blue-400/40 bg-blue-500/15 text-blue-100 active:bg-blue-500/25'
    : 'border-blue-200 bg-blue-50 text-blue-700 active:bg-blue-100'
  const mobileDisabledButtonClassName = isDark
    ? 'cursor-not-allowed border-slate-800 bg-slate-900/70 text-slate-600'
    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
  const mobileMoveButtonClassName = isDark
    ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100 active:bg-emerald-500/25'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700 active:bg-emerald-100'
  const mobileDpadButtonClassName = 'flex h-10 w-10 items-center justify-center rounded-lg border text-lg font-black leading-none shadow-sm'
  const mobileDpadLabelClassName = 'flex h-10 w-10 items-center justify-center rounded-lg border text-[10px] font-black'
  const mobileResizeModeLabel = mobileActiveEditorNode?.type === 'pipeSegment' ? '길이' : '크기'
  const mobileEditorModeHud = isMobileInput && mobileEditorMode !== 'idle' && mobileActiveNodeId ? (
    <MobileBottomSheet
      theme={theme}
      title={mobileEditorMode === 'move' ? '객체 이동' : `${mobileResizeModeLabel} 조절`}
      description={mobileEditorMode === 'move'
        ? mobileMoveCapability?.canMoveY
          ? '버튼으로 선택 객체를 상하좌우로 이동합니다.'
          : '고정 객체와 연결되어 좌우 이동만 가능합니다.'
        : mobileResizeCapability?.preferredEdge
          ? `${mobileResizeModeLabel}를 지원하는 방향만 조절할 수 있습니다.`
          : `이 객체는 현재 ${mobileResizeModeLabel} 조절을 지원하지 않습니다.`}
      closeLabel={mobileEditorMode === 'move' ? '객체 이동 완료' : `${mobileResizeModeLabel} 조절 완료`}
      zIndexClassName="z-[240]"
      overlayClassName="pointer-events-none fixed left-0 right-0 top-[var(--app-visual-offset-top,0px)] flex h-[var(--app-visual-height,100dvh)] items-end"
      backdropClassName="bg-transparent"
      sheetClassName={`pointer-events-auto flex max-h-[50dvh] w-screen flex-col overflow-hidden rounded-t-2xl border-t shadow-2xl backdrop-blur ${
        isDark
          ? 'border-slate-800 bg-slate-950/96 text-slate-100'
          : 'border-slate-200 bg-white/96 text-slate-900'
      }`}
      headerClassName={`flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 ${
        isDark ? 'border-slate-800' : 'border-slate-200'
      }`}
      bodyClassName="min-h-0 overflow-y-auto px-4 pb-0 pt-3"
      closeButtonClassName={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-black ${
        isDark
          ? 'border-slate-700 bg-slate-900 text-slate-100'
          : 'border-slate-200 bg-slate-50 text-slate-700'
      }`}
      closeButtonContent="완료"
      ariaModal={false}
      lockBodyScroll={false}
      onClose={() => {
        mobileMoveArmedNodeIdRef.current = null
        setMobileMoveArmedNodeId(null)
        setMobileEditorMode('idle')
        setMobileActiveNodeId(null)
      }}
    >
        {mobileEditorMode === 'move' ? (
          <>
            <div
              className={`mx-auto mt-3 grid w-max grid-cols-[40px_40px_40px] gap-1.5 ${
                mobileMoveCapability?.canMoveY ? 'grid-rows-[40px_40px_40px]' : 'grid-rows-[40px]'
              }`}
            >
              {mobileMoveCapability?.canMoveY ? (
                <button
                  type="button"
                  onClick={() => applyMobileMoveStep(mobileActiveNodeId, 'up')}
                  className={`col-start-2 row-start-1 ${mobileDpadButtonClassName} ${mobileMoveButtonClassName}`}
                  aria-label="위로 이동"
                >
                  ↑
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => applyMobileMoveStep(mobileActiveNodeId, 'left')}
                className={`col-start-1 ${mobileMoveCapability?.canMoveY ? 'row-start-2' : 'row-start-1'} ${mobileDpadButtonClassName} ${mobileMoveButtonClassName}`}
                aria-label="왼쪽으로 이동"
              >
                ←
              </button>
              <button
                type="button"
                disabled
                className={`col-start-2 ${mobileMoveCapability?.canMoveY ? 'row-start-2' : 'row-start-1'} ${mobileDpadLabelClassName} ${mobileDisabledButtonClassName}`}
              >
                이동
              </button>
              <button
                type="button"
                onClick={() => applyMobileMoveStep(mobileActiveNodeId, 'right')}
                className={`col-start-3 ${mobileMoveCapability?.canMoveY ? 'row-start-2' : 'row-start-1'} ${mobileDpadButtonClassName} ${mobileMoveButtonClassName}`}
                aria-label="오른쪽으로 이동"
              >
                →
              </button>
              {mobileMoveCapability?.canMoveY ? (
                <button
                  type="button"
                  onClick={() => applyMobileMoveStep(mobileActiveNodeId, 'down')}
                  className={`col-start-2 row-start-3 ${mobileDpadButtonClassName} ${mobileMoveButtonClassName}`}
                  aria-label="아래로 이동"
                >
                  ↓
                </button>
              ) : null}
            </div>
            {isMobileRotatableNode(mobileActiveEditorNode) ? (
              <div className={`mt-3 border-t pt-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className={`mb-2 text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>회전</div>
                <button
                  type="button"
                  onClick={() => rotateNodeClockwise(mobileActiveNodeId)}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-black ${
                    isDark
                      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100 active:bg-emerald-500/25'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 active:bg-emerald-100'
                  }`}
                  aria-label={`${mobileActiveEditorNode ? NODE_LABELS[mobileActiveEditorNode.type] : '객체'} 오른쪽 90도 회전`}
                >
                  <span aria-hidden="true">↻</span>
                  <span>90도 회전</span>
                </button>
              </div>
            ) : null}
            <div className={`mt-3 border-t pt-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className={`mb-2 text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>객체 순서</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => changeNodeZOrder(mobileActiveNodeId, 'bringForward')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-black ${
                    isDark
                      ? 'border-slate-700 bg-slate-900 text-slate-100 active:bg-slate-800'
                      : 'border-slate-200 bg-slate-50 text-slate-800 active:bg-white'
                  }`}
                >
                  <span aria-hidden="true">↑</span>
                  <span>위</span>
                </button>
                <button
                  type="button"
                  onClick={() => changeNodeZOrder(mobileActiveNodeId, 'sendBackward')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-black ${
                    isDark
                      ? 'border-slate-700 bg-slate-900 text-slate-100 active:bg-slate-800'
                      : 'border-slate-200 bg-slate-50 text-slate-800 active:bg-white'
                  }`}
                >
                  <span aria-hidden="true">↓</span>
                  <span>아래</span>
                </button>
              </div>
            </div>
          </>
        ) : null}

        {mobileEditorMode === 'resize' ? (
          <div className="mx-auto mt-3 grid w-max grid-cols-[40px_40px_40px] grid-rows-[40px_40px_40px] gap-1.5">
            <button
              type="button"
              disabled={!mobileResizeCapability?.verticalEdge}
              onClick={() => mobileResizeCapability?.verticalEdge
                ? applyMobileResizeStep(mobileActiveNodeId, mobileResizeCapability.verticalEdge, 'shrink')
                : undefined}
              className={`col-start-2 row-start-1 ${mobileDpadButtonClassName} ${
                mobileResizeCapability?.verticalEdge ? mobileResizeButtonClassName : mobileDisabledButtonClassName
              }`}
              aria-label="세로 줄임"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={!mobileResizeCapability?.horizontalEdge}
              onClick={() => mobileResizeCapability?.horizontalEdge
                ? applyMobileResizeStep(mobileActiveNodeId, mobileResizeCapability.horizontalEdge, 'shrink')
                : undefined}
              className={`col-start-1 row-start-2 ${mobileDpadButtonClassName} ${
                mobileResizeCapability?.horizontalEdge ? mobileResizeButtonClassName : mobileDisabledButtonClassName
              }`}
              aria-label="가로 줄임"
            >
              ←
            </button>
            <button
              type="button"
              disabled
              className={`col-start-2 row-start-2 ${mobileDpadLabelClassName} ${mobileDisabledButtonClassName}`}
            >
              {mobileResizeModeLabel}
            </button>
            <button
              type="button"
              disabled={!mobileResizeCapability?.horizontalEdge}
              onClick={() => mobileResizeCapability?.horizontalEdge
                ? applyMobileResizeStep(mobileActiveNodeId, mobileResizeCapability.horizontalEdge, 'grow')
                : undefined}
              className={`col-start-3 row-start-2 ${mobileDpadButtonClassName} ${
                mobileResizeCapability?.horizontalEdge ? mobileResizeButtonClassName : mobileDisabledButtonClassName
              }`}
              aria-label="가로 늘림"
            >
              →
            </button>
            <button
              type="button"
              disabled={!mobileResizeCapability?.verticalEdge}
              onClick={() => mobileResizeCapability?.verticalEdge
                ? applyMobileResizeStep(mobileActiveNodeId, mobileResizeCapability.verticalEdge, 'grow')
                : undefined}
              className={`col-start-2 row-start-3 ${mobileDpadButtonClassName} ${
                mobileResizeCapability?.verticalEdge ? mobileResizeButtonClassName : mobileDisabledButtonClassName
              }`}
              aria-label="세로 늘림"
            >
              ↓
            </button>
          </div>
        ) : null}
    </MobileBottomSheet>
  ) : null
  const editorZoomRatio = editorZoom / EDITOR_ZOOM_DEFAULT
  const editorZoomPercentLabel = formatZoomPercentLabel(editorZoom, EDITOR_ZOOM_DEFAULT)
  const mobileCanvasScale = isMobileInput ? Math.max(EDITOR_ZOOM_MIN, editorZoomRatio) : 1
  const mobileCanvasHasHorizontalGutter = isMobileAddMenuPreviewOpen
  const renderedEditorViewBox = isMobileInput ? mobileScrollViewBox : editorViewBox
  const mobileEditorLocksScroll = false
  const mobileEditorTouchSurfaceStyle: CSSProperties | undefined = isMobileInput && !mobileEditorLocksScroll
    ? { overscrollBehavior: 'contain', touchAction: 'pan-x pan-y' }
    : undefined
  const editorCanvasViewportClassName = `${isMobileInput && !mobileEditorLocksScroll
    ? renderHeader
      ? 'fixed left-0 right-0 top-[calc(var(--app-visual-offset-top,0px)+90px)] z-[80] h-[calc(var(--app-visual-height,100dvh)-90px)] overflow-auto overscroll-contain'
      : 'fixed left-0 right-0 top-[var(--app-visual-offset-top,0px)] z-[80] h-[var(--app-visual-height,100dvh)] overflow-auto overscroll-contain'
    : 'relative flex-1 overflow-hidden'
  } min-h-0 min-w-0 ${isDark ? 'bg-slate-900' : 'bg-sky-50'}`
  const editorSystemSurfaceClassName = isDark
    ? 'border-white bg-white text-slate-950'
    : 'border-slate-950 bg-slate-950 text-white'
  const editorSystemDividerClassName = isDark ? 'border-slate-200' : 'border-white/15'
  const editorUndoRedoButtonClassName = isDark
    ? 'hover:bg-slate-100 disabled:text-slate-400 disabled:opacity-45'
    : 'hover:bg-slate-900 disabled:text-slate-500 disabled:opacity-35'
  const editorUndoRedoControls = (
    <div className={`fixed left-4 top-24 z-[130] inline-flex h-12 overflow-hidden rounded-md border shadow-xl backdrop-blur lg:top-28 ${editorSystemSurfaceClassName}`}>
      <button
        type="button"
        onClick={undoEditorLayout}
        disabled={!canUndo || isScenarioReadOnly}
        aria-label="되돌리기"
        title="되돌리기"
        className={`flex h-12 w-12 items-center justify-center border-r transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 disabled:cursor-not-allowed ${editorSystemDividerClassName} ${editorUndoRedoButtonClassName}`}
      >
        <UndoIcon className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={redoEditorLayout}
        disabled={!canRedo || isScenarioReadOnly}
        aria-label="다시 실행"
        title="다시 실행"
        className={`flex h-12 w-12 items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 disabled:cursor-not-allowed ${editorUndoRedoButtonClassName}`}
      >
        <RedoIcon className="h-5 w-5" />
      </button>
    </div>
  )
  const editorZoomControls = (
    <MobileZoomControls
      ref={editorZoomControlsRef}
      className="fixed right-4 top-24 z-[130] lg:top-28"
      isDark={isDark}
      percentLabel={editorZoomPercentLabel}
      canZoomOut={editorZoomRatio > EDITOR_ZOOM_MIN + 0.001}
      canReset={Math.abs(editorZoomRatio - 1) > 0.001}
      zoomOutLabel="편집 캔버스 축소"
      resetLabel="편집 캔버스 확대 초기화"
      zoomInLabel="편집 캔버스 확대"
      onZoomOut={() => setEditorZoom((current) => Math.max(EDITOR_ZOOM_MIN, current - EDITOR_ZOOM_STEP))}
      onReset={() => {
        setEditorZoom(EDITOR_ZOOM_DEFAULT)
        setEditorPan({ x: 0, y: 0 })
      }}
      onZoomIn={() => setEditorZoom((current) => current + EDITOR_ZOOM_STEP)}
    />
  )
  const floatingSystemButtonClassName = isDark
    ? 'border-white bg-white text-slate-950 hover:bg-slate-100 focus-visible:ring-white'
    : 'border-slate-950 bg-slate-950 text-white hover:bg-slate-900 focus-visible:ring-slate-500'
  const desktopEditorSettingsFab = !isMobileInput && !isEditorSettingsOpen ? (
    <button
      type="button"
      onClick={() => setIsEditorSettingsOpen(true)}
      aria-label="편집 세팅"
      title="편집 세팅"
      className={`fixed bottom-5 right-8 z-[140] flex h-12 w-12 items-center justify-center rounded-full border shadow-xl backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${floatingSystemButtonClassName}`}
    >
      <GearIcon />
    </button>
  ) : null
  const desktopEditorInfoDrawer = !isMobileInput ? (
    <div
      className={`fixed inset-0 z-[220] flex items-stretch justify-start bg-slate-950/45 transition-[opacity] duration-200 ${
        isEditorInfoPanelOpen
          ? 'opacity-100'
          : 'pointer-events-none opacity-0'
      }`}
    >
      <div
        className={`transition-transform duration-200 ${
          isEditorInfoPanelOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <InfoPanelFrame
          theme={theme}
          title="편집 정보"
          variant="drawer"
          controls={{
            isInfoPanelOpen: isEditorInfoPanelOpen,
            toggleInfoPanel: toggleEditorInfoPanel,
          }}
        >
          {editorInfoPanelContent}
        </InfoPanelFrame>
      </div>
    </div>
  ) : null
  const addMenuPreviewPoint = isMobileAddMenuPreviewOpen
  const mobileAddMenuPreviewStyle = {
    left: '50%',
    top: `calc(var(--app-visual-offset-top, 0px) + var(--app-visual-height, 100dvh) / 2 - ${MOBILE_ADD_PREVIEW_OFFSET_Y_PX}px)`,
  }
  const getCurrentMobileAddMenuPoint = useCallback((fallbackPoint: Point) => {
    if (!isMobileInput || !addMenuPreviewPoint) {
      return fallbackPoint
    }

    const svg = svgRef.current
    if (!svg) {
      return fallbackPoint
    }

    const rootStyles = getComputedStyle(document.documentElement)
    const visualHeight = Number.parseFloat(rootStyles.getPropertyValue('--app-visual-height')) || window.visualViewport?.height || window.innerHeight
    const visualOffsetTop = Number.parseFloat(rootStyles.getPropertyValue('--app-visual-offset-top')) || 0
    const clientX = window.innerWidth / 2
    const clientY = visualOffsetTop + visualHeight / 2
    return getSvgCursor(svg, clientX, clientY)
  }, [addMenuPreviewPoint, isMobileInput])
  const activeMobileModalSheetHeight = isMobileInput && isEditorSettingsOpen
    ? mobileModalSheetHeight
    : 0
  const activeMobileEditorModeHudHeight = 0
  const mobileBottomSpacerHeight = isMobileInput
    ? Math.max(mobileContextSheetHeight, activeMobileModalSheetHeight, activeMobileEditorModeHudHeight)
    : 0
  const mobileActionSheetAllowsCanvasGesture = Boolean(
    isMobileInput &&
    (
      mobileQuickEditPanel ||
      mobileEditorMode !== 'idle' ||
      isEditorInfoPanelOpen ||
      relationPreviewNodeId
    ),
  )
  const mobileCanvasGestureGuard = mobileActionSheetAllowsCanvasGesture ? (
    <rect
      x="0"
      y="0"
      width={canvasWidth}
      height={canvasHeight}
      fill="transparent"
      pointerEvents="all"
      style={{ touchAction: 'pan-x pan-y' }}
    />
  ) : null
  const mobileQuickEditNode = (
    isMobileInput &&
    !contextMenu &&
    mobileEditorMode === 'idle' &&
    mobileQuickEditNodeId
  )
    ? nodesById.get(mobileQuickEditNodeId) ?? null
    : null
  const shouldShowMobileQuickEditSheet = Boolean(
    ENABLE_MOBILE_QUICK_EDIT_SHEET &&
    mobileQuickEditNode &&
    selectedNodeIds.has(mobileQuickEditNode.id) &&
    isMobileQuickEditableNode(mobileQuickEditNode),
  )
  const shouldShowMobileQuickEditCapsule = Boolean(
    mobileQuickEditNode &&
    selectedNodeIds.has(mobileQuickEditNode.id) &&
    isMobileQuickEditableNode(mobileQuickEditNode) &&
    !isEditorInfoPanelOpen &&
    !isEditorSettingsOpen &&
    !mobileQuickEditPanel &&
    !relationPreviewNodeId,
  )
  const renderResizeHandles = useCallback((
    node: EditorNode,
    onResizePointerDown: (node: EditorNode, edge: ResizeEdge, event: ReactPointerEvent<SVGRectElement>) => void,
  ) => {
    if (isMobileInput) {
      return null
    }

    return (
      <g className={isMobileInput ? '[&>rect]:opacity-100' : undefined}>
        <PipeResizeHandles node={node} onResizePointerDown={onResizePointerDown} />
      </g>
    )
  }, [isMobileInput])
  const changeMobileQuickEditNodeType = (node: EditorNode, nextType: EditorNodeType) => {
    const updates = resizeNodeForType(node, nextType)
    updateNode(node.id, {
      ...updates,
      props: {
        ...node.props,
        ...updates.props,
      },
    })
  }
  const startMobileQuickEditRelation = (node: EditorNode) => {
    if (blockReadOnlyScenarioAction() || !canNodeStartRelation(node)) {
      return
    }

    setSelection({ kind: 'node', id: node.id })
    setIsEditorInfoPanelOpen(false)
    mobileMoveArmedNodeIdRef.current = null
    setMobileMoveArmedNodeId(null)
    setMobileEditorMode('idle')
    setMobileActiveNodeId(node.id)
    setMobileQuickEditPanel(null)
    setMobileQuickEditNodeId(null)
    setMobileQuickEditAnchorPoint(null)
    if (pendingPort && pendingPort.nodeId !== node.id) {
      setAttachTargetNodeId(node.id)
      setRelationPreviewMode('child')
    } else {
      setPendingPort(null)
      setAttachTargetNodeId(null)
      setRelationPreviewMode('parent')
    }
    setCoordinateEditState(null)
    setDragState(null)
    setDragDraftPositionsByNodeId(null)
    setResizeState(null)
    setResizeDraftNodesById(null)
    setMarqueeSelectionState(null)
    setRelationPreviewZoom(RELATION_PREVIEW_ZOOM_DEFAULT)
    setRelationPreviewNodeId(node.id)
  }
  const startMobileQuickEditMove = (node: EditorNode) => {
    if (node.type === 'terrain') {
      return
    }

    setRelationPreviewNodeId(null)
    setSelection({ kind: 'node', id: node.id })
    mobileMoveArmedNodeIdRef.current = node.id
    setMobileMoveArmedNodeId(node.id)
    setMobileEditorMode('move')
    setMobileActiveNodeId(node.id)
    setMobileQuickEditNodeId(null)
    setMobileQuickEditPanel(null)
    setMobileQuickEditAnchorPoint(null)
  }
  const startMobileQuickEditResize = (node: EditorNode) => {
    setRelationPreviewNodeId(null)
    setSelection({ kind: 'node', id: node.id })
    mobileMoveArmedNodeIdRef.current = null
    setMobileMoveArmedNodeId(null)
    setMobileEditorMode('resize')
    setMobileActiveNodeId(node.id)
    setMobileQuickEditNodeId(null)
    setMobileQuickEditPanel(null)
    setMobileQuickEditAnchorPoint(null)
  }
  const openMobileQuickEditInfo = (node: EditorNode) => {
    setSelection({ kind: 'node', id: node.id })
    setIsEditorInfoPanelOpen(true)
    setMobileQuickEditNodeId(null)
    setMobileQuickEditPanel(null)
    setMobileQuickEditAnchorPoint(null)
  }
  const deleteMobileQuickEditNode = (node: EditorNode) => {
    if (blockReadOnlyScenarioAction()) {
      return
    }

    setLayout((currentLayout) => ({
      ...currentLayout,
      nodes: currentLayout.nodes.filter((candidate) => candidate.id !== node.id),
      links: currentLayout.links.filter((link) => link.from.nodeId !== node.id && link.to.nodeId !== node.id),
    }))
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setMarqueeSelectionState(null)
    setSelection(null)
    setMobileQuickEditNodeId(null)
    setMobileQuickEditPanel(null)
    setMobileQuickEditAnchorPoint(null)
  }
  const handleMobileQuickEditActionClick = (actionKey: MobileQuickEditActionKey) => {
    if (!mobileQuickEditNode) {
      return
    }

    if (actionKey === 'type') {
      setMobileQuickEditPanel((current) => current === 'type' ? null : 'type')
      return
    }

    if (actionKey === 'detail') {
      setMobileQuickEditPanel((current) => current === 'detail' ? null : 'detail')
      return
    }

    if (actionKey === 'size') {
      if (mobileQuickEditCanUseSizePreset) {
        setMobileQuickEditPanel((current) => current === 'size' ? null : 'size')
        return
      }

      startMobileQuickEditResize(mobileQuickEditNode)
      return
    }

    if (actionKey === 'length') {
      startMobileQuickEditResize(mobileQuickEditNode)
      return
    }

    if (actionKey === 'relation') {
      startMobileQuickEditRelation(mobileQuickEditNode)
      return
    }

    if (actionKey === 'move') {
      startMobileQuickEditMove(mobileQuickEditNode)
      return
    }

    if (actionKey === 'info') {
      openMobileQuickEditInfo(mobileQuickEditNode)
      return
    }

    deleteMobileQuickEditNode(mobileQuickEditNode)
  }
  const mobileQuickEditRenderNode = mobileQuickEditNode
    ? renderNodesById.get(mobileQuickEditNode.id) ?? mobileQuickEditNode
    : null
  const mobileQuickEditCapsulePosition = (() => {
    if (!isMobileInput || !mobileQuickEditRenderNode) {
      return undefined
    }

    const viewportPadding = 24
    const capsuleWidth = Math.min(
      MOBILE_QUICK_EDIT_CAPSULE_WIDTH,
      Math.max(360, canvasWidth - viewportPadding * 2),
    )
    const capsuleHeight = MOBILE_QUICK_EDIT_CAPSULE_HEIGHT
    const fallbackAnchorX = mobileQuickEditRenderNode.x + mobileQuickEditRenderNode.width / 2
    const fallbackAnchorY = mobileQuickEditRenderNode.y + mobileQuickEditRenderNode.height / 2
    const anchorX = clampNumber(
      mobileQuickEditAnchorPoint?.x ?? fallbackAnchorX,
      mobileQuickEditRenderNode.x,
      mobileQuickEditRenderNode.x + mobileQuickEditRenderNode.width,
    )
    const anchorY = clampNumber(
      mobileQuickEditAnchorPoint?.y ?? fallbackAnchorY,
      mobileQuickEditRenderNode.y,
      mobileQuickEditRenderNode.y + mobileQuickEditRenderNode.height,
    )
    const aboveY = anchorY - MOBILE_QUICK_EDIT_CAPSULE_GAP - capsuleHeight
    const belowY = anchorY + MOBILE_QUICK_EDIT_CAPSULE_GAP
    const availableAbove = anchorY - viewportPadding
    const availableBelow = canvasHeight - viewportPadding - anchorY
    const placement = aboveY < viewportPadding && availableBelow > availableAbove ? 'below' : 'above'
    const left = clampNumber(
      anchorX - capsuleWidth / 2,
      viewportPadding,
      Math.max(viewportPadding, canvasWidth - capsuleWidth - viewportPadding),
    )
    const y = placement === 'below'
      ? clampNumber(
          belowY,
          viewportPadding,
          Math.max(viewportPadding, canvasHeight - capsuleHeight - viewportPadding),
        )
      : clampNumber(
          aboveY,
          viewportPadding,
          Math.max(viewportPadding, canvasHeight - capsuleHeight - viewportPadding),
        )

    return {
      placement,
      x: left,
      y,
      width: capsuleWidth,
      height: capsuleHeight,
    }
  })()
  const mobileQuickEditCanUseSizePreset = Boolean(
    mobileQuickEditNode &&
    (mobileQuickEditNode.type === 'pipeSegment' || CONNECTOR_TYPE_OPTIONS.includes(mobileQuickEditNode.type)),
  )
  const mobileQuickEditResizeCapability = mobileQuickEditNode ? getMobileResizeCapability(mobileQuickEditNode) : null
  const mobileQuickEditCanChangeType = Boolean(
    mobileQuickEditNode &&
    (
      mobileQuickEditNode.type === 'terrain' ||
      FACILITY_TYPE_OPTIONS.includes(mobileQuickEditNode.type) ||
      CONNECTOR_TYPE_OPTIONS.includes(mobileQuickEditNode.type)
    ),
  )
  const mobileQuickEditCanLengthResize = Boolean(
    mobileQuickEditResizeCapability?.canResizeX ||
    mobileQuickEditResizeCapability?.canResizeY,
  )
  const mobileQuickEditCanResize = Boolean(
    mobileQuickEditCanUseSizePreset ||
    mobileQuickEditCanLengthResize,
  )
  const mobileQuickEditCanStartRelation = Boolean(
    mobileQuickEditNode && canNodeStartRelation(mobileQuickEditNode),
  )
  const mobileQuickEditIsTerrain = mobileQuickEditNode?.type === 'terrain'
  const mobileQuickEditHasDetailOptions = Boolean(
    mobileQuickEditNode &&
    (
      mobileQuickEditNode.type === 'facility' ||
      mobileQuickEditNode.type === 'pipeSegment' ||
      mobileQuickEditNode.type === 'manhole' ||
      mobileQuickEditNode.type === 'outfall'
    ),
  )
  const mobileQuickEditPanelTitle = mobileQuickEditPanel === 'type'
    ? getMobileKindSheetLabel(mobileQuickEditNode)
    : mobileQuickEditPanel === 'detail'
      ? mobileQuickEditNode?.type === 'pipeSegment'
        ? '파이프 종류'
        : '상세 종류'
      : mobileQuickEditPanel === 'size'
        ? '크기'
        : null
  const mobileQuickEditPanelContent = mobileQuickEditPanel && mobileQuickEditNode ? (
    <>
      {mobileQuickEditPanel === 'type' && mobileQuickEditNode.type === 'terrain' ? (
        <div className="grid grid-cols-3 gap-2">
          {TERRAIN_KIND_OPTIONS.map((terrainKind) => (
            <MobileQuickEditOptionButton
              key={terrainKind}
              label={TERRAIN_KIND_LABELS[terrainKind]}
              active={getNodeTerrainKind(mobileQuickEditNode) === terrainKind}
              isDark={isDark}
              onClick={() => updateNode(mobileQuickEditNode.id, resizeNodeForTerrainKind(mobileQuickEditNode, terrainKind))}
            />
          ))}
        </div>
      ) : null}
      {mobileQuickEditPanel === 'type' && FACILITY_TYPE_OPTIONS.includes(mobileQuickEditNode.type) ? (
        <div className="grid grid-cols-2 gap-2">
          {MOBILE_QUICK_EDIT_TYPE_OPTIONS.map((nodeType) => (
            <MobileQuickEditOptionButton
              key={nodeType}
              label={NODE_LABELS[nodeType]}
              active={mobileQuickEditNode.type === nodeType}
              isDark={isDark}
              onClick={() => changeMobileQuickEditNodeType(mobileQuickEditNode, nodeType)}
            />
          ))}
        </div>
      ) : null}
      {mobileQuickEditPanel === 'type' && CONNECTOR_TYPE_OPTIONS.includes(mobileQuickEditNode.type) ? (
        <div className="grid grid-cols-2 gap-2">
          {CONNECTOR_TYPE_OPTIONS.map((nodeType) => (
            <MobileQuickEditOptionButton
              key={nodeType}
              label={NODE_LABELS[nodeType]}
              active={mobileQuickEditNode.type === nodeType}
              isDark={isDark}
              onClick={() => changeMobileQuickEditNodeType(mobileQuickEditNode, nodeType)}
            />
          ))}
        </div>
      ) : null}
      {mobileQuickEditPanel === 'detail' && mobileQuickEditNode.type === 'facility' ? (
        <div className="grid grid-cols-2 gap-2">
          {SELECTABLE_FACILITY_KIND_OPTIONS.map((facilityKind) => (
            <MobileQuickEditOptionButton
              key={facilityKind}
              label={FACILITY_KIND_LABELS[facilityKind]}
              active={getNodeFacilityKind(mobileQuickEditNode) === facilityKind}
              isDark={isDark}
              onClick={() => updateNode(mobileQuickEditNode.id, resizeNodeForFacilityKind(mobileQuickEditNode, facilityKind))}
            />
          ))}
        </div>
      ) : null}
      {mobileQuickEditPanel === 'detail' && mobileQuickEditNode.type === 'pipeSegment' ? (
        <div className="grid grid-cols-2 gap-2">
          {PIPE_KIND_OPTIONS.map((pipeKind) => (
            <MobileQuickEditOptionButton
              key={pipeKind}
              label={PIPE_KIND_LABELS[pipeKind]}
              active={getNodePipeKind(mobileQuickEditNode) === pipeKind}
              isDark={isDark}
              onClick={() => updateNode(mobileQuickEditNode.id, {
                props: {
                  ...mobileQuickEditNode.props,
                  pipeKind,
                },
              })}
            />
          ))}
        </div>
      ) : null}
      {mobileQuickEditPanel === 'detail' && mobileQuickEditNode.type === 'manhole' ? (
        <div className="grid grid-cols-2 gap-2">
          {MANHOLE_KIND_OPTIONS.map((manholeKind) => (
            <MobileQuickEditOptionButton
              key={manholeKind}
              label={MANHOLE_KIND_LABELS[manholeKind]}
              active={getNodeManholeKind(mobileQuickEditNode) === manholeKind}
              isDark={isDark}
              onClick={() => updateNode(mobileQuickEditNode.id, resizeNodeForManholeKind(mobileQuickEditNode, manholeKind))}
            />
          ))}
        </div>
      ) : null}
      {mobileQuickEditPanel === 'detail' && mobileQuickEditNode.type === 'outfall' ? (
        <div className="grid grid-cols-2 gap-2">
          {OUTFALL_KIND_OPTIONS.map((outfallKind) => (
            <MobileQuickEditOptionButton
              key={outfallKind}
              label={OUTFALL_KIND_LABELS[outfallKind]}
              active={getNodeOutfallKind(mobileQuickEditNode) === outfallKind}
              isDark={isDark}
              onClick={() => updateNode(mobileQuickEditNode.id, resizeNodeForOutfallKind(mobileQuickEditNode, outfallKind))}
            />
          ))}
        </div>
      ) : null}
      {mobileQuickEditPanel === 'size' && mobileQuickEditCanUseSizePreset ? (
        <div className="grid grid-cols-3 gap-2">
          {PIPE_SIZE_OPTIONS.map((pipeSize: EditorPipeSize) => (
            <MobileQuickEditOptionButton
              key={pipeSize}
              label={PIPE_SIZE_LABELS[pipeSize]}
              active={getNodePipeSize(mobileQuickEditNode) === pipeSize}
              isDark={isDark}
              onClick={() => updateNode(mobileQuickEditNode.id, resizeNodeForPipeSize(mobileQuickEditNode, pipeSize))}
            />
          ))}
        </div>
      ) : null}
    </>
  ) : null
  const mobileQuickEditOptionSheet = isMobileInput && mobileQuickEditPanel && mobileQuickEditNode && mobileQuickEditPanelContent ? (
    <MobileBottomSheet
      theme={theme}
      title={mobileQuickEditPanelTitle ?? getMobileKindSheetLabel(mobileQuickEditNode)}
      description={mobileQuickEditNode.name || mobileQuickEditNode.swmmId}
      titleId="mobile-quick-edit-option-sheet-title"
      closeLabel="빠른 편집 옵션 닫기"
      zIndexClassName="z-[236]"
      overlayClassName="pointer-events-none fixed left-0 right-0 top-[var(--app-visual-offset-top,0px)] flex h-[var(--app-visual-height,100dvh)] items-end"
      backdropClassName="bg-transparent"
      sheetClassName={`pointer-events-auto flex max-h-[50dvh] w-screen flex-col overflow-hidden rounded-t-2xl border-t shadow-2xl ${
        isDark ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
      }`}
      bodyClassName="min-h-0 overflow-y-auto px-5 pb-4 pt-4"
      ariaModal={false}
      lockBodyScroll={false}
      onClose={() => setMobileQuickEditPanel(null)}
    >
      {mobileQuickEditPanelContent}
    </MobileBottomSheet>
  ) : null
  const mobileQuickEditActions: Array<{
    key: MobileQuickEditActionKey
    label: string
    icon: string
    active: boolean
    disabled: boolean
    tone?: 'destructive'
  }> = []
  if (mobileQuickEditNode) {
    if (mobileQuickEditCanChangeType) {
      mobileQuickEditActions.push({
        key: 'type',
        label: '종류',
        icon: '▦',
        active: mobileQuickEditPanel === 'type',
        disabled: false,
      })
    }

    if (!mobileQuickEditIsTerrain) {
      mobileQuickEditActions.push({
        key: 'detail',
        label: mobileQuickEditNode.type === 'pipeSegment' ? '종류' : '상세',
        icon: '⋯',
        active: mobileQuickEditPanel === 'detail',
        disabled: !mobileQuickEditHasDetailOptions,
      })
    }

    if (mobileQuickEditNode.type === 'pipeSegment') {
      mobileQuickEditActions.push({
        key: 'size',
        label: '크기',
        icon: '◯',
        active: mobileQuickEditPanel === 'size',
        disabled: !mobileQuickEditCanUseSizePreset,
      })
      mobileQuickEditActions.push({
        key: 'length',
        label: '길이',
        icon: '↔',
        active: false,
        disabled: !mobileQuickEditCanLengthResize,
      })
    } else {
      mobileQuickEditActions.push({
        key: 'size',
        label: '크기',
        icon: '↔',
        active: mobileQuickEditPanel === 'size',
        disabled: !mobileQuickEditCanResize,
      })
    }

    mobileQuickEditActions.push({
      key: 'relation',
      label: '관계',
      icon: '⛓',
      active: false,
      disabled: !mobileQuickEditCanStartRelation,
    })
    mobileQuickEditActions.push({
      key: 'move',
      label: '이동',
      icon: '↕',
      active: false,
      disabled: mobileQuickEditIsTerrain,
    })
    mobileQuickEditActions.push({
      key: 'info',
      label: '정보',
      icon: 'i',
      active: false,
      disabled: false,
    })
    mobileQuickEditActions.push({
      key: 'delete',
      label: '삭제',
      icon: '×',
      active: false,
      disabled: false,
      tone: 'destructive',
    })
  }
  const mobileQuickEditActionGap = 12
  const mobileQuickEditActionPaddingX = 34
  const mobileQuickEditActionWidth = mobileQuickEditCapsulePosition && mobileQuickEditActions.length > 0
    ? (
        mobileQuickEditCapsulePosition.width -
        mobileQuickEditActionPaddingX * 2 -
        mobileQuickEditActionGap * (mobileQuickEditActions.length - 1)
      ) / mobileQuickEditActions.length
    : 0
  const mobileQuickEditCapsule = shouldShowMobileQuickEditCapsule && mobileQuickEditNode && mobileQuickEditCapsulePosition ? (
    <g
      transform={`translate(${mobileQuickEditCapsulePosition.x} ${mobileQuickEditCapsulePosition.y})`}
      data-editor-context-menu="true"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <rect
        x="10"
        y="12"
        width={mobileQuickEditCapsulePosition.width}
        height={mobileQuickEditCapsulePosition.height}
        rx="46"
        fill="#000000"
        opacity="0.18"
      />
      <rect
        x="0"
        y="0"
        width={mobileQuickEditCapsulePosition.width}
        height={mobileQuickEditCapsulePosition.height}
        rx="46"
        fill={isDark ? '#020617' : '#ffffff'}
        fillOpacity="0.96"
        stroke={isDark ? 'rgba(255,255,255,0.14)' : '#e2e8f0'}
        strokeWidth="4"
      />
      <text
        x="42"
        y="54"
        fill={isDark ? '#94a3b8' : '#64748b'}
        fontSize="28"
        fontWeight="900"
        pointerEvents="none"
      >
        {getMobileKindSheetLabel(mobileQuickEditNode)}
      </text>
      <text
        x="42"
        y="104"
        fill={isDark ? '#f8fafc' : '#020617'}
        fontSize="38"
        fontWeight="900"
        pointerEvents="none"
      >
        {truncateMobileQuickEditText(
          mobileQuickEditNode.name || mobileQuickEditNode.swmmId || NODE_LABELS[mobileQuickEditNode.type],
          20,
        )}
      </text>
      <g
        transform={`translate(${mobileQuickEditCapsulePosition.width - 106} 24)`}
        role="button"
        aria-label="빠른 편집 닫기"
        onClick={(event) => {
          event.stopPropagation()
          setMobileQuickEditNodeId(null)
          setMobileQuickEditPanel(null)
          setMobileQuickEditAnchorPoint(null)
        }}
      >
        <circle
          cx="36"
          cy="36"
          r="36"
          fill={isDark ? '#0f172a' : '#f8fafc'}
          stroke={isDark ? '#334155' : '#e2e8f0'}
          strokeWidth="3"
        />
        <text
          x="36"
          y="50"
          textAnchor="middle"
          fill={isDark ? '#f8fafc' : '#334155'}
          fontSize="48"
          fontWeight="900"
          pointerEvents="none"
        >
          ×
        </text>
      </g>
      {mobileQuickEditActions.map((action, index) => (
        <MobileQuickEditSvgActionButton
          key={action.key}
          x={mobileQuickEditActionPaddingX + (mobileQuickEditActionWidth + mobileQuickEditActionGap) * index}
          y={178}
          width={mobileQuickEditActionWidth}
          height={138}
          label={action.label}
          icon={action.icon}
          active={action.active}
          disabled={action.disabled}
          tone={action.tone}
          isDark={isDark}
          onClick={() => handleMobileQuickEditActionClick(action.key)}
        />
      ))}
    </g>
  ) : null
  const mobileQuickEditSheet = shouldShowMobileQuickEditSheet && mobileQuickEditNode ? (
    <MobileBottomSheet
      theme={theme}
      title={getMobileKindSheetLabel(mobileQuickEditNode)}
      description={mobileQuickEditNode.name || mobileQuickEditNode.swmmId}
      titleId="mobile-quick-edit-sheet-title"
      closeLabel="종류 변경 닫기"
      zIndexClassName="z-[232]"
      backdropClassName="bg-slate-950/45"
      bodyClassName="min-h-0 overflow-y-auto px-5 pb-4 pt-4"
      onHeightChange={setMobileModalSheetHeight}
      onClose={() => {
        setMobileQuickEditNodeId(null)
        setMobileQuickEditPanel(null)
        setMobileQuickEditAnchorPoint(null)
      }}
    >
      {FACILITY_TYPE_OPTIONS.includes(mobileQuickEditNode.type) ? (
        <div>
          <div className={`text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>객체 종류</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {FACILITY_TYPE_OPTIONS.map((nodeType) => (
              <MobileQuickEditOptionButton
                key={nodeType}
                label={NODE_LABELS[nodeType]}
                active={mobileQuickEditNode.type === nodeType}
                isDark={isDark}
                onClick={() => changeMobileQuickEditNodeType(mobileQuickEditNode, nodeType)}
              />
            ))}
          </div>
        </div>
      ) : null}
      {mobileQuickEditNode.type === 'facility' ? (
        <div>
          <div className={`mt-4 text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>시설 세부 종류</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SELECTABLE_FACILITY_KIND_OPTIONS.map((facilityKind) => (
              <MobileQuickEditOptionButton
                key={facilityKind}
                label={FACILITY_KIND_LABELS[facilityKind]}
                active={getNodeFacilityKind(mobileQuickEditNode) === facilityKind}
                isDark={isDark}
                onClick={() => updateNode(mobileQuickEditNode.id, resizeNodeForFacilityKind(mobileQuickEditNode, facilityKind))}
              />
            ))}
          </div>
        </div>
      ) : null}
      {mobileQuickEditNode.type === 'pipeSegment' ? (
        <div>
          <div className={`text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>파이프 종류</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {PIPE_KIND_OPTIONS.map((pipeKind) => (
              <MobileQuickEditOptionButton
                key={pipeKind}
                label={PIPE_KIND_LABELS[pipeKind]}
                active={getNodePipeKind(mobileQuickEditNode) === pipeKind}
                isDark={isDark}
                onClick={() => updateNode(mobileQuickEditNode.id, {
                  props: {
                    ...mobileQuickEditNode.props,
                    pipeKind,
                  },
                })}
              />
            ))}
          </div>
        </div>
      ) : null}
      {mobileQuickEditNode.type === 'manhole' ? (
        <div>
          <div className={`mt-4 text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>맨홀 종류</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {MANHOLE_KIND_OPTIONS.map((manholeKind) => (
              <MobileQuickEditOptionButton
                key={manholeKind}
                label={MANHOLE_KIND_LABELS[manholeKind]}
                active={getNodeManholeKind(mobileQuickEditNode) === manholeKind}
                isDark={isDark}
                onClick={() => updateNode(mobileQuickEditNode.id, resizeNodeForManholeKind(mobileQuickEditNode, manholeKind))}
              />
            ))}
          </div>
        </div>
      ) : null}
      {mobileQuickEditNode.type === 'outfall' ? (
        <div>
          <div className={`mt-4 text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>방류구 종류</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {OUTFALL_KIND_OPTIONS.map((outfallKind) => (
              <MobileQuickEditOptionButton
                key={outfallKind}
                label={OUTFALL_KIND_LABELS[outfallKind]}
                active={getNodeOutfallKind(mobileQuickEditNode) === outfallKind}
                isDark={isDark}
                onClick={() => updateNode(mobileQuickEditNode.id, resizeNodeForOutfallKind(mobileQuickEditNode, outfallKind))}
              />
            ))}
          </div>
        </div>
      ) : null}
      {CONNECTOR_TYPE_OPTIONS.includes(mobileQuickEditNode.type) ? (
        <div>
          <div className={`text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>커넥터 종류</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {CONNECTOR_TYPE_OPTIONS.map((nodeType) => (
              <MobileQuickEditOptionButton
                key={nodeType}
                label={NODE_LABELS[nodeType]}
                active={mobileQuickEditNode.type === nodeType}
                isDark={isDark}
                onClick={() => changeMobileQuickEditNodeType(mobileQuickEditNode, nodeType)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </MobileBottomSheet>
  ) : null

  return (
    <>
      <section
        className={`relative flex h-screen min-w-0 flex-col ${renderHeader ? 'box-border pt-[90px] lg:pt-[86px]' : ''}`}
        data-swmm-theme={theme}
        style={mobileEditorTouchSurfaceStyle}
      >
      {EditorHeader ? (
        <div className="fixed left-0 right-0 top-0 z-[180] w-full">
          <EditorHeader
            isInfoPanelOpen={isEditorInfoPanelOpen}
            toggleInfoPanel={toggleEditorInfoPanel}
          />
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 items-stretch">
        <MobilePortal>
          {editorUndoRedoControls}
          {editorZoomControls}
          {desktopEditorSettingsFab}
          {desktopEditorInfoDrawer}
          {editorSettingsSheet}
        </MobilePortal>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-h-[640px]">
        <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${themeTokens.panel}`}>
        <div
          ref={editorCanvasViewportRef}
          className={editorCanvasViewportClassName}
          style={mobileEditorTouchSurfaceStyle}
        >
          <div
            ref={mobileCanvasContentRef}
            className="h-full w-full"
            style={isMobileInput ? {
              minWidth: '100%',
              minHeight: '100%',
              width: mobileCanvasHasHorizontalGutter
                ? `calc(${mobileCanvasScale * 100}% + 100vw)`
                : `${mobileCanvasScale * 100}%`,
              height: `${mobileCanvasScale * 100}%`,
              paddingLeft: mobileCanvasHasHorizontalGutter ? '50vw' : undefined,
              paddingRight: mobileCanvasHasHorizontalGutter ? '50vw' : undefined,
            } : undefined}
          >
          <svg
            ref={svgRef}
            viewBox={renderedEditorViewBox}
            preserveAspectRatio="xMidYMid meet"
            className={`block h-full w-full max-w-none border border-dashed ${
              isDark ? 'border-slate-700 bg-slate-900/80' : 'border-slate-300 bg-sky-50'
            } ${
              coordinateEditAxis === 'x'
                ? 'cursor-ew-resize'
                : coordinateEditAxis === 'y'
                  ? 'cursor-ns-resize'
                  : ''
            }`}
            role="img"
            aria-label="배수도 편집 캔버스"
            style={{ touchAction: isMobileInput && !mobileEditorLocksScroll ? 'pan-x pan-y' : 'none' }}
            onPointerDown={handleCanvasPointerDown}
            onContextMenu={handleCanvasContextMenu}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={finishPointerInteraction}
            onPointerCancel={finishPointerInteraction}
            onPointerLeave={handleCanvasPointerLeave}
          >
            {terrainNodes.map((node) => {
              const renderNode = renderNodesById.get(node.id) ?? node
              if (normalizeTerrainKind(renderNode.props.terrainKind) !== 'ground') {
                return null
              }

              const skyHeight = Math.max(0, renderNode.y)
              if (skyHeight <= 1 || renderNode.width <= 1) {
                return null
              }

              return (
                <rect
                  key={`${node.id}-ground-sky`}
                  x={renderNode.x}
                  y="0"
                  width={renderNode.width}
                  height={skyHeight}
                  fill="#e8f5ff"
                  pointerEvents="none"
                />
              )
            })}
            {hasVisibleBaseGround ? (
              <SoilBackground
                minX={baseGroundBounds.left}
                topY={baseGroundBounds.top}
                width={baseGroundWidth}
                height={baseGroundHeight}
                skyHeight={layout.groundSurfaceY}
              />
            ) : null}
            {hasVisibleBaseGround && isMobileInput && contextMenu?.baseGround ? (
              <g pointerEvents="none">
                <rect
                  x={baseGroundBounds.left + 5}
                  y={baseGroundBounds.top + 5}
                  width={Math.max(0, baseGroundWidth - 10)}
                  height={Math.max(0, baseGroundHeight - 10)}
                  rx="10"
                  fill="none"
                  stroke="#fb923c"
                  strokeWidth="10"
                  opacity="0.24"
                />
                <rect
                  x={baseGroundBounds.left + 9}
                  y={baseGroundBounds.top + 9}
                  width={Math.max(0, baseGroundWidth - 18)}
                  height={Math.max(0, baseGroundHeight - 18)}
                  rx="8"
                  fill="none"
                  stroke="#ea580c"
                  strokeWidth="4"
                  opacity="0.96"
                />
              </g>
            ) : null}
            {marqueeRect ? (
              <rect
                x={marqueeRect.left}
                y={marqueeRect.top}
                width={marqueeRect.right - marqueeRect.left}
                height={marqueeRect.bottom - marqueeRect.top}
                fill="rgba(59, 130, 246, .12)"
                stroke="#2563eb"
                strokeWidth="2"
                strokeDasharray="8 6"
                pointerEvents="none"
              />
            ) : null}

            <g>
              <EditableNodeLayer
                nodes={terrainNodes}
                renderNodesById={renderNodesById}
                selectedNodeIds={selectedNodeIds}
                renderedPortRelationLookupByNodeId={renderedPortRelationLookupByNodeId}
                connectedPortKeys={connectedPortKeys}
                selectedRelationPortRoles={selectedRelationPortRoles}
                selectedParentPortKeys={selectedParentPortKeys}
                pendingPort={pendingPort}
                attachTargetNodeId={attachTargetNodeId}
                coordinateEditActive={Boolean(coordinateEditState)}
                getRenderablePorts={getNodeRenderablePorts}
                getRenderedPortPoint={getRenderedPortPointFromLookup}
                hasManualResizableEdge={hasManualResizableEdge}
                renderResizeHandles={renderResizeHandles}
                onPointerDown={handleNodePointerDown}
                onPointerEnter={handleNodePointerEnter}
                onNodeContextMenu={handleNodeContextMenu}
                onPortClick={handlePortClick}
                onPortContextMenu={handlePortContextMenu}
                onResizePointerDown={handlePipeResizePointerDown}
              />
              {isMobileInput ? (
                <g>
                  {terrainNodes.map((node) => {
                    const renderNode = renderNodesById.get(node.id) ?? node

                    return (
                      <g key={`${node.id}-mobile-layout-add-buttons`}>
                        <MobileLayoutAddEdgeButtons
                          bounds={{
                            left: renderNode.x,
                            top: renderNode.y,
                            right: renderNode.x + renderNode.width,
                            bottom: renderNode.y + renderNode.height,
                          }}
                          onPointerDown={(side, event) => handleNodeLayoutAddPointerDown(renderNode, side, event)}
                        />
                      </g>
                    )
                  })}
                  {hasVisibleBaseGround ? (
                    <MobileLayoutAddEdgeButtons
                      bounds={baseGroundBounds}
                      onPointerDown={handleBaseLayoutAddPointerDown}
                    />
                  ) : null}
                </g>
              ) : (
                <g>
                  {terrainNodes.map((node) => {
                    const renderNode = renderNodesById.get(node.id) ?? node

                    return (
                      <g key={`${node.id}-layout-add-handles`} transform={`translate(${renderNode.x} ${renderNode.y})`}>
                        <LayoutAddHandles
                          bounds={{ left: 0, top: 0, right: renderNode.width, bottom: renderNode.height }}
                          onPointerDown={(side, event) => handleNodeLayoutAddPointerDown(renderNode, side, event)}
                        />
                      </g>
                    )
                  })}
                  {hasVisibleBaseGround ? (
                    <LayoutAddHandles
                      bounds={baseGroundBounds}
                      onPointerDown={handleBaseLayoutAddPointerDown}
                    />
                  ) : null}
                </g>
              )}

              <g>
                {layout.links.map((link) => (
                  <EditableLink
                    key={link.id}
                    link={link}
                    fromNode={renderNodesById.get(link.from.nodeId) ?? null}
                    toNode={renderNodesById.get(link.to.nodeId) ?? null}
                    selected={selection?.kind === 'link' && selection.id === link.id}
                    onSelect={handleLinkSelect}
                  />
                ))}
              </g>

              <EditableNodeLayer
                nodes={drawableNodes}
                renderNodesById={renderNodesById}
                selectedNodeIds={selectedNodeIds}
                renderedPortRelationLookupByNodeId={renderedPortRelationLookupByNodeId}
                connectedPortKeys={connectedPortKeys}
                selectedRelationPortRoles={selectedRelationPortRoles}
                selectedParentPortKeys={selectedParentPortKeys}
                pendingPort={pendingPort}
                attachTargetNodeId={attachTargetNodeId}
                coordinateEditActive={Boolean(coordinateEditState)}
                getRenderablePorts={getNodeRenderablePorts}
                getRenderedPortPoint={getRenderedPortPointFromLookup}
                hasManualResizableEdge={hasManualResizableEdge}
                renderResizeHandles={renderResizeHandles}
                onPointerDown={handleNodePointerDown}
                onPointerEnter={handleNodePointerEnter}
                onNodeContextMenu={handleNodeContextMenu}
                onPortClick={handlePortClick}
                onPortContextMenu={handlePortContextMenu}
                onResizePointerDown={handlePipeResizePointerDown}
              />
            </g>
            {mobileCanvasGestureGuard}
            {selectedOutlineNodes.length > 0 ? (
              <g pointerEvents="none">
                {selectedOutlineNodes.map((node) => {
                  const renderNode = renderNodesById.get(node.id) ?? node
                  const glowPadding = 10
                  const strokePadding = 5

                  return (
                    <g key={`${node.id}-top-selection-outline`}>
                      <rect
                        x={renderNode.x - glowPadding}
                        y={renderNode.y - glowPadding}
                        width={renderNode.width + glowPadding * 2}
                        height={renderNode.height + glowPadding * 2}
                        rx="14"
                        fill="none"
                        stroke="#fb923c"
                        strokeWidth="10"
                        opacity="0.24"
                      />
                      <rect
                        x={renderNode.x - strokePadding}
                        y={renderNode.y - strokePadding}
                        width={renderNode.width + strokePadding * 2}
                        height={renderNode.height + strokePadding * 2}
                        rx="10"
                        fill="none"
                        stroke="#ea580c"
                        strokeWidth="4"
                        opacity="0.96"
                      />
                    </g>
                  )
                })}
              </g>
            ) : null}
            {mobileQuickEditCapsule}
          </svg>
          </div>
          {mobileBottomSpacerHeight > 0 ? (
            <div
              className="pointer-events-none w-px shrink-0"
              style={{ height: mobileBottomSpacerHeight }}
              aria-hidden="true"
            />
          ) : null}
        </div>
      </div>
      </div>
      </div>
      {addMenuPreviewPoint ? (
        <div
          className={`pointer-events-none fixed z-[225] -translate-x-1/2 -translate-y-1/2 select-none drop-shadow-xl ${
            isDark
              ? 'text-white [--map-pin-hole:#020617]'
              : 'text-slate-950 [--map-pin-hole:#ffffff]'
          }`}
          style={mobileAddMenuPreviewStyle}
          aria-hidden="true"
        >
          <MapPinIcon />
        </div>
      ) : null}
      <MobilePortal>
        {editorToastMessage ? (
          <div
            className={`pointer-events-none fixed left-1/2 top-[calc(var(--app-visual-offset-top,0px)+16px)] z-[320] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-full border px-4 py-2 text-center text-xs font-black shadow-2xl backdrop-blur ${
              isDark
                ? 'border-white/15 bg-white text-slate-950'
                : 'border-slate-950/10 bg-slate-950 text-white'
            }`}
            role="status"
            aria-live="polite"
          >
            {editorToastMessage}
          </div>
        ) : null}
        {isMobileInput && !isEditorSettingsOpen && !addMenuPreviewPoint ? (
          <div className="fixed bottom-5 right-8 z-[120] flex flex-col items-center gap-2">
            <MobileFloatingActionButton
              onClick={() => {
                setContextMenu(null)
                setIsEditorSettingsOpen(true)
              }}
              label="편집 세팅"
              title="편집 세팅"
              tone={isDark ? 'systemDark' : 'systemLight'}
            >
              <GearIcon />
            </MobileFloatingActionButton>
            <MobileFloatingActionButton
              onClick={openAddMenuAtViewportCenter}
              label="현재 화면 중심에 객체 추가"
              title="객체 추가"
              tone="blue"
              withRingOffset
            >
              <PlusIcon />
            </MobileFloatingActionButton>
          </div>
        ) : null}
        {mobileEditorModeHud}
      </MobilePortal>
      {editorInfoSheet}
      {relationPreviewSheet}
      {mobileQuickEditOptionSheet}
      {mobileQuickEditSheet}
    </section>
    {contextMenu ? (
      <EditorContextMenu
        key={`${contextMenu.nodeId ?? 'canvas'}-${contextMenu.relationPort?.linkId ?? 'none'}-${contextMenu.layoutAdd ? 'layout' : 'menu'}-${contextMenu.x}-${contextMenu.y}`}
        contextMenu={contextMenu}
        canStartCoordinateEdit={Boolean(
          contextMenu.nodeId && getCoordinateEditableTeeRelationInfo(layout, contextMenu.nodeId),
        )}
        canStartNodeRelation={Boolean(
          isMobileInput &&
          contextMenu.nodeId && canNodeStartRelation(nodesById.get(contextMenu.nodeId)),
        )}
        canDetachNodeParentRelation={Boolean(contextMenu.nodeId && hasParentRelationForNode(contextMenu.nodeId))}
        canOpenNodeKindSheet={Boolean(
          isMobileInput &&
          contextMenu.nodeId &&
          isMobileQuickEditableNode(nodesById.get(contextMenu.nodeId)),
        )}
        nodeKindSheetLabel={getMobileKindSheetLabel(contextMenu.nodeId ? nodesById.get(contextMenu.nodeId) : null)}
        isMobileSheet={isMobileInput}
        theme={theme}
        onOpenInfoPanel={() => {
          clearPointerInteractionState()
          setRelationPreviewNodeId(null)
          setIsEditorInfoPanelOpen(true)
        }}
        onStartNodeRelation={() => {
          if (!contextMenu.nodeId || blockReadOnlyScenarioAction()) {
            return
          }

          setSelection({ kind: 'node', id: contextMenu.nodeId })
          setIsEditorInfoPanelOpen(false)
          mobileMoveArmedNodeIdRef.current = null
          setMobileMoveArmedNodeId(null)
          setMobileEditorMode('idle')
          setMobileActiveNodeId(contextMenu.nodeId)
          if (pendingPort && pendingPort.nodeId !== contextMenu.nodeId) {
            setAttachTargetNodeId(contextMenu.nodeId)
            setRelationPreviewMode('child')
          } else {
            setPendingPort(null)
            setAttachTargetNodeId(null)
            setRelationPreviewMode('parent')
          }
          setCoordinateEditState(null)
          setDragState(null)
          setDragDraftPositionsByNodeId(null)
          setResizeState(null)
          setResizeDraftNodesById(null)
          setMarqueeSelectionState(null)
          setRelationPreviewZoom(RELATION_PREVIEW_ZOOM_DEFAULT)
          setRelationPreviewNodeId(contextMenu.nodeId)
        }}
        onDetachNodeParentRelation={detachContextNodeParentRelations}
        onOpenNodeKindSheet={() => {
          if (!contextMenu.nodeId) {
            return
          }

          setSelection({ kind: 'node', id: contextMenu.nodeId })
          setIsEditorInfoPanelOpen(false)
          setMobileQuickEditNodeId(contextMenu.nodeId)
        }}
        onStartNodeMove={() => {
          const contextNode = contextMenu.nodeId ? nodesById.get(contextMenu.nodeId) : null
          if (contextMenu.nodeId && contextNode?.type !== 'terrain') {
            setRelationPreviewNodeId(null)
            setSelection({ kind: 'node', id: contextMenu.nodeId })
            mobileMoveArmedNodeIdRef.current = contextMenu.nodeId
            setMobileMoveArmedNodeId(contextMenu.nodeId)
            setMobileEditorMode('move')
            setMobileActiveNodeId(contextMenu.nodeId)
          }
        }}
        onStartNodeResize={() => {
          if (contextMenu.nodeId) {
            setRelationPreviewNodeId(null)
            setSelection({ kind: 'node', id: contextMenu.nodeId })
            mobileMoveArmedNodeIdRef.current = null
            setMobileMoveArmedNodeId(null)
            setMobileEditorMode('resize')
            setMobileActiveNodeId(contextMenu.nodeId)
          }
        }}
        onChangeNodeZOrder={changeContextNodeZOrder}
        onStartTeeCoordinateEdit={startContextTeeCoordinateEdit}
        onAddLayoutNode={addLayoutNode}
        onDetachRelation={detachContextRelation}
        onDeleteSelection={deleteSelection}
        onAddNode={(type, point) => addNode(type, getCurrentMobileAddMenuPoint(point))}
        onAddStandalonePipe={(point) => addStandalonePipe(getCurrentMobileAddMenuPoint(point))}
        onMobileSheetHeightChange={setMobileContextSheetHeight}
        onClose={() => setContextMenu(null)}
      />
    ) : null}
    </>
  )
})
