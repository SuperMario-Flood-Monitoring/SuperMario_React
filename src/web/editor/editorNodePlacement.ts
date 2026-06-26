import { FIXED_NODE_Y_BY_TYPE } from './editorDefinitions'
import { SURFACE_NODE_TYPES, type EditorNode } from './editorTypes'

/** 지상/고정 y 객체가 기준 지면에 붙도록 y 좌표를 보정한다. */
export function snapNodeToGround(node: EditorNode, groundSurfaceY: number): EditorNode {
  const fixedY = FIXED_NODE_Y_BY_TYPE[node.type]
  if (fixedY !== undefined) {
    return {
      ...node,
      y: fixedY,
    }
  }

  if (!SURFACE_NODE_TYPES.has(node.type)) {
    return node
  }

  return {
    ...node,
    y: groundSurfaceY - node.height,
  }
}
