import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  completeHazardAction,
  getHazardLogDetail,
  listHazardLogs,
  startHazardAction,
  type HazardActionRecord,
  type HazardLogDetail,
  type HazardLogRecord,
} from '../../services/hazards/hazards'
import { formatHazardDetail, formatHazardTypeLabel } from '../../shared/hazards/hazardDisplay'
import { getSwmmWebSocketUrl } from '../../services/swmm/client'
import { isRealtimeSnapshot } from '../../services/swmm/editorRuntime'
import { SWMM_ENGINE_URL } from '../editor/editorDefinitions'
import { WORKBENCH_THEME_TOKENS, type WorkbenchTheme } from '../theme/workbenchTheme'
import { useBodyScrollLock } from '../ui/useBodyScrollLock'

interface HazardLogsPageProps {
  theme?: WorkbenchTheme
  renderHeader?: () => ReactNode
}

const STATUS_LABELS: Record<HazardLogRecord['status'], string> = {
  OPEN: '조치 전',
  IN_PROGRESS: '조치 중',
  RESOLVED: '조치 후',
}

type StatusFilterState = Record<HazardLogRecord['status'], boolean>
type TimeSortDirection = 'asc' | 'desc'

const DEFAULT_STATUS_FILTER: StatusFilterState = {
  OPEN: true,
  IN_PROGRESS: true,
  RESOLVED: false,
}

const STATUS_FILTER_OPTIONS: HazardLogRecord['status'][] = ['OPEN', 'IN_PROGRESS', 'RESOLVED']

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR')
}

function getLatestOpenAction(actions: HazardActionRecord[]) {
  return [...actions].reverse().find((action) => !action.resultDetail) ?? null
}

