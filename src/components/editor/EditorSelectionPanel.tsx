import {
  CONNECTOR_TYPE_OPTIONS,
  DEFAULT_PIPE_KIND,
  FACILITY_KIND_LABELS,
  FACILITY_KIND_OPTIONS,
  FACILITY_TYPE_OPTIONS,
  FIXED_NODE_Y_BY_TYPE,
  LINK_ROUTE_OPTIONS,
  LINK_TYPE_OPTIONS,
  MANHOLE_KIND_LABELS,
  MANHOLE_KIND_OPTIONS,
  MIN_MANHOLE_HEIGHT,
  MIN_ROAD_WIDTH,
  MIN_TERRAIN_HEIGHT,
  MIN_TERRAIN_WIDTH,
  NODE_LABELS,
  OUTFALL_KIND_LABELS,
  OUTFALL_KIND_OPTIONS,
  PIPE_KIND_LABELS,
  PIPE_KIND_OPTIONS,
  PIPE_SIZE_LABELS,
  PIPE_SIZE_OPTIONS,
  TERRAIN_KIND_LABELS,
  TERRAIN_KIND_OPTIONS,
} from './editorDefinitions'
import { snapNodeToGround } from './editorNodePlacement'
import {
  getLinkPipeKind,
  getNodeFacilityKind,
  getNodeManholeKind,
  getNodeOutfallKind,
  getNodePipeKind,
  getNodePipeSize,
  getNodeTerrainKind,
  normalizeNodePorts,
  resizeNodeForFacilityKind,
  resizeNodeForManholeKind,
  resizeNodeForOutfallKind,
  resizeNodeForPipeSize,
  resizeNodeForTerrainKind,
  resizeNodeForType,
} from './editorNodeHelpers'
import { clampPercent } from '../../services/swmm/editorRuntime'
import {
  SURFACE_NODE_TYPES,
  type EditorLink,
  type EditorLinkType,
  type EditorNode,
  type EditorNodeType,
  type EditorPipeSize,
} from './editorTypes'
import type { WorkbenchTheme } from '../theme/workbenchTheme'

