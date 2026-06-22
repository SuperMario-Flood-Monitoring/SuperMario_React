# SuperMario React

도시 배수망을 직접 편집하고, SWMM 기반 실시간 침수/배수 시뮬레이션을 확인하는 React 클라이언트입니다.

이 프로젝트의 핵심은 화면에서 만든 배수도 JSON을 백엔드 DTO 계약에 맞게 전달하고, 백엔드가 변환/실행한 SWMM 런타임 결과를 다시 시각적으로 보여주는 것입니다. React는 유량, 유속, 수위, 만관율을 직접 계산하지 않고 SWMM snapshot을 렌더링합니다.

## 한눈에 보기

| 영역 | 역할 |
| --- | --- |
| 편집 화면 | 빗물받이, 맨홀, 관로, 펌프장, 우수토실 등 배수 객체 배치와 연결 |
| 시나리오 | 편집한 배수도 JSON 저장, 불러오기, 갱신 |
| 변환 검증 | 편집 JSON을 백엔드에 보내 SWMM INP 변환 가능 여부 확인 |
| 실험 화면 | 강수량, 배속, 객체별 막힘을 조작하며 SWMM 결과 관찰 |
| 런타임 연결 | HTTP API와 WebSocket으로 엔진 상태와 tick snapshot 수신 |

## UI/UX 플로우

```text
배수도 편집
  -> 시나리오 저장 또는 불러오기
  -> SWMM 변환 검증
  -> 실험 화면 진입
  -> 엔진 시작
  -> 강수량 / 막힘 / 배속 조정
  -> WebSocket snapshot 표시
  -> 위험 지점과 선택 객체 상태 확인
```

### 편집 화면

사용자는 배수 시설과 관망을 배치하고 연결합니다. 각 객체의 `id`, `swmmId`, 포트, 관 종류, 막힘 설정은 이후 SWMM 변환과 런타임 제어 payload의 기준이 됩니다.

### 시나리오 관리

백엔드의 scenario API와 연결되어 현재 편집 layout을 저장하거나 다시 불러올 수 있습니다. React DTO는 백엔드의 `ScenarioCreateRequest`, `ScenarioUpdateRequest`, `ScenarioResponse` 형태를 기준으로 맞춰져 있습니다.

### 실험 화면

실험 화면은 백엔드 SWMM 엔진을 시작하고, `ws/simulation` WebSocket으로 들어오는 snapshot을 화면 객체 단위로 집계해 보여줍니다. 선택한 객체의 SWMM node/link 매핑, 유량, 유속, 차오름, 막힘, 외부 유입을 확인할 수 있습니다.

## 기술 스택

| 계층 | 사용 기술 |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS 4, CSS |
| Runtime 통신 | Fetch API, WebSocket |
| DTO 기준 | Django Ninja Schema 기반 백엔드 DTO |
| 주요 타입 | `src/services/swmm/dto.ts` |
| 빌드 | TypeScript project build, Vite |

## 백엔드 DTO 기준

React DTO는 백엔드 DTO 이름과 필드 의미를 기준으로 맞춥니다.

| 백엔드 DTO | React 타입 |
| --- | --- |
| `EngineStartRequest` | `EngineStartRequest`, `SwmmRuntimeStartRequest` |
| `EngineResetRequest` | `EngineResetRequest` |
| `EngineControlRequest` | `EngineControlRequest`, `SwmmEngineControl` |
| `EngineStatusResponse` | `EngineStatusResponse`, `SwmmEngineStatus` |
| `EngineStartResponse` | `EngineStartResponse`, `SwmmRuntimeStartResponse` |
| `EngineControlResponse` | `EngineControlResponse` |
| `EditorConvertRequest` / `EditorConvertResponse` | `EditorConvertRequest`, `EditorConvertResponse` |
| `ScenarioCreateRequest` / `ScenarioUpdateRequest` / `ScenarioResponse` | scenario 관련 React 타입 |

타입 정의는 [src/services/swmm/dto.ts](./src/services/swmm/dto.ts)에 모여 있고, 실제 HTTP/WebSocket 호출은 [src/services/swmm/client.ts](./src/services/swmm/client.ts)가 담당합니다. 편집 JSON과 SWMM mapping을 이용해 제어 payload를 만드는 로직은 [src/services/swmm/editorRuntime.ts](./src/services/swmm/editorRuntime.ts)에 있습니다.

## 주요 DTO 필드

| 필드 | 방향 | 의미 |
| --- | --- | --- |
| `layout` | React -> Backend | 편집 화면에서 만든 `EditorLayout` JSON |
| `stepSeconds` | React -> Backend | SWMM runtime step. 기본값은 `1` |
| `rainfallRatio` | React -> Backend | 현재 런타임 호환용 강수 제어값 |
| `rainfallPercent` | React -> Backend | 백엔드 DTO에서 허용하는 강수 표시값 |
| `blockagesById` | React -> Backend | SWMM node/link id별 막힘 값 |
| `control` | Backend -> React | 강수, 막힘, 최대 강수량, 배속 상태 |
| `nodes` / `links` | Backend -> React | SWMM node/link별 runtime snapshot |
| `editorObjects` | Backend -> React | 화면 객체 단위로 집계한 상태 |

## 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 백엔드 실행

백엔드는 기본적으로 `http://127.0.0.1:8000`을 사용합니다.

```bash
cd /Users/onseoktae/Documents/urban_flooding_monitoring-master/backend
python3 -m pip install -r requirements.txt
python3 manage.py runserver 127.0.0.1:8000
```

### 3. React 개발 서버 실행

```bash
cd /Users/onseoktae/Documents/SuperMario/SuperMario_React
VITE_SWMM_ENGINE_URL=http://127.0.0.1:8000 npm run dev
```

### 4. 빌드 확인

```bash
npm run build
```

## 환경 변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `VITE_SWMM_ENGINE_URL` | `http://127.0.0.1:8000` | SWMM/Django 백엔드 API 주소 |

## 디렉터리 구조

```text
SuperMario_React/
├── src/
│   ├── components/
│   │   ├── editor/        # 배수도 편집 UI
│   │   ├── simulation/    # SWMM 실험/런타임 UI
│   │   ├── diagram/       # SVG 배수도 구성 요소
│   │   └── layout/        # workbench layout
│   ├── data/              # 기본 배수도 JSON
│   ├── domain/            # 도메인 타입/상수
│   └── services/swmm/     # DTO, API client, runtime mapping helper
├── public/
├── docs/
├── package.json
└── vite.config.ts
```

## 개발 시 주의할 점

- 백엔드 DTO를 바꾸면 [src/services/swmm/dto.ts](./src/services/swmm/dto.ts)를 먼저 맞춥니다.
- React는 SWMM 계산 결과를 직접 만들지 않습니다. 수리 상태는 snapshot의 `nodes`, `links`, `editorObjects`를 기준으로 표시합니다.
- UI slider 값과 SWMM 정규화 값을 혼동하지 않습니다. 막힘 UI는 0~100 표시값이고, 서버 snapshot의 `blockageRatio`는 0~1 비율입니다.
- 편집 객체 ID, `swmmId`, runtime mapping의 SWMM node/link ID는 따로 임의 변경하지 않습니다.
- 백엔드가 없는 상태에서도 편집 화면은 열리지만, 변환 검증과 실험 화면은 API/WebSocket 연결이 필요합니다.
