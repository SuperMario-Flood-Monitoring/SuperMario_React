import { memo, type ReactNode } from 'react'
import { FACILITY_KIND_DEFINITIONS, ROAD_DASH_SPACING } from './editorDefinitions'
import {
  getElbowConnectorGeometry,
  getNodeFacilityDefinition,
  getNodeManholeDefinition,
  getNodeOutfallDefinition,
  getNodeTerrainDefinition,
  getPipePalette,
  getTeeConnectorGeometry,
} from './editorNodeHelpers'
import { clampNumber } from './editorGeometry'
import { ConnectorCap, PipeSegmentNode } from './EditorPipeNode'
import type { EditorNode } from './editorTypes'

/** 노드 타입에 맞는 실제 SVG 본체 컴포넌트를 선택한다. */
export const NodeBody = memo(function NodeBody({ node, selected }: { node: EditorNode; selected: boolean }) {
  let body: ReactNode

  if (node.type === 'terrain') {
    body = <TerrainNode node={node} selected={selected} />
  } else if (node.type === 'road') {
    body = <RoadNode node={node} selected={selected} />
  } else if (node.type === 'apartment') {
    body = <ApartmentNode node={node} selected={selected} />
  } else if (node.type === 'house') {
    body = <HouseNode node={node} selected={selected} />
  } else if (node.type === 'catchBasin') {
    body = <CatchBasinNode node={node} selected={selected} />
  } else if (node.type === 'manhole') {
    body = <ManholeNode node={node} selected={selected} />
  } else if (node.type === 'connector') {
    body = <ConnectorNode node={node} selected={selected} />
  } else if (node.type === 'elbowConnector') {
    body = <ElbowConnectorNode node={node} selected={selected} />
  } else if (node.type === 'teeConnector') {
    body = <TeeConnectorNode node={node} selected={selected} />
  } else if (node.type === 'pipeSegment') {
    body = <PipeSegmentNode node={node} selected={selected} />
  } else {
    body = <FacilityNode node={node} selected={selected} />
  }

  return (
    <>
      <EditorSelectionOutline node={node} selected={selected} />
      {body}
    </>
  )
})

interface EditorLocalVisualBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function getEditorObjectVisualBounds(node: EditorNode): EditorLocalVisualBounds {
  if (node.type === 'catchBasin') {
    const grateStrokePadding = 3 / 2
    return {
      minX: 0,
      minY: -16 - grateStrokePadding,
      maxX: node.width,
      maxY: node.height,
    }
  }

  if (node.type === 'house') {
    const roofStrokePadding = 3 / 2
    return {
      minX: 6 - roofStrokePadding,
      minY: -36 - roofStrokePadding,
      maxX: node.width - 6 + roofStrokePadding,
      maxY: node.height,
    }
  }

  if (node.type === 'manhole') {
    const lidRadius = Math.min(node.width * 0.9, 84) / 2
    const lidStrokePadding = 7 / 2
    return {
      minX: node.width / 2 - lidRadius - lidStrokePadding,
      minY: -lidRadius - lidStrokePadding,
      maxX: node.width / 2 + lidRadius + lidStrokePadding,
      maxY: node.height,
    }
  }

  return {
    minX: 0,
    minY: 0,
    maxX: node.width,
    maxY: node.height,
  }
}

function createEditorOutlineRect(node: EditorNode, padding: number) {
  const bounds = getEditorObjectVisualBounds(node)
  return {
    x: bounds.minX - padding,
    y: bounds.minY - padding,
    width: bounds.maxX - bounds.minX + padding * 2,
    height: bounds.maxY - bounds.minY + padding * 2,
  }
}

