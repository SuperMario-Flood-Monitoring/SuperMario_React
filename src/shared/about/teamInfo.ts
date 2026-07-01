export const TEAM_PPT_URL = '#'

export interface TeamMember {
  roleLabel: string
  name: string
  responsibility: string
  resumeUrl: string
}

export const TEAM_MEMBERS: TeamMember[] = [
  {
    roleLabel: '팀장',
    name: '온석태',
    responsibility: '역할: React, SWMM 엔진 구현',
    resumeUrl: 'https://www.rallit.com/hub/resumes/1686371',
  },
  {
    roleLabel: '팀원',
    name: '장윤창',
    responsibility: '역할: Django 백엔드 서버 구현',
    resumeUrl: 'https://www.rallit.com/resumes/1612608@bcobra0/%EC%9E%A5%EC%9C%A4%EC%B0%BD',
  },
  {
    roleLabel: '팀원',
    name: '이현욱',
    responsibility: '역할: LangChain 서비스 서버 구현',
    resumeUrl: 'https://www.rallit.com/hub/resumes/1735736',
  }
]