# 컴포넌트 구조

작성 기준: 2026-06-29

## 최상위 구조

```text
src/
  App.tsx
  app/
  assets/
  mobile/
  services/
  shared/
  web/
```

`App.tsx`는 라우트, 인증 세션, 화면 종류를 결정한다. 화면 종류는 `src/app/deviceSurface.ts`에서 판단하며, mobile 또는 web 작업장 컴포넌트를 lazy import로 로드한다.

## web/mobile 분리

web과 mobile은 화면 단위 컴포넌트를 별도 폴더에 둔다.

```text
src/web/
  auth/
  editor/
  layout/
  logs/
  notifications/
  simulation/
  theme/

src/mobile/
  auth/
  editor/
  layout/
  logs/
  notifications/
  simulation/
  theme/
```

동일한 기능이라도 레이아웃과 상호작용 방식이 다르면 web/mobile에 각각 구현한다. API 호출, DTO 정규화, 공통 표시 유틸은 `services`와 `shared`에 둔다.

## 작업장 컴포넌트

작업장 컴포넌트는 현재 모드에 따라 실제 화면을 선택한다.

- `simulation`: `SimulationWorkbench`
- `editor`: `EditorCanvas`
- `logs`: `HazardLogsPage`

작업장 헤더는 각 화면에 `renderHeader` 형태로 전달된다. 편집 모드처럼 정보 패널 토글이 필요한 화면은 헤더 렌더러에 제어 객체를 넘길 수 있다.

## 위험 로그 구조

위험 로그 화면은 web과 mobile에 각각 존재한다.

- web: 테이블 중심의 그리드 UI
- mobile: 카드/시트 중심의 터치 UI
- 공통 서비스: `src/services/hazards/hazards.ts`
- 공통 표시 유틸: `src/shared/hazards/hazardDisplay.ts`

위험 로그 컴포넌트가 담당하는 일은 다음과 같다.

- 로그 목록 조회
- 상태 필터
- 시간 정렬
- 실시간 이벤트 버퍼 개수 표시
- 조치 시작 모달 또는 시트
- 조치 완료 모달 또는 시트
- API 응답을 기준으로 row 갱신

## 서비스 계층

서비스 계층은 화면 컴포넌트가 직접 Axios 세부 구현에 의존하지 않도록 API 호출 함수를 제공한다.

- HTTP 공통 클라이언트: `src/services/http/apiClient.ts`
- 인증 API: `src/services/auth/authApi.ts`
- 인증 상태: `src/services/auth/authState.ts`
- SWMM API: `src/services/swmm/client.ts`
- 위험 로그 API: `src/services/hazards/hazards.ts`

## shared 계층

`shared`는 web/mobile 양쪽에서 사용하는 타입, 변환, 표시 로직을 둔다.

- 편집기 타입: `src/shared/editor`
- 위험 로그 표시 포맷: `src/shared/hazards`

화면 전용 레이아웃 로직은 shared로 올리지 않는다. 양쪽에서 같은 의미로 재사용되는 순수 로직만 shared에 둔다.
