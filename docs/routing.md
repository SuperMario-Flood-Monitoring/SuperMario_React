# 라우팅

작성 기준: 2026-06-29

이 프로젝트는 React Router를 사용하지 않는다. `src/App.tsx`에서 브라우저 History API와 React state로 라우팅을 처리한다.

## 라우트 목록

| 경로 | 내부 라우트 | 설명 |
| --- | --- | --- |
| `/login` | `login` | 로그인 화면 |
| `/simulation` | `simulation` | 시뮬레이션 화면 |
| `/simulation/fullscreen` | `simulationFullscreen` | 시뮬레이션 전체화면 |
| `/editor` | `editor` | 편집 모드 |
| `/logs` | `logs` | 위험 로그 |
| `/demo/admin` | `demoAdmin` | 데모용 관리자 자동 로그인 |

알 수 없는 경로 또는 루트 경로는 로그인 라우트로 처리한다. 이미 인증 세션이 있으면 로그인 대신 `/simulation`으로 이동한다.
`/demo/admin`은 진입 즉시 관리자 계정으로 로그인 요청을 보내고, 성공하면 `/simulation`으로 replace 이동한다.

## 라우트 결정

`routeFromPathname`이 `window.location.pathname`을 내부 라우트로 변환한다.

`getInitialRoute`는 앱 최초 실행 시 현재 URL을 읽고, 인증 세션이 있는 사용자가 `/login`에 있으면 `simulation`으로 초기화한다.

## 이동 처리

`navigate` 함수는 다음 일을 수행한다.

- 대상 라우트의 path를 계산한다.
- 현재 path와 다르면 `pushState` 또는 `replaceState`를 호출한다.
- React route state를 갱신한다.
- 라우트에 맞춰 브라우저 전체화면 상태를 동기화한다.

## 뒤로가기 처리

`popstate` 이벤트를 구독해 브라우저 뒤로가기/앞으로가기와 React state를 동기화한다.

인증된 사용자가 history 이동으로 `/login`에 도달하면 `/simulation`으로 replace 한다.

## 전체화면 라우트

다음 라우트는 진입 시 브라우저 전체화면을 요청한다.

- `/editor`
- `/simulation/fullscreen`

시뮬레이션 전체화면에서 사용자가 브라우저 전체화면을 해제하면 앱은 `/simulation`으로 replace 이동한다.

## web/mobile 화면 선택

라우팅은 web/mobile과 독립적이다. 같은 라우트라도 `AppSurface` 값에 따라 web 또는 mobile 컴포넌트를 렌더링한다.

- web 로그인 또는 mobile 로그인
- web 작업장 또는 mobile 작업장

따라서 `/logs`는 하나의 URL이지만, 실제 화면 구현은 입력 환경과 viewport에 따라 달라질 수 있다.