function EditorSelectionOutline({ node, selected }: { node: EditorNode; selected: boolean }) {
  if (!selected) {
    return null
  }

  const glowRect = createEditorOutlineRect(node, 10)
  const strokeRect = createEditorOutlineRect(node, 5)

  return (
    <g pointerEvents="none">
      <rect
        x={glowRect.x}
        y={glowRect.y}
        width={glowRect.width}
        height={glowRect.height}
        rx="14"
        fill="none"
        stroke="#fb923c"
        strokeWidth="10"
        opacity="0.28"
      />
      <rect
        x={strokeRect.x}
        y={strokeRect.y}
        width={strokeRect.width}
        height={strokeRect.height}
        rx="10"
        fill="none"
        stroke="#ea580c"
        strokeWidth="4"
        opacity="0.94"
      />
    </g>
  )
}

/** 공통 노드 프레임과 선택 테두리를 렌더링한다. */
function NodeFrame({
  node,
  selected,
  fill,
  stroke = '#334155',
  children,
}: {
  node: EditorNode
  selected: boolean
  fill: string
  stroke?: string
  children?: ReactNode
}) {
  return (
    <>
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        rx="8"
        fill={fill}
        stroke={selected ? '#f97316' : stroke}
        strokeWidth={selected ? 5 : 3}
      />
      {children}
      <text
        x={node.width / 2}
        y={node.height / 2 + 8}
        textAnchor="middle"
        className="select-none text-[22px] font-black"
        fill="#0f172a"
        paintOrder="stroke"
        stroke="white"
        strokeWidth="6"
      >
        {node.name}
      </text>
    </>
  )
}

function getEditorObjectLabelWidth(name: string) {
  const weightedLength = Array.from(name).reduce((sum, char) => {
    if (/[가-힣]/.test(char)) {
      return sum + 1.08
    }

    if (char === ' ') {
      return sum + 0.35
    }

    return sum + 0.72
  }, 0)

  return clampNumber(weightedLength * 14 + 18, 56, 280)
}

function FacilityNameLabel({
  node,
  selected,
  fill,
  stroke,
}: {
  node: EditorNode
  selected: boolean
  fill: string
  stroke: string
}) {
  const labelWidth = getEditorObjectLabelWidth(node.name)
  const labelHeight = 26
  const activeStroke = selected ? '#f97316' : stroke

  return (
    <g
      pointerEvents="none"
      transform={`translate(${node.width / 2 - labelWidth / 2} ${node.height + 8})`}
    >
      <rect
        width={labelWidth}
        height={labelHeight}
        rx="7"
        fill={fill}
        stroke={activeStroke}
        strokeWidth={selected ? 2.5 : 1.75}
        opacity="0.96"
      />
      <rect
        x="4"
        y="4"
        width={Math.max(0, labelWidth - 8)}
        height={labelHeight - 8}
        rx="5"
        fill="rgba(255,255,255,.38)"
      />
      <text
        x={labelWidth / 2}
        y="18"
        textAnchor="middle"
        className="select-none text-[15px] font-black"
        fill="#0f172a"
      >
        {node.name}
      </text>
    </g>
  )
}

/** 아파트 시설 노드를 렌더링한다. */
function ApartmentNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  return (
    <NodeFrame node={node} selected={selected} fill="#d9ecfb">
      {Array.from({ length: 9 }, (_, index) => {
        const col = index % 3
        const row = Math.floor(index / 3)
        return (
          <rect
            key={index}
            x={28 + col * 40}
            y={28 + row * 38}
            width="22"
            height="24"
            fill="#fff8dc"
            stroke="#60a5fa"
            strokeWidth="2"
          />
        )
      })}
      <rect x={node.width / 2 - 14} y={node.height - 34} width="28" height="34" fill="#9a6a34" />
    </NodeFrame>
  )
}

