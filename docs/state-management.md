# 상태 관리

작성 기준: 2026-06-29

이 프로젝트는 전역 상태 관리 라이브러리를 사용하지 않는다. React state, browser storage, API 응답, WebSocket 메시지를 용도에 맞게 나누어 관리한다.

## 인증 상태

인증 상태는 `src/services/auth/authState.ts`에서 관리한다.

- 세션 키: `supermario-react-auth-session`
- access token 키: `supermario-react-access-token`
- 현재 저장 위치: `sessionStorage`
- 로그아웃 또는 인증 실패 시 세션과 access token을 제거한다.
- 과거 localStorage에 남아 있을 수 있는 동일 키도 정리한다.

403 응답이 오면 `apiClient`가 인증 상태를 지우고 인증 실패 핸들러를 호출한다. `App.tsx`는 이 핸들러를 통해 로그인 화면으로 이동한다.

## 라우트 상태

라우트는 별도 라우터 라이브러리 없이 `window.history`와 React state로 관리한다.

- 상태 타입: `AppRoute`
- pathname을 읽어 현재 라우트를 결정한다.
- 버튼 클릭 시 `pushState` 또는 `replaceState`로 URL을 변경한다.
- 브라우저 뒤로가기/앞으로가기는 `popstate` 이벤트로 동기화한다.

## 화면 종류 상태

화면 종류는 `src/app/deviceSurface.ts`가 판단한다. coarse pointer 또는 1023px 이하 조건을 기준으로 mobile 화면을 선택한다.

`App.tsx`는 `surface` 상태에 따라 web 또는 mobile 컴포넌트를 lazy import 한다.

## 테마 상태

작업장 테마는 `DrainageWorkbench` 내부 state로 관리한다.

- 초기값은 `prefers-color-scheme`에서 읽는다.
- 시스템 테마 변경 이벤트를 구독한다.
- web 작업장에서는 버튼으로 다크/라이트를 토글할 수 있다.
- 현재 구현에는 `localStorage`에 `darkTheme: true`처럼 테마를 저장하는 기능이 없다.

## 편집기 상태

편집기 레이아웃은 nodes/links 기반의 `EditorLayout`이 원천 데이터다.

- 화면 조작은 React state로 관리한다.
- 저장된 레이아웃은 로컬 저장소를 통해 유지한다.
- 시뮬레이션 화면은 저장된 레이아웃을 읽어 SWMM 엔진 실행 payload로 사용한다.

## 시뮬레이션 상태

시뮬레이션 화면은 엔진 상태와 실시간 스냅샷을 분리해 관리한다.

- 엔진 상태: API 조회 및 제어 응답
- 실시간 결과: WebSocket snapshot
- 제어값: 강우량, 실행 속도, 막힘 설정 등 화면 state
- 수리 계산 결과는 React에서 계산하지 않고 SWMM 엔진 응답을 표시한다.

## 위험 로그 상태

위험 로그 화면은 다음 상태를 가진다.

- 서버에서 내려온 로그 목록
- 로딩 여부
- 에러 메시지
- 상태 필터
- 시간 정렬 방향
- 선택된 로그 상세
- 조치 입력값
- 제출 중 여부
- WebSocket으로 감지된 새 로그 개수

위험 로그 목록의 최종 원천은 서버 응답이다. 실시간 이벤트는 즉시 row로 추가하지 않고 새 로그 개수만 증가시키며, 사용자가 새로고침을 누르면 서버 목록을 다시 받아 렌더링한다.
