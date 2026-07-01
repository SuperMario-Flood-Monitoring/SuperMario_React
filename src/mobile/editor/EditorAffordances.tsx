import { type PointerEvent as ReactPointerEvent } from 'react'
import { LAYOUT_ADD_HANDLE_SIZE, RESIZE_BORDER_HIT_SIZE } from './editorDefinitions'
import { clampNumber } from './editorGeometry'
import { getNodeOrientation } from './editorNodeHelpers'
import { getManualResizableEdges } from './editorNodeRenderData'
import type { LayoutAddSide, RectBounds, ResizeEdge } from './editorInternalTypes'
import type { EditorNode } from './editorTypes'

/** 지형 세그먼트 주변의 + 추가 핸들을 렌더링한다. */
export function LayoutAddHandles({
  bounds,
  onPointerDown,
}: {
  bounds: RectBounds
  onPointerDown: (side: LayoutAddSide, event: ReactPointerEvent<SVGGElement>) => void
}) {
  const size = LAYOUT_ADD_HANDLE_SIZE
  const radius = size / 2 - 2
  const inset = 12
  const edgeHitSize = 72
  const guideStroke = 'rgba(15, 23, 42, 0.5)'
  const width = Math.max(1, bounds.right - bounds.left)
  const height = Math.max(1, bounds.bottom - bounds.top)
  const centerX = bounds.left + width / 2
  const centerY = bounds.top + height / 2
  const handles: Array<{
    side: LayoutAddSide
    x: number
    y: number
    hitX: number
    hitY: number
    hitWidth: number
    hitHeight: number
    lineX1: number
    lineY1: number
    lineX2: number
    lineY2: number
  }> = [
    {
      side: 'left',
      x: bounds.left + inset,
      y: clampNumber(centerY - size / 2, bounds.top + inset, bounds.bottom - size - inset),
      hitX: bounds.left,
      hitY: bounds.top,
      hitWidth: Math.min(edgeHitSize, width),
      hitHeight: height,
      lineX1: bounds.left + inset,
      lineY1: bounds.top + inset,
      lineX2: bounds.left + inset,
      lineY2: bounds.bottom - inset,
    },
    {
      side: 'right',
      x: bounds.right - size - inset,
      y: clampNumber(centerY - size / 2, bounds.top + inset, bounds.bottom - size - inset),
      hitX: bounds.right - Math.min(edgeHitSize, width),
      hitY: bounds.top,
      hitWidth: Math.min(edgeHitSize, width),
      hitHeight: height,
      lineX1: bounds.right - inset,
      lineY1: bounds.top + inset,
      lineX2: bounds.right - inset,
      lineY2: bounds.bottom - inset,
    },
    {
      side: 'bottom',
      x: clampNumber(centerX - size / 2, bounds.left + inset, bounds.right - size - inset),
      y: bounds.bottom - size - inset,
      hitX: bounds.left,
      hitY: bounds.bottom - Math.min(edgeHitSize, height),
      hitWidth: width,
      hitHeight: Math.min(edgeHitSize, height),
      lineX1: bounds.left + inset,
      lineY1: bounds.bottom - inset,
      lineX2: bounds.right - inset,
      lineY2: bounds.bottom - inset,
    },
  ]

  return (
    <g>
      {handles.map((handle) => (
        <g
          key={handle.side}
          className="group cursor-copy"
          onPointerDown={(event) => onPointerDown(handle.side, event)}
        >
          <rect
            x={handle.hitX}
            y={handle.hitY}
            width={handle.hitWidth}
            height={handle.hitHeight}
            fill="transparent"
            pointerEvents="all"
          />
          <line
            x1={handle.lineX1}
            y1={handle.lineY1}
            x2={handle.lineX2}
            y2={handle.lineY2}
            stroke={guideStroke}
            strokeWidth="4"
            strokeLinecap="round"
            className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            pointerEvents="none"
          />
          <circle
            cx={handle.x + size / 2}
            cy={handle.y + size / 2}
            r={radius}
            fill="rgba(248, 250, 252, 0.92)"
            stroke={guideStroke}
            strokeWidth="2.5"
            className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            pointerEvents="none"
          />
          <text
            x={handle.x + size / 2}
            y={handle.y + size / 2 + 1}
            textAnchor="middle"
            dominantBaseline="central"
            className="select-none text-[20px] font-black opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            fill="rgba(15, 23, 42, 0.76)"
            pointerEvents="none"
          >
            +
          </text>
        </g>
      ))}
    </g>
  )
}