/** 주거지 시설 노드를 렌더링한다. */
function HouseNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const stroke = selected ? '#f97316' : '#334155'
  const bodyX = 6
  const bodyY = 18
  const bodyWidth = node.width - bodyX * 2
  const bodyHeight = node.height - bodyY
  const roofBaseY = bodyY
  const roofPeakY = -36
  const windowY = bodyY + 28
  const labelY = bodyY + 66

  return (
    <>
      <path
        d={`M${node.width / 2} ${roofPeakY} L${node.width - 12} ${roofBaseY} H12 Z`}
        fill="#f97316"
        stroke={stroke}
        strokeWidth={selected ? 4 : 3}
        strokeLinejoin="round"
      />
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyWidth}
        height={bodyHeight}
        rx="8"
        fill="#fff3d6"
        stroke={stroke}
        strokeWidth={selected ? 4 : 3}
      />
      <rect
        x={bodyX + 10}
        y={roofBaseY - 5}
        width={bodyWidth - 20}
        height="8"
        rx="4"
        fill="#9a3412"
      />
      <rect x="26" y={windowY} width="23" height="25" fill="#d9ecfb" stroke="#60a5fa" strokeWidth="2" />
      <rect x={node.width - 49} y={windowY} width="23" height="25" fill="#d9ecfb" stroke="#60a5fa" strokeWidth="2" />
      <rect
        x={node.width / 2 - 15}
        y={node.height - 40}
        width="30"
        height="40"
        fill="#9a6a34"
        stroke="#6b4423"
        strokeWidth="2"
      />
      <text
        x={node.width / 2}
        y={labelY}
        textAnchor="middle"
        className="select-none text-[20px] font-black"
        fill="#0f172a"
        paintOrder="stroke"
        stroke="white"
        strokeWidth="5"
      >
        {node.name}
      </text>
    </>
  )
}

/** 빗물받이 노드를 렌더링한다. */
function CatchBasinNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  return (
    <>
      <rect
        x="10"
        y="-16"
        width={node.width - 20}
        height="26"
        rx="3"
        fill="#475569"
        stroke={selected ? '#f97316' : '#1e293b'}
        strokeWidth="3"
      />
      {Array.from({ length: 6 }, (_, index) => (
        <line
          key={index}
          x1={28 + index * 22}
          y1="-15"
          x2={28 + index * 22}
          y2="10"
          stroke="#cbd5e1"
          strokeWidth="4"
        />
      ))}
      <NodeFrame node={node} selected={selected} fill="#111827" stroke="#020617">
        <line x1="34" y1="34" x2={node.width - 34} y2="34" stroke="#334155" strokeWidth="3" />
        <line x1="34" y1={node.height - 34} x2={node.width - 34} y2={node.height - 34} stroke="#334155" strokeWidth="3" />
      </NodeFrame>
    </>
  )
}

/** 맨홀 노드를 렌더링한다. */
function ManholeNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const definition = getNodeManholeDefinition(node)
  const palette = getPipePalette(definition.waterKind)
  const lidDiameter = Math.min(node.width * 0.9, 84)
  const lidX = node.width / 2
  const lidY = 0

  return (
    <>
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        rx="10"
        fill={definition.fill}
        stroke={selected ? '#f97316' : definition.stroke}
        strokeWidth={selected ? 5 : 4}
      />
      <rect
        x="10"
        y={node.height * 0.48}
        width={node.width - 20}
        height={node.height * 0.42}
        fill={palette.water}
      />
      <path
        d={`M10 ${node.height * 0.48} C22 ${node.height * 0.42} 34 ${node.height * 0.54} 46 ${
          node.height * 0.48
        } S70 ${node.height * 0.42} ${node.width - 10} ${node.height * 0.48}`}
        fill="none"
        stroke="rgba(255,255,255,.75)"
        strokeWidth="8"
      />
      <circle cx={lidX} cy={lidY} r={lidDiameter / 2} fill={palette.fill} stroke={definition.stroke} strokeWidth="7" />
      <circle cx={lidX} cy={lidY} r={lidDiameter / 2 - 14} fill={palette.stroke} stroke="#172554" strokeWidth="5" />
      {[-12, 0, 12].map((offset) => (
        <line
          key={offset}
          x1={lidX - 20}
          y1={lidY + offset}
          x2={lidX + 20}
          y2={lidY + offset}
          stroke="rgba(255,255,255,.68)"
          strokeWidth="6"
          strokeLinecap="round"
        />
      ))}
      <text
        x={node.width / 2}
        y={node.height / 2}
        textAnchor="middle"
        className="select-none text-[24px] font-black"
        fill="#334155"
        paintOrder="stroke"
        stroke="white"
        strokeWidth="6"
      >
        {node.name}
      </text>
    </>
  )
}

