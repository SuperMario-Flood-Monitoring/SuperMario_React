import { EditorCanvas } from '../editor'
import { InfoPanelToggleButton, type InfoPanelControls } from './InfoPanelLayout'
import { SimulationWorkbench } from '../simulation/SimulationWorkbench'
import { WORKBENCH_THEME_TOKENS, type WorkbenchTheme } from '../theme/workbenchTheme'
import { useState } from 'react'

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

export function DrainageWorkbench({ mode, onModeChange, onLogout }: DrainageWorkbenchProps) {
  const [internalMode, setInternalMode] = useState<WorkbenchMode>('simulation')
  const [theme, setTheme] = useState<WorkbenchTheme>('light')
  const activeMode = mode ?? internalMode
  const config = VIEW_CONFIG[activeMode]
  const isDark = theme === 'dark'
  const themeTokens = WORKBENCH_THEME_TOKENS[theme]
  const changeMode = (nextMode: WorkbenchMode) => {
    setInternalMode(nextMode)
    onModeChange?.(nextMode)
  }

  const renderWorkbenchHeader = (infoPanelControls?: InfoPanelControls) => (
      <header className={`flex min-w-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-4 ${themeTokens.header}`}>
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
          <button
            type="button"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            className={`rounded-md border px-3 py-2 text-xs font-black transition ${themeTokens.button}`}
            title={isDark ? '화이트 모드' : '다크 모드'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          {Object.entries(VIEW_CONFIG).map(([viewMode, viewConfig]) => (
            <button
              key={viewMode}
              type="button"
              onClick={() => changeMode(viewMode as WorkbenchMode)}
              className={`rounded-md border px-3 py-2 text-xs font-black transition ${
                activeMode === viewMode
                  ? themeTokens.buttonActive
                  : themeTokens.buttonMuted
              }`}
            >
              {viewConfig.label}
            </button>
          ))}
          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className={`rounded-md border px-3 py-2 text-xs font-black transition ${themeTokens.buttonMuted}`}
            >
              로그아웃
            </button>
          ) : null}
        </div>
      </header>
  )

  return (
    <main className={`min-h-screen min-w-0 overflow-x-hidden ${themeTokens.app}`}>
      {activeMode === 'editor' ? (
        <EditorCanvas theme={theme} renderHeader={renderWorkbenchHeader} />
      ) : (
        <SimulationWorkbench theme={theme} renderHeader={renderWorkbenchHeader} />
      )}
    </main>
  )
}
