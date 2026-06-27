import { useCallback, useEffect, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useBodyScrollLock } from '../../mobile/ui/useBodyScrollLock'

type BottomSheetTheme = 'light' | 'dark'

interface MobileBottomSheetProps {
  theme: BottomSheetTheme
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
  headerClassName?: string
  bodyClassName?: string
  bottomSpacerClassName?: string
  closeButtonClassName?: string
  closeButtonContent?: ReactNode
  dataEditorContextMenu?: boolean
  role?: 'dialog'
  ariaModal?: boolean
  lockBodyScroll?: boolean
  onBackdropClick?: () => void
  onWheel?: (event: React.WheelEvent<HTMLDivElement>) => void
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void
}

function DefaultCloseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  )
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
  headerClassName,
  bodyClassName = 'min-h-0 overflow-y-auto px-5 pb-4 pt-4',
  bottomSpacerClassName = 'h-[calc(env(safe-area-inset-bottom)+40px)]',
  closeButtonClassName,
  closeButtonContent,
  dataEditorContextMenu = false,
  role = 'dialog',
  ariaModal = true,
  lockBodyScroll = true,
  onBackdropClick,
  onWheel,
  onContextMenu,
}: MobileBottomSheetProps) {
  const internalSectionRef = useRef<HTMLElement | HTMLDivElement | null>(null)
  const isDark = theme === 'dark'
  const sheetThemeClassName = isDark
    ? 'border-slate-800 bg-slate-950 text-slate-100'
    : 'border-slate-200 bg-white text-slate-900'
  const dividerClassName = isDark ? 'border-slate-800' : 'border-slate-200'
  const resolvedCloseButtonClassName = closeButtonClassName ?? `flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
    isDark
      ? 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800'
      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
  }`

  useBodyScrollLock(lockBodyScroll)

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

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className={`${overlayClassName} ${zIndexClassName} ${backdropClassName}`}
      role={role}
      aria-modal={ariaModal}
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onBackdropClick?.()
        }
      }}
      onWheel={onWheel}
    >
      <section
        ref={setSectionNode}
        data-editor-context-menu={dataEditorContextMenu ? 'true' : undefined}
        className={sheetClassName ?? `flex max-h-[50dvh] w-screen flex-col overflow-hidden rounded-t-2xl border-t shadow-2xl ${sheetThemeClassName}`}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={onContextMenu}
      >
        <header className={headerClassName ?? `flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4 ${dividerClassName}`}>
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
            className={resolvedCloseButtonClassName}
            aria-label={closeLabel}
            title={closeLabel}
          >
            {closeButtonContent ?? <DefaultCloseIcon />}
          </button>
        </header>
        <div className={bodyClassName}>
          {children}
        </div>
        <div className={`shrink-0 ${bottomSpacerClassName}`} aria-hidden="true" />
      </section>
    </div>,
    document.body,
  )
}