/** 땅/하천/바다 지형 세그먼트를 렌더링한다. */
function TerrainNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const definition = getNodeTerrainDefinition(node)
  const columns = Math.ceil(node.width / 260)
  const rows = Math.ceil(node.height / 44)
  const showLabel = node.width >= 160 && node.height >= 100

  return (
    <>
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        fill={definition.fill}
        stroke={selected ? '#f97316' : definition.stroke}
        strokeWidth={selected ? 5 : 3}
      />
      {Array.from({ length: columns * rows }, (_, index) => {
        const column = index % columns
        const row = Math.floor(index / columns)
        const start = column * 260
        const baseY = 22 + row * 44

        return (
          <path
            key={index}
            d={`M${start} ${baseY} C${start + 36} ${baseY - 14} ${
              start + 76
            } ${baseY + 14} ${start + 116} ${baseY} S${
              start + 204
            } ${baseY - 14} ${start + 260} ${baseY}`}
            fill="none"
            stroke={definition.waveStroke}
            strokeWidth="3"
          />
        )
      })}
      {showLabel ? (
        <text
          x={node.width / 2}
          y={node.height / 2 + 6}
          textAnchor="middle"
          className="select-none text-[22px] font-black"
          fill="#0f172a"
          paintOrder="stroke"
          stroke="white"
          strokeWidth="6"
        >
          {node.name}
        </text>
      ) : null}
    </>
  )
}

/** 도로 노드를 렌더링한다. */
function RoadNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const dashCount = Math.max(3, Math.floor((node.width - 80) / ROAD_DASH_SPACING))
  const dashSpacing = node.width / (dashCount + 1)

  return (
    <>
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        fill="#111827"
        stroke={selected ? '#f97316' : '#253244'}
        strokeWidth={selected ? 5 : 4}
      />
      {[0.18, 0.5, 0.82].map((ratio) => (
        <line
          key={ratio}
          x1="32"
          y1={node.height * ratio}
          x2={node.width - 32}
          y2={node.height * ratio}
          stroke="#273548"
          strokeWidth="3"
        />
      ))}
      {Array.from({ length: dashCount }, (_, index) => (
        <line
          key={index}
          x1={(index + 1) * dashSpacing - 16}
          y1={node.height / 2}
          x2={(index + 1) * dashSpacing + 16}
          y2={node.height / 2}
          stroke="#facc15"
          strokeWidth="4"
          strokeLinecap="butt"
        />
      ))}
      <text
        x={node.width / 2}
        y={node.height / 2 + 8}
        textAnchor="middle"
        className="select-none text-[22px] font-black"
        fill="#f8fafc"
        paintOrder="stroke"
        stroke="#0f172a"
        strokeWidth="6"
      >
        {node.name}
      </text>
    </>
  )
}

/** 일반 커넥터 노드를 렌더링한다. */
function ConnectorNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const isHorizontal = node.width >= node.height
  const stripeIndexes = [0, 1, 2]
  const palette = getPipePalette(node.props.pipeKind)

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
        strokeWidth={selected ? 5 : 4}
      />
      {stripeIndexes.map((index) => {
        const ratio = (index + 1) / 4
        if (isHorizontal) {
          const x = node.width * ratio
          return (
            <line
              key={index}
              x1={x}
              y1={8}
              x2={x}
              y2={node.height - 8}
              stroke="#f8fafc"
              strokeWidth="5"
              strokeLinecap="butt"
            />
          )
        }

        const y = node.height * ratio
        return (
          <line
            key={index}
            x1={8}
            y1={y}
            x2={node.width - 8}
            y2={y}
            stroke="#f8fafc"
            strokeWidth="5"
            strokeLinecap="butt"
          />
        )
      })}
    </>
  )
}