function StatusBadge({ status }: { status: HazardLogRecord['status'] }) {
  const className = status === 'RESOLVED'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'IN_PROGRESS'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-rose-200 bg-rose-50 text-rose-700'

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${className}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function getLogDisplayContent(log: HazardLogRecord) {
  if (log.status === 'IN_PROGRESS' && log.actionDetail) {
    return log.actionDetail
  }

  if (log.status === 'RESOLVED' && log.resultDetail) {
    return log.resultDetail
  }

  return formatHazardDetail(log.hazardDetail)
}

function HelpSheet({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
  const mutedTextClass = isDark ? 'text-slate-400' : 'text-slate-500'
  const itemClass = isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-[var(--app-visual-offset-top,0px)] z-[240] flex h-[var(--app-visual-height,100dvh)] items-end justify-center bg-slate-950/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hazard-help-sheet-title"
      onMouseDown={onClose}
    >
      <section
        className={`flex max-h-[82dvh] w-screen flex-col rounded-t-2xl border-x-0 border-b-0 border-t shadow-2xl ${
          isDark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-950'
        }`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center px-5 pt-3">
          <span className={`h-1.5 w-12 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
        </div>
        <header className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="min-w-0">
            <h2 id="hazard-help-sheet-title" className="text-base font-black">위험 로그 도움말</h2>
            <p className={`mt-1 text-xs font-bold ${mutedTextClass}`}>각 항목이 의미하는 정보를 확인합니다.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`min-w-0 whitespace-normal break-keep rounded-md border px-3 py-2 text-xs font-black leading-tight transition ${
              isDark ? 'border-slate-700 bg-slate-900 hover:bg-slate-800' : 'border-slate-300 bg-white hover:bg-slate-100'
            }`}
          >
            닫기
          </button>
        </header>
        <div className="scrollbar-hidden min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm font-bold leading-6">
          <div className={`rounded-lg border p-4 ${itemClass}`}>
            <h3 className="font-black">우선순위</h3>
            <p className={`mt-2 ${mutedTextClass}`}>위험한 정도와 현장 조치 순서를 나타냅니다.</p>
            <p className="mt-2 font-black">P1 긴급 | P2 위험 | P3 경고 | P4 주의</p>
            <p className={`mt-2 ${mutedTextClass}`}>등급 뒤 숫자는 시스템이 계산한 점수이며 높을수록 더 위험합니다.</p>
          </div>
          <div className={`rounded-lg border p-4 ${itemClass}`}>
            <h3 className="font-black">대상</h3>
            <p className={`mt-2 ${mutedTextClass}`}>위험이 발생한 SWMM node/link 또는 편집 객체 ID입니다.</p>
          </div>
          <div className={`rounded-lg border p-4 ${itemClass}`}>
            <h3 className="font-black">내용</h3>
            <p className={`mt-2 ${mutedTextClass}`}>위험 판정 이유와 주요 수치를 사람이 읽기 쉬운 형태로 표시합니다.</p>
          </div>
          <div className={`rounded-lg border p-4 ${itemClass}`}>
            <h3 className="font-black">유형</h3>
            <p className={`mt-2 ${mutedTextClass}`}>위험 종류를 현장 용어로 바꿔 표시합니다.</p>
          </div>
        </div>
        <div className="h-[calc(env(safe-area-inset-bottom)+16px)] shrink-0" aria-hidden="true" />
      </section>
    </div>
  )
}

function HazardActionSheet({
  detail,
  isDark,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  detail: HazardLogDetail
  isDark: boolean
  isSubmitting: boolean
  error: string
  onClose: () => void
  onSubmit: (input: { actionDetail?: string; resultDetail?: string; recurrenceNote?: string }) => void
}) {
  const [actionDetail, setActionDetail] = useState('')
  const [resultDetail, setResultDetail] = useState('')
  const [recurrenceNote, setRecurrenceNote] = useState('')
  const isCompleteStep = detail.status === 'IN_PROGRESS'
  const fieldClass = isDark
    ? 'border-slate-700 bg-slate-950 text-slate-100 focus:border-sky-400 focus:ring-sky-900/40'
    : 'border-slate-300 bg-white text-slate-950 focus:border-sky-500 focus:ring-sky-100'

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit(isCompleteStep ? { resultDetail, recurrenceNote } : { actionDetail })
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-[var(--app-visual-offset-top,0px)] z-[240] flex h-[var(--app-visual-height,100dvh)] items-end justify-center bg-slate-950/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hazard-action-sheet-title"
      onMouseDown={onClose}
    >
      <section
        className={`flex max-h-[88dvh] w-screen flex-col rounded-t-2xl border-x-0 border-b-0 border-t shadow-2xl ${
          isDark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-950'
        }`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center px-5 pt-3">
          <span className={`h-1.5 w-12 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
        </div>
        <header className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="min-w-0">
            <h2 id="hazard-action-sheet-title" className="text-base font-black">위험 로그 조치</h2>
            <p className={`mt-1 line-clamp-2 text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {formatHazardDetail(detail.hazardDetail)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`min-w-0 whitespace-normal break-keep rounded-md border px-3 py-2 text-xs font-black leading-tight transition ${
              isDark ? 'border-slate-700 bg-slate-900 hover:bg-slate-800' : 'border-slate-300 bg-white hover:bg-slate-100'
            }`}
          >
            닫기
          </button>
        </header>

        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-md border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
              <div className="text-[10px] font-black uppercase text-slate-500">상태</div>
              <div className="mt-2"><StatusBadge status={detail.status} /></div>
            </div>
            <div className={`rounded-md border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
              <div className="text-[10px] font-black uppercase text-slate-500">우선순위</div>
              <div className="mt-2 text-sm font-black">{detail.priorityBand} / {detail.priorityScore.toFixed(1)}</div>
            </div>
          </div>
          <div className="mt-3 break-all font-mono text-xs font-bold text-slate-500">{detail.targetId}</div>

          {error ? (
            <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
              {error}
            </p>
          ) : null}

          <form onSubmit={submit} className="mt-4 space-y-4">
            {isCompleteStep ? (
              <>
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">결과</span>
                  <textarea
                    value={resultDetail}
                    onChange={(event) => setResultDetail(event.target.value)}
                    disabled={isSubmitting}
                    rows={4}
                    className={`mt-2 w-full rounded-md border px-3 py-2 text-sm font-bold outline-none transition focus:ring-4 ${fieldClass}`}
                    placeholder="토사 제거 후 수위 안정화"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">재발 시 참고사항</span>
                  <textarea
                    value={recurrenceNote}
                    onChange={(event) => setRecurrenceNote(event.target.value)}
                    disabled={isSubmitting}
                    rows={3}
                    className={`mt-2 w-full rounded-md border px-3 py-2 text-sm font-bold outline-none transition focus:ring-4 ${fieldClass}`}
                    placeholder="폭우 시 상류 맨홀 우선 점검"
                  />
                </label>
              </>
            ) : (
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">조치 내용</span>
                <textarea
                  value={actionDetail}
                  onChange={(event) => setActionDetail(event.target.value)}
                  disabled={isSubmitting || detail.status === 'RESOLVED'}
                  rows={4}
                  className={`mt-2 w-full rounded-md border px-3 py-2 text-sm font-bold outline-none transition focus:ring-4 ${fieldClass}`}
                  placeholder="하류 관로 현장 점검 진행"
                />
              </label>
            )}

            <button
              type="submit"
              disabled={isSubmitting || detail.status === 'RESOLVED'}
              className="h-11 w-full rounded-md border border-sky-600 bg-sky-600 px-4 text-sm font-black text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? '저장 중' : '확인'}
            </button>
          </form>
        </div>
        <div className="h-[calc(env(safe-area-inset-bottom)+16px)] shrink-0" aria-hidden="true" />
      </section>
    </div>
  )
}

export function HazardLogsPage({ theme = 'light', renderHeader }: HazardLogsPageProps) {
  const isDark = theme === 'dark'
  const themeTokens = WORKBENCH_THEME_TOKENS[theme]
  const [logs, setLogs] = useState<HazardLogRecord[]>([])
  const [bufferedLogCount, setBufferedLogCount] = useState(0)
  const [isSocketConnected, setIsSocketConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDetail, setSelectedDetail] = useState<HazardLogDetail | null>(null)
  const [modalError, setModalError] = useState('')
  const [isModalLoading, setIsModalLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilterState>(DEFAULT_STATUS_FILTER)
  const [timeSortDirection, setTimeSortDirection] = useState<TimeSortDirection>('desc')
  const seenSocketEventsRef = useRef(new Set<string>())
  useBodyScrollLock(Boolean(selectedDetail) || isHelpOpen)

  useEffect(() => {
    const root = document.documentElement
    const updateVisualViewportVars = () => {
      const visualViewport = window.visualViewport
      const height = visualViewport?.height ?? window.innerHeight
      const offsetTop = visualViewport?.offsetTop ?? 0

      root.style.setProperty('--app-visual-height', `${height}px`)
      root.style.setProperty('--app-visual-offset-top', `${offsetTop}px`)
    }

    updateVisualViewportVars()
    window.addEventListener('resize', updateVisualViewportVars)
    window.visualViewport?.addEventListener('resize', updateVisualViewportVars)
    window.visualViewport?.addEventListener('scroll', updateVisualViewportVars)

    return () => {
      window.removeEventListener('resize', updateVisualViewportVars)
      window.visualViewport?.removeEventListener('resize', updateVisualViewportVars)
      window.visualViewport?.removeEventListener('scroll', updateVisualViewportVars)
    }
  }, [])

  const refreshLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      setLogs(await listHazardLogs())
      setBufferedLogCount(0)
      seenSocketEventsRef.current.clear()
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '위험 로그를 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void refreshLogs()
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [refreshLogs])

  useEffect(() => {
    const socket = new WebSocket(getSwmmWebSocketUrl(SWMM_ENGINE_URL))
    socket.onopen = () => setIsSocketConnected(true)
    socket.onclose = () => setIsSocketConnected(false)
    socket.onerror = () => setIsSocketConnected(false)
    socket.onmessage = (event) => {
      try {
        const payload: unknown = JSON.parse(event.data)
        if (!isRealtimeSnapshot(payload)) {
          return
        }

        const criticalEvents = payload.risk?.events.filter((riskEvent) => riskEvent.severity === 'CRITICAL') ?? []
        let addedCount = 0
        criticalEvents.forEach((riskEvent) => {
          const eventKey = `${riskEvent.eventId}:${payload.runId ?? ''}`
          if (!seenSocketEventsRef.current.has(eventKey)) {
            seenSocketEventsRef.current.add(eventKey)
            addedCount += 1
          }
        })

        if (addedCount > 0) {
          setBufferedLogCount((currentCount) => currentCount + addedCount)
        }
      } catch {
        setIsSocketConnected(false)
      }
    }

    return () => socket.close()
  }, [])

  const openLog = async (log: HazardLogRecord) => {
    setIsModalLoading(true)
    setModalError('')
    try {
      setSelectedDetail(await getHazardLogDetail(log.id))
    } catch (detailError) {
      setModalError(detailError instanceof Error ? detailError.message : '위험 로그 상세를 불러오지 못했습니다.')
      setSelectedDetail({
        ...log,
        runId: null,
        stepIndex: null,
        modelTime: null,
        metricsSnapshot: {},
        actions: [],
      })
    } finally {
      setIsModalLoading(false)
    }
  }

  const submitAction = async (input: { actionDetail?: string; resultDetail?: string; recurrenceNote?: string }) => {
    if (!selectedDetail) {
      return
    }

    if (selectedDetail.status === 'OPEN' && !input.actionDetail?.trim()) {
      setModalError('조치 내용을 입력해주세요.')
      return
    }

    if (selectedDetail.status === 'IN_PROGRESS' && !input.resultDetail?.trim()) {
      setModalError('결과를 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    setModalError('')
    try {
      if (selectedDetail.status === 'OPEN') {
        const selectedLogId = selectedDetail.id
        setSelectedDetail(null)
        const action = await startHazardAction(selectedDetail.id, { actionDetail: input.actionDetail ?? '' })
        setLogs((currentLogs) => currentLogs.map((log) => (
          log.id === selectedLogId ? { ...log, status: 'IN_PROGRESS', actionDetail: action.actionDetail } : log
        )))
        return
      }

      const action = getLatestOpenAction(selectedDetail.actions)
      if (!action) {
        throw new Error('완료 처리할 조치 이력을 찾지 못했습니다.')
      }

      await completeHazardAction(selectedDetail.id, action.id, {
        resultDetail: input.resultDetail ?? '',
        recurrenceNote: input.recurrenceNote,
      })
      setLogs((currentLogs) => currentLogs.map((log) => (
        log.id === selectedDetail.id
          ? {
            ...log,
            status: 'RESOLVED',
            resultDetail: input.resultDetail?.trim(),
            recurrenceNote: input.recurrenceNote?.trim(),
          }
          : log
      )))
      setSelectedDetail(null)
    } catch (submitError) {
      setModalError(submitError instanceof Error ? submitError.message : '위험 조치를 저장하지 못했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const headerElement = renderHeader ? renderHeader() : null
  const rows = useMemo(() => (
    logs
      .filter((log) => statusFilter[log.status])
      .sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime()
        const bTime = new Date(b.createdAt).getTime()
        const safeATime = Number.isFinite(aTime) ? aTime : 0
        const safeBTime = Number.isFinite(bTime) ? bTime : 0
        return timeSortDirection === 'desc'
          ? safeBTime - safeATime
          : safeATime - safeBTime
      })
  ), [logs, statusFilter, timeSortDirection])
  const activeStatusLabels = STATUS_FILTER_OPTIONS
    .filter((status) => statusFilter[status])
    .map((status) => STATUS_LABELS[status])
    .join(', ')

  return (
    <section className={`min-h-screen min-w-0 overflow-hidden ${themeTokens.app}`} data-swmm-theme={theme}>
      {headerElement ? (
        <>
          <div className="fixed inset-x-0 top-0 z-50">{headerElement}</div>
          <div className="pointer-events-none invisible" aria-hidden="true">{headerElement}</div>
        </>
      ) : null}

      <div className={`flex h-[calc(100dvh-104px)] min-h-0 flex-col border-t px-3 py-3 ${themeTokens.panel}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-black">위험 로그</h2>
            <div className="mt-2 flex gap-2">
              <span className={`rounded-full px-2 py-1 text-[11px] font-black ${isSocketConnected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                {isSocketConnected ? 'WS ON' : 'WS OFF'}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
                {rows.length} rows
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
                {activeStatusLabels || '상태 필터 없음'}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshLogs()}
              disabled={isLoading}
              className={`rounded-md border px-3 py-2 text-xs font-black transition disabled:cursor-wait disabled:opacity-60 ${themeTokens.buttonMuted}`}
            >
              새로고침
            </button>
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className={`rounded-md border px-3 py-2 text-xs font-black transition ${themeTokens.buttonMuted}`}
            >
              도움말
            </button>
          </div>
        </div>

        <div className={`mt-3 rounded-md border px-3 py-2 text-sm font-black ${bufferedLogCount > 0 ? 'border-rose-200 bg-rose-50 text-rose-700' : themeTokens.panelMuted}`}>
          새 로그가 {bufferedLogCount}개 발견되었습니다.
        </div>

        <div className={`mt-3 rounded-md border p-2 ${themeTokens.panelMuted}`}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsStatusFilterOpen((current) => !current)}
              className={`flex-1 rounded-md border px-3 py-2 text-xs font-black transition ${themeTokens.buttonMuted}`}
            >
              상태
            </button>
            <button
              type="button"
              onClick={() => setTimeSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
              className={`flex-1 rounded-md border px-3 py-2 text-xs font-black transition ${themeTokens.buttonMuted}`}
            >
              시간 {timeSortDirection === 'desc' ? '최신순' : '과거순'}
            </button>
          </div>
          {isStatusFilterOpen ? (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {STATUS_FILTER_OPTIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={statusFilter[status]}
                  onClick={() => setStatusFilter((current) => ({
                    ...current,
                    [status]: !current[status],
                  }))}
                  className={`min-w-0 rounded-md border px-2 py-2 text-[11px] font-black transition ${
                    statusFilter[status]
                      ? isDark ? 'border-sky-500 bg-sky-950 text-sky-100' : 'border-sky-600 bg-sky-50 text-sky-800'
                      : isDark ? 'border-slate-700 bg-slate-900 text-slate-300' : 'border-slate-300 bg-slate-50 text-slate-600'
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="scrollbar-hidden mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pb-6">
          {isLoading && rows.length === 0 ? (
            <div className={`rounded-lg border p-5 text-center text-sm font-black ${themeTokens.panelMuted}`}>
              위험 로그를 불러오는 중입니다.
            </div>
          ) : rows.length === 0 ? (
            <div className={`rounded-lg border p-5 text-center text-sm font-black ${themeTokens.panelMuted}`}>
              표시할 위험 로그가 없습니다.
            </div>
          ) : (
            rows.map((log) => (
              <button
                key={log.id}
                type="button"
                onClick={() => void openLog(log)}
                disabled={isModalLoading}
                className={`w-full rounded-lg border p-4 text-left shadow-sm transition disabled:cursor-wait ${
                  isDark ? 'border-slate-800 bg-slate-900 hover:bg-slate-800' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <StatusBadge status={log.status} />
                  <div className="shrink-0 text-right text-xs font-black text-slate-500">
                    {log.priorityBand} / {log.priorityScore.toFixed(0)}
                  </div>
                </div>
                <div className="mt-3 line-clamp-2 text-sm font-black">{getLogDisplayContent(log)}</div>
                <div className={`mt-3 flex flex-wrap gap-2 text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span className="break-all font-mono">{log.targetId}</span>
                  <span>{formatHazardTypeLabel(log.hazardType)}</span>
                  <span>{formatDateTime(log.createdAt)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {selectedDetail ? (
        <HazardActionSheet
          detail={selectedDetail}
          isDark={isDark}
          isSubmitting={isSubmitting}
          error={modalError}
          onClose={() => setSelectedDetail(null)}
          onSubmit={submitAction}
        />
      ) : null}
      {isHelpOpen ? <HelpSheet isDark={isDark} onClose={() => setIsHelpOpen(false)} /> : null}
    </section>
  )
}
