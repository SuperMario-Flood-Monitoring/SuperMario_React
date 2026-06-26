import { useEffect, useState, type FormEvent } from 'react'
import {
  createNotificationChat,
  deleteNotificationChat,
  listNotificationChats,
  type NotificationChatRecord,
} from '../../services/notifications/notificationChats'
import type { WorkbenchTheme } from '../theme/workbenchTheme'

interface NotificationChatModalProps {
  theme: WorkbenchTheme
  onClose: () => void
}

function NotificationChatSkeletonList({ isDark }: { isDark: boolean }) {
  return (
    <div className="space-y-3" aria-label="알림 채팅방 목록 로딩 중">
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
  )
}

export function NotificationChatModal({ theme, onClose }: NotificationChatModalProps) {
  const [notificationChats, setNotificationChats] = useState<NotificationChatRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [employeeName, setEmployeeName] = useState('')
  const [chatId, setChatId] = useState('')
  const [error, setError] = useState('')
  const isDark = theme === 'dark'
  const panelClass = isDark
    ? 'border-slate-700 bg-slate-950 text-slate-100'
    : 'border-slate-200 bg-white text-slate-950'
  const mutedTextClass = isDark ? 'text-slate-400' : 'text-slate-500'
  const subtlePanelClass = isDark
    ? 'border-slate-800 bg-slate-900'
    : 'border-slate-200 bg-slate-50'
  const fieldClass = isDark
    ? 'border-slate-700 bg-slate-950 text-slate-100 focus:border-sky-400 focus:ring-sky-900/40'
    : 'border-slate-300 bg-white text-slate-950 focus:border-sky-500 focus:ring-sky-100'

  useEffect(() => {
    let isMounted = true

    async function loadNotificationChats() {
      try {
        setIsLoading(true)
        const nextNotificationChats = await listNotificationChats()

        if (isMounted) {
          setNotificationChats(nextNotificationChats)
          setError('')
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : '알림 채팅방 목록을 불러오지 못했습니다.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadNotificationChats()

    return () => {
      isMounted = false
    }
  }, [])

  const handleAddNotificationChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isLoading) {
      return
    }

    if (!employeeName.trim() || !chatId.trim()) {
      setError('직원 이름과 채팅방 ID를 모두 입력해주세요.')
      return
    }

    try {
      setIsSubmitting(true)
      const nextNotificationChat = await createNotificationChat({
        employeeName,
        chatId,
      })

      setNotificationChats((currentNotificationChats) => [
        nextNotificationChat,
        ...currentNotificationChats.filter((item) => item.id !== nextNotificationChat.id),
      ])
      setEmployeeName('')
      setChatId('')
      setError('')
      setIsAdding(false)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '알림 채팅방을 추가하지 못했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteNotificationChat = async (notificationId: string) => {
    try {
      setDeletingId(notificationId)
      await deleteNotificationChat(notificationId)
      setNotificationChats((currentNotificationChats) => (
        currentNotificationChats.filter((item) => item.id !== notificationId)
      ))
      setError('')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '알림 채팅방을 삭제하지 못했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-chat-modal-title"
      onMouseDown={onClose}
    >
      <section
        className={`flex max-h-[86vh] w-full max-w-[720px] flex-col rounded-lg border shadow-2xl ${panelClass}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={`flex items-start justify-between gap-4 border-b p-5 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div>
            <h2 id="notification-chat-modal-title" className="text-lg font-black">
              알림 채팅방
            </h2>
            <p className={`mt-1 text-sm font-semibold ${mutedTextClass}`}>
              {isLoading ? '채팅방 목록 확인 중' : `등록된 채팅방 ${notificationChats.length}개`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-md border px-3 py-2 text-xs font-black transition ${isDark ? 'border-slate-700 bg-slate-900 hover:bg-slate-800' : 'border-slate-300 bg-white hover:bg-slate-100'}`}
          >
            닫기
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error ? (
            <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="space-y-3">
            {isLoading ? (
              <NotificationChatSkeletonList isDark={isDark} />
            ) : notificationChats.length === 0 ? (
              <div className={`rounded-lg border p-5 text-center ${subtlePanelClass}`}>
                <p className="text-sm font-black">등록된 채팅방이 없습니다.</p>
              </div>
            ) : (
              notificationChats.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-lg border p-4 ${subtlePanelClass}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-black">{item.employeeName}</h3>
                      <p className={`mt-1 break-all font-mono text-xs font-bold ${mutedTextClass}`}>
                        chat_id {item.chatId}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteNotificationChat(item.id)}
                      disabled={isLoading || deletingId === item.id}
                      className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === item.id ? '삭제 중' : '삭제'}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <footer className={`border-t p-5 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          {isAdding ? (
            <form onSubmit={handleAddNotificationChat} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">Employee name</span>
                  <input
                    value={employeeName}
                    onChange={(event) => setEmployeeName(event.target.value)}
                    disabled={isLoading || isSubmitting}
                    className={`mt-2 h-11 w-full rounded-md border px-3 text-sm font-bold outline-none transition focus:ring-4 ${fieldClass}`}
                    placeholder="홍길동"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">Chat ID</span>
                  <input
                    value={chatId}
                    onChange={(event) => setChatId(event.target.value)}
                    disabled={isLoading || isSubmitting}
                    className={`mt-2 h-11 w-full rounded-md border px-3 text-sm font-bold outline-none transition focus:ring-4 ${fieldClass}`}
                    placeholder="채팅방 ID"
                  />
                </label>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false)
                    setError('')
                  }}
                  disabled={isLoading || isSubmitting}
                  className={`rounded-md border px-4 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${isDark ? 'border-slate-700 bg-slate-900 hover:bg-slate-800' : 'border-slate-300 bg-white hover:bg-slate-100'}`}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isLoading || isSubmitting}
                  className="rounded-md border border-sky-600 bg-sky-600 px-4 py-2 text-xs font-black text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? '추가 중' : '추가'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(true)
                  setError('')
                }}
                disabled={isLoading}
                className="rounded-md border border-emerald-500 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                추가
              </button>
            </div>
          )}
        </footer>
      </section>
    </div>
  )
}
