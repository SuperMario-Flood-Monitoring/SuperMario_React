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
import type { SwmmRealtimeSnapshot, SwmmRiskEvent } from '../../services/swmm/dto'
import { SWMM_ENGINE_URL } from '../editor/editorDefinitions'
import { WORKBENCH_THEME_TOKENS, type WorkbenchTheme } from '../theme/workbenchTheme'

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
const MIN_HAZARD_LOG_INITIAL_LOADING_MS = 1500

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

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

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function buildSocketEventKey(riskEvent: SwmmRiskEvent, snapshot: SwmmRealtimeSnapshot) {
  return `${riskEvent.eventId}:${snapshot.runId ?? ''}`
}

function buildSocketHazardLog(riskEvent: SwmmRiskEvent, snapshot: SwmmRealtimeSnapshot): HazardLogRecord {
  const eventKey = buildSocketEventKey(riskEvent, snapshot)
  return {
    id: -hashString(eventKey),
    targetId: riskEvent.sourceId || '-',
    pipeId: riskEvent.source === 'link' ? riskEvent.sourceId : null,
    source: riskEvent.source || '-',
    hazardLevel: riskEvent.severity || 'CRITICAL',
    hazardType: riskEvent.eventType || '-',
    hazardDetail: riskEvent.reason || `${riskEvent.sourceId || '대상'}에서 위험이 감지되었습니다.`,
    status: 'OPEN',
    priorityScore: Number(riskEvent.metrics.priorityScore ?? 0),
    priorityBand: String(riskEvent.metrics.priorityBand ?? 'P1'),
    priorityReasons: Array.isArray(riskEvent.metrics.priorityReasons)
      ? riskEvent.metrics.priorityReasons.map(String)
      : [],
    createdAt: snapshot.modelTime || new Date().toISOString(),
  }
}

