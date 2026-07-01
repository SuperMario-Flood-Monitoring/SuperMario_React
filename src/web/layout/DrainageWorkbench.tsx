import { EditorCanvas } from '../editor'
import { InfoPanelToggleButton, type InfoPanelControls } from './InfoPanelLayout'
import { MobileLandscapeNotice } from './MobileLandscapeNotice'
import { useMobileLandscapePreference } from './mobileLandscape'
import { SimulationWorkbench } from '../simulation/SimulationWorkbench'
import { HazardLogsPage } from '../logs/HazardLogsPage'
import { WORKBENCH_THEME_TOKENS, type WorkbenchTheme } from '../theme/workbenchTheme'
import logoImage from '../../assets/supermario-logo.png'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'

const NotificationChatModal = lazy(() => import('../notifications/NotificationChatModal').then((module) => ({
  default: module.NotificationChatModal,
})))

export type WorkbenchMode = 'simulation' | 'editor' | 'logs'

interface DrainageWorkbenchProps {
  mode?: WorkbenchMode
  onModeChange?: (mode: WorkbenchMode) => void
  simulationFullscreenActive?: boolean
  onSimulationFullscreenChange?: (active: boolean) => void
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
    description: '편집 모드의 저장된 설계를 SWMM 엔진으로 실행하고 실시간 결과를 확인하는 화면입니다.',
  },
  editor: {
    label: '편집 모드',
    description: '드래그와 포트 클릭으로 배수 객체를 배치하고 SWMM형 nodes/links JSON을 만드는 화면입니다.',
  },
  logs: {
    label: '위험 로그',
    description: 'SWMM runtime이 위험으로 판정한 로그를 확인하고 현장 조치 이력을 저장하는 화면입니다.',
  },
}

function getSystemWorkbenchTheme(): WorkbenchTheme {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function NotificationChatModalFallback({ theme, onClose }: { theme: WorkbenchTheme; onClose: () => void }) {
  const isDark = theme === 'dark'
  const panelClass = isDark
    ? 'border-slate-700 bg-slate-950 text-slate-100'
    : 'border-slate-200 bg-white text-slate-950'
  const mutedTextClass = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-chat-modal-fallback-title"
      onMouseDown={onClose}
    >
      <section
        className={`flex max-h-[86vh] w-full max-w-[720px] flex-col rounded-lg border shadow-2xl ${panelClass}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={`flex items-start justify-between gap-4 border-b p-5 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div>
            <h2 id="notification-chat-modal-fallback-title" className="text-lg font-black">알림 등록</h2>
            <p className={`mt-1 text-sm font-semibold ${mutedTextClass}`}>등록 목록 확인 중</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-md border px-3 py-2 text-xs font-black transition ${isDark ? 'border-slate-700 bg-slate-900 hover:bg-slate-800' : 'border-slate-300 bg-white hover:bg-slate-100'}`}
          >
            닫기
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className={`animate-pulse rounded-lg border p-4 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}
            >
              <div className={`h-4 w-28 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
              <div className={`mt-3 h-3 w-48 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <div className={`mt-3 h-3 w-36 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            </div>
          ))}
        </div>
        <footer className={`flex justify-end border-t p-5 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <button
            type="button"
            disabled
            className="rounded-md border border-emerald-500 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 opacity-50"
          >
            추가
          </button>
        </footer>
      </section>
    </div>
  )
}

export function DrainageWorkbench({
  mode,
  onModeChange,
  simulationFullscreenActive = false,
  onSimulationFullscreenChange,
  onLogout,
}: DrainageWorkbenchProps) {
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
  const mobileActionGridColumns = onLogout ? 'grid-cols-5' : 'grid-cols-4'

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
          알림 등록
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
        <div className={`flex min-w-0 items-start gap-3 transition-[padding] duration-200 ${
          infoPanelControls?.isInfoPanelOpen ? 'lg:pl-[430px]' : ''
        }`}>
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
      ) : activeMode === 'logs' ? (
        <HazardLogsPage theme={theme} renderHeader={renderWorkbenchHeader} />
      ) : (
        <SimulationWorkbench
          theme={theme}
          renderHeader={renderWorkbenchHeader}
          fullscreenRouteActive={simulationFullscreenActive}
          onFullscreenRouteChange={onSimulationFullscreenChange}
        />
      )}
      {isNotificationModalOpen ? (
        <Suspense fallback={<NotificationChatModalFallback theme={theme} onClose={() => setIsNotificationModalOpen(false)} />}>
          <NotificationChatModal
            theme={theme}
            onClose={() => setIsNotificationModalOpen(false)}
          />
        </Suspense>
      ) : null}
    </main>
  )
}