/** 편집 정보 drawer의 모델 요약 숫자 카드를 렌더링한다. */
export function SummaryCard({
  theme = 'light',
  label,
  value,
}: {
  theme?: WorkbenchTheme
  label: string
  value: number
}) {
  const isDark = theme === 'dark'

  return (
    <div className={`editor-summary-card rounded-lg border p-3 ${
      isDark ? 'border-slate-800 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
    }`}>
      <div className={`text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{label}</div>
      <div className={`mt-1 text-2xl font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{value}</div>
    </div>
  )
}

/** 선택된 노드 또는 링크의 속성을 수정하는 편집 패널을 렌더링한다. */
export function SelectionPanel({
  theme = 'light',
  node,
  link,
  connectedLinks,
  groundSurfaceY,
  onUpdateNode,
  onRotateNode,
  onUpdateLink,
  onUpdateLinkProps,
  onDeleteSelection,
}: {
  theme?: WorkbenchTheme
  node: EditorNode | null
  link: EditorLink | null
  connectedLinks: EditorLink[]
  groundSurfaceY: number
  onUpdateNode: (nodeId: string, updates: Partial<EditorNode>) => void
  onRotateNode: (nodeId: string) => void
  onUpdateLink: (linkId: string, updates: Partial<Omit<EditorLink, 'props'>>) => void
  onUpdateLinkProps: (linkId: string, updates: Partial<EditorLink['props']>) => void
  onDeleteSelection: () => void
}) {
  const isDark = theme === 'dark'
  const panelClassName = isDark
    ? 'border-slate-800 bg-slate-900 text-slate-100'
    : 'border-slate-200 bg-white text-slate-900'
  const deleteButtonClassName = isDark
    ? 'border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
    : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-white'
  const mutedTextClassName = isDark ? 'text-slate-400' : 'text-slate-400'
  const blueNoticeClassName = isDark
    ? 'bg-blue-500/10 text-blue-200'
    : 'bg-blue-50 text-blue-700'
  const orangeNoticeClassName = isDark
    ? 'bg-orange-500/10 text-orange-200'
    : 'bg-orange-50 text-orange-700'

  if (node) {
    const isSurfaceNode = SURFACE_NODE_TYPES.has(node.type)
    const fixedY = FIXED_NODE_Y_BY_TYPE[node.type]
    const isYLocked = isSurfaceNode || fixedY !== undefined
    const isPositionLockedPipe = node.type === 'pipeSegment' && connectedLinks.length > 0
    const hasPipeSize = (
      node.type === 'pipeSegment' ||
      node.type === 'connector' ||
      node.type === 'elbowConnector' ||
      node.type === 'teeConnector'
    )
    const hasPipeKind = hasPipeSize
    const hasFacilityType = FACILITY_TYPE_OPTIONS.includes(node.type)
    const hasFacilityKind = node.type === 'facility'
    const hasOutfallKind = node.type === 'outfall'
    const hasManholeKind = node.type === 'manhole'
    const hasTerrainKind = node.type === 'terrain'
    const hasConnectorType = CONNECTOR_TYPE_OPTIONS.includes(node.type)
    const hasNodeBlockageControl = (
      node.type === 'pipeSegment' ||
      node.type === 'facility' ||
      node.type === 'manhole' ||
      node.type === 'catchBasin' ||
      node.type === 'outfall'
    )
    const pipeKind = hasPipeKind ? getNodePipeKind(node) : DEFAULT_PIPE_KIND
    const minNodeWidth = node.type === 'road'
      ? MIN_ROAD_WIDTH
      : node.type === 'terrain'
        ? MIN_TERRAIN_WIDTH
        : 20
    const minNodeHeight = node.type === 'manhole'
      ? MIN_MANHOLE_HEIGHT
      : node.type === 'terrain'
        ? MIN_TERRAIN_HEIGHT
        : 20
    const handleNodeTypeChange = (nextType: EditorNodeType) => {
      const updates = resizeNodeForType(node, nextType)
      const nextNode = snapNodeToGround(
        normalizeNodePorts({
          ...node,
          ...updates,
        }),
        groundSurfaceY,
      )

      onUpdateNode(node.id, nextNode)
    }

    return (
      <div className={`mt-5 rounded-lg border p-4 ${panelClassName}`}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black">선택 객체</h3>
          <button
            type="button"
            onClick={onDeleteSelection}
            className={`rounded-md border px-2 py-1 text-xs font-black ${deleteButtonClassName}`}
          >
            삭제
          </button>
        </div>

        <TextField
          theme={theme}
          label="화면 이름"
          value={node.name}
          onChange={(value) => onUpdateNode(node.id, { name: value })}
        />
        <TextField
          theme={theme}
          label="SWMM ID"
          value={node.swmmId}
          onChange={(value) => onUpdateNode(node.id, { swmmId: value })}
        />
        <Definition theme={theme} label="id" value={node.id} />
        <Definition theme={theme} label="type" value={node.type} />
        {hasFacilityType && (
          <SelectField
            theme={theme}
            label="객체 종류"
            value={node.type}
            options={FACILITY_TYPE_OPTIONS}
            optionLabels={NODE_LABELS}
            onChange={handleNodeTypeChange}
          />
        )}
        {hasFacilityKind && (
          <SelectField
            theme={theme}
            label="시설 세부 종류"
            value={getNodeFacilityKind(node)}
            options={FACILITY_KIND_OPTIONS}
            optionLabels={FACILITY_KIND_LABELS}
            onChange={(value) => onUpdateNode(node.id, resizeNodeForFacilityKind(node, value))}
          />
        )}
        {hasOutfallKind && (
          <SelectField
            theme={theme}
            label="방류구 종류"
            value={getNodeOutfallKind(node)}
            options={OUTFALL_KIND_OPTIONS}
            optionLabels={OUTFALL_KIND_LABELS}
            onChange={(value) => onUpdateNode(node.id, resizeNodeForOutfallKind(node, value))}
          />
        )}
        {hasManholeKind && (
          <SelectField
            theme={theme}
            label="맨홀 종류"
            value={getNodeManholeKind(node)}
            options={MANHOLE_KIND_OPTIONS}
            optionLabels={MANHOLE_KIND_LABELS}
            onChange={(value) => onUpdateNode(node.id, resizeNodeForManholeKind(node, value))}
          />
        )}
        {hasTerrainKind && (
          <SelectField
            theme={theme}
            label="레이아웃 종류"
            value={getNodeTerrainKind(node)}
            options={TERRAIN_KIND_OPTIONS}
            optionLabels={TERRAIN_KIND_LABELS}
            onChange={(value) => onUpdateNode(node.id, resizeNodeForTerrainKind(node, value))}
          />
        )}
        {hasConnectorType && (
          <SelectField
            theme={theme}
            label="커넥터 종류"
            value={node.type}
            options={CONNECTOR_TYPE_OPTIONS}
            optionLabels={NODE_LABELS}
            disabled={connectedLinks.length > 0}
            onChange={handleNodeTypeChange}
          />
        )}
        {hasConnectorType && connectedLinks.length > 0 && (
          <p className={`mt-2 rounded-md px-2 py-2 text-xs font-bold leading-5 ${orangeNoticeClassName}`}>
            연결된 커넥터는 포트 구성이 바뀌지 않도록 종류 변경이 잠겨 있습니다. 먼저 연결을 끊은 뒤 변경하세요.
          </p>
        )}
        {hasPipeKind && (
          <SelectField
            theme={theme}
            label="관 종류"
            value={pipeKind}
            options={PIPE_KIND_OPTIONS}
            optionLabels={PIPE_KIND_LABELS}
            onChange={(value) => onUpdateNode(node.id, {
              props: {
                ...node.props,
                pipeKind: value,
              },
            })}
          />
        )}
        {hasPipeSize && (
          <SelectField
            theme={theme}
            label="굵기"
            value={getNodePipeSize(node)}
            options={PIPE_SIZE_OPTIONS}
            onChange={(value) => onUpdateNode(node.id, resizeNodeForPipeSize(node, value as EditorPipeSize))}
          />
        )}

        {hasNodeBlockageControl && (
          <div className="mt-3">
            <NumberField
              theme={theme}
              label="막힘 정도"
              value={clampPercent(node.props.blockage)}
              min={0}
              max={100}
              onChange={(value) => onUpdateNode(node.id, {
                props: {
                  ...node.props,
                  blockage: Math.min(100, Math.max(0, value)),
                },
              })}
            />
          </div>
        )}

        {hasPipeSize && (
          <button
            type="button"
            onClick={() => onRotateNode(node.id)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 text-sm font-black text-white shadow-sm hover:bg-slate-800"
            title="오른쪽으로 90도 회전"
            aria-label={`${NODE_LABELS[node.type]} 오른쪽 90도 회전`}
          >
            <RotateClockwiseIcon />
            오른쪽 90도 회전
          </button>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField
            theme={theme}
            label="x"
            value={node.x}
            disabled={isPositionLockedPipe}
            onChange={(value) => onUpdateNode(node.id, { x: value })}
          />
          <NumberField
            theme={theme}
            label="y"
            value={node.y}
            disabled={isYLocked || isPositionLockedPipe}
            onChange={(value) => onUpdateNode(node.id, { y: value })}
          />
          <NumberField
            theme={theme}
            label="가로"
            value={node.width}
            onChange={(value) => onUpdateNode(node.id, { width: Math.max(minNodeWidth, value) })}
          />
          <NumberField
            theme={theme}
            label="세로"
            value={node.height}
            min={minNodeHeight}
            disabled={node.type === 'road'}
            onChange={(value) => onUpdateNode(node.id, { height: Math.max(minNodeHeight, value) })}
          />
        </div>

        {fixedY !== undefined && (
          <p className={`mt-2 rounded-md px-2 py-2 text-xs font-bold leading-5 ${blueNoticeClassName}`}>
            {node.type === 'catchBasin' ? '빗물받이' : '맨홀'}은 y={fixedY}px로 고정되고 x만 이동할 수 있습니다.
          </p>
        )}

        {isSurfaceNode && fixedY === undefined && (
          <p className={`mt-2 rounded-md px-2 py-2 text-xs font-bold leading-5 ${blueNoticeClassName}`}>
            지상 고정 객체는 y={groundSurfaceY}px 지상선에 자동 스냅됩니다.
          </p>
        )}

        {isPositionLockedPipe && (
          <p className={`mt-2 rounded-md px-2 py-2 text-xs font-bold leading-5 ${orangeNoticeClassName}`}>
            관계에 연결된 파이프는 캔버스에서 그룹 단위로 이동합니다. 숫자 위치 편집은 잠겨 있고 길이는 가로/세로 값으로 조정하세요.
          </p>
        )}

        <Definition theme={theme} label="ports" value={node.ports.map((port) => port.id).join(', ')} />
        <div className={`mt-3 text-xs font-black ${mutedTextClassName}`}>연결 링크</div>
        <ul className="mt-2 space-y-1">
          {connectedLinks.length > 0 ? connectedLinks.map((connectedLink) => (
            <li key={connectedLink.id} className={`rounded-md px-2 py-1 text-xs font-bold ${isDark ? 'bg-slate-950 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
              {connectedLink.name}
            </li>
          )) : (
            <li className={`text-xs font-semibold ${mutedTextClassName}`}>아직 연결된 링크가 없습니다.</li>
          )}
        </ul>
      </div>
    )
  }

  if (link) {
    const hasPipeKind = link.type !== 'relation'
    const pipeKind = hasPipeKind ? getLinkPipeKind(link) : DEFAULT_PIPE_KIND

    return (
      <div className={`mt-5 rounded-lg border p-4 ${panelClassName}`}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black">선택 링크</h3>
          <button
            type="button"
            onClick={onDeleteSelection}
            className={`rounded-md border px-2 py-1 text-xs font-black ${deleteButtonClassName}`}
          >
            삭제
          </button>
        </div>

        <TextField
          theme={theme}
          label="화면 이름"
          value={link.name}
          onChange={(value) => onUpdateLink(link.id, { name: value })}
        />
        <TextField
          theme={theme}
          label="SWMM ID"
          value={link.swmmId}
          onChange={(value) => onUpdateLink(link.id, { swmmId: value })}
        />
        <Definition theme={theme} label="id" value={link.id} />
        <SelectField
          theme={theme}
          label="링크 종류"
          value={link.type}
          options={LINK_TYPE_OPTIONS}
          onChange={(value) => onUpdateLink(link.id, { type: value as EditorLinkType })}
        />
        <SelectField
          theme={theme}
          label="관 크기"
          value={link.size}
          options={PIPE_SIZE_OPTIONS}
          onChange={(value) => onUpdateLink(link.id, { size: value as EditorPipeSize })}
        />
        {hasPipeKind && (
          <SelectField
            theme={theme}
            label="관 종류"
            value={pipeKind}
            options={PIPE_KIND_OPTIONS}
            optionLabels={PIPE_KIND_LABELS}
            onChange={(value) => onUpdateLinkProps(link.id, { pipeKind: value })}
          />
        )}
        <SelectField
          theme={theme}
          label="경로"
          value={link.props.route}
          options={LINK_ROUTE_OPTIONS}
          onChange={(value) => onUpdateLinkProps(link.id, { route: value as EditorLink['props']['route'] })}
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField
            theme={theme}
            label="경사"
            value={link.props.slope}
            onChange={(value) => onUpdateLinkProps(link.id, { slope: value })}
          />
          <NumberField
            theme={theme}
            label="길이"
            value={link.props.length}
            onChange={(value) => onUpdateLinkProps(link.id, { length: value })}
          />
          <NumberField
            theme={theme}
            label="막힘 정도"
            value={link.props.blockage}
            min={0}
            max={100}
            onChange={(value) => onUpdateLinkProps(link.id, { blockage: Math.min(100, Math.max(0, value)) })}
          />
        </div>
        {link.type === 'relation' ? (
          <>
            <div className={`mt-3 rounded-md border px-3 py-2 ${isDark ? 'border-blue-500/30 bg-blue-500/10' : 'border-blue-100 bg-blue-50'}`}>
              <div className={`text-xs font-black ${isDark ? 'text-blue-200' : 'text-blue-500'}`}>관계 방향</div>
              <div className={`mt-1 text-sm font-black ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                부모에서 자식 방향으로 attach됩니다.
              </div>
            </div>
            <Definition theme={theme} label="부모(from)" value={`${link.from.nodeId} / ${link.from.portId}`} />
            <Definition theme={theme} label="자식(to)" value={`${link.to.nodeId} / ${link.to.portId}`} />
          </>
        ) : (
          <>
            <Definition theme={theme} label="from" value={`${link.from.nodeId} / ${link.from.portId}`} />
            <Definition theme={theme} label="to" value={`${link.to.nodeId} / ${link.to.portId}`} />
          </>
        )}
      </div>
    )
  }

  return (
    <div className={`mt-5 rounded-lg border border-dashed p-4 text-sm font-semibold ${isDark ? 'border-slate-800 bg-slate-900 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
      객체나 링크를 선택하면 id, swmmId, type, 연결 상태가 여기에 표시됩니다.
    </div>
  )
}

function RotateClockwiseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M19 7v5h-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.2 12A6.2 6.2 0 1 0 16 16.7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TextField({
  theme = 'light',
  label,
  value,
  onChange,
}: {
  theme?: WorkbenchTheme
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const isDark = theme === 'dark'

  return (
    <label className="mt-3 block">
      <span className={`text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 w-full rounded-md border px-2 py-2 text-sm font-bold outline-none focus:border-blue-400 ${
          isDark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-700'
        }`}
      />
    </label>
  )
}

function NumberField({
  theme = 'light',
  label,
  value,
  min,
  max,
  disabled = false,
  onChange,
}: {
  theme?: WorkbenchTheme
  label: string
  value: number | undefined
  min?: number
  max?: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  const isDark = theme === 'dark'

  return (
    <label className="block">
      <span className={`text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        disabled={disabled}
        value={formatNumberInput(value)}
        onChange={(event) => onChange(parseNumberInput(event.target.value, value ?? 0))}
        className={`mt-1 w-full rounded-md border px-2 py-2 text-sm font-bold outline-none focus:border-blue-400 disabled:text-slate-400 ${
          isDark ? 'border-slate-700 bg-slate-950 text-slate-100 disabled:bg-slate-900' : 'border-slate-200 bg-white text-slate-700 disabled:bg-slate-100'
        }`}
      />
    </label>
  )
}

function SelectField<T extends string>({
  theme = 'light',
  label,
  value,
  options,
  optionLabels,
  disabled = false,
  onChange,
}: {
  theme?: WorkbenchTheme
  label: string
  value: T
  options: readonly T[]
  optionLabels?: Partial<Record<string, string>>
  disabled?: boolean
  onChange: (value: T) => void
}) {
  const isDark = theme === 'dark'

  return (
    <label className="mt-3 block">
      <span className={`text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        className={`mt-1 w-full rounded-md border px-2 py-2 text-sm font-bold outline-none focus:border-blue-400 disabled:text-slate-400 ${
          isDark ? 'border-slate-700 bg-slate-950 text-slate-100 disabled:bg-slate-900' : 'border-slate-200 bg-white text-slate-700 disabled:bg-slate-100'
        }`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] ?? (option in PIPE_SIZE_LABELS ? PIPE_SIZE_LABELS[option as EditorPipeSize] : option)}
          </option>
        ))}
      </select>
    </label>
  )
}

function Definition({
  theme = 'light',
  label,
  value,
}: {
  theme?: WorkbenchTheme
  label: string
  value: string
}) {
  const isDark = theme === 'dark'

  return (
    <div className={`mt-3 border-t pt-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
      <div className={`text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{label}</div>
      <div className={`mt-1 break-all text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{value}</div>
    </div>
  )
}

function parseNumberInput(value: string, fallback: number) {
  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function formatNumberInput(value: number | undefined) {
  return value === undefined ? '' : String(value)
}