/** ㄱ자 커넥터 노드를 렌더링한다. */
function ElbowConnectorNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const palette = getPipePalette(node.props.pipeKind)
  const {
    pipeSize,
    outerStroke,
    capHorizontal,
    capVertical,
    startY,
    endX,
    pathData,
    rotation,
  } = getElbowConnectorGeometry(node)
  const rotationTransform = rotation ? `rotate(${rotation} ${node.width / 2} ${node.height / 2})` : undefined

  return (
    <>
      <g transform={rotationTransform}>
        <path
          d={pathData}
          fill="none"
          stroke={selected ? '#f97316' : palette.stroke}
          strokeWidth={outerStroke}
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        <path
          d={pathData}
          fill="none"
          stroke={palette.fill}
          strokeWidth={pipeSize}
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        <ConnectorCap
          x={0}
          y={startY - capVertical.height / 2}
          width={capVertical.width}
          height={capVertical.height}
          selected={selected}
          orientation="vertical"
          palette={palette}
        />
        <ConnectorCap
          x={endX - capHorizontal.width / 2}
          y={node.height - capHorizontal.height}
          width={capHorizontal.width}
          height={capHorizontal.height}
          selected={selected}
          orientation="horizontal"
          palette={palette}
        />
      </g>
    </>
  )
}

/** T자 커넥터 노드를 렌더링한다. */
function TeeConnectorNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const palette = getPipePalette(node.props.pipeKind)
  const {
    pipeSize,
    outerStroke,
    capHorizontal,
    capVertical,
    centerX,
    junctionY,
    horizontalPathData,
    verticalPathData,
    rotation,
  } = getTeeConnectorGeometry(node)
  const rotationTransform = rotation ? `rotate(${rotation} ${node.width / 2} ${node.height / 2})` : undefined

  return (
    <>
      <g transform={rotationTransform}>
        <path
          d={horizontalPathData}
          fill="none"
          stroke={selected ? '#f97316' : palette.stroke}
          strokeWidth={outerStroke}
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        <path
          d={verticalPathData}
          fill="none"
          stroke={selected ? '#f97316' : palette.stroke}
          strokeWidth={outerStroke}
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        <path
          d={horizontalPathData}
          fill="none"
          stroke={palette.fill}
          strokeWidth={pipeSize}
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        <path
          d={verticalPathData}
          fill="none"
          stroke={palette.fill}
          strokeWidth={pipeSize}
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        <ConnectorCap
          x={0}
          y={junctionY - capVertical.height / 2}
          width={capVertical.width}
          height={capVertical.height}
          selected={selected}
          orientation="vertical"
          palette={palette}
        />
        <ConnectorCap
          x={node.width - capVertical.width}
          y={junctionY - capVertical.height / 2}
          width={capVertical.width}
          height={capVertical.height}
          selected={selected}
          orientation="vertical"
          palette={palette}
        />
        <ConnectorCap
          x={centerX - capHorizontal.width / 2}
          y={0}
          width={capHorizontal.width}
          height={capHorizontal.height}
          selected={selected}
          orientation="horizontal"
          palette={palette}
        />
      </g>
    </>
  )
}

/** 시설 노드 type을 세부 시설 렌더러로 분기한다. */
function FacilityNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  if (node.type === 'outfall') {
    return <OutfallNode node={node} selected={selected} />
  }

  const definition = getNodeFacilityDefinition(node)
  const stroke = selected ? '#f97316' : definition.stroke

  if (definition.id === 'overflowChamber') {
    return <OverflowChamberNode node={node} selected={selected} definition={definition} />
  }

  if (definition.id === 'stormPumpStation') {
    return <StormPumpStationNode node={node} selected={selected} definition={definition} />
  }

  if (definition.id === 'waterReclamationCenter') {
    return <WaterReclamationNode node={node} selected={selected} definition={definition} />
  }

  return (
    <FacilityShell node={node} selected={selected} fill={definition.fill} stroke={definition.stroke}>
      <circle cx={node.width / 2} cy={node.height / 2 + 10} r="28" fill="#f8fafc" stroke={stroke} strokeWidth="6" />
      <path
        d={`M${node.width / 2 - 16} ${node.height / 2 - 6} L${node.width / 2 + 16} ${node.height / 2 + 26}`}
        stroke={stroke}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d={`M${node.width / 2 + 16} ${node.height / 2 - 6} L${node.width / 2 - 16} ${node.height / 2 + 26}`}
        stroke={stroke}
        strokeWidth="7"
        strokeLinecap="round"
      />
    </FacilityShell>
  )
}

