import { useEffect, useRef } from 'react'
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
import { MobileBottomSheet } from '../ui/MobileBottomSheet'

export type ContextNodeZOrderAction = 'bringForward' | 'sendBackward' | 'bringToFront' | 'sendToBack'

/** 캔버스/노드/relation/지형 추가 상황에 맞는 우클릭 편집 메뉴를 렌더링한다. */
export function EditorContextMenu({
  contextMenu,
  canStartCoordinateEdit,
  canStartNodeRelation,
  canDetachNodeParentRelation,
  canOpenNodeKindSheet,
  nodeKindSheetLabel = '객체 종류 변경',
  isMobileSheet = false,
  theme = 'light',
  onChangeNodeZOrder,
  onStartTeeCoordinateEdit,
  onOpenInfoPanel,
  onStartNodeRelation,
  onDetachNodeParentRelation,
  onOpenNodeKindSheet,
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
  canOpenNodeKindSheet?: boolean
  nodeKindSheetLabel?: string
  isMobileSheet?: boolean
  theme?: WorkbenchTheme
  onChangeNodeZOrder: (action: ContextNodeZOrderAction) => void
  onStartTeeCoordinateEdit: () => void
  onOpenInfoPanel?: () => void
  onStartNodeRelation?: () => void
  onDetachNodeParentRelation?: () => void
  onOpenNodeKindSheet?: () => void
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
  const mobileAddToolbarFrameRef = useRef<HTMLDivElement | null>(null)
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
  const mobileAddToolbarClassName = isDark
    ? 'border-white/10 bg-black/92 text-slate-100'
    : 'border-slate-200 bg-white/95 text-slate-900'
  const mobileAddButtonClassName = isDark
    ? 'border-white/10 bg-slate-950/85 active:bg-slate-900'
    : 'border-slate-200 bg-slate-50 active:bg-white'
  const mobileSheetTitle = contextMenu.baseGround || contextMenu.nodeId
    ? '객체 액션'
    : '편집 메뉴'

  useEffect(() => {
    if (!isMobileSheet || !isCanvasAddMenu || !onMobileSheetHeightChange) {
      return undefined
    }

    const toolbarFrame = mobileAddToolbarFrameRef.current
    if (!toolbarFrame) {
      onMobileSheetHeightChange(0)
      return undefined
    }

    const updateToolbarHeight = () => {
      onMobileSheetHeightChange(toolbarFrame.getBoundingClientRect().height)
    }

    updateToolbarHeight()
    const resizeObserver = new ResizeObserver(updateToolbarHeight)
    resizeObserver.observe(toolbarFrame)

    return () => {
      resizeObserver.disconnect()
      onMobileSheetHeightChange(0)
    }
  }, [isCanvasAddMenu, isMobileSheet, onMobileSheetHeightChange])

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
      {canOpenNodeKindSheet ? (
        <button
          type="button"
          onClick={() => {
            onOpenNodeKindSheet?.()
            onClose()
          }}
          className={`block w-full px-5 py-3 text-left text-base font-black ${itemClassName}`}
        >
          {nodeKindSheetLabel}
        </button>
      ) : null}
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
  const menuContent = (
    <>
      <div className={`border-b px-3 py-2 text-xs font-black ${dividerClassName} ${headerTextClassName}`}>
        편집 메뉴
      </div>
      {menuBodyContent}
    </>
  )

  if (isMobileSheet) {
    if (isCanvasAddMenu) {
      return (
        <div
          ref={mobileAddToolbarFrameRef}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[230] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
          data-editor-context-menu="true"
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            className={`pointer-events-auto grid w-full max-w-sm grid-cols-3 gap-2 rounded-2xl border p-2 shadow-2xl backdrop-blur ${mobileAddToolbarClassName}`}
          >
            <button
              type="button"
              onClick={() => {
                onAddNode('facility', contextMenu.point)
                onClose()
              }}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center transition ${mobileAddButtonClassName}`}
              aria-label="시설 추가"
              title="시설 추가"
            >
              <span className="text-2xl leading-none" aria-hidden="true">🏭</span>
              <span className="text-[11px] font-black leading-none">시설</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onAddNode('connector', contextMenu.point)
                onClose()
              }}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center transition ${mobileAddButtonClassName}`}
              aria-label="커넥터 추가"
              title="커넥터 추가"
            >
              <span className="text-2xl leading-none" aria-hidden="true">🔌</span>
              <span className="text-[11px] font-black leading-none">커넥터</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onAddStandalonePipe(contextMenu.point)
                onClose()
              }}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center transition ${mobileAddButtonClassName}`}
              aria-label="파이프 추가"
              title="파이프 추가"
            >
              <span className="text-2xl leading-none" aria-hidden="true">➡️</span>
              <span className="text-[11px] font-black leading-none">파이프</span>
            </button>
          </div>
        </div>
      )
    }

    return (
      <MobileBottomSheet
        theme={theme}
        title={mobileSheetTitle}
        closeLabel="바텀시트 닫기"
        zIndexClassName="z-[230]"
        overlayClassName="fixed inset-x-0 bottom-0 flex items-end"
        backdropClassName={hasTransparentMobileBackdrop ? 'pointer-events-none bg-transparent' : 'bg-slate-950/55'}
        sheetClassName={`pointer-events-auto flex max-h-[50dvh] w-screen flex-col overflow-hidden rounded-t-2xl border-t pb-[calc(env(safe-area-inset-bottom)+8px)] shadow-2xl ${menuFrameClassName}`}
        bodyClassName="min-h-0 overflow-y-auto"
        dataEditorContextMenu
        role={undefined}
        ariaModal={undefined}
        onHeightChange={onMobileSheetHeightChange}
        onClose={onClose}
        onContextMenu={(event) => event.preventDefault()}
      >
        {contextMenu.baseGround ? renderMobileBaseGroundMenu() : contextMenu.nodeId ? renderMobileNodeMenu() : menuBodyContent}
      </MobileBottomSheet>
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