function mergeSocketBufferedLogs(apiLogs: HazardLogRecord[], bufferedLogs: HazardLogRecord[]) {
  const apiLogKeys = new Set(apiLogs.map((log) => `${log.hazardType}:${log.targetId}:${log.hazardLevel}`))
  const pendingLogs = bufferedLogs.filter((log) => !apiLogKeys.has(`${log.hazardType}:${log.targetId}:${log.hazardLevel}`))
  return [...pendingLogs, ...apiLogs]
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

function FilterIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </svg>
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

function LoadingSpinner({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
      aria-hidden="true"
    />
  )
}

function CenterProgress({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center px-6" role="status" aria-live="polite">
      <div className="w-full max-w-[360px] text-center">
        <div className={`mx-auto h-10 w-10 animate-spin rounded-full border-4 border-r-transparent ${isDark ? 'border-sky-300' : 'border-sky-600'}`} />
        <div className={`mt-5 h-2 overflow-hidden rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
          <div className="h-full w-1/2 animate-pulse rounded-full bg-sky-500" />
        </div>
        <p className={`mt-3 text-sm font-black ${isDark ? 'text-sky-200' : 'text-sky-700'}`}>
          위험 로그를 새로 불러오는 중입니다.
        </p>
      </div>
    </div>
  )
}

function HazardLogSkeletonRows({ isDark }: { isDark: boolean }) {
  return (
    <div className="space-y-0" aria-label="위험 로그 목록 로딩 중">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className={`grid grid-cols-[90px_105px_160px_minmax(180px,1fr)_100px_150px] gap-3 border-b px-4 py-3 ${
            isDark ? 'border-slate-800' : 'border-slate-100'
          }`}
        >
          <div className={`h-7 w-16 animate-pulse rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
          <div className={`h-4 w-14 animate-pulse rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
          <div className={`h-4 w-28 animate-pulse rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
          <div>
            <div className={`h-4 w-full animate-pulse rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <div className={`mt-2 h-4 w-2/3 animate-pulse rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
          </div>
          <div className={`h-4 w-16 animate-pulse rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
          <div className={`h-4 w-24 animate-pulse rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
        </div>
      ))}
    </div>
  )
}

function HazardLogRefreshSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2" aria-label="위험 로그 새로고침 영역 로딩 중">
      <div className={`h-4 w-44 animate-pulse rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
      <div className={`h-9 w-20 animate-pulse rounded-md border ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-100'}`} />
      <div className={`h-9 w-16 animate-pulse rounded-md border ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-100'}`} />
    </div>
  )
}

function HelpModal({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
  const panelClass = isDark
    ? 'border-slate-700 bg-slate-950 text-slate-100'
    : 'border-slate-200 bg-white text-slate-950'
  const mutedTextClass = isDark ? 'text-slate-400' : 'text-slate-500'
  const itemClass = isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'

  return (
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/55 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hazard-help-modal-title"
      onMouseDown={onClose}
    >
      <section
        className={`flex max-h-[86vh] w-full max-w-[680px] flex-col rounded-lg border shadow-2xl ${panelClass}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={`flex items-start justify-between gap-4 border-b p-5 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div>
            <h2 id="hazard-help-modal-title" className="text-lg font-black">위험 로그 도움말</h2>
            <p className={`mt-1 text-sm font-semibold ${mutedTextClass}`}>각 항목이 의미하는 정보를 확인합니다.</p>
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
        <div className="scrollbar-hidden min-h-0 flex-1 space-y-3 overflow-y-auto p-5 text-sm font-bold leading-6">
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
          <div className={`rounded-lg border p-4 ${itemClass}`}>
            <h3 className="font-black">시간</h3>
            <p className={`mt-2 ${mutedTextClass}`}>위험 로그가 생성된 시각입니다.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

function DetailModal({
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
      className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/55 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hazard-log-modal-title"
      onMouseDown={onClose}
    >
      <section
        className={`flex max-h-[88vh] w-full max-w-[720px] flex-col rounded-lg border shadow-2xl ${
          isDark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-950'
        }`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={`flex items-start justify-between gap-4 border-b p-5 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="min-w-0">
            <h2 id="hazard-log-modal-title" className="text-lg font-black">위험 로그 조치</h2>
            <p className={`mt-1 break-words text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
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

        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={`rounded-md border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
              <div className="text-[11px] font-black uppercase text-slate-500">상태</div>
              <div className="mt-2"><StatusBadge status={detail.status} /></div>
            </div>
            <div className={`rounded-md border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
              <div className="text-[11px] font-black uppercase text-slate-500">대상</div>
              <div className="mt-2 break-all text-sm font-black">{detail.targetId}</div>
            </div>
            <div className={`rounded-md border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
              <div className="text-[11px] font-black uppercase text-slate-500">우선순위</div>
              <div className="mt-2 text-sm font-black">{detail.priorityBand} / {detail.priorityScore.toFixed(1)}</div>
            </div>
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-black text-slate-500">유형</dt>
              <dd className="mt-1 break-words font-bold">{formatHazardTypeLabel(detail.hazardType)}</dd>
            </div>
            <div>
              <dt className="font-black text-slate-500">발생 시각</dt>
              <dd className="mt-1 font-bold">{formatDateTime(detail.createdAt)}</dd>
            </div>
          </dl>

          {error ? (
            <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
              {error}
            </p>
          ) : null}

          <form onSubmit={submit} className="mt-5 space-y-4">
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

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className={`min-w-0 whitespace-normal break-keep rounded-md border px-4 py-2 text-xs font-black leading-tight transition disabled:opacity-60 ${
                  isDark ? 'border-slate-700 bg-slate-900 hover:bg-slate-800' : 'border-slate-300 bg-white hover:bg-slate-100'
                }`}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting || detail.status === 'RESOLVED'}
                className="rounded-md border border-sky-600 bg-sky-600 px-4 py-2 text-xs font-black text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? '저장 중' : '확인'}
              </button>
            </div>
          </form>
        </div>
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
  const [hasLoadedLogs, setHasLoadedLogs] = useState(false)
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
  const bufferedSocketLogsRef = useRef(new Map<string, HazardLogRecord>())

  const refreshLogs = useCallback(async (options?: { minimumLoadingMs?: number }) => {
    const loadingStartedAt = Date.now()
    setIsLoading(true)
    try {
      const nextLogs = await listHazardLogs()
      const remainingMs = (options?.minimumLoadingMs ?? 0) - (Date.now() - loadingStartedAt)
      if (remainingMs > 0) {
        await delay(remainingMs)
      }
      setLogs((currentLogs) => mergeSocketBufferedLogs(
        nextLogs,
        [
          ...currentLogs.filter((log) => log.id < 0),
          ...Array.from(bufferedSocketLogsRef.current.values()),
        ],
      ))
      setBufferedLogCount(0)
      bufferedSocketLogsRef.current.clear()
      setError('')
    } catch (loadError) {
      const remainingMs = (options?.minimumLoadingMs ?? 0) - (Date.now() - loadingStartedAt)
      if (remainingMs > 0) {
        await delay(remainingMs)
      }
      setError(loadError instanceof Error ? loadError.message : '위험 로그를 불러오지 못했습니다.')
    } finally {
      setHasLoadedLogs(true)
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void refreshLogs({ minimumLoadingMs: MIN_HAZARD_LOG_INITIAL_LOADING_MS })
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
          const eventKey = buildSocketEventKey(riskEvent, payload)
          if (!seenSocketEventsRef.current.has(eventKey)) {
            seenSocketEventsRef.current.add(eventKey)
            bufferedSocketLogsRef.current.set(eventKey, buildSocketHazardLog(riskEvent, payload))
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
  const isInitialLoading = isLoading && !hasLoadedLogs
  const isRefreshing = isLoading && hasLoadedLogs

  return (
    <section className={`min-h-screen min-w-0 p-0 lg:p-4 ${themeTokens.app}`} data-swmm-theme={theme}>
      <div className="flex min-h-[calc(100vh-16px)] min-w-0 flex-col gap-3 lg:h-[calc(100vh-32px)] lg:min-h-[640px] lg:gap-4">
        {headerElement ? (
          <div className="min-w-0">{headerElement}</div>
        ) : null}

        <div className={`mx-0 flex min-h-0 flex-1 flex-col border p-3 lg:rounded-lg lg:p-4 ${themeTokens.panel}`}>
          <div className={`flex flex-wrap items-center justify-between gap-3 border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div>
              <h2 className="text-base font-black">위험 로그</h2>
              <div className="mt-2 flex flex-wrap gap-2">
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
            {isInitialLoading ? (
              <HazardLogRefreshSkeleton isDark={isDark} />
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <span className={`min-w-0 truncate text-sm font-black ${bufferedLogCount > 0 ? 'text-rose-600' : themeTokens.description}`}>
                  새 로그가 {bufferedLogCount}개 발견되었습니다.
                </span>
                <button
                  type="button"
                  onClick={() => void refreshLogs()}
                  disabled={isLoading}
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-black transition disabled:cursor-wait disabled:opacity-60 ${themeTokens.buttonMuted}`}
                >
                  {isRefreshing ? <LoadingSpinner /> : null}
                  {isRefreshing ? '불러오는 중' : '새로고침'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsHelpOpen(true)}
                  className={`rounded-md border px-3 py-2 text-xs font-black transition ${themeTokens.buttonMuted}`}
                >
                  도움말
                </button>
              </div>
            )}
          </div>

          {error ? (
            <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
              {error}
            </p>
          ) : null}

          <div className={`mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border ${
            isDark ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
          }`}>
            <div className={`grid grid-cols-[90px_105px_160px_minmax(180px,1fr)_100px_150px] gap-3 border-b px-4 py-3 text-xs font-black uppercase ${
              isDark ? 'border-slate-800 bg-slate-900 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}>
              <div>
                <button
                  type="button"
                  onClick={() => setIsStatusFilterOpen((current) => !current)}
                  className={`inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-left font-black transition ${
                    isStatusFilterOpen
                      ? isDark ? 'bg-sky-950 text-sky-200 ring-2 ring-sky-700' : 'bg-sky-100 text-sky-800 ring-2 ring-sky-300'
                      : isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-200'
                  }`}
                >
                  <FilterIcon />
                  상태
                </button>
              </div>
              <div>우선순위</div>
              <div>대상</div>
              <div>내용</div>
              <div>유형</div>
              <div>
                <button
                  type="button"
                  onClick={() => setTimeSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
                  className={`rounded px-2 py-1.5 text-left font-black transition ${
                    timeSortDirection === 'desc'
                      ? isDark ? 'bg-indigo-950 text-indigo-200 ring-2 ring-indigo-700' : 'bg-indigo-100 text-indigo-800 ring-2 ring-indigo-300'
                      : isDark ? 'bg-emerald-950 text-emerald-200 ring-2 ring-emerald-700' : 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-300'
                  }`}
                  title={timeSortDirection === 'desc' ? '최신순' : '과거순'}
                >
                  시간 {timeSortDirection === 'desc' ? '↓' : '↑'}
                </button>
              </div>
            </div>
            {isStatusFilterOpen ? (
              <div className={`flex flex-wrap items-center gap-2 border-b px-4 py-3 text-xs font-black ${
                isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'
              }`}>
                {STATUS_FILTER_OPTIONS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={statusFilter[status]}
                    onClick={() => setStatusFilter((current) => ({
                      ...current,
                      [status]: !current[status],
                    }))}
                    className={`rounded-md border px-3 py-2 transition ${
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
            <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto">
              {isInitialLoading ? (
                <HazardLogSkeletonRows isDark={isDark} />
              ) : isRefreshing ? (
                <CenterProgress isDark={isDark} />
              ) : rows.length === 0 ? (
                <div className="p-6 text-sm font-black text-slate-500">표시할 위험 로그가 없습니다.</div>
              ) : (
                rows.map((log) => (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => void openLog(log)}
                    disabled={isModalLoading}
                    className={`grid w-full grid-cols-[90px_105px_160px_minmax(180px,1fr)_100px_150px] gap-3 border-b px-4 py-3 text-left text-sm transition disabled:cursor-wait ${
                      isDark ? 'border-slate-800 hover:bg-slate-900' : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div><StatusBadge status={log.status} /></div>
                    <div className="font-black">{log.priorityBand}<span className="ml-1 text-slate-400">{log.priorityScore.toFixed(0)}</span></div>
                    <div className="break-all font-mono text-xs font-bold">{log.targetId}</div>
                    <div className="line-clamp-2 font-bold">{getLogDisplayContent(log)}</div>
                    <div className="break-keep font-bold">{formatHazardTypeLabel(log.hazardType)}</div>
                    <div className="text-xs font-bold text-slate-500">{formatDateTime(log.createdAt)}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedDetail ? (
        <DetailModal
          detail={selectedDetail}
          isDark={isDark}
          isSubmitting={isSubmitting}
          error={modalError}
          onClose={() => setSelectedDetail(null)}
          onSubmit={submitAction}
        />
      ) : null}
      {isHelpOpen ? <HelpModal isDark={isDark} onClose={() => setIsHelpOpen(false)} /> : null}
    </section>
  )
}
