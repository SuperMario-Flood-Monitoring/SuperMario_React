import {
  ATTACH_TAP_MAX_PERCENTAGE,
  ATTACH_TAP_MIN_PERCENTAGE,
} from './editorDefinitions'
import {
  clampNumber,
  getNodeCenter,
  getPointDistance,
} from './editorGeometry'
import {
  formatAttachTapPercentage,
  getAttachTapPortInfo,
  getAttachedPortPoint,
  getNodePort,
  getPortPoint,
  getResolvableAttachTapSides,
  supportsAttachTapPorts,
} from './editorNodeHelpers'
import type {
  EditorAttachPoint,
  EditorEndpoint,
  EditorLayout,
  EditorLink,
  EditorNode,
  EditorPort,
  EditorPortSelection,
  EditorPortSide,
} from './editorTypes'
import type { Point } from './editorInternalTypes'

/** endpoint가 가리키는 포트 또는 노드 중심의 현재 좌표를 반환한다. */
export function getEndpointPoint(layout: EditorLayout, endpoint: EditorEndpoint): Point | null {
  const node = layout.nodes.find((candidate) => candidate.id === endpoint.nodeId)
  if (!node) {
    return null
  }

  const port = getNodePort(node, endpoint.portId)
  if (!port) {
    return getNodeCenter(node)
  }

  return getPortPoint(node, port)
}

/** 상대 endpoint까지 고려해 하단부 attach 보정이 들어간 endpoint 좌표를 반환한다. */
export function getEndpointPointWithCounterpart(
  layout: EditorLayout,
  endpoint: EditorEndpoint,
  counterpartEndpoint: EditorEndpoint,
): Point | null {
  const node = layout.nodes.find((candidate) => candidate.id === endpoint.nodeId)
  if (!node) {
    return null
  }

  const port = getNodePort(node, endpoint.portId)
  if (!port) {
    return getNodeCenter(node)
  }

  const counterpartNode = layout.nodes.find((candidate) => candidate.id === counterpartEndpoint.nodeId)
  const counterpartPort = counterpartNode ? getNodePort(counterpartNode, counterpartEndpoint.portId) : null

  return getAttachedPortPoint(node, port, counterpartNode, counterpartPort)
}

/** 일반 링크와 relation 링크의 endpoint 좌표 계산 방식을 통합한다. */
export function getLinkEndpointPoint(layout: EditorLayout, link: EditorLink, endpointName: 'from' | 'to') {
  if (link.type !== 'relation') {
    return getEndpointPoint(layout, link[endpointName])
  }

  return endpointName === 'from'
    ? getEndpointPointWithCounterpart(layout, link.from, link.to)
    : getEndpointPointWithCounterpart(layout, link.to, link.from)
}

/** endpoint에서 실제 포트 정의를 찾는다. */
export function getEndpointPort(layout: EditorLayout, endpoint: EditorEndpoint): EditorPort | null {
  const node = layout.nodes.find((candidate) => candidate.id === endpoint.nodeId)

  return node ? getNodePort(node, endpoint.portId) : null
}

/** 두 endpoint 좌표를 SVG path 문자열로 연결한다. */
function getLinkPathForPoints(layout: EditorLayout, link: EditorLink, start: Point, end: Point): string {
  if (link.props.route === 'straight') {
    return `M${start.x} ${start.y} L${end.x} ${end.y}`
  }

  const startPort = getEndpointPort(layout, link.from)
  const prefersHorizontalStart = startPort?.side === 'left' || startPort?.side === 'right'

  if (prefersHorizontalStart) {
    const midX = start.x + (end.x - start.x) * 0.58
    return `M${start.x} ${start.y} H${midX} V${end.y} H${end.x}`
  }

  const midY = start.y + (end.y - start.y) * 0.58
  return `M${start.x} ${start.y} V${midY} H${end.x} V${end.y}`
}

/** 링크 endpoint 좌표를 계산한 뒤 렌더링 path를 만든다. */
export function getLinkPath(layout: EditorLayout, link: EditorLink): string | null {
  const start = getLinkEndpointPoint(layout, link, 'from')
  const end = getLinkEndpointPoint(layout, link, 'to')
  if (!start || !end) {
    return null
  }

  return getLinkPathForPoints(layout, link, start, end)
}

/** nodeId와 portId를 relation lookup용 문자열 key로 만든다. */
export function endpointKey(selection: EditorPortSelection) {
  return `${selection.nodeId}:${selection.portId}`
}

