import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react'
import type { WorkbenchTheme } from '../theme/workbenchTheme'
import { CloseIcon } from './MobileIcons'
import { MobilePortal } from './MobilePortal'
import { useBodyScrollLock } from './useBodyScrollLock'

interface MobileBottomSheetProps {
  theme: WorkbenchTheme
  title: string
  description?: ReactNode
  titleId?: string
  closeLabel: string
  children: ReactNode
  onClose: () => void
  sectionRef?: RefObject<HTMLElement | HTMLDivElement | null>
  onHeightChange?: (height: number) => void
  zIndexClassName?: string
  overlayClassName?: string
  backdropClassName?: string
  sheetClassName?: string
  bodyClassName?: string
  bottomSpacerClassName?: string
  dataEditorContextMenu?: boolean
  role?: 'dialog'
  ariaModal?: boolean
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void
}

export function MobileBottomSheet({
  theme,
  title,
  description,
  titleId,
  closeLabel,
  children,
  onClose,
  sectionRef,
  onHeightChange,
  zIndexClassName = 'z-[220]',
  overlayClassName = 'fixed bottom-0 left-0 right-0 top-[var(--app-visual-offset-top,0px)] flex h-[var(--app-visual-height,100dvh)] items-end',
  backdropClassName = 'bg-slate-950/55',
  sheetClassName,
  bodyClassName = 'min-h-0 overflow-y-auto px-5 pb-4 pt-4',
  bottomSpacerClassName = 'h-[calc(env(safe-area-inset-bottom)+12px)]',
  dataEditorContextMenu = false,
  role = 'dialog',
  ariaModal = true,
  onContextMenu,
}: MobileBottomSheetProps) {
  const internalSectionRef = useRef<HTMLElement | HTMLDivElement | null>(null)
  const isDark = theme === 'dark'
  const sheetThemeClassName = isDark
    ? 'border-slate-800 bg-slate-950 text-slate-100'
    : 'border-slate-200 bg-white text-slate-900'
  const dividerClassName = isDark ? 'border-slate-800' : 'border-slate-200'

  useBodyScrollLock(true)

  const setSectionNode = useCallback((node: HTMLElement | HTMLDivElement | null) => {
    internalSectionRef.current = node

    if (sectionRef) {
      sectionRef.current = node
    }
  }, [sectionRef])

  useEffect(() => {
    if (!onHeightChange) {
      return undefined
    }

    const sheet = internalSectionRef.current
    if (!sheet) {
      onHeightChange(0)
      return undefined
    }

    const updateSheetHeight = () => {
      onHeightChange(sheet.getBoundingClientRect().height)
    }

    updateSheetHeight()
    const resizeObserver = new ResizeObserver(updateSheetHeight)
    resizeObserver.observe(sheet)

    return () => {
      resizeObserver.disconnect()
      onHeightChange(0)
    }
  }, [children, onHeightChange, title])

  return (
    <MobilePortal>
    <div
      className={`${overlayClassName} ${zIndexClassName} ${backdropClassName}`}
      role={role}
      aria-modal={ariaModal}
      aria-labelledby={titleId}
    >
      <section
        ref={setSectionNode}
        data-editor-context-menu={dataEditorContextMenu ? 'true' : undefined}
        className={sheetClassName ?? `flex max-h-[50dvh] w-screen flex-col overflow-hidden rounded-t-2xl border-t shadow-2xl ${sheetThemeClassName}`}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={onContextMenu}
      >
        <header className={`flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4 ${dividerClassName}`}>
          <div>
            <h2 id={titleId} className="text-base font-black">{title}</h2>
            {description ? (
              <p className={`mt-1 text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
              isDark
                ? 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
            }`}
            aria-label={closeLabel}
            title="닫기"
          >
            <CloseIcon />
          </button>
        </header>
        <div className={bodyClassName}>
          {children}
        </div>
        <div className={`shrink-0 ${bottomSpacerClassName}`} aria-hidden="true" />
      </section>
    </div>
    </MobilePortal>
  )
}
