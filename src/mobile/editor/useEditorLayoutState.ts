import { useCallback, useEffect, useReducer } from 'react'
import { createDefaultEditorLayout } from './defaultLayout'
import { LAYOUT_HISTORY_LIMIT } from './editorDefinitions'
import { normalizeRelationAttachments } from './editorRelations'
import { loadEditorLayout, saveEditorLayout } from './layoutStorage'
import type {
  LayoutHistoryAction,
  LayoutHistoryState,
  LayoutSetOptions,
  LayoutUpdate,
} from './editorInternalTypes'
import type {
  EditorAttachPoint,
  EditorEndpoint,
  EditorLayout,
  EditorLink,
  EditorNode,
  EditorPort,
  EditorRelationAttachMetadata,
} from './editorTypes'

type NormalizeLayout = (layout: EditorLayout) => EditorLayout

/** 함수형/값형 layout 업데이트를 현재 layout 기준으로 해석한다. */
function resolveLayoutUpdate(currentLayout: EditorLayout, update: LayoutUpdate) {
  return typeof update === 'function' ? update(currentLayout) : update
}

/** layout props는 원시값만 들어오므로 문자열 직렬화 없이 key/value만 비교한다. */
function areRecordsEqual(
  first: Record<string, string | number | boolean>,
  second: Record<string, string | number | boolean>,
) {
  if (first === second) {
    return true
  }

  const firstKeys = Object.keys(first)
  const secondKeys = Object.keys(second)
  if (firstKeys.length !== secondKeys.length) {
    return false
  }

  for (const key of firstKeys) {
    if (first[key] !== second[key]) {
      return false
    }
  }

  return true
}

function arePortsEqual(first: EditorPort[], second: EditorPort[]) {
  if (first === second) {
    return true
  }

  if (first.length !== second.length) {
    return false
  }

  for (let index = 0; index < first.length; index += 1) {
    const firstPort = first[index]
    const secondPort = second[index]
    if (
      firstPort.id !== secondPort.id ||
      firstPort.side !== secondPort.side ||
      firstPort.label !== secondPort.label ||
      firstPort.offset !== secondPort.offset
    ) {
      return false
    }
  }

  return true
}

function areNodesEqual(first: EditorNode, second: EditorNode) {
  return (
    first === second ||
    (
      first.id === second.id &&
      first.swmmId === second.swmmId &&
      first.name === second.name &&
      first.type === second.type &&
      first.x === second.x &&
      first.y === second.y &&
      first.width === second.width &&
      first.height === second.height &&
      arePortsEqual(first.ports, second.ports) &&
      areRecordsEqual(first.props, second.props)
    )
  )
}

function areEndpointsEqual(first: EditorEndpoint, second: EditorEndpoint) {
  return first.nodeId === second.nodeId && first.portId === second.portId
}

function areAttachPointsEqual(first: EditorAttachPoint, second: EditorAttachPoint) {
  return (
    first.nodeId === second.nodeId &&
    first.portId === second.portId &&
    first.side === second.side &&
    first.ratio === second.ratio &&
    first.rawRatio === second.rawRatio &&
    first.point.x === second.point.x &&
    first.point.y === second.point.y
  )
}

function areAttachMetadataEqual(
  first: EditorRelationAttachMetadata | undefined,
  second: EditorRelationAttachMetadata | undefined,
) {
  if (first === second) {
    return true
  }

  return Boolean(
    first &&
    second &&
    first.aligned === second.aligned &&
    areAttachPointsEqual(first.parentEndpoint, second.parentEndpoint) &&
    areAttachPointsEqual(first.childEndpoint, second.childEndpoint) &&
    areAttachPointsEqual(first.parentOnChild, second.parentOnChild) &&
    areAttachPointsEqual(first.childOnParent, second.childOnParent),
  )
}

function areLinkPropsEqual(first: EditorLink['props'], second: EditorLink['props']) {
  return (
    first === second ||
    (
      first.route === second.route &&
      first.slope === second.slope &&
      first.length === second.length &&
      first.blockage === second.blockage &&
      first.pipeKind === second.pipeKind
    )
  )
}

function areLinksEqual(first: EditorLink, second: EditorLink) {
  return (
    first === second ||
    (
      first.id === second.id &&
      first.swmmId === second.swmmId &&
      first.name === second.name &&
      first.type === second.type &&
      first.size === second.size &&
      areEndpointsEqual(first.from, second.from) &&
      areEndpointsEqual(first.to, second.to) &&
      areLinkPropsEqual(first.props, second.props) &&
      areAttachMetadataEqual(first.attach, second.attach)
    )
  )
}