/** 특정 포트에 이미 연결된 relation을 찾는다. */
export function getRelationLinkForPort(layout: EditorLayout, port: EditorPortSelection) {
  const portKey = endpointKey(port)

  return layout.links.find((link) => (
    link.type === 'relation' &&
    (endpointKey(link.from) === portKey || endpointKey(link.to) === portKey)
  )) ?? null
}

/** 두 endpoint 사이에 이미 존재하는 relation ID를 찾는다. */
export function getRelationIdForEndpointPair(
  layout: EditorLayout,
  firstEndpoint: EditorPortSelection,
  secondEndpoint: EditorPortSelection,
) {
  const firstKey = endpointKey(firstEndpoint)
  const secondKey = endpointKey(secondEndpoint)
  const relation = layout.links.find((link) => (
    link.type === 'relation' &&
    (
      (endpointKey(link.from) === firstKey && endpointKey(link.to) === secondKey) ||
      (endpointKey(link.from) === secondKey && endpointKey(link.to) === firstKey)
    )
  ))

  return relation?.id ?? null
}

/** parent가 child보다 위에 보이도록 relation 깊이를 계산한다. */
export function getNodeRenderDepths(layout: EditorLayout) {
  const childNodeIdsByParent = new Map<string, string[]>()
  layout.links.forEach((link) => {
    if (link.type !== 'relation') {
      return
    }

    const childNodeIds = childNodeIdsByParent.get(link.from.nodeId) ?? []
    childNodeIds.push(link.to.nodeId)
    childNodeIdsByParent.set(link.from.nodeId, childNodeIds)
  })

  const depths = new Map<string, number>()
  const visitingNodeIds = new Set<string>()

  const getDepth = (nodeId: string): number => {
    const memoizedDepth = depths.get(nodeId)
    if (memoizedDepth !== undefined) {
      return memoizedDepth
    }

    if (visitingNodeIds.has(nodeId)) {
      return 0
    }

    visitingNodeIds.add(nodeId)
    const childDepth = (childNodeIdsByParent.get(nodeId) ?? []).reduce(
      (maxDepth, childNodeId) => Math.max(maxDepth, getDepth(childNodeId) + 1),
      0,
    )
    visitingNodeIds.delete(nodeId)
    depths.set(nodeId, childDepth)

    return childDepth
  }

  layout.nodes.forEach((node) => getDepth(node.id))
  return depths
}

/** 서로 마주보는 포트 조합이면 직선 relation route를 사용할지 판정한다. */
export function shouldUseStraightRoute(fromPort: EditorPort | null, toPort: EditorPort | null) {
  if (!fromPort || !toPort) {
    return false
  }

  const horizontalPair =
    (fromPort.side === 'left' || fromPort.side === 'right') &&
    (toPort.side === 'left' || toPort.side === 'right')
  const verticalPair =
    (fromPort.side === 'top' || fromPort.side === 'bottom') &&
    (toPort.side === 'top' || toPort.side === 'bottom')

  return horizontalPair || verticalPair
}

/** 특정 노드의 relation parent 체인을 위쪽으로 탐색한다. */
export function getRelationAncestorNodeIds(layout: EditorLayout, startNodeId: string): string[] {
  const visited = new Set<string>([startNodeId])
  const queue = [startNodeId]

  while (queue.length > 0) {
    const currentNodeId = queue.shift()
    if (!currentNodeId) {
      continue
    }

    layout.links.forEach((link) => {
      if (link.type !== 'relation' || link.to.nodeId !== currentNodeId) {
        return
      }

      const nextNodeId = link.from.nodeId
      if (!visited.has(nextNodeId)) {
        visited.add(nextNodeId)
        queue.push(nextNodeId)
      }
    })
  }

  return Array.from(visited)
}

/** 새 relation이 parent-child 순환을 만들지 확인한다. */
export function wouldCreateRelationCycle(layout: EditorLayout, parentNodeId: string, childNodeId: string) {
  return getRelationAncestorNodeIds(layout, parentNodeId).includes(childNodeId)
}