/** 시설류 공통 외곽과 라벨을 렌더링한다. */
function FacilityShell({
  node,
  selected,
  fill,
  stroke,
  children,
}: {
  node: EditorNode
  selected: boolean
  fill: string
  stroke: string
  children: ReactNode
}) {
  const activeStroke = selected ? '#f97316' : stroke

  return (
    <>
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        rx="14"
        fill={fill}
        stroke={activeStroke}
        strokeWidth={selected ? 5 : 4}
      />
      <rect
        x="8"
        y="8"
        width={Math.max(0, node.width - 16)}
        height={Math.max(0, node.height - 16)}
        rx="10"
        fill="rgba(255,255,255,.28)"
      />
      {children}
      <FacilityNameLabel node={node} selected={selected} fill={fill} stroke={stroke} />
    </>
  )
}

/** 월류/우수토실 시설을 렌더링한다. */
function OverflowChamberNode({
  node,
  selected,
  definition,
}: {
  node: EditorNode
  selected: boolean
  definition: typeof FACILITY_KIND_DEFINITIONS[number]
}) {
  const stroke = selected ? '#f97316' : definition.stroke
  const innerX = 22
  const innerY = 44
  const innerWidth = Math.max(0, node.width - innerX * 2)
  const innerHeight = Math.max(0, node.height - innerY - 16)
  const grateWidth = Math.max(120, node.width - 72)
  const gateStartX = node.width * 0.44
  const gateEndX = node.width * 0.66

  return (
    <FacilityShell node={node} selected={selected} fill={definition.fill} stroke={definition.stroke}>
      <rect x="36" y="12" width={grateWidth} height="18" rx="3" fill="#687383" stroke={stroke} strokeWidth="2.5" />
      {Array.from({ length: 10 }, (_, index) => (
        <line
          key={index}
          x1={48 + index * (grateWidth - 24) / 9}
          y1="13"
          x2={48 + index * (grateWidth - 24) / 9}
          y2="29"
          stroke="#cbd5e1"
          strokeWidth="3"
        />
      ))}
      <rect
        x={innerX}
        y={innerY}
        width={innerWidth}
        height={innerHeight}
        rx="7"
        fill="#f8fafc"
        stroke="#94a3b8"
        strokeWidth="3"
      />
      <path
        d={`M${gateStartX} ${innerY + innerHeight} L${gateEndX} ${innerY + 18} H${gateEndX + 24} L${gateStartX + 24} ${innerY + innerHeight} Z`}
        fill="#9ca3af"
        stroke={stroke}
        strokeWidth="4"
      />
      <text
        x={innerX + 64}
        y={innerY + innerHeight - 20}
        textAnchor="middle"
        className="select-none text-[13px] font-black"
        fill="#334155"
      >
        일반 유량
      </text>
      <text
        x={node.width - 74}
        y={innerY + innerHeight - 42}
        textAnchor="middle"
        className="select-none text-[13px] font-black"
        fill="#334155"
      >
        폭우 초과분
      </text>
    </FacilityShell>
  )
}