/** history 기록 전 layout이 동일한지 필드 단위로 비교한다. */
function areLayoutsEqual(first: EditorLayout, second: EditorLayout) {
  if (first === second) {
    return true
  }

  if (
    first.version !== second.version ||
    first.groundSurfaceY !== second.groundSurfaceY ||
    first.nodes.length !== second.nodes.length ||
    first.links.length !== second.links.length
  ) {
    return false
  }

  for (let index = 0; index < first.nodes.length; index += 1) {
    if (!areNodesEqual(first.nodes[index], second.nodes[index])) {
      return false
    }
  }

  for (let index = 0; index < first.links.length; index += 1) {
    if (!areLinksEqual(first.links[index], second.links[index])) {
      return false
    }
  }

  return true
}

/** undo history 길이를 제한하면서 새 snapshot을 추가한다. */
function pushLimitedHistory(history: EditorLayout[], layout: EditorLayout) {
  return [...history, layout].slice(-LAYOUT_HISTORY_LIMIT)
}

/** localStorage 또는 기본 layout으로 history 초기 상태를 만든다. */
function createInitialLayoutHistoryState(normalizeLayout: NormalizeLayout): LayoutHistoryState {
  return {
    present: normalizeLayout(loadEditorLayout() ?? createDefaultEditorLayout()),
    past: [],
    future: [],
    batchStart: null,
  }
}

/** layout apply, batch, undo, redo를 처리하는 reducer다. */
function layoutHistoryReducer(
  state: LayoutHistoryState,
  action: LayoutHistoryAction,
  normalizeLayout: NormalizeLayout,
): LayoutHistoryState {
  if (action.type === 'apply') {
    const nextLayout = normalizeRelationAttachments(resolveLayoutUpdate(state.present, action.update))
    if (areLayoutsEqual(state.present, nextLayout)) {
      return state
    }

    return {
      present: nextLayout,
      past: action.recordHistory ? pushLimitedHistory(state.past, state.present) : state.past,
      future: action.recordHistory ? [] : state.future,
      batchStart: action.recordHistory ? null : state.batchStart,
    }
  }

  if (action.type === 'replace') {
    return {
      present: normalizeLayout(action.layout),
      past: [],
      future: [],
      batchStart: null,
    }
  }

  if (action.type === 'beginBatch') {
    return state.batchStart ? state : { ...state, batchStart: state.present }
  }

  if (action.type === 'commitBatch') {
    if (!state.batchStart || areLayoutsEqual(state.batchStart, state.present)) {
      return { ...state, batchStart: null }
    }

    return {
      ...state,
      past: pushLimitedHistory(state.past, state.batchStart),
      future: [],
      batchStart: null,
    }
  }

  if (action.type === 'undo') {
    const previous = state.past.at(-1)
    if (!previous) {
      return { ...state, batchStart: null }
    }

    return {
      present: normalizeRelationAttachments(previous),
      past: state.past.slice(0, -1),
      future: [state.present, ...state.future].slice(0, LAYOUT_HISTORY_LIMIT),
      batchStart: null,
    }
  }

  if (action.type === 'redo') {
    const next = state.future[0]
    if (!next) {
      return { ...state, batchStart: null }
    }

    return {
      present: normalizeRelationAttachments(next),
      past: pushLimitedHistory(state.past, state.present),
      future: state.future.slice(1),
      batchStart: null,
    }
  }

  return state
}

/** layout 저장, history, undo/redo API를 하나의 hook으로 묶는다. */
export function useEditorLayoutState(normalizeLayout: NormalizeLayout) {
  const reducer = useCallback(
    (state: LayoutHistoryState, action: LayoutHistoryAction) => layoutHistoryReducer(state, action, normalizeLayout),
    [normalizeLayout],
  )
  const [historyState, dispatchLayoutHistory] = useReducer(
    reducer,
    undefined,
    () => createInitialLayoutHistoryState(normalizeLayout),
  )
  const layout = historyState.present

  useEffect(() => {
    saveEditorLayout(layout)
  }, [layout])

  const setLayout = useCallback((update: LayoutUpdate, options: LayoutSetOptions = {}) => {
    dispatchLayoutHistory({
      type: 'apply',
      update,
      recordHistory: options.recordHistory !== false,
    })
  }, [])

  const beginLayoutHistoryBatch = useCallback(() => {
    dispatchLayoutHistory({ type: 'beginBatch' })
  }, [])

  const commitLayoutHistoryBatch = useCallback(() => {
    dispatchLayoutHistory({ type: 'commitBatch' })
  }, [])

  const undoLayout = useCallback(() => {
    dispatchLayoutHistory({ type: 'undo' })
  }, [])

  const redoLayout = useCallback(() => {
    dispatchLayoutHistory({ type: 'redo' })
  }, [])

  const replaceLayout = useCallback((layout: EditorLayout) => {
    dispatchLayoutHistory({ type: 'replace', layout })
  }, [])

  return [
    layout,
    setLayout,
    {
      beginLayoutHistoryBatch,
      commitLayoutHistoryBatch,
      undoLayout,
      redoLayout,
      replaceLayout,
      canUndo: historyState.past.length > 0,
      canRedo: historyState.future.length > 0,
    },
  ] as const
}
