import type { ReactNode } from 'react'
import { WORKBENCH_THEME_TOKENS, type WorkbenchTheme } from '../theme/workbenchTheme'

export interface InfoPanelControls {
  isInfoPanelOpen: boolean
  toggleInfoPanel: () => void
}

interface InfoPanelToggleButtonProps extends InfoPanelControls {
  theme: WorkbenchTheme
  className?: string
}

export function InfoPanelToggleButton({
  theme,
  isInfoPanelOpen,
  toggleInfoPanel,
  className = '',
}: InfoPanelToggleButtonProps) {
  const themeTokens = WORKBENCH_THEME_TOKENS[theme]

  return (
    <button
      type="button"
      onClick={toggleInfoPanel}
      aria-label={isInfoPanelOpen ? '정보 패널 닫기' : '정보 패널 열기'}
      title={isInfoPanelOpen ? '정보 패널 닫기' : '정보 패널 열기'}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition hover:scale-105 ${
        isInfoPanelOpen ? themeTokens.buttonActive : themeTokens.button
      } ${className}`}
    >
      <span className="block h-5 w-5 rounded-md border-2 border-current">
        <span className="ml-[5px] mt-[3px] block h-3 w-[2px] rounded-full bg-current" />
      </span>
    </button>
  )
}

interface InfoPanelFrameProps {
  theme: WorkbenchTheme
  title: string
  children: ReactNode
  controls?: InfoPanelControls
}

export function InfoPanelFrame({ theme, title, children, controls }: InfoPanelFrameProps) {
  const isDark = theme === 'dark'

  return (
    <aside className={`flex h-full w-[380px] flex-col overflow-hidden rounded-lg border shadow-sm ${
      isDark ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
    }`}>
      <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <h2 className="text-base font-black">{title}</h2>
        {controls ? (
          <InfoPanelToggleButton
            theme={theme}
            isInfoPanelOpen={controls.isInfoPanelOpen}
            toggleInfoPanel={controls.toggleInfoPanel}
          />
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {children}
      </div>
    </aside>
  )
}

interface InlineInfoPanelProps extends InfoPanelFrameProps {
  isOpen: boolean
}

export function InlineInfoPanel({
  theme,
  title,
  children,
  isOpen,
  controls,
}: InlineInfoPanelProps) {
  return (
    <div
      className={`order-first h-[calc(100vh-32px)] min-h-[640px] shrink-0 overflow-hidden transition-[width,margin,opacity] duration-200 ${
        isOpen ? 'mr-3 w-[380px] opacity-100' : 'pointer-events-none mr-0 w-0 opacity-0'
      }`}
    >
      <InfoPanelFrame theme={theme} title={title} controls={isOpen ? controls : undefined}>
        {children}
      </InfoPanelFrame>
    </div>
  )
}

interface FullscreenInfoPanelProps extends InfoPanelFrameProps {
  isOpen: boolean
}

export function FullscreenInfoPanel({
  theme,
  title,
  children,
  isOpen,
  controls,
}: FullscreenInfoPanelProps) {
  return (
    <div
      className={`h-full shrink-0 overflow-hidden transition-[width,margin,opacity] duration-200 ${
        isOpen ? 'mr-3 w-[380px] opacity-100' : 'pointer-events-none mr-0 w-0 opacity-0'
      }`}
    >
      <InfoPanelFrame theme={theme} title={title} controls={isOpen ? controls : undefined}>
        {children}
      </InfoPanelFrame>
    </div>
  )
}
