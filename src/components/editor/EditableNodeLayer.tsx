import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { EditableNode } from './EditableNode'
import type { Point, RelationPortRole, ResizeEdge } from './editorInternalTypes'
import type { RenderedPortRelationLookup } from './editorNodeRenderData'
import type { EditorNode, EditorPort, EditorPortSelection } from './editorTypes'

const EMPTY_RENDERED_PORT_RELATION_LOOKUP: RenderedPortRelationLookup = new Map()

type EditableNodeLayerProps = {
  nodes: EditorNode[]
  selectedNodeIds: Set<string>
  renderedPortRelationLookupByNodeId: Map<string, RenderedPortRelationLookup>
  connectedPortKeys: Set<string>
  selectedRelationPortRoles: Map<string, RelationPortRole>
  selectedParentPortKeys: Set<string>
  pendingPort: EditorPortSelection | null
  attachTargetNodeId: string | null
  coordinateEditActive: boolean
  getRenderablePorts: (
    node: EditorNode,
    pendingPort: EditorPortSelection | null,
    includeAttachCandidatePorts: boolean,
    connectedPortKeys: Set<string>,
    selectedRelationPortRoles: Map<string, RelationPortRole>,
  ) => EditorPort[]
  getRenderedPortPoint: (node: EditorNode, port: EditorPort, relationLookup: RenderedPortRelationLookup) => Point
  hasManualResizableEdge: (node: EditorNode) => boolean
  renderResizeHandles: (
    node: EditorNode,
    onResizePointerDown: (node: EditorNode, edge: ResizeEdge, event: ReactPointerEvent<SVGRectElement>) => void,
  ) => ReactNode
  onPointerDown: (node: EditorNode, event: ReactPointerEvent<SVGGElement>) => void
  onPointerEnter: (node: EditorNode) => void
  onNodeContextMenu: (node: EditorNode, event: ReactMouseEvent<SVGGElement>) => void
  onPortClick: (nodeId: string, portId: string, event: ReactMouseEvent<SVGElement>) => void
  onPortContextMenu: (nodeId: string, portId: string, event: ReactMouseEvent<SVGElement>) => void
  onResizePointerDown: (node: EditorNode, edge: ResizeEdge, event: ReactPointerEvent<SVGRectElement>) => void
}

export function EditableNodeLayer({
  nodes,
  selectedNodeIds,
  renderedPortRelationLookupByNodeId,
  connectedPortKeys,
  selectedRelationPortRoles,
  selectedParentPortKeys,
  pendingPort,
  attachTargetNodeId,
  coordinateEditActive,
  getRenderablePorts,
  getRenderedPortPoint,
  hasManualResizableEdge,
  renderResizeHandles,
  onPointerDown,
  onPointerEnter,
  onNodeContextMenu,
  onPortClick,
  onPortContextMenu,
  onResizePointerDown,
}: EditableNodeLayerProps) {
  return (
    <g>
      {nodes.map((node) => (
        <EditableNode
          key={node.id}
          node={node}
          renderedPortRelationLookup={
            renderedPortRelationLookupByNodeId.get(node.id) ?? EMPTY_RENDERED_PORT_RELATION_LOOKUP
          }
          connectedPortKeys={connectedPortKeys}
          selectedRelationPortRoles={selectedRelationPortRoles}
          selectedParentPortKeys={selectedParentPortKeys}
          pendingPort={pendingPort}
          attachTargetNodeId={attachTargetNodeId}
          coordinateEditActive={coordinateEditActive}
          selected={selectedNodeIds.has(node.id)}
          getRenderablePorts={getRenderablePorts}
          getRenderedPortPoint={getRenderedPortPoint}
          hasManualResizableEdge={hasManualResizableEdge}
          renderResizeHandles={renderResizeHandles}
          onPointerDown={onPointerDown}
          onPointerEnter={onPointerEnter}
          onNodeContextMenu={onNodeContextMenu}
          onPortClick={onPortClick}
          onPortContextMenu={onPortContextMenu}
          onResizePointerDown={onResizePointerDown}
        />
      ))}
    </g>
  )
}
