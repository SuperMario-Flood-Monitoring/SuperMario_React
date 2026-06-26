import { getNodeRenderDepths } from './editorRelations'
import type { EditorLayout, EditorNode } from './editorTypes'

export type NodeZOrderAction = 'bringForward' | 'sendBackward' | 'bringToFront' | 'sendToBack'

/** 노드 타입별 기본 렌더링 레이어 우선순위를 반환한다. */
function getNodeLayerPriority(node: EditorNode) {
  if (node.type === 'terrain') {
    return -30
  }

  if (node.type === 'road') {
    return -20
  }

  return 0
}

/** 사용자가 지정한 z-order 값을 읽는다. */
function getNodeUserZOrder(node: EditorNode) {
  const zOrder = Number(node.props.zOrder ?? 0)
  return Number.isFinite(zOrder) ? zOrder : 0
}

/** terrain/road 같은 레이어, 사용자가 지정한 zOrder, relation depth 순서로 실제 렌더 순서를 정한다. */
export function createRenderedNodes(layout: EditorLayout) {
  const nodeIndex = new Map(layout.nodes.map((node, index) => [node.id, index]))
  const renderDepths = getNodeRenderDepths(layout)

  return [...layout.nodes].sort((first, second) => {
    const layerDelta = getNodeLayerPriority(first) - getNodeLayerPriority(second)
    if (layerDelta !== 0) {
      return layerDelta
    }

    const userZOrderDelta = getNodeUserZOrder(first) - getNodeUserZOrder(second)
    if (userZOrderDelta !== 0) {
      return userZOrderDelta
    }

    const depthDelta = (renderDepths.get(first.id) ?? 0) - (renderDepths.get(second.id) ?? 0)
    if (depthDelta !== 0) {
      return depthDelta
    }

    return (nodeIndex.get(first.id) ?? 0) - (nodeIndex.get(second.id) ?? 0)
  })
}

/** 앞/뒤로 보내기 액션에 사용할 다음 z-order 값을 계산한다. */
function getNextNodeZOrder(nodes: EditorNode[], action: NodeZOrderAction) {
  const zOrders = nodes.map(getNodeUserZOrder)
  const minZOrder = Math.min(0, ...zOrders)
  const maxZOrder = Math.max(0, ...zOrders)

  if (action === 'bringToFront' || action === 'bringForward') {
    return maxZOrder + 1
  }

  return minZOrder - 1
}

/** 선택 노드들의 사용자 z-order를 변경한다. */
export function reorderNodesByZOrder(nodes: EditorNode[], nodeIds: string[], action: NodeZOrderAction) {
  const targetIds = new Set(nodeIds)
  if (targetIds.size === 0) {
    return nodes
  }

  const nextZOrder = getNextNodeZOrder(nodes, action)
  const withUpdatedZOrder = nodes.map((node) => (
    targetIds.has(node.id)
      ? {
          ...node,
          props: {
            ...node.props,
            zOrder: nextZOrder,
          },
        }
      : node
  ))

  const nextNodes = [...nodes]

  if (action === 'bringToFront') {
    return [
      ...withUpdatedZOrder.filter((node) => !targetIds.has(node.id)),
      ...withUpdatedZOrder.filter((node) => targetIds.has(node.id)),
    ]
  }

  if (action === 'sendToBack') {
    return [
      ...withUpdatedZOrder.filter((node) => targetIds.has(node.id)),
      ...withUpdatedZOrder.filter((node) => !targetIds.has(node.id)),
    ]
  }

  nextNodes.splice(0, nextNodes.length, ...withUpdatedZOrder)

  if (action === 'bringForward') {
    for (let index = nextNodes.length - 2; index >= 0; index -= 1) {
      if (targetIds.has(nextNodes[index].id) && !targetIds.has(nextNodes[index + 1].id)) {
        const currentNode = nextNodes[index]
        nextNodes[index] = nextNodes[index + 1]
        nextNodes[index + 1] = currentNode
      }
    }
    return nextNodes
  }

  for (let index = 1; index < nextNodes.length; index += 1) {
    if (targetIds.has(nextNodes[index].id) && !targetIds.has(nextNodes[index - 1].id)) {
      const currentNode = nextNodes[index]
      nextNodes[index] = nextNodes[index - 1]
      nextNodes[index - 1] = currentNode
    }
  }

  return nextNodes
}