/** 모바일에서 hover 대신 항상 보이는 지형 추가 edge 버튼을 렌더링한다. */
export function MobileLayoutAddEdgeButtons({
  bounds,
  onPointerDown,
}: {
  bounds: RectBounds
  onPointerDown: (side: LayoutAddSide, event: ReactPointerEvent<SVGGElement>) => void
}) {
  const width = Math.max(0, bounds.right - bounds.left)
  const height = Math.max(0, bounds.bottom - bounds.top)

  if (width < 120 || height < 120) {
    return null
  }

  const stripSize = Math.min(88, Math.max(56, Math.min(width, height) * 0.18))
  const buttonLength = Math.min(260, Math.max(170, Math.min(width, height) * 0.46))
  const centerX = bounds.left + width / 2
  const centerY = bounds.top + height / 2
  const sideButtons: Array<{
    side: LayoutAddSide
    x: number
    y: number
    width: number
    height: number
    labelX: number
    labelY: number
    rotate?: number
  }> = [
    {
      side: 'left',
      x: bounds.left,
      y: centerY - buttonLength / 2,
      width: stripSize,
      height: buttonLength,
      labelX: bounds.left + stripSize / 2,
      labelY: centerY,
      rotate: -90,
    },
    {
      side: 'right',
      x: bounds.right - stripSize,
      y: centerY - buttonLength / 2,
      width: stripSize,
      height: buttonLength,
      labelX: bounds.right - stripSize / 2,
      labelY: centerY,
      rotate: 90,
    },
    {
      side: 'bottom',
      x: centerX - buttonLength / 2,
      y: bounds.bottom - stripSize,
      width: buttonLength,
      height: stripSize,
      labelX: centerX,
      labelY: bounds.bottom - stripSize / 2,
    },
  ]

  return (
    <g>
      {sideButtons.map((button) => (
        <g
          key={button.side}
          className="cursor-copy"
          onPointerDown={(event) => onPointerDown(button.side, event)}
        >
          <rect
            x={button.x}
            y={button.y}
            width={button.width}
            height={button.height}
            rx="14"
            fill="rgba(15, 23, 42, 0.72)"
            stroke="rgba(248, 250, 252, 0.92)"
            strokeWidth="2.5"
            pointerEvents="all"
          />
          <text
            x={button.labelX}
            y={button.labelY}
            textAnchor="middle"
            dominantBaseline="central"
            transform={button.rotate ? `rotate(${button.rotate} ${button.labelX} ${button.labelY})` : undefined}
            className="select-none text-[22px] font-black"
            fill="white"
            pointerEvents="none"
          >
            + 레이아웃
          </text>
        </g>
      ))}
    </g>
  )
}

/** resize 가능한 edge의 보이지 않는 hit 영역과 hover 표시를 렌더링한다. */
function ResizeHandleRect({
  node,
  edge,
  x,
  y,
  width,
  height,
  cursorClassName,
  onResizePointerDown,
}: {
  node: EditorNode
  edge: ResizeEdge
  x: number
  y: number
  width: number
  height: number
  cursorClassName: string
  onResizePointerDown: (node: EditorNode, edge: ResizeEdge, event: ReactPointerEvent<SVGRectElement>) => void
}) {
  if (width <= 0 || height <= 0) {
    return null
  }

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="rgba(37, 99, 235, 0.22)"
      pointerEvents="all"
      className={`${cursorClassName} opacity-0 transition-opacity hover:opacity-100`}
      onPointerDown={(event) => onResizePointerDown(node, edge, event)}
    />
  )
}

