import { useState, type FormEvent } from 'react'
import logoImage from '../../assets/supermario-logo.png'

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<void>
}

interface LoginFormProps {
  username: string
  password: string
  error: string
  isSubmitting: boolean
  variant: 'mobile' | 'desktop'
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function LoginForm({
  username,
  password,
  error,
  isSubmitting,
  variant,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: LoginFormProps) {
  const isMobile = variant === 'mobile'
  const labelClass = isMobile
    ? 'text-[11px] font-black uppercase tracking-[0.08em] text-slate-500'
    : 'text-xs font-black uppercase text-slate-500'
  const inputClass = isMobile
    ? 'mt-2 h-14 w-full rounded-md border border-slate-200 bg-slate-50 px-4 text-[17px] font-black text-slate-950 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100 disabled:text-slate-400'
    : 'mt-2 h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-base font-bold text-slate-950 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100'

  return (
    <form
      onSubmit={onSubmit}
      className={isMobile
        ? 'w-full'
        : 'w-full max-w-[430px] rounded-lg border border-slate-200 bg-white p-6 shadow-[0_20px_48px_rgba(15,23,42,0.12)]'
      }
    >
      <div>
        <h2 className={isMobile ? 'text-[28px] font-black leading-tight' : 'text-2xl font-black'}>로그인</h2>
        <p className={isMobile
          ? 'mt-2 text-sm font-bold leading-6 text-slate-500'
          : 'mt-2 text-sm font-semibold leading-6 text-slate-500'
        }>
          관리자 계정으로 접속합니다.
        </p>
      </div>

      <label className={isMobile ? 'mt-7 block' : 'mt-6 block'}>
        <span className={labelClass}>Username</span>
        <input
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          disabled={isSubmitting}
          className={inputClass}
          placeholder="admin"
        />
      </label>

      <label className="mt-4 block">
        <span className={labelClass}>Password</span>
        <input
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          type="password"
          autoComplete="current-password"
          disabled={isSubmitting}
          className={inputClass}
          placeholder="비밀번호"
        />
      </label>

      <div className={isMobile ? 'mt-4 min-h-11' : 'mt-5 min-h-6'}>
        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold leading-5 text-rose-700">
            {error}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={isMobile
          ? 'mt-1 h-14 w-full rounded-md bg-sky-600 px-4 text-base font-black text-white shadow-[0_12px_26px_rgba(2,132,199,0.25)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-400'
          : 'mt-2 h-12 w-full rounded-md bg-sky-600 px-4 text-sm font-black text-white transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-400'
        }
      >
        {isSubmitting ? '로그인 중...' : '로그인'}
      </button>
    </form>
  )
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!username.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 입력해주세요.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      await onLogin(username.trim(), password)
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : '로그인 요청에 실패했습니다.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <section className="flex min-h-[100dvh] flex-col overflow-hidden bg-[#07111d] lg:hidden">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <div className="text-sm font-black leading-none text-white">SuperMario</div>
              <div className="mt-1 text-[11px] font-bold uppercase text-sky-200">Urban Drainage</div>
            </div>
          </div>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/12 px-3 py-1 text-[11px] font-black text-emerald-100">
            ADMIN
          </span>
        </div>

        <div className="flex flex-1 flex-col px-5 pb-5">
          <div className="flex flex-1 flex-col justify-center pb-7 pt-3">
            <img
              src={logoImage}
              alt="수퍼마리오 로고"
              className="mx-auto h-[115px] w-[115px] object-contain drop-shadow-[0_18px_32px_rgba(56,189,248,0.18)]"
            />
            <div className="mt-7">
              <h1 className="text-[34px] font-black leading-[1.04] text-white">
                도시침수
                <span className="block text-sky-200">배수도 작업장</span>
              </h1>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {['SWMM', '배수도 편집', '실시간 분석'].map((label) => (
                  <span
                    key={label}
                    className="rounded-md border border-white/10 bg-white/8 px-3 py-2 text-center text-[11px] font-black text-slate-100"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-950 shadow-[0_22px_54px_rgba(0,0,0,0.28)]">
            <LoginForm
              username={username}
              password={password}
              error={error}
              isSubmitting={isSubmitting}
              variant="mobile"
              onUsernameChange={setUsername}
              onPasswordChange={setPassword}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </section>

      <div className="hidden min-h-screen grid-cols-[minmax(420px,0.78fr)_1fr] lg:grid">
        <section className="relative flex min-h-[104px] flex-col justify-center overflow-hidden border-b border-white/10 bg-[#08131f] px-5 py-5 lg:min-h-screen lg:justify-between lg:border-b-0 lg:border-r lg:p-8">
          <div className="absolute inset-0 bg-[#08131f]/55" />
          <div className="relative z-10 hidden lg:block">
            <p className="text-xs font-black uppercase text-sky-200">SuperMario</p>
            <p className="text-sm font-bold text-slate-300">Urban Drainage Control</p>
          </div>
          <div className="relative z-10 mx-auto my-10 hidden w-full max-w-[420px] justify-center lg:flex">
            <img
              src={logoImage}
              alt="수퍼마리오 로고"
              className="w-[288px] max-w-full object-contain drop-shadow-[0_28px_42px_rgba(14,165,233,0.18)]"
            />
          </div>
          <div className="relative z-10 max-w-xl">
            <div className="mb-3 h-1 w-10 rounded-full bg-sky-300 lg:hidden" />
            <h1 className="text-2xl font-black leading-tight text-white sm:text-3xl lg:text-4xl xl:text-5xl">
              도시침수 배수도 작업장
            </h1>
            <p className="mt-4 hidden text-base font-semibold leading-7 text-slate-300 lg:block">
              도시 배수망을 편집하고 SWMM 시뮬레이션으로 실시간 침수 흐름을 확인합니다.
            </p>
          </div>
        </section>

        <section className="flex min-h-[calc(100vh-104px)] items-start justify-center bg-slate-100 px-5 py-8 text-slate-950 lg:min-h-screen lg:items-center lg:py-10">
          <LoginForm
            username={username}
            password={password}
            error={error}
            isSubmitting={isSubmitting}
            variant="desktop"
            onUsernameChange={setUsername}
            onPasswordChange={setPassword}
            onSubmit={handleSubmit}
          />
        </section>
      </div>
    </main>
  )
}
