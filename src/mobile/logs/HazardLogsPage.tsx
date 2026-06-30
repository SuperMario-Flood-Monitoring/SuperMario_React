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
import { MobileBottomSheet } from '../../shared/ui/MobileBottomSheet'
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
      <div className="w-full max-w-[320px] text-center">
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

function HazardLogSkeletonCards({ isDark }: { isDark: boolean }) {
  return (
    <div className="space-y-3" aria-label="위험 로그 목록 로딩 중">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className={`rounded-lg border p-4 shadow-sm ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className={`h-7 w-16 animate-pulse rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <div className={`h-4 w-14 animate-pulse rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
          </div>
          <div className={`mt-4 h-4 w-full animate-pulse rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
          <div className={`mt-2 h-4 w-4/5 animate-pulse rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
          <div className="mt-4 flex gap-2">
            <div className={`h-3 w-24 animate-pulse rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <div className={`h-3 w-16 animate-pulse rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
          </div>
        </div>
      ))}
    </div>
  )
}

function HazardLogRefreshSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2" aria-label="위험 로그 새로고침 영역 로딩 중">
      <div className={`h-9 w-20 animate-pulse rounded-md border ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-100'}`} />
      <div className={`h-9 w-16 animate-pulse rounded-md border ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-100'}`} />
    </div>
  )
}

function HazardLogNoticeSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={`mt-3 rounded-md border px-3 py-2 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}
      aria-label="새 위험 로그 안내 로딩 중"
    >
      <div className={`h-4 w-44 animate-pulse rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
    </div>
  )
}

function HelpSheet({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
  const theme = isDark ? 'dark' : 'light'
  const mutedTextClass = isDark ? 'text-slate-400' : 'text-slate-500'
  const itemClass = isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'
  const closeButtonClassName = `inline-flex h-10 min-w-16 shrink-0 items-center justify-center rounded-md border px-3 text-center text-sm font-black leading-none transition ${
    isDark ? 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
  }`

  return (
    <MobileBottomSheet
      theme={theme}
      title="위험 로그 도움말"
      titleId="hazard-help-sheet-title"
      description="각 항목이 의미하는 정보를 확인합니다."
      closeLabel="위험 로그 도움말 닫기"
      zIndexClassName="z-[240]"
      overlayClassName="fixed inset-x-0 bottom-0 top-[var(--app-visual-offset-top,0px)] flex h-[var(--app-visual-height,100dvh)] items-end justify-center"
      sheetClassName={`flex max-h-[82dvh] w-screen flex-col overflow-hidden rounded-t-2xl border-x-0 border-b-0 border-t shadow-2xl ${
        isDark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-950'
      }`}
      bodyClassName="scrollbar-hidden min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm font-bold leading-6"
      bottomSpacerClassName="h-[calc(env(safe-area-inset-bottom)+16px)]"
      closeButtonClassName={closeButtonClassName}
      closeButtonContent="닫기"
      onBackdropClick={onClose}
      onClose={onClose}
    >
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
    </MobileBottomSheet>
  )
}

function SheetCloseButtonContent() {
  return <span className="inline-flex h-full w-full items-center justify-center leading-none">닫기</span>
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
  const theme = isDark ? 'dark' : 'light'
  const fieldClass = isDark
    ? 'border-slate-700 bg-slate-950 text-slate-100 focus:border-sky-400 focus:ring-sky-900/40'
    : 'border-slate-300 bg-white text-slate-950 focus:border-sky-500 focus:ring-sky-100'
  const closeButtonClassName = `inline-flex h-10 min-w-16 shrink-0 items-center justify-center rounded-md border px-3 text-center text-sm font-black leading-none transition ${
    isDark ? 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
  }`

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit(isCompleteStep ? { resultDetail, recurrenceNote } : { actionDetail })
  }

  return (
    <MobileBottomSheet
      theme={theme}
      title="위험 로그 조치"
      titleId="hazard-action-sheet-title"
      description={<span className="line-clamp-2">{formatHazardDetail(detail.hazardDetail)}</span>}
      closeLabel="위험 로그 조치 닫기"
      zIndexClassName="z-[240]"
      overlayClassName="fixed inset-x-0 bottom-0 top-[var(--app-visual-offset-top,0px)] flex h-[var(--app-visual-height,100dvh)] items-end justify-center"
      sheetClassName={`flex max-h-[88dvh] w-screen flex-col overflow-hidden rounded-t-2xl border-x-0 border-b-0 border-t shadow-2xl ${
        isDark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-950'
      }`}
      bodyClassName="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-5 py-4"
      bottomSpacerClassName="h-[calc(env(safe-area-inset-bottom)+16px)]"
      closeButtonClassName={closeButtonClassName}
      closeButtonContent={<SheetCloseButtonContent />}
      onBackdropClick={onClose}
      onClose={onClose}
    >
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
                className={`mt-2 w-full rounded-md border px-3 py-2 text-base font-bold outline-none transition focus:ring-4 ${fieldClass}`}
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
                className={`mt-2 w-full rounded-md border px-3 py-2 text-base font-bold outline-none transition focus:ring-4 ${fieldClass}`}
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
              className={`mt-2 w-full rounded-md border px-3 py-2 text-base font-bold outline-none transition focus:ring-4 ${fieldClass}`}
              placeholder="하류 관로 현장 점검 진행"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={isSubmitting || detail.status === 'RESOLVED'}
          className="flex h-11 w-full items-center justify-center rounded-md border border-sky-600 bg-sky-600 px-4 text-base font-black leading-none text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? '저장 중' : '확인'}
        </button>
      </form>
    </MobileBottomSheet>
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
  const activeStatusLabelText = activeStatusLabels.length > 0 ? activeStatusLabels.join(' · ') : '상태 필터 없음'
  const isInitialLoading = isLoading && !hasLoadedLogs
  const isRefreshing = isLoading && hasLoadedLogs
  const summaryChipClassName = `inline-flex h-7 max-w-full items-center rounded-md border px-2.5 text-[10px] font-black leading-none ${
    isDark ? 'border-slate-800 bg-slate-950 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'
  }`
  const actionButtonClassName = `inline-flex h-10 min-w-[72px] items-center justify-center rounded-md border px-3 text-center text-xs font-black leading-none transition disabled:cursor-wait disabled:opacity-60 ${themeTokens.buttonMuted}`

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
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
              <span className={`${summaryChipClassName} ${
                isSocketConnected
                  ? isDark ? 'border-sky-600 bg-sky-950 text-sky-200' : 'border-sky-200 bg-sky-50 text-sky-700'
                  : ''
              }`}>
                {isSocketConnected ? 'WS ON' : 'WS OFF'}
              </span>
              <span className={summaryChipClassName}>
                {rows.length}건
              </span>
              <span className={`${summaryChipClassName} min-w-0 max-w-[150px] truncate`}>
                {activeStatusLabelText}
              </span>
            </div>
          </div>
          {isInitialLoading ? (
            <HazardLogRefreshSkeleton isDark={isDark} />
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void refreshLogs()}
                disabled={isLoading}
                className={actionButtonClassName}
              >
                {isRefreshing ? <LoadingSpinner /> : null}
                {isRefreshing ? '불러오는 중' : '새로고침'}
              </button>
              <button
                type="button"
                onClick={() => setIsHelpOpen(true)}
                className={actionButtonClassName}
              >
                도움말
              </button>
            </div>
          )}
        </div>

        {isInitialLoading ? (
          <HazardLogNoticeSkeleton isDark={isDark} />
        ) : (
          <div className={`mt-3 rounded-md border px-3 py-2 text-sm font-black ${bufferedLogCount > 0 ? 'border-rose-200 bg-rose-50 text-rose-700' : themeTokens.panelMuted}`}>
            새 로그가 {bufferedLogCount}개 발견되었습니다.
          </div>
        )}

        <div className={`mt-3 rounded-md border p-2 ${themeTokens.panelMuted}`}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsStatusFilterOpen((current) => !current)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-black transition ${
                isStatusFilterOpen
                  ? isDark ? 'border-sky-500 bg-sky-950 text-sky-100 ring-2 ring-sky-700' : 'border-sky-600 bg-sky-50 text-sky-800 ring-2 ring-sky-200'
                  : themeTokens.buttonMuted
              }`}
            >
              <FilterIcon />
              상태
            </button>
            <button
              type="button"
              onClick={() => setTimeSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
              className={`flex-1 rounded-md border px-3 py-2 text-xs font-black transition ${
                timeSortDirection === 'desc'
                  ? isDark ? 'border-indigo-500 bg-indigo-950 text-indigo-100 ring-2 ring-indigo-700' : 'border-indigo-600 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-200'
                  : isDark ? 'border-emerald-500 bg-emerald-950 text-emerald-100 ring-2 ring-emerald-700' : 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200'
              }`}
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
          {isInitialLoading ? (
            <HazardLogSkeletonCards isDark={isDark} />
          ) : isRefreshing ? (
            <CenterProgress isDark={isDark} />
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
