import { getNodeRect, rectsIntersect } from './editorGeometry'
import { isFixedYNode, normalizeNodePorts } from './editorNodeHelpers'
import { snapNodeToGround } from './editorNodePlacement'
import { normalizeRelationAttachments } from './editorRelations'
import type { CopiedEditorSelection, Point, RectBounds } from './editorInternalTypes'
import type { EditorLayout, EditorLink, EditorSelection } from './editorTypes'

/** relation으로 연결된 동일 그룹의 노드 ID를 탐색한다. */
export function getRelationGroupNodeIds(layout: EditorLayout, startNodeId: string): string[] {
  const visited = new Set<string>([startNodeId])
  const queue = [startNodeId]

  while (queue.length > 0) {
    const currentNodeId = queue.shift()
    if (!currentNodeId) {
      continue
    }

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

      if (nextNodeId && !visited.has(nextNodeId)) {
        visited.add(nextNodeId)
        queue.push(nextNodeId)
      }
    })
  }

  return Array.from(visited)
}

/** 선택된 노드 일부가 relation 그룹이면 그룹 전체 선택으로 확장한다. */
export function getExpandedRelationGroupNodeIds(layout: EditorLayout, nodeIds: string[]): string[] {
  const expandedNodeIds = new Set<string>()

  nodeIds.forEach((nodeId) => {
    getRelationGroupNodeIds(layout, nodeId).forEach((groupNodeId) => {
      expandedNodeIds.add(groupNodeId)
    })
  })

  return Array.from(expandedNodeIds)
}

/** 현재 selection에서 노드 ID 목록만 추출한다. */
export function getSelectionNodeIds(selection: EditorSelection): string[] {
  if (!selection) {
    return []
  }

  if (selection.kind === 'node') {
    return [selection.id]
  }

  if (selection.kind === 'multi') {
    return selection.ids
  }

  return []
}

/** 영역 선택 사각형과 겹치는 노드를 찾는다. */
export function getMarqueeSelectedNodeIds(layout: EditorLayout, rect: RectBounds): string[] {
  return layout.nodes
    .filter((node) => rectsIntersect(rect, getNodeRect(node)))
    .map((node) => node.id)
}

/** drag 시작 시 각 노드의 원래 좌표를 보관한다. */
export function getOriginNodes(layout: EditorLayout, nodeIds: string[]): Record<string, Point> {
  const selectedNodeIds = new Set(nodeIds)

  return Object.fromEntries(
    layout.nodes
      .filter((candidate) => selectedNodeIds.has(candidate.id))
      .map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]),
  )
}

/** 복사/붙여넣기 시 기존 ID와 충돌하지 않는 새 ID를 만든다. */
function createUniqueLayoutId(existingIds: Set<string>, prefix: string) {
  const timestamp = Date.now()
  let index = 1
  let id = `${prefix}_${timestamp}_${index}`

  while (existingIds.has(id)) {
    index += 1
    id = `${prefix}_${timestamp}_${index}`
  }

  existingIds.add(id)
  return id
}

/** 복사본 이름이 기존 이름과 충돌하지 않도록 새 이름을 만든다. */
function createUniqueCopyName(name: string, existingNames: Set<string>) {
  const baseName = `${name} 복사`
  let nextName = baseName
  let index = 2

  while (existingNames.has(nextName)) {
    nextName = `${baseName} ${index}`
    index += 1
  }

  existingNames.add(nextName)
  return nextName
}

/** 현재 선택된 노드/링크를 붙여넣기 가능한 스냅샷으로 만든다. */
export function createCopiedEditorSelection(
  layout: EditorLayout,
  selection: EditorSelection,
): CopiedEditorSelection | null {
  const selectedNodeIds = getSelectionNodeIds(selection)
  if (selectedNodeIds.length === 0) {
    return null
  }

  const copiedNodeIds = new Set(getExpandedRelationGroupNodeIds(layout, selectedNodeIds))
  const nodes = layout.nodes.filter((node) => copiedNodeIds.has(node.id))
  if (nodes.length === 0) {
    return null
  }

  const links = layout.links.filter(
    (link) => copiedNodeIds.has(link.from.nodeId) && copiedNodeIds.has(link.to.nodeId),
  )

  return {
    nodes: structuredClone(nodes),
    links: structuredClone(links),
  }
}

/** 복사 스냅샷의 ID를 재생성하고 새 위치에 붙여넣는다. */
export function pasteCopiedEditorSelection(
  layout: EditorLayout,
  copiedSelection: CopiedEditorSelection,
): { layout: EditorLayout; selectedNodeIds: string[] } {
  const existingNodeIds = new Set(layout.nodes.map((node) => node.id))
  const existingLinkIds = new Set(layout.links.map((link) => link.id))
  const existingNames = new Set(layout.nodes.map((node) => node.name))
  const nodeIdMap = new Map<string, string>()
  const hasFixedYNode = copiedSelection.nodes.some((node) => isFixedYNode(node))
  const dx = 32
  const dy = hasFixedYNode ? 0 : 32

  const pastedNodes = copiedSelection.nodes.map((node) => {
    const nextId = createUniqueLayoutId(existingNodeIds, `${node.type}_copy`)
    nodeIdMap.set(node.id, nextId)

    return snapNodeToGround(
      normalizeNodePorts({
        ...node,
        id: nextId,
        swmmId: nextId,
        name: createUniqueCopyName(node.name, existingNames),
        x: node.x + dx,
        y: node.y + dy,
        ports: node.ports.map((port) => ({ ...port })),
        props: { ...node.props },
      }),
      layout.groundSurfaceY,
    )
  })

  const pastedLinks = copiedSelection.links.flatMap((link) => {
    const fromNodeId = nodeIdMap.get(link.from.nodeId)
    const toNodeId = nodeIdMap.get(link.to.nodeId)
    if (!fromNodeId || !toNodeId) {
      return []
    }

    const nextId = createUniqueLayoutId(existingLinkIds, 'link_copy')
    const pastedLink: EditorLink = {
      ...link,
      id: nextId,
      swmmId: nextId,
      from: {
        ...link.from,
        nodeId: fromNodeId,
      },
      to: {
        ...link.to,
        nodeId: toNodeId,
      },
      props: { ...link.props },
    }

    delete pastedLink.attach
    return [pastedLink]
  })

  return {
    layout: normalizeRelationAttachments({
      ...layout,
      nodes: [...layout.nodes, ...pastedNodes],
      links: [...layout.links, ...pastedLinks],
    }),
    selectedNodeIds: pastedNodes.map((node) => node.id),
  }
}