/** 빗물펌프장 시설을 렌더링한다. */
function StormPumpStationNode({
  node,
  selected,
  definition,
}: {
  node: EditorNode
  selected: boolean
  definition: typeof FACILITY_KIND_DEFINITIONS[number]
}) {
  const stroke = selected ? '#f97316' : definition.stroke
  const centerX = node.width / 2
  const centerY = node.height * 0.62

  return (
    <FacilityShell node={node} selected={selected} fill={definition.fill} stroke={definition.stroke}>
      <rect x="28" y={centerY - 20} width={node.width * 0.26} height="40" rx="10" fill="#f8fbff" stroke="#8cc7ff" strokeWidth="3" />
      <rect
        x={node.width - node.width * 0.26 - 28}
        y={centerY - 20}
        width={node.width * 0.26}
        height="40"
        rx="20"
        fill="#f8fbff"
        stroke="#8cc7ff"
        strokeWidth="3"
      />
      <path
        d={`M${node.width * 0.28} ${centerY} H${centerX - 42} M${centerX + 42} ${centerY} H${node.width * 0.72}`}
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
      />
      <circle cx={centerX} cy={centerY} r="34" fill="#bfdbfe" stroke={stroke} strokeWidth="6" />
      <circle cx={centerX} cy={centerY} r="14" fill="#1d4ed8" />
      <path
        d={`M${centerX} ${centerY} L${centerX + 25} ${centerY - 12} M${centerX} ${centerY} L${centerX + 17} ${centerY + 22} M${centerX} ${centerY} L${centerX - 25} ${centerY + 12} M${centerX} ${centerY} L${centerX - 17} ${centerY - 22}`}
        stroke="#e9f5ff"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </FacilityShell>
  )
}

/** 물재생센터 시설을 렌더링한다. */
function WaterReclamationNode({
  node,
  selected,
  definition,
}: {
  node: EditorNode
  selected: boolean
  definition: typeof FACILITY_KIND_DEFINITIONS[number]
}) {
  const stroke = selected ? '#f97316' : definition.stroke
  const moduleWidth = Math.max(42, node.width * 0.16)
  const gap = Math.max(10, node.width * 0.035)
  const totalWidth = moduleWidth * 4 + gap * 3
  const startX = (node.width - totalWidth) / 2
  const moduleY = node.height * 0.58

  return (
    <FacilityShell node={node} selected={selected} fill={definition.fill} stroke={definition.stroke}>
      {Array.from({ length: 4 }, (_, index) => (
        <rect
          key={index}
          x={startX + index * (moduleWidth + gap)}
          y={moduleY}
          width={moduleWidth}
          height="34"
          rx="7"
          fill="#f8fff9"
          stroke="#80d99b"
          strokeWidth="3"
        />
      ))}
      {[0, 1, 2].map((index) => (
        <line
          key={index}
          x1={startX + moduleWidth + index * (moduleWidth + gap)}
          y1={moduleY + 17}
          x2={startX + moduleWidth + gap + index * (moduleWidth + gap)}
          y2={moduleY + 17}
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
        />
      ))}
    </FacilityShell>
  )
}

/** 방류구 노드를 렌더링한다. */
function OutfallNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const definition = getNodeOutfallDefinition(node)
  const stroke = selected ? '#f97316' : definition.stroke
  const grilleWidth = Math.min(70, node.width * 0.34)
  const grilleX = node.width - grilleWidth - 14

  return (
    <>
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        rx="18"
        fill={definition.fill}
        stroke={stroke}
        strokeWidth={selected ? 5 : 4}
      />
      <rect
        x={grilleX}
        y={node.height * 0.16}
        width={grilleWidth}
        height={node.height * 0.68}
        rx="10"
        fill="#d6dce2"
        stroke="#6b7280"
        strokeWidth="4"
      />
      {[0.34, 0.5, 0.66].map((ratio) => (
        <line
          key={ratio}
          x1={grilleX + 14}
          y1={node.height * ratio}
          x2={grilleX + grilleWidth - 14}
          y2={node.height * ratio}
          stroke="#6b7280"
          strokeWidth="6"
          strokeLinecap="round"
        />
      ))}
      <FacilityNameLabel node={node} selected={selected} fill={definition.fill} stroke={definition.stroke} />
    </>
  )
}
