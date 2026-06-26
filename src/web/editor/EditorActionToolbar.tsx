import type { ChangeEvent, RefObject } from 'react'

/** 편집 세팅의 JSON/INP 입출력 제어 버튼 묶음이다. */
export function EditorActionToolbar({
  isDark,
  controlBarClassName,
  isScenarioReadOnly,
  isScenarioEditMode,
  isExportingInp,
  isExportingPng,
  swmmEngineUrl,
  fileInputRef,
  onExportJson,
  onExportInp,
  onExportPng,
  onImport,
  onResetLayout,
  isSheet = false,
}: {
  isDark: boolean
  controlBarClassName: string
  isScenarioReadOnly: boolean
  isScenarioEditMode: boolean
  isExportingInp: boolean
  isExportingPng: boolean
  swmmEngineUrl: string
  fileInputRef: RefObject<HTMLInputElement | null>
  onExportJson: () => void
  onExportInp: () => void
  onExportPng: () => void
  onImport: (event: ChangeEvent<HTMLInputElement>) => void
  onResetLayout: () => void
  isSheet?: boolean
}) {
  return (
    <div className={`${isSheet ? '' : 'sticky top-0 z-40 shadow-sm backdrop-blur'} flex min-w-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${controlBarClassName}`}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onExportJson}
          className={`rounded-md border px-3 py-2 text-xs font-black ${
            isDark ? 'border-blue-900 bg-slate-900 text-blue-200 hover:bg-slate-800' : 'border-blue-300 bg-blue-100 text-blue-700 hover:bg-slate-100'
          }`}
        >
          JSON 내보내기
        </button>
        <button
          type="button"
          onClick={onExportInp}
          disabled={isExportingInp}
          className={`rounded-md border px-3 py-2 text-xs font-black disabled:cursor-wait disabled:opacity-60 ${
            isDark ? 'border-cyan-900 bg-slate-900 text-cyan-200 hover:bg-slate-800' : 'border-cyan-300 bg-cyan-100 text-cyan-700 hover:bg-slate-100'
          }`}
          title={`SWMM 엔진 서버: ${swmmEngineUrl}`}
        >
          {isExportingInp ? 'INP 생성 중' : 'INP 다운로드'}
        </button>
        <button
          type="button"
          onClick={onExportPng}
          disabled={isExportingPng}
          className={`rounded-md border px-3 py-2 text-xs font-black disabled:cursor-wait disabled:opacity-60 ${
            isDark ? 'border-purple-900 bg-slate-900 text-purple-200 hover:bg-slate-800' : 'border-purple-300 bg-purple-100 text-purple-700 hover:bg-slate-100'
          }`}
        >
          {isExportingPng ? 'PNG 인코딩 중' : '이미지로 내보내기'}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isScenarioReadOnly}
          className={`rounded-md border px-3 py-2 text-xs font-black ${
            isDark ? 'border-emerald-900 bg-slate-900 text-emerald-200 hover:bg-slate-800' : 'border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-slate-100'
          }`}
        >
          JSON 불러오기
        </button>
        <button
          type="button"
          onClick={onResetLayout}
          disabled={isScenarioReadOnly}
          className={`rounded-md border px-3 py-2 text-xs font-black ${
            isDark ? 'border-rose-900 bg-slate-900 text-rose-200 hover:bg-slate-800' : 'border-rose-300 bg-rose-100 text-rose-700 hover:bg-slate-100'
          }`}
        >
          {isScenarioEditMode ? '수정 초기화' : '기본 초기화'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onImport}
        />
      </div>
    </div>
  )
}
