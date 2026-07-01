import type { AppSurface } from '../../app/deviceSurface'
import logoImage from '../../assets/supermario-logo.png'
import { TEAM_MEMBERS, TEAM_PPT_URL } from './teamInfo'

interface AboutUsPageProps {
  surface: AppSurface
  onBack: () => void
}

export function AboutUsPage({ surface, onBack }: AboutUsPageProps) {
  const isMobile = surface === 'mobile'

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className={`mx-auto flex min-h-screen w-full flex-col ${
        isMobile ? 'max-w-lg px-5 py-5' : 'max-w-3xl px-5 py-6 sm:px-8 sm:py-10'
      }`}>
        <header className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-sky-100 transition hover:border-sky-300/40 hover:bg-white/10"
          >
            ← 돌아가기
          </button>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-200">SuperMario</p>
        </header>

        <section className={`text-center ${isMobile ? 'mt-8' : 'mt-10'}`}>
          <div className={`mx-auto mb-6 flex justify-center ${
            isMobile ? 'h-[96px] w-[96px]' : 'w-full max-w-[260px]'
          }`}>
            <img
              src={logoImage}
              alt="수퍼마리오 로고"
              className="h-full w-full object-contain drop-shadow-[0_20px_36px_rgba(14,165,233,0.2)]"
            />
          </div>
          <h1 className={`font-black leading-tight text-white ${isMobile ? 'text-[30px]' : 'text-3xl sm:text-4xl'}`}>
            About Us
          </h1>
          <p className={`mt-3 font-semibold leading-6 text-slate-300 ${isMobile ? 'text-sm' : 'text-sm sm:text-base'}`}>
            도시침수 배수도 프로젝트를 함께 만든 팀을 소개합니다.
          </p>
        </section>

        <section className={`rounded-xl border border-white/10 bg-[#08131f] shadow-[0_24px_48px_rgba(2,6,23,0.35)] ${
          isMobile ? 'mt-8 p-4' : 'mt-10 p-5 sm:p-6'
        }`}>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-200">Presentation</p>
          <a
            href={TEAM_PPT_URL}
            className="mt-3 inline-flex items-center gap-2 text-base font-black text-white underline decoration-sky-400/70 underline-offset-4 transition hover:text-sky-200"
          >
            프로젝트 PPT 보기
          </a>
        </section>

        <section className={`space-y-4 ${isMobile ? 'mt-5' : 'mt-6'}`}>
          {TEAM_MEMBERS.map((member) => (
            <article
              key={member.name}
              className={`rounded-xl border border-slate-200/10 bg-slate-100 text-slate-950 shadow-[0_18px_40px_rgba(15,23,42,0.18)] ${
                isMobile ? 'p-4' : 'p-5 sm:p-6'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-600">{member.roleLabel}</p>
                  <h2 className={`mt-1 font-black text-slate-950 ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                    {member.name}
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{member.responsibility}</p>
                </div>
                <a
                  href={member.resumeUrl}
                  className="inline-flex h-10 shrink-0 items-center rounded-md bg-sky-600 px-4 text-xs font-black text-white transition hover:bg-sky-700"
                >
                  이력서
                </a>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