/** 파이프/맨홀/지형/도로의 수동 resize handle을 렌더링한다. */
export function PipeResizeHandles({
  node,
  resizeEdges,
  onResizePointerDown,
}: {
  node: EditorNode
  resizeEdges?: Record<ResizeEdge, boolean>
  onResizePointerDown: (node: EditorNode, edge: ResizeEdge, event: ReactPointerEvent<SVGRectElement>) => void
}) {
  const hitSize = RESIZE_BORDER_HIT_SIZE
  const edges = resizeEdges ?? getManualResizableEdges(node)

  if (node.type === 'pipeSegment') {
    const isHorizontal = getNodeOrientation(node) === 'horizontal'

    if (isHorizontal) {
      const halfWidth = Math.max(1, node.width / 2)

      return (
        <>
          {edges.left ? (
            <>
              <ResizeHandleRect
                node={node}
                edge="left"
                x={-hitSize / 2}
                y={0}
                width={hitSize}
                height={node.height}
                cursorClassName="cursor-ew-resize"
                onResizePointerDown={onResizePointerDown}
              />
              <ResizeHandleRect
                node={node}
                edge="left"
                x={0}
                y={-hitSize / 2}
                width={halfWidth}
                height={hitSize}
                cursorClassName="cursor-ew-resize"
                onResizePointerDown={onResizePointerDown}
              />
              <ResizeHandleRect
                node={node}
                edge="left"
                x={0}
                y={node.height - hitSize / 2}
                width={halfWidth}
                height={hitSize}
                cursorClassName="cursor-ew-resize"
                onResizePointerDown={onResizePointerDown}
              />
            </>
          ) : null}
          {edges.right ? (
            <>
              <ResizeHandleRect
                node={node}
                edge="right"
                x={node.width - hitSize / 2}
                y={0}
                width={hitSize}
                height={node.height}
                cursorClassName="cursor-ew-resize"
                onResizePointerDown={onResizePointerDown}
              />
              <ResizeHandleRect
                node={node}
                edge="right"
                x={halfWidth}
                y={-hitSize / 2}
                width={halfWidth}
                height={hitSize}
                cursorClassName="cursor-ew-resize"
                onResizePointerDown={onResizePointerDown}
              />
              <ResizeHandleRect
                node={node}
                edge="right"
                x={halfWidth}
                y={node.height - hitSize / 2}
                width={halfWidth}
                height={hitSize}
                cursorClassName="cursor-ew-resize"
                onResizePointerDown={onResizePointerDown}
              />
            </>
          ) : null}
        </>
      )
    }

    const halfHeight = Math.max(1, node.height / 2)

    return (
      <>
        {edges.top ? (
          <>
            <ResizeHandleRect
              node={node}
              edge="top"
              x={0}
              y={-hitSize / 2}
              width={node.width}
              height={hitSize}
              cursorClassName="cursor-ns-resize"
              onResizePointerDown={onResizePointerDown}
            />
            <ResizeHandleRect
              node={node}
              edge="top"
              x={-hitSize / 2}
              y={0}
              width={hitSize}
              height={halfHeight}
              cursorClassName="cursor-ns-resize"
              onResizePointerDown={onResizePointerDown}
            />
            <ResizeHandleRect
              node={node}
              edge="top"
              x={node.width - hitSize / 2}
              y={0}
              width={hitSize}
              height={halfHeight}
              cursorClassName="cursor-ns-resize"
              onResizePointerDown={onResizePointerDown}
            />
          </>
        ) : null}
        {edges.bottom ? (
          <>
            <ResizeHandleRect
              node={node}
              edge="bottom"
              x={0}
              y={node.height - hitSize / 2}
              width={node.width}
              height={hitSize}
              cursorClassName="cursor-ns-resize"
              onResizePointerDown={onResizePointerDown}
            />
            <ResizeHandleRect
              node={node}
              edge="bottom"
              x={-hitSize / 2}
              y={halfHeight}
              width={hitSize}
              height={halfHeight}
              cursorClassName="cursor-ns-resize"
              onResizePointerDown={onResizePointerDown}
            />
            <ResizeHandleRect
              node={node}
              edge="bottom"
              x={node.width - hitSize / 2}
              y={halfHeight}
              width={hitSize}
              height={halfHeight}
              cursorClassName="cursor-ns-resize"
              onResizePointerDown={onResizePointerDown}
            />
          </>
        ) : null}
      </>
    )
  }

  return (
    <>
      {edges.left ? (
        <ResizeHandleRect
          node={node}
          edge="left"
          x={-hitSize / 2}
          y={0}
          width={hitSize}
          height={node.height}
          cursorClassName="cursor-ew-resize"
          onResizePointerDown={onResizePointerDown}
        />
      ) : null}
      {edges.right ? (
        <ResizeHandleRect
          node={node}
          edge="right"
          x={node.width - hitSize / 2}
          y={0}
          width={hitSize}
          height={node.height}
          cursorClassName="cursor-ew-resize"
          onResizePointerDown={onResizePointerDown}
        />
      ) : null}
      {edges.top ? (
        <ResizeHandleRect
          node={node}
          edge="top"
          x={0}
          y={-hitSize / 2}
          width={node.width}
          height={hitSize}
          cursorClassName="cursor-ns-resize"
          onResizePointerDown={onResizePointerDown}
        />
      ) : null}
      {edges.bottom ? (
        <ResizeHandleRect
          node={node}
          edge="bottom"
          x={0}
          y={node.height - hitSize / 2}
          width={node.width}
          height={hitSize}
          cursorClassName="cursor-ns-resize"
          onResizePointerDown={onResizePointerDown}
        />
      ) : null}
    </>
  )
}
