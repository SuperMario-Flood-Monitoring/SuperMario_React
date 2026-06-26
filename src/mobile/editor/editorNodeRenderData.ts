import { getAttachedPortPoint, getAttachCandidatePorts, getNodeOrientation, getNodePort, getPortPoint, supportsAttachTapPorts } from './editorNodeHelpers'
import { endpointKey, getRelationLinkForPort } from './editorRelations'
import type { Point, RelationPortRole, ResizeEdge } from './editorInternalTypes'
import type { EditorLayout, EditorLink, EditorNode, EditorPort, EditorPortSelection } from './editorTypes'

export type RenderedPortRelation = {
  counterpartNode: EditorNode | null
  counterpartPort: EditorPort | null
}

export type RenderedPortRelationLookup = Map<string, RenderedPortRelation>

/** relation으로 보정된 포트의 실제 렌더 좌표를 노드 내부 좌표로 반환한다. */
export function getRenderedPortPoint(layout: EditorLayout, node: EditorNode, port: EditorPort): Point {
  const relation = getRelationLinkForPort(layout, { nodeId: node.id, portId: port.id })
  if (!relation) {
    return getPortPoint({ ...node, x: 0, y: 0 }, port)
  }

  const portKey = endpointKey({ nodeId: node.id, portId: port.id })
  const counterpartEndpoint = endpointKey(relation.from) === portKey ? relation.to : relation.from
  const counterpartNode = layout.nodes.find((candidate) => candidate.id === counterpartEndpoint.nodeId)
  const counterpartPort = counterpartNode ? getNodePort(counterpartNode, counterpartEndpoint.portId) : null
  const worldPoint = getAttachedPortPoint(node, port, counterpartNode, counterpartPort)

  return {
    x: worldPoint.x - node.x,
    y: worldPoint.y - node.y,
  }
}

export function createRenderedPortRelationLookup(
  node: EditorNode,
  relationLinks: readonly EditorLink[],
  nodesById: ReadonlyMap<string, EditorNode>,
): RenderedPortRelationLookup {
  const lookup: RenderedPortRelationLookup = new Map()

  relationLinks.forEach((relation) => {
    const selfEndpoint = relation.from.nodeId === node.id ? relation.from : relation.to
    const counterpartEndpoint = relation.from.nodeId === node.id ? relation.to : relation.from
    const counterpartNode = nodesById.get(counterpartEndpoint.nodeId) ?? null
    const counterpartPort = counterpartNode ? getNodePort(counterpartNode, counterpartEndpoint.portId) : null

    lookup.set(selfEndpoint.portId, {
      counterpartNode,
      counterpartPort,
    })
  })

  return lookup
}

/** relation counterpart lookup으로 보정된 포트의 실제 렌더 좌표를 노드 내부 좌표로 반환한다. */
export function getRenderedPortPointFromLookup(
  node: EditorNode,
  port: EditorPort,
  relationLookup: RenderedPortRelationLookup,
): Point {
  const relation = relationLookup.get(port.id)
  if (!relation) {
    return getPortPoint({ ...node, x: 0, y: 0 }, port)
  }

  const worldPoint = getAttachedPortPoint(node, port, relation.counterpartNode, relation.counterpartPort)
  return {
    x: worldPoint.x - node.x,
    y: worldPoint.y - node.y,
  }
}

/** 선택/연결/attach 상태에 따라 실제로 화면에 보여줄 포트 목록을 만든다. */
export function getNodeRenderablePorts(
  node: EditorNode,
  pendingPort: EditorPortSelection | null,
  includeAttachCandidatePorts: boolean,
  connectedPortKeys: Set<string>,
  selectedRelationPortRoles: Map<string, RelationPortRole>,
) {
  const portsById = new Map(node.ports.map((port) => [port.id, port]))
  if (!supportsAttachTapPorts(node)) {
    return Array.from(portsById.values())
  }

  if (includeAttachCandidatePorts) {
    getAttachCandidatePorts(node).forEach((port) => portsById.set(port.id, port))
  }

  const nodeKeyPrefix = `${node.id}:`
  const addPortFromKey = (portKey: string) => {
    if (!portKey.startsWith(nodeKeyPrefix)) {
      return
    }

    const portId = portKey.slice(nodeKeyPrefix.length)
    const port = getNodePort(node, portId)
    if (port) {
      portsById.set(port.id, port)
    }
  }

  connectedPortKeys.forEach(addPortFromKey)
  selectedRelationPortRoles.forEach((_role, portKey) => addPortFromKey(portKey))
  if (pendingPort?.nodeId === node.id) {
    addPortFromKey(endpointKey(pendingPort))
  }

  return Array.from(portsById.values())
}

/** attach 규칙이 사용할 수 있는 resize edge 목록을 반환한다. */
export function getAttachResizableEdges(node: EditorNode): Record<ResizeEdge, boolean> {
  if (node.type === 'manhole') {
    return { top: false, right: false, bottom: true, left: false }
  }

  if (node.type === 'pipeSegment') {
    return getNodeOrientation(node) === 'horizontal'
      ? { top: false, right: true, bottom: false, left: true }
      : { top: true, right: false, bottom: true, left: false }
  }

  return { top: false, right: false, bottom: false, left: false }
}

/** 사용자가 마우스로 직접 조작할 수 있는 resize edge 목록을 반환한다. */
export function getManualResizableEdges(node: EditorNode): Record<ResizeEdge, boolean> {
  if (node.type === 'manhole') {
    return { top: false, right: false, bottom: false, left: false }
  }

  if (node.type === 'road') {
    return { top: false, right: true, bottom: false, left: true }
  }

  if (node.type === 'terrain') {
    return { top: false, right: true, bottom: true, left: true }
  }

  return getAttachResizableEdges(node)
}

/** 노드에 수동 resize 가능한 edge가 하나라도 있는지 확인한다. */
export function hasManualResizableEdge(node: EditorNode) {
  const edges = getManualResizableEdges(node)
  return edges.top || edges.right || edges.bottom || edges.left
}
