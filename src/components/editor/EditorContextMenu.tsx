import { useState } from 'react'
import {
  LAYOUT_ADD_KIND_LABELS,
  LAYOUT_ADD_KIND_OPTIONS,
  NODE_BUTTONS,
  NODE_LABELS,
  type LayoutAddKind,
} from './editorDefinitions'
import type { ContextMenuState, Point } from './editorInternalTypes'
import type { EditorNodeType } from './editorTypes'
import type { WorkbenchTheme } from '../theme/workbenchTheme'

export type ContextNodeZOrderAction = 'bringForward' | 'sendBackward' | 'bringToFront' | 'sendToBack'
type MobileNodeMenuView = 'root' | 'zOrder'

/** 캔버스/노드/relation/지형 추가 상황에 맞는 우클릭 편집 메뉴를 렌더링한다. */
export function EditorContextMenu({
  contextMenu,
  canStartCoordinateEdit,
  isMobileSheet = false,
  theme = 'light',
  onChangeNodeZOrder,
  onStartTeeCoordinateEdit,
  onOpenInfoPanel,
  onStartNodeMove,
  onStartNodeResize,
  onAddLayoutNode,
  onDetachRelation,
  onAddNode,
  onAddStandalonePipe,
  onClose,
}: {
  contextMenu: ContextMenuState
  canStartCoordinateEdit: boolean
  isMobileSheet?: boolean
  theme?: WorkbenchTheme
  onChangeNodeZOrder: (action: ContextNodeZOrderAction) => void
  onStartTeeCoordinateEdit: () => void
  onOpenInfoPanel?: () => void
  onStartNodeMove?: () => void
  onStartNodeResize?: () => void
  onAddLayoutNode: (kind: LayoutAddKind, source: NonNullable<ContextMenuState['layoutAdd']>) => void
  onDetachRelation: () => void
  onAddNode: (type: EditorNodeType, point: Point) => void
  onAddStandalonePipe: (point: Point) => void
  onClose: () => void
}) {
  const [mobileNodeMenuView, setMobileNodeMenuView] = useState<MobileNodeMenuView>('root')
  const isCanvasAddMenu = !contextMenu.nodeId && !contextMenu.layoutAdd && !contextMenu.relationPort
  const isDark = theme === 'dark'
  const menuFrameClassName = isDark
    ? 'border-slate-800 bg-slate-950 text-slate-100'
    : 'border-slate-200 bg-white text-slate-900'
  const dividerClassName = isDark ? 'border-slate-800' : 'border-slate-100'
  const headerTextClassName = isDark ? 'text-slate-400' : 'text-slate-400'
  const itemClassName = isDark
    ? 'text-slate-100 hover:bg-slate-900'
    : 'text-slate-700 hover:bg-slate-50'
  const blueItemClassName = isDark
    ? 'text-blue-200 hover:bg-blue-500/10'
    : 'text-blue-700 hover:bg-blue-50'
  const roseItemClassName = isDark
    ? 'text-rose-200 hover:bg-rose-500/10'
    : 'text-rose-700 hover:bg-rose-50'

  const runZOrderAction = (action: ContextNodeZOrderAction) => {
    onChangeNodeZOrder(action)
    onClose()
  }

  const renderZOrderButtons = () => (
    <>
      <button
        type="button"
        onClick={() => runZOrderAction('bringToFront')}
        className={`block w-full px-3 py-2 text-left text-sm font-black ${itemClassName}`}
      >
        맨 앞으로 보내기
      </button>
      <button
        type="button"
        onClick={() => runZOrderAction('bringForward')}
        className={`block w-full px-3 py-2 text-left text-sm font-black ${itemClassName}`}
      >
        앞으로 보내기
      </button>
      <button
        type="button"
        onClick={() => runZOrderAction('sendBackward')}
        className={`block w-full px-3 py-2 text-left text-sm font-black ${itemClassName}`}
      >
        뒤로 보내기
      </button>
      <button
        type="button"
        onClick={() => runZOrderAction('sendToBack')}
        className={`block w-full px-3 py-2 text-left text-sm font-black ${itemClassName}`}
      >
        맨 뒤로 보내기
      </button>
    </>
  )

  const renderMobileNodeMenu = () => (
    <>
      <div className={`border-b px-5 py-3 text-xs font-black ${dividerClassName} ${headerTextClassName}`}>
        {mobileNodeMenuView === 'zOrder' ? 'ZIndex 변경' : '객체 액션'}
      </div>
      {mobileNodeMenuView === 'zOrder' ? (
        <>
          <button
            type="button"
            onClick={() => setMobileNodeMenuView('root')}
            className={`block w-full px-5 py-3 text-left text-sm font-black ${blueItemClassName}`}
          >
            이전 메뉴
          </button>
          <div className={`border-t ${dividerClassName}`} />
          {renderZOrderButtons()}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              onOpenInfoPanel?.()
              onClose()
            }}
            className={`block w-full px-5 py-3 text-left text-base font-black ${itemClassName}`}
          >
            편집정보 보기
          </button>
          <button
            type="button"
            onClick={() => setMobileNodeMenuView('zOrder')}
            className={`block w-full px-5 py-3 text-left text-base font-black ${itemClassName}`}
          >
            ZIndex 변경
          </button>
          <button
            type="button"
            onClick={() => {
              onStartNodeMove?.()
              onClose()
            }}
            className={`block w-full px-5 py-3 text-left text-base font-black ${blueItemClassName}`}
          >
            객체이동
          </button>
          <button
            type="button"
            onClick={() => {
              onStartNodeResize?.()
              onClose()
            }}
            className={`block w-full px-5 py-3 text-left text-base font-black ${blueItemClassName}`}
          >
            크기 조절
          </button>
        </>
      )}
    </>
  )

  const menuContent = (
    <>
      <div className={`border-b px-3 py-2 text-xs font-black ${dividerClassName} ${headerTextClassName}`}>
        편집 메뉴
      </div>
      {contextMenu.nodeId ? (
        <>
          {renderZOrderButtons()}
          {canStartCoordinateEdit ? (
            <>
              <div className={`my-1 border-t ${dividerClassName}`} />
              <button
                type="button"
                onClick={onStartTeeCoordinateEdit}
                className={`block w-full px-3 py-2 text-left text-sm font-black ${blueItemClassName}`}
              >
                좌표 변경
              </button>
            </>
          ) : null}
        </>
      ) : contextMenu.layoutAdd ? (
        <>
          {LAYOUT_ADD_KIND_OPTIONS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => onAddLayoutNode(kind, contextMenu.layoutAdd!)}
              className={`block w-full px-3 py-2 text-left text-sm font-black ${itemClassName}`}
            >
              {LAYOUT_ADD_KIND_LABELS[kind]} 추가
            </button>
          ))}
        </>
      ) : contextMenu.relationPort ? (
        <button
          type="button"
          onClick={onDetachRelation}
          className={`block w-full px-3 py-2 text-left text-sm font-black ${roseItemClassName}`}
        >
          해체
        </button>
      ) : (
        <>
          {NODE_BUTTONS.map((nodeType) => (
            <button
              key={nodeType}
              type="button"
              onClick={() => {
              onAddNode(nodeType, contextMenu.point)
              onClose()
            }}
            className={`block w-full px-3 py-2 text-left text-sm font-bold ${itemClassName}`}
          >
              {NODE_LABELS[nodeType]} 추가
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onAddStandalonePipe(contextMenu.point)
              onClose()
            }}
            className={`block w-full px-3 py-2 text-left text-sm font-bold ${blueItemClassName}`}
          >
            파이프 추가
          </button>
        </>
      )}
    </>
  )

  if (isMobileSheet) {
    return (
      <div
        className={`fixed inset-0 z-[230] flex items-end ${isCanvasAddMenu ? 'bg-transparent' : 'bg-slate-950/55'}`}
        onClick={onClose}
      >
        <div
          data-editor-context-menu="true"
          className={`max-h-[78vh] w-screen overflow-y-auto rounded-t-2xl border-t py-2 shadow-2xl ${menuFrameClassName}`}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="flex justify-center px-4 pb-2 pt-1">
            <span className={`h-1.5 w-12 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
          </div>
          {contextMenu.nodeId ? renderMobileNodeMenu() : menuContent}
        </div>
      </div>
    )
  }

  return (
    <div
      data-editor-context-menu="true"
      className={`fixed z-50 w-56 overflow-hidden rounded-lg border py-1 shadow-xl ${menuFrameClassName}`}
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {menuContent}
    </div>
  )
}