/** 특정 endpoint 기준으로 반대편 relation 그룹을 구한다. */
export function getRelationSideNodeIds(layout: EditorLayout, endpoint: EditorPortSelection): string[] {
  const relation = getRelationLinkForPort(layout, endpoint)
  if (!relation) {
    return []
  }

  const blockedNodeId = endpoint.nodeId
  const startNodeId = relation.from.nodeId === blockedNodeId ? relation.to.nodeId : relation.from.nodeId
  const visited = new Set<string>([blockedNodeId])
  const sideNodeIds = new Set<string>([startNodeId])
  const queue = [startNodeId]

  while (queue.length > 0) {
    const currentNodeId = queue.shift()
    if (!currentNodeId) {
      continue
    }

    visited.add(currentNodeId)

    layout.links.forEach((link) => {
      if (link.type !== 'relation') {
        return
      }

      let nextNodeId: string | null = null
      if (link.from.nodeId === currentNodeId) {
        nextNodeId = link.to.nodeId
      } else if (link.to.nodeId === currentNodeId) {
        nextNodeId = link.from.nodeId
      }

      if (!nextNodeId || visited.has(nextNodeId)) {
        return
      }

      visited.add(nextNodeId)
      sideNodeIds.add(nextNodeId)
      queue.push(nextNodeId)
    })
  }

  return Array.from(sideNodeIds)
}

/** 특정 노드가 참여한 모든 relation을 찾는다. */
export function getRelationLinksForNode(layout: EditorLayout, nodeId: string) {
  return layout.links.filter((link) => (
    link.type === 'relation' &&
    (link.from.nodeId === nodeId || link.to.nodeId === nodeId)
  ))
}

/** relation에서 현재 노드 반대편 endpoint를 반환한다. */
export function getOtherRelationEndpoint(link: EditorLink, nodeId: string): EditorPortSelection | null {
  if (link.from.nodeId === nodeId) {
    return link.to
  }

  if (link.to.nodeId === nodeId) {
    return link.from
  }

  return null
}

/** relation에서 현재 노드가 차지하는 endpoint를 반환한다. */
export function getEndpointForNode(link: EditorLink, nodeId: string): EditorPortSelection | null {
  if (link.from.nodeId === nodeId) {
    return link.from
  }

  if (link.to.nodeId === nodeId) {
    return link.to
  }

  return null
}

/** attach metadata에 저장할 좌표/비율 값을 소수점 4자리로 정리한다. */
function roundAttachValue(value: number) {
  return Number(value.toFixed(4))
}

/** 노드 특정 면의 ratio 위치에 해당하는 월드 좌표를 계산한다. */
function getPointOnNodeSide(node: EditorNode, side: EditorPortSide, ratio: number): Point {
  const safeRatio = clampNumber(ratio, 0, 1)

  if (side === 'top') {
    return {
      x: node.x + node.width * safeRatio,
      y: node.y,
    }
  }

  if (side === 'bottom') {
    return {
      x: node.x + node.width * safeRatio,
      y: node.y + node.height,
    }
  }

  if (side === 'right') {
    return {
      x: node.x + node.width,
      y: node.y + node.height * safeRatio,
    }
  }

  if (side === 'left') {
    return {
      x: node.x,
      y: node.y + node.height * safeRatio,
    }
  }

  return getNodeCenter(node)
}

/** 월드 좌표가 노드 특정 면에서 차지하는 원시 ratio를 계산한다. */
function getRawRatioOnNodeSide(node: EditorNode, side: EditorPortSide, sourcePoint: Point) {
  if ((side === 'top' || side === 'bottom') && node.width > 0) {
    return (sourcePoint.x - node.x) / node.width
  }

  if ((side === 'left' || side === 'right') && node.height > 0) {
    return (sourcePoint.y - node.y) / node.height
  }

  return 0.5
}

/** endpoint의 실제 attach 좌표와 ratio를 JSON metadata로 만든다. */
function createAttachPointMetadata(
  node: EditorNode,
  endpoint: EditorEndpoint,
  port: EditorPort,
  sourcePoint: Point,
) {
  const rawRatio = getRawRatioOnNodeSide(node, port.side, sourcePoint)
  const ratio = clampNumber(rawRatio, 0, 1)
  const point = getPointOnNodeSide(node, port.side, ratio)

  return {
    nodeId: endpoint.nodeId,
    portId: endpoint.portId,
    side: port.side,
    ratio: roundAttachValue(ratio),
    rawRatio: roundAttachValue(rawRatio),
    point: {
      x: roundAttachValue(point.x),
      y: roundAttachValue(point.y),
    },
  }
}

