# API 연동

작성 기준: 2026-06-29

## 공통 HTTP 클라이언트

공통 HTTP 클라이언트는 `src/services/http/apiClient.ts`에 있다.

- Axios 기반
- `withCredentials: true`
- base URL: `import.meta.env.VITE_SWMM_ENGINE_URL ?? '/api'`
- 요청 전 access token을 읽어 `Authorization: Bearer {token}`을 붙인다.
- `skipAuth` 요청은 인증 헤더를 붙이지 않는다.
- 401 응답은 refresh API를 한 번 시도한 뒤 원래 요청을 재시도한다.
- 403 응답은 인증 상태를 정리하고 로그인 화면으로 이동하게 한다.

`joinApiUrl`은 base URL과 path를 안전하게 결합한다. base URL이 절대 URL인 경우에도 중복 path가 생기지 않도록 처리한다.

## 환경 변수

주요 환경 변수는 다음과 같다.

- `VITE_SWMM_ENGINE_URL`
- `VITE_AUTH_LOGIN_PATH`
- `VITE_AUTH_REFRESH_PATH`
- `VITE_AUTH_LOGOUT_PATH`
- `VITE_AUTH_USE_MOCK_LOGIN`

개발 환경에서는 백엔드 서버 주소를 직접 지정할 수 있고, 운영 환경에서는 `/api` 프록시 경로를 사용할 수 있다.

## 인증 API

인증 API는 `src/services/auth/authApi.ts`에서 담당한다.

- 로그인 성공 시 access token을 추출한다.
- 세션 정보와 access token은 `authState.ts`를 통해 저장한다.
- mock login 옵션이 켜져 있으면 실제 로그인 요청 대신 mock 세션을 만든다.
- 로그아웃은 서버 요청을 보낸 뒤 로컬 인증 상태를 정리한다.
- `/demo/admin` 진입 시에도 같은 로그인 API를 사용하며, `admin` / `supermario4` 값으로 요청한 뒤 성공 시 `/simulation`으로 이동한다.

## SWMM API

SWMM API는 `src/services/swmm/client.ts`에서 담당한다.

- `GET /engine/status`
- `POST /engine/start`
- `POST /engine/stop`
- `POST /engine/pause`
- `POST /engine/resume`
- `POST /engine/reset`
- `POST /engine/control`
- `GET /scenarios`
- `POST /scenarios`
- `PUT /scenarios/{id}`

엔진 시작 요청은 편집기 레이아웃과 실행 제어값을 함께 전달한다. 응답이 비어 있으면 화면에 표시 가능한 오류로 변환한다.

## 위험 로그 API

위험 로그 API는 `src/services/hazards/hazards.ts`에서 담당한다.

- `GET /api/hazards`
- `GET /api/hazards/{id}`
- `POST /api/hazards/{id}/actions`
- `PATCH /api/hazards/{id}/actions/{action_id}`

응답 필드는 snake_case와 camelCase를 모두 허용한다. 화면에서는 정규화된 `HazardLogRecord`, `HazardLogDetail`, `HazardActionRecord` 타입을 사용한다.

위험 로그 목록은 서버에서 받은 전체 로그를 기준으로 렌더링한다. 상태 필터와 정렬은 React 화면에서 적용한다.

## 위험 로그 상태 갱신

`조치 전` row에서 조치 내용을 제출하면 다음 요청을 보낸다.

```json
{
  "action_detail": "입력한 조치 내용",
  "action_type": "FIELD_CHECK"
}
```

성공 시 화면 row는 `IN_PROGRESS`로 갱신되고, 내용에는 `actionDetail`을 표시한다.

`조치 중` row에서 결과를 제출하면 다음 요청을 보낸다.

```json
{
  "result_detail": "입력한 결과",
  "result_status": "RESOLVED",
  "recurrence_note": "선택 입력값"
}
```

성공 시 화면 row는 `RESOLVED`로 갱신된다.
