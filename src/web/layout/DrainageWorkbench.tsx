import { EditorCanvas } from '../editor'
import { InfoPanelToggleButton, type InfoPanelControls } from './InfoPanelLayout'
import { MobileLandscapeNotice } from './MobileLandscapeNotice'
import { useMobileLandscapePreference } from './mobileLandscape'
import { SimulationWorkbench } from '../simulation/SimulationWorkbench'
import { WORKBENCH_THEME_TOKENS, type WorkbenchTheme } from '../theme/workbenchTheme'
import logoImage from '../../assets/supermario-logo.png'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'

const NotificationChatModal = lazy(() => import('../notifications/NotificationChatModal').then((module) => ({
  default: module.NotificationChatModal,
})))

export type WorkbenchMode = 'simulation' | 'editor'

interface DrainageWorkbenchProps {
  mode?: WorkbenchMode
  onModeChange?: (mode: WorkbenchMode) => void
  onLogout?: () => void
}

const VIEW_CONFIG: Record<
  WorkbenchMode,
  {
    label: string
    description: string
  }
> = {
  simulation: {
    label: '시뮬레이션',
    description: '편집 모드의 저장된 설계를 SWMM 엔진으로 실행하고 1초 tick 결과를 확인하는 화면입니다.',
  },
  editor: {
    label: '편집 모드',
    description: '드래그와 포트 클릭으로 배수 객체를 배치하고 SWMM형 nodes/links JSON을 만드는 화면입니다.',
  },
}

function getSystemWorkbenchTheme(): WorkbenchTheme {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function DrainageWorkbench({ mode, onModeChange, onLogout }: DrainageWorkbenchProps) {
  const [internalMode, setInternalMode] = useState<WorkbenchMode>('simulation')
  const [theme, setTheme] = useState<WorkbenchTheme>(() => getSystemWorkbenchTheme())
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false)
  const activeMode = mode ?? internalMode
  const config = VIEW_CONFIG[activeMode]
  const isDark = theme === 'dark'
  const themeTokens = WORKBENCH_THEME_TOKENS[theme]
  const {
    isMobileLike: isMobileLandscapeTarget,
    isPortrait: isMobilePortrait,
    landscapeModeSupport,
    requestLandscape,
  } = useMobileLandscapePreference(activeMode === 'editor')
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const syncSystemTheme = () => setTheme(mediaQuery.matches ? 'dark' : 'light')
    syncSystemTheme()
    mediaQuery.addEventListener('change', syncSystemTheme)

    return () => mediaQuery.removeEventListener('change', syncSystemTheme)
  }, [])
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }

    const previousDocumentBackground = document.documentElement.style.backgroundColor
    const previousBodyBackground = document.body.style.backgroundColor
    const backgroundColor = theme === 'dark' ? '#020617' : '#e2e8f0'

    document.documentElement.style.backgroundColor = backgroundColor
    document.body.style.backgroundColor = backgroundColor

    return () => {
      document.documentElement.style.backgroundColor = previousDocumentBackground
      document.body.style.backgroundColor = previousBodyBackground
    }
  }, [theme])

  const changeMode = useCallback((nextMode: WorkbenchMode) => {
    setInternalMode(nextMode)
    onModeChange?.(nextMode)
  }, [onModeChange])
  const mobileActionGridColumns = onLogout ? 'grid-cols-4' : 'grid-cols-3'

  const renderWorkbenchActions = useCallback((variant: 'desktop' | 'mobile' = 'desktop') => {
    const actionButtonClassName = variant === 'mobile'
      ? 'min-w-0 truncate whitespace-nowrap rounded-md border px-1.5 py-2 text-[10px] font-black leading-none transition sm:px-2 sm:text-xs'
      : 'shrink-0 rounded-md border px-3 py-2 text-xs font-black transition'

    return (
      <>
        {variant === 'desktop' ? (
          <button
            type="button"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            className={`${actionButtonClassName} ${themeTokens.button}`}
            title={isDark ? '화이트 모드' : '다크 모드'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        ) : null}
        {Object.entries(VIEW_CONFIG).map(([viewMode, viewConfig]) => (
          <button
            key={viewMode}
            type="button"
            onClick={() => changeMode(viewMode as WorkbenchMode)}
            className={`${actionButtonClassName} ${
              activeMode === viewMode
                ? themeTokens.buttonActive
                : themeTokens.buttonMuted
            }`}
          >
            {viewConfig.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIsNotificationModalOpen(true)}
          className={`${actionButtonClassName} ${themeTokens.buttonMuted}`}
        >
          알림 채팅방
        </button>
        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className={`${actionButtonClassName} ${themeTokens.buttonMuted}`}
          >
            로그아웃
          </button>
        ) : null}
      </>
    )
  }, [activeMode, changeMode, isDark, onLogout, themeTokens.button, themeTokens.buttonActive, themeTokens.buttonMuted])

  const renderWorkbenchHeader = useCallback((infoPanelControls?: InfoPanelControls) => (
    <>
      <header className={`hidden min-w-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-4 lg:flex ${themeTokens.header}`}>
        <div className="flex min-w-0 items-start gap-3">
          {infoPanelControls && !infoPanelControls.isInfoPanelOpen ? (
            <InfoPanelToggleButton
              theme={theme}
              isInfoPanelOpen={infoPanelControls.isInfoPanelOpen}
              toggleInfoPanel={infoPanelControls.toggleInfoPanel}
              className="mt-0.5"
            />
          ) : null}
          <div className="min-w-0">
            <h1 className="text-xl font-black">도시침수 배수도 React 작업장</h1>
            <p className={`mt-1 text-sm font-semibold ${themeTokens.description}`}>
              {config.description}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {renderWorkbenchActions()}
        </div>
      </header>
      <div className={`min-w-0 lg:hidden ${themeTokens.header}`}>
        <div className={`flex min-w-0 items-center gap-2 border-b px-3 py-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <img src={logoImage} alt="" className="h-8 w-8 shrink-0 rounded-md object-contain" />
          <div className="min-w-0 truncate text-base font-black tracking-normal">
            수퍼마리오
          </div>
        </div>
        <div className={`grid min-w-0 ${mobileActionGridColumns} gap-1.5 border-b px-2 py-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          {renderWorkbenchActions('mobile')}
        </div>
      </div>
    </>
  ), [config.description, isDark, mobileActionGridColumns, renderWorkbenchActions, theme, themeTokens.description, themeTokens.header])

  return (
    <main className={`min-h-screen min-w-0 overflow-x-hidden ${themeTokens.app}`}>
      <MobileLandscapeNotice
        active={false}
        isMobileLike={isMobileLandscapeTarget}
        isPortrait={isMobilePortrait}
        landscapeModeSupport={landscapeModeSupport}
        theme={theme}
        title="편집 모드는 가로 화면에 맞춰집니다."
        body="모바일 브라우저가 자동 회전을 막으면 기기를 가로로 돌리거나 다시 시도해주세요."
        onRetry={requestLandscape}
      />
      {activeMode === 'editor' ? (
        <EditorCanvas theme={theme} renderHeader={renderWorkbenchHeader} />
      ) : (
        <SimulationWorkbench theme={theme} renderHeader={renderWorkbenchHeader} />
      )}
      {isNotificationModalOpen ? (
        <Suspense fallback={null}>
          <NotificationChatModal
            theme={theme}
            onClose={() => setIsNotificationModalOpen(false)}
          />
        </Suspense>
      ) : null}
    </main>
  )
}
