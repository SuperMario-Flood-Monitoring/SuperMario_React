import { useState, type FormEvent } from 'react'
import {
  createNotificationToken,
  deleteNotificationToken,
  listNotificationTokens,
  type NotificationTokenRecord,
} from '../../services/notifications/notificationTokens'
import type { WorkbenchTheme } from '../theme/workbenchTheme'

interface NotificationTokenModalProps {
  theme: WorkbenchTheme
  onClose: () => void
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleString('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function maskToken(token: string) {
  if (token.length <= 10) {
    return '••••'
  }

  return `${token.slice(0, 6)}••••${token.slice(-4)}`
}

export function NotificationTokenModal({ theme, onClose }: NotificationTokenModalProps) {
  const [tokens, setTokens] = useState<NotificationTokenRecord[]>(() => listNotificationTokens())
  const [isAdding, setIsAdding] = useState(false)
  const [name, setName] = useState('')
  const [token, setToken] = useState('')
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

  const handleAddToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!name.trim() || !token.trim()) {
      setError('이름과 토큰을 모두 입력해주세요.')
      return
    }

    const nextToken = createNotificationToken({
      name,
      token,
    })

    setTokens((currentTokens) => [nextToken, ...currentTokens])
    setName('')
    setToken('')
    setError('')
    setIsAdding(false)
  }

  const handleDeleteToken = (tokenId: string) => {
    setTokens(deleteNotificationToken(tokenId))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-token-modal-title"
      onMouseDown={onClose}
    >
      <section
        className={`flex max-h-[86vh] w-full max-w-[720px] flex-col rounded-lg border shadow-2xl ${panelClass}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={`flex items-start justify-between gap-4 border-b p-5 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div>
            <h2 id="notification-token-modal-title" className="text-lg font-black">
              알림 토큰
            </h2>
            <p className={`mt-1 text-sm font-semibold ${mutedTextClass}`}>
              등록된 알림 토큰 {tokens.length}개
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
          <div className="space-y-3">
            {tokens.length === 0 ? (
              <div className={`rounded-lg border p-5 text-center ${subtlePanelClass}`}>
                <p className="text-sm font-black">등록된 토큰이 없습니다.</p>
              </div>
            ) : (
              tokens.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-lg border p-4 ${subtlePanelClass}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-black">{item.name}</h3>
                      <p className={`mt-1 break-all font-mono text-xs font-bold ${mutedTextClass}`}>
                        {maskToken(item.token)}
                      </p>
                      <p className={`mt-2 text-xs font-semibold ${mutedTextClass}`}>
                        ID {item.id} / {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteToken(item.id)}
                      className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100"
                    >
                      삭제
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <footer className={`border-t p-5 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          {isAdding ? (
            <form onSubmit={handleAddToken} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">Name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={`mt-2 h-11 w-full rounded-md border px-3 text-sm font-bold outline-none transition focus:ring-4 ${fieldClass}`}
                    placeholder="관리자 텔레그램"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">Token</span>
                  <input
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    className={`mt-2 h-11 w-full rounded-md border px-3 text-sm font-bold outline-none transition focus:ring-4 ${fieldClass}`}
                    placeholder="알림 전송 토큰"
                  />
                </label>
              </div>
              {error ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false)
                    setError('')
                  }}
                  className={`rounded-md border px-4 py-2 text-xs font-black transition ${isDark ? 'border-slate-700 bg-slate-900 hover:bg-slate-800' : 'border-slate-300 bg-white hover:bg-slate-100'}`}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-md border border-sky-600 bg-sky-600 px-4 py-2 text-xs font-black text-white transition hover:bg-sky-700"
                >
                  추가
                </button>
              </div>
            </form>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="rounded-md border border-emerald-500 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
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
