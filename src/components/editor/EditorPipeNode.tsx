import { memo } from 'react'
import {
  PIPE_BORDER,
  PIPE_COLORS,
  PIPE_FLOW_ARROW_EDGE_PADDING,
  PIPE_FLOW_ARROW_MAX_COUNT,
  PIPE_FLOW_ARROW_SPACING,
} from './editorDefinitions'
import { clampNumber } from './editorGeometry'
import {
  getNodeOrientation,
  getNodePipeSize,
  getPipePalette,
  getPipeSegmentRotation,
} from './editorNodeHelpers'
import type { EditorNode } from './editorTypes'

/** 파이프 끝의 커넥터 캡 모양을 렌더링한다. */
export const ConnectorCap = memo(function ConnectorCap({
  x,
  y,
  width,
  height,
  selected,
  orientation,
  palette = PIPE_COLORS.default,
}: {
  x: number
  y: number
  width: number
  height: number
  selected: boolean
  orientation: 'horizontal' | 'vertical'
  palette?: { fill: string; stroke: string }
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="0"
        fill={palette.fill}
        stroke={selected ? '#f97316' : palette.stroke}
        strokeWidth={selected ? 5 : 4}
      />
      {[1, 2, 3].map((index) => {
        const ratio = index / 4

        if (orientation === 'horizontal') {
          const lineX = x + width * ratio
          return (
            <line
              key={index}
              x1={lineX}
              y1={y + 6}
              x2={lineX}
              y2={y + height - 6}
              stroke="#f8fafc"
              strokeWidth="4"
              strokeLinecap="butt"
            />
          )
        }

        const lineY = y + height * ratio
        return (
          <line
            key={index}
            x1={x + 6}
            y1={lineY}
            x2={x + width - 6}
            y2={lineY}
            stroke="#f8fafc"
            strokeWidth="4"
            strokeLinecap="butt"
          />
        )
      })}
    </>
  )
})

/** 파이프 내부 흐름 방향 화살표를 렌더링한다. */
function PipeFlowArrows({ node, palette }: { node: EditorNode; palette: ReturnType<typeof getPipePalette> }) {
  const size = getNodePipeSize(node)
  const innerInset = PIPE_BORDER[size]
  const orientation = getNodeOrientation(node)
  const rotation = getPipeSegmentRotation(node)
  const axisLength = orientation === 'horizontal' ? node.width : node.height
  const usableLength = Math.max(0, axisLength - innerInset * 2 - PIPE_FLOW_ARROW_EDGE_PADDING * 2)
  const arrowCount = Math.round(clampNumber(
    Math.floor(usableLength / PIPE_FLOW_ARROW_SPACING) + 1,
    1,
    PIPE_FLOW_ARROW_MAX_COUNT,
  ))
  const strokeWidth = size === 'small' ? 3.25 : size === 'medium' ? 4 : 4.75

  return (
    <g pointerEvents="none" opacity="0.9">
      {Array.from({ length: arrowCount }, (_, index) => {
        const ratio = (index + 1) / (arrowCount + 1)
        const offset = innerInset + PIPE_FLOW_ARROW_EDGE_PADDING + usableLength * ratio
        const x = orientation === 'horizontal' ? offset : node.width / 2
        const y = orientation === 'horizontal' ? node.height / 2 : offset

        return (
          <path
            key={`pipe-flow-arrow-${index}`}
            d="M-11 -8 L0 0 L-11 8"
            transform={`translate(${x} ${y}) rotate(${rotation})`}
            fill="none"
            stroke={palette.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      })}
    </g>
  )
}

function getPipeLabelWidth(name: string) {
  return clampNumber(name.length * 18 + 36, 92, 320)
}

function PipeNameLabel({ node, selected }: { node: EditorNode; selected: boolean }) {
  const orientation = getNodeOrientation(node)
  const labelWidth = getPipeLabelWidth(node.name)
  const labelHeight = 34
  const labelX = orientation === 'horizontal'
    ? node.width / 2 - labelWidth / 2
    : node.width + 12
  const labelY = orientation === 'horizontal'
    ? -labelHeight - 8
    : node.height / 2 - labelHeight / 2

  return (
    <g pointerEvents="none" transform={`translate(${labelX} ${labelY})`}>
      <rect
        x="0"
        y="0"
        width={labelWidth}
        height={labelHeight}
        rx="8"
        fill="rgba(255,255,255,.92)"
        stroke={selected ? '#ef4444' : 'rgba(15,23,42,.18)'}
        strokeWidth={selected ? 3 : 1.5}
      />
      <text
        x={labelWidth / 2}
        y="23"
        textAnchor="middle"
        className="select-none text-[19px] font-black"
        fill="#0f172a"
      >
        {node.name}
      </text>
    </g>
  )
}

/** 파이프 세그먼트 본체와 흐름 표시를 렌더링한다. */
export const PipeSegmentNode = memo(function PipeSegmentNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const size = getNodePipeSize(node)
  const palette = getPipePalette(node.props.pipeKind)
  const innerInset = PIPE_BORDER[size]

  return (
    <>
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        rx="0"
        fill={palette.fill}
        stroke={selected ? '#f97316' : palette.stroke}
        strokeWidth={selected ? 5 : PIPE_BORDER[size]}
      />
      <rect
        x={innerInset}
        y={innerInset}
        width={Math.max(0, node.width - innerInset * 2)}
        height={Math.max(0, node.height - innerInset * 2)}
        fill={palette.water}
        opacity="0.24"
      />
      <PipeFlowArrows node={node} palette={palette} />
      <PipeNameLabel node={node} selected={selected} />
    </>
  )
})
