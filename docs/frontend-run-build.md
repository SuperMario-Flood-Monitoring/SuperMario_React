# 프론트 실행/빌드

작성 기준: 2026-06-29

## 기술 스택

- React 19
- TypeScript
- Vite 8
- Tailwind CSS 4
- Axios
- ESLint

## 설치

```bash
npm install
```

## 개발 서버 실행

```bash
npm run dev
```

Vite 개발 서버가 실행되면 터미널에 표시되는 로컬 URL로 접속한다.

## 린트

```bash
npm run lint
```

ESLint 설정을 기준으로 전체 소스를 검사한다.

## 빌드

```bash
npm run build
```

빌드는 TypeScript project build와 Vite build를 순서대로 수행한다.

```bash
tsc -b && vite build
```

## 미리보기

```bash
npm run preview
```

Vite preview 서버로 빌드 결과를 확인한다.

## 주요 환경 변수

개발 및 운영 환경에서 API 주소와 인증 경로를 환경 변수로 조정한다.

```text
VITE_SWMM_ENGINE_URL
VITE_AUTH_LOGIN_PATH
VITE_AUTH_REFRESH_PATH
VITE_AUTH_LOGOUT_PATH
VITE_AUTH_USE_MOCK_LOGIN
```

`VITE_SWMM_ENGINE_URL`은 공통 API base URL로 사용된다. 값이 없으면 기본값은 `/api`다.

## 개발 시 확인 포인트

문서만 수정한 경우 빌드는 필수는 아니다. React 소스 또는 TypeScript 타입을 수정한 경우에는 최소한 다음 명령을 확인한다.

```bash
npm run lint
npm run build
```
