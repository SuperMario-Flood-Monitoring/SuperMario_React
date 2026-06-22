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
import type { EditorLayout } from './editorTypes'

type NormalizeLayout = (layout: EditorLayout) => EditorLayout

/** 함수형/값형 layout 업데이트를 현재 layout 기준으로 해석한다. */
function resolveLayoutUpdate(currentLayout: EditorLayout, update: LayoutUpdate) {
  return typeof update === 'function' ? update(currentLayout) : update
}

/** history 기록 전 layout JSON이 동일한지 비교한다. */
function areLayoutsEqual(first: EditorLayout, second: EditorLayout) {
  return JSON.stringify(first) === JSON.stringify(second)
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