/** relation의 parent/child 양쪽 attach 최신 좌표 metadata를 계산한다. */
function getRelationAttachMetadata(layout: EditorLayout, link: EditorLink) {
  if (link.type !== 'relation') {
    return undefined
  }

  const parentNode = layout.nodes.find((node) => node.id === link.from.nodeId)
  const childNode = layout.nodes.find((node) => node.id === link.to.nodeId)
  const parentPort = parentNode ? getNodePort(parentNode, link.from.portId) : null
  const childPort = childNode ? getNodePort(childNode, link.to.portId) : null
  if (!parentNode || !childNode || !parentPort || !childPort) {
    return undefined
  }

  const parentPoint = getEndpointPointWithCounterpart(layout, link.from, link.to)
  const childPoint = getEndpointPointWithCounterpart(layout, link.to, link.from)
  if (!parentPoint || !childPoint) {
    return undefined
  }

  return {
    parentEndpoint: createAttachPointMetadata(parentNode, link.from, parentPort, parentPoint),
    childEndpoint: createAttachPointMetadata(childNode, link.to, childPort, childPoint),
    parentOnChild: createAttachPointMetadata(childNode, link.to, childPort, parentPoint),
    childOnParent: createAttachPointMetadata(parentNode, link.from, parentPort, childPoint),
    aligned: getPointDistance(parentPoint, childPoint) < 0.5,
  }
}

/** 저장된 attach 위치를 동적 tap 포트 ID로 변환한다. */
function getTapPortIdForAttachPoint(node: EditorNode, attachPoint: EditorAttachPoint) {
  if (
    attachPoint.side === 'center' ||
    !getResolvableAttachTapSides(node).includes(attachPoint.side)
  ) {
    return null
  }

  const percentage = clampNumber(
    attachPoint.ratio * 100,
    ATTACH_TAP_MIN_PERCENTAGE,
    ATTACH_TAP_MAX_PERCENTAGE,
  )

  return `tap-${attachPoint.side}-${formatAttachTapPercentage(percentage)}`
}

/** attach metadata와 endpoint의 tap 포트 ID가 어긋나면 endpoint를 보정한다. */
function syncTapEndpointToAttachPoint(
  layout: EditorLayout,
  endpoint: EditorEndpoint,
  attachPoint: EditorAttachPoint,
): EditorEndpoint {
  const node = layout.nodes.find((candidate) => candidate.id === endpoint.nodeId)
  if (!node || !supportsAttachTapPorts(node) || !getAttachTapPortInfo(endpoint.portId)) {
    return endpoint
  }

  const nextPortId = getTapPortIdForAttachPoint(node, attachPoint)
  if (!nextPortId || nextPortId === endpoint.portId) {
    return endpoint
  }

  return {
    ...endpoint,
    portId: nextPortId,
  }
}

/** relation 양쪽 endpoint의 동적 tap 포트 ID를 최신 attach 좌표에 맞춘다. */
function syncRelationTapEndpointPortIds(layout: EditorLayout, link: EditorLink): EditorLink {
  if (link.type !== 'relation') {
    return link
  }

  const attach = getRelationAttachMetadata(layout, link)
  if (!attach) {
    return link
  }

  const from = syncTapEndpointToAttachPoint(layout, link.from, attach.childOnParent)
  const to = syncTapEndpointToAttachPoint(layout, link.to, attach.parentOnChild)
  if (from === link.from && to === link.to) {
    return link
  }

  return {
    ...link,
    from,
    to,
  }
}

/** 모든 relation의 attach metadata와 tap endpoint를 최신 layout 기준으로 정규화한다. */
export function normalizeRelationAttachments(layout: EditorLayout): EditorLayout {
  const linksWithSyncedTapPorts = layout.links.map((link) => syncRelationTapEndpointPortIds(layout, link))
  const syncedLayout = linksWithSyncedTapPorts.some((link, index) => link !== layout.links[index])
    ? { ...layout, links: linksWithSyncedTapPorts }
    : layout

  return {
    ...syncedLayout,
    links: syncedLayout.links.map((link) => {
      if (link.type !== 'relation') {
        if (link.attach === undefined) {
          return link
        }

        const linkWithoutAttach = { ...link }
        delete linkWithoutAttach.attach
        return linkWithoutAttach
      }

      const attach = getRelationAttachMetadata(syncedLayout, link)
      if (!attach) {
        if (link.attach === undefined) {
          return link
        }

        const linkWithoutAttach = { ...link }
        delete linkWithoutAttach.attach
        return linkWithoutAttach
      }

      return {
        ...link,
        attach,
      }
    }),
  }
}
