# 화면 명세서

작성 기준: 2026-06-29

## 공통 작업장

공통 작업장은 로그인 이후 진입하는 메인 화면이며, 화면 크기와 입력 환경에 따라 web 또는 mobile 구현을 선택한다.

- 주요 진입 파일: `src/App.tsx`
- web 작업장: `src/web/layout/DrainageWorkbench.tsx`
- mobile 작업장: `src/mobile/layout/DrainageWorkbench.tsx`
- 공통 화면 모드: `시뮬레이션`, `편집 모드`, `위험 로그`
- 공통 상단 액션: 화면 모드 전환, 알림 채팅방, 로그아웃
- web 전용 상단 액션: 다크/라이트 테마 전환

## 로그인 화면

사용자는 로그인 화면에서 아이디와 비밀번호를 입력한다. 로그인 성공 시 세션과 access token이 저장되고 `/simulation`으로 이동한다.

- web: `src/web/auth/LoginPage`
- mobile: `src/mobile/auth/LoginPage`
- 인증 API: `src/services/auth/authApi.ts`
- 인증 상태 저장: `src/services/auth/authState.ts`

## 시뮬레이션 화면

시뮬레이션 화면은 저장된 배수 설계 또는 선택한 시나리오를 SWMM 엔진으로 실행하고 실시간 결과를 표시한다.

- 주요 컴포넌트: `SimulationWorkbench`
- 시나리오 목록 조회 및 선택
- 엔진 상태 조회
- 엔진 시작, 일시정지, 재개, 정지
- 강우 프리셋 및 실행 속도 제어
- 관로 막힘 제어
- 실시간 스냅샷 표시
- PNG 내보내기
- 전체화면 라우트 지원: `/simulation/fullscreen`

## 편집 모드 화면

편집 모드는 배수 객체를 배치하고 SWMM 형식에 가까운 nodes/links JSON 레이아웃을 만드는 화면이다.

- 주요 컴포넌트: `EditorCanvas`
- 객체 배치, 이동, 연결
- 편집 패널 및 속성 입력
- 레이아웃 JSON 저장
- 모바일 세로 화면에서는 가로 화면 안내 표시
- 라우트 진입 시 브라우저 전체화면 요청

## 위험 로그 화면

위험 로그 화면은 SWMM 실행 결과 위험으로 판정된 항목을 목록으로 보여주고, 현장 조치 이력을 입력하는 화면이다.

- web: `src/web/logs/HazardLogsPage.tsx`
- mobile: `src/mobile/logs/HazardLogsPage.tsx`
- 목록 API: `GET /api/hazards`
- 상세 API: `GET /api/hazards/{id}`
- 조치 시작 API: `POST /api/hazards/{id}/actions`
- 조치 완료 API: `PATCH /api/hazards/{id}/actions/{action_id}`

위험 로그의 상태는 다음과 같이 표시한다.

- `OPEN`: 조치 전
- `IN_PROGRESS`: 조치 중
- `RESOLVED`: 조치 후

기본 목록은 `조치 전`, `조치 중`만 보여준다. `조치 후`는 상태 필터에서 선택해야 조회된다. 시간 정렬은 기본적으로 최신 항목이 위에 오도록 내림차순이다.

실시간으로 새 위험 로그가 감지되어도 즉시 목록에 추가하지 않는다. 대신 새 로그 개수를 상단에 표시하고, 사용자가 새로고침 버튼을 눌렀을 때 `GET /api/hazards`를 다시 호출해 목록을 갱신한다.
