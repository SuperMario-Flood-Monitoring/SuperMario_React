import { useEffect, useRef, useState } from 'react'
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
import { CloseIcon } from '../ui/WebIcons'

export type ContextNodeZOrderAction = 'bringForward' | 'sendBackward' | 'bringToFront' | 'sendToBack'
type MobileNodeMenuView = 'root' | 'zOrder'

/** 캔버스/노드/relation/지형 추가 상황에 맞는 우클릭 편집 메뉴를 렌더링한다. */
export function EditorContextMenu({
  contextMenu,
  canStartCoordinateEdit,
  canStartNodeRelation,
  canDetachNodeParentRelation,
  canStartNodeMove = true,
  canStartNodeResize = true,
  canDeleteSelection = true,
  isMobileSheet = false,
  theme = 'light',
  onChangeNodeZOrder,
  onStartTeeCoordinateEdit,
  onOpenInfoPanel,
  onStartNodeRelation,
  onDetachNodeParentRelation,
  onStartNodeMove,
  onStartNodeResize,
  onDeleteSelection,
  onAddLayoutNode,
  onDetachRelation,
  onAddNode,
  onAddStandalonePipe,
  onMobileSheetHeightChange,
  onClose,
}: {
  contextMenu: ContextMenuState
  canStartCoordinateEdit: boolean
  canStartNodeRelation?: boolean
  canDetachNodeParentRelation?: boolean
  canStartNodeMove?: boolean
  canStartNodeResize?: boolean
  canDeleteSelection?: boolean
  isMobileSheet?: boolean
  theme?: WorkbenchTheme
  onChangeNodeZOrder: (action: ContextNodeZOrderAction) => void
  onStartTeeCoordinateEdit: () => void
  onOpenInfoPanel?: () => void
  onStartNodeRelation?: () => void
  onDetachNodeParentRelation?: () => void
  onStartNodeMove?: () => void
  onStartNodeResize?: () => void
  onDeleteSelection?: () => void
  onAddLayoutNode: (kind: LayoutAddKind, source: NonNullable<ContextMenuState['layoutAdd']>) => void
  onDetachRelation: () => void
  onAddNode: (type: EditorNodeType, point: Point) => void
  onAddStandalonePipe: (point: Point) => void
  onMobileSheetHeightChange?: (height: number) => void
  onClose: () => void
}) {
  const [mobileNodeMenuView, setMobileNodeMenuView] = useState<MobileNodeMenuView>('root')
  const mobileSheetRef = useRef<HTMLDivElement | null>(null)
  const isCanvasAddMenu = !contextMenu.nodeId && !contextMenu.baseGround && !contextMenu.layoutAdd && !contextMenu.relationPort
  const isMobileNodeMenu = Boolean(contextMenu.nodeId || contextMenu.baseGround)
  const hasTransparentMobileBackdrop = isCanvasAddMenu || isMobileNodeMenu
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
  const layoutAddToolbarClassName = isDark
    ? 'border-slate-700 bg-slate-950/96 text-slate-100 shadow-black/40'
    : 'border-slate-200 bg-white/96 text-slate-900 shadow-slate-900/20'
  const layoutAddButtonClassName = isDark
    ? 'border-slate-700 bg-slate-900 text-slate-100 hover:border-blue-400 hover:bg-blue-950'
    : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-blue-400 hover:bg-blue-50'
  const layoutAddIcons: Record<LayoutAddKind, string> = {
    ground: '🟫',
    river: '🏞️',
    sea: '🌊',
  }
  const mobileSheetTitle = contextMenu.baseGround || contextMenu.nodeId
    ? mobileNodeMenuView === 'zOrder'
      ? 'ZIndex 변경'
      : '객체 액션'
    : '편집 메뉴'

  useEffect(() => {
    if (!isMobileSheet || !onMobileSheetHeightChange) {
      return undefined
    }

    const sheet = mobileSheetRef.current
    if (!sheet) {
      onMobileSheetHeightChange(0)
      return undefined
    }

    const updateSheetHeight = () => {
      onMobileSheetHeightChange(sheet.getBoundingClientRect().height)
    }

    updateSheetHeight()
    const resizeObserver = new ResizeObserver(updateSheetHeight)
    resizeObserver.observe(sheet)

    return () => {
      resizeObserver.disconnect()
      onMobileSheetHeightChange(0)
    }
  }, [contextMenu, isMobileSheet, mobileNodeMenuView, onMobileSheetHeightChange])

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
          {canStartNodeRelation ? (
            <button
              type="button"
              onClick={() => {
                onStartNodeRelation?.()
                onClose()
              }}
              className={`block w-full px-5 py-3 text-left text-base font-black ${blueItemClassName}`}
            >
              관계형성
            </button>
          ) : null}
          {canDetachNodeParentRelation ? (
            <button
              type="button"
              onClick={() => {
                onDetachNodeParentRelation?.()
                onClose()
              }}
              className={`block w-full px-5 py-3 text-left text-base font-black ${roseItemClassName}`}
            >
              관계 해제
            </button>
          ) : null}
          {canStartNodeMove ? (
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
          ) : null}
          {canStartNodeResize ? (
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
          ) : null}
          {canDeleteSelection ? (
            <>
              <div className={`my-1 border-t ${dividerClassName}`} />
              <button
                type="button"
                onClick={() => {
                  onDeleteSelection?.()
                  onClose()
                }}
                className={`block w-full px-5 py-3 text-left text-base font-black ${roseItemClassName}`}
              >
                객체 삭제
              </button>
            </>
          ) : null}
        </>
      )}
    </>
  )

  const renderMobileBaseGroundMenu = () => (
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
    </>
  )

  const menuBodyContent = (
    <>
      {contextMenu.nodeId ? (
        <>
          {renderZOrderButtons()}
          {canDetachNodeParentRelation ? (
            <>
              <div className={`my-1 border-t ${dividerClassName}`} />
              <button
                type="button"
                onClick={() => {
                  onDetachNodeParentRelation?.()
                  onClose()
                }}
                className={`block w-full px-3 py-2 text-left text-sm font-black ${roseItemClassName}`}
              >
                관계 해제
              </button>
            </>
          ) : null}
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
              onClick={() => {
                onAddLayoutNode(kind, contextMenu.layoutAdd!)
                onClose()
              }}
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
  const menuContent = (
    <>
      <div className={`border-b px-3 py-2 text-xs font-black ${dividerClassName} ${headerTextClassName}`}>
        편집 메뉴
      </div>
      {menuBodyContent}
    </>
  )

  if (isMobileSheet) {
    return (
      <div
        className={`fixed inset-x-0 bottom-0 z-[230] flex items-end ${
          hasTransparentMobileBackdrop ? 'pointer-events-none bg-transparent' : 'bg-slate-950/55'
        }`}
        onClick={undefined}
      >
        <div
          ref={mobileSheetRef}
          data-editor-context-menu="true"
          className={`pointer-events-auto flex h-[50dvh] max-h-[50dvh] w-screen flex-col overflow-hidden rounded-t-2xl border-t pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-2xl ${menuFrameClassName}`}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="flex shrink-0 justify-center px-5 pb-1 pt-2">
            <span className={`h-1.5 w-12 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
          </div>
          <div className={`flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3 ${dividerClassName}`}>
            <h2 className="text-base font-black">{mobileSheetTitle}</h2>
            <button
              type="button"
              onClick={onClose}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
                isDark
                  ? 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
              }`}
              aria-label="바텀시트 닫기"
              title="닫기"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {contextMenu.baseGround ? renderMobileBaseGroundMenu() : contextMenu.nodeId ? renderMobileNodeMenu() : menuBodyContent}
          </div>
        </div>
      </div>
    )
  }

  if (contextMenu.layoutAdd) {
    return (
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[230] flex justify-center px-4 pb-7"
        onContextMenu={(event) => event.preventDefault()}
      >
        <div
          data-editor-context-menu="true"
          className={`pointer-events-auto grid w-full max-w-md grid-cols-3 gap-2 rounded-2xl border p-2 shadow-2xl backdrop-blur ${layoutAddToolbarClassName}`}
        >
          {LAYOUT_ADD_KIND_OPTIONS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                onAddLayoutNode(kind, contextMenu.layoutAdd!)
                onClose()
              }}
              className={`flex min-h-[86px] flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-center transition ${layoutAddButtonClassName}`}
            >
              <span className="text-2xl leading-none" aria-hidden="true">{layoutAddIcons[kind]}</span>
              <span className="text-sm font-black">{LAYOUT_ADD_KIND_LABELS[kind]}</span>
            </button>
          ))}
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
