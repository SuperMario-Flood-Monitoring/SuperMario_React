import { memo, useMemo } from 'react'
import {
  PIPE_BORDER,
  PIPE_THICKNESS,
  RELATION_ARROW_MIN_SIZE,
} from './editorDefinitions'
import { clampNumber } from './editorGeometry'
import { getPipePalette } from './editorNodeHelpers'
import type { EditorLink as EditorLinkModel, EditorNode } from './editorTypes'
import { createEditorLinkRenderItemFromNodes, type EditorLinkRenderItem } from './editorLinkRenderData'

/** SVG marker ID에 안전한 문자열로 변환한다. */
function getSvgSafeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

/** relation 화살표 marker의 고유 ID를 만든다. */
function getRelationMarkerId(link: EditorLinkModel, selected: boolean) {
  return `relation-arrow-${getSvgSafeId(link.id)}-${selected ? 'selected' : 'normal'}`
}

type EditableLinkShapeProps = EditorLinkRenderItem & {
  selected: boolean
  onSelect: (linkId: string) => void
}

/** 계산이 끝난 link/relation SVG path와 direction marker를 렌더링한다. */
const EditableLinkShape = memo(function EditableLinkShape({
  link,
  path,
  startX,
  startY,
  endX,
  endY,
  arrowSize,
  selected,
  onSelect,
}: EditableLinkShapeProps) {
  const thickness = PIPE_THICKNESS[link.size]
  const border = PIPE_BORDER[link.size]
  const labelX = (startX + endX) / 2
  const labelY = (startY + endY) / 2 - 12
  const palette = getPipePalette(link.props.pipeKind)
  const fill = palette.fill
  const edge = selected ? '#f97316' : palette.stroke

  if (link.type === 'relation') {
    const safeArrowSize = arrowSize ?? RELATION_ARROW_MIN_SIZE
    const arrowOffset = clampNumber(safeArrowSize * 0.75, 4, 8)
    const markerId = getRelationMarkerId(link, selected)
    const relationColor = selected ? '#f97316' : '#64748b'
    const relationStrokeWidth = selected ? 3.2 : 2.2

    return (
      <g onClick={(event) => {
        event.stopPropagation()
        onSelect(link.id)
      }}>
        <defs>
          <marker
            id={markerId}
            markerUnits="userSpaceOnUse"
            markerWidth={safeArrowSize + arrowOffset}
            markerHeight={safeArrowSize}
            refX={safeArrowSize + arrowOffset}
            refY={safeArrowSize / 2}
            orient="auto"
            viewBox={`0 0 ${safeArrowSize + arrowOffset} ${safeArrowSize}`}
          >
            <path
              d={`M0 0 L${safeArrowSize} ${safeArrowSize / 2} L0 ${safeArrowSize} Z`}
              fill={relationColor}
            />
          </marker>
        </defs>
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={path}
          fill="none"
          stroke={relationColor}
          strokeWidth={relationStrokeWidth}
          strokeDasharray={selected ? 'none' : '7 7'}
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd={`url(#${markerId})`}
          opacity={selected ? 0.95 : 0.7}
          pointerEvents="none"
        />
      </g>
    )
  }

  return (
    <g onClick={(event) => {
      event.stopPropagation()
      onSelect(link.id)
    }}>
      <path
        d={path}
        fill="none"
        stroke={edge}
        strokeWidth={thickness + border * 2}
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      <path
        d={path}
        fill="none"
        stroke={fill}
        strokeWidth={thickness}
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      <path
        d={path}
        fill="none"
        stroke={palette.center}
        strokeWidth="10"
        strokeDasharray="24 22"
        strokeLinecap="round"
      />
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        className="select-none text-[22px] font-black"
        fill="#0f172a"
        paintOrder="stroke"
        stroke="white"
        strokeWidth="6"
      >
        {link.name}
      </text>
    </g>
  )
})

/** endpoint 노드가 바뀐 링크만 path를 다시 계산하도록 링크 단위로 memoized boundary를 둔다. */
export const EditableLink = memo(function EditableLink({
  link,
  fromNode,
  toNode,
  selected,
  onSelect,
}: {
  link: EditorLinkModel
  fromNode: EditorNode | null
  toNode: EditorNode | null
  selected: boolean
  onSelect: (linkId: string) => void
}) {
  const renderItem = useMemo(
    () => createEditorLinkRenderItemFromNodes(link, fromNode, toNode),
    [fromNode, link, toNode],
  )

  if (!renderItem) {
    return null
  }

  return (
    <EditableLinkShape
      link={renderItem.link}
      path={renderItem.path}
      startX={renderItem.startX}
      startY={renderItem.startY}
      endX={renderItem.endX}
      endY={renderItem.endY}
      arrowSize={renderItem.arrowSize}
      selected={selected}
      onSelect={onSelect}
    />
  )
})
