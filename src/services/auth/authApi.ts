import { apiClient, AUTH_LOGIN_PATH, AUTH_LOGOUT_PATH, API_BASE_URL, extractAccessToken, joinApiUrl } from '../http/apiClient'
import { clearAuthState, saveAuthSession, setAccessToken, type AuthSession } from './authState'

const USE_MOCK_LOGIN = import.meta.env.VITE_AUTH_USE_MOCK_LOGIN !== 'false'

interface LoginResponseBody {
  email?: unknown
  user?: {
    email?: unknown
  }
}

function base64UrlEncode(value: string) {
  return window.btoa(unescape(encodeURIComponent(value)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function createMockAccessToken(email: string) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64UrlEncode(JSON.stringify({
    email,
    iat: Math.floor(Date.now() / 1000),
    iss: 'supermario-react-mock',
    sub: email,
  }))
  const signature = base64UrlEncode(`mock-${crypto.randomUUID()}`)

  return `${header}.${payload}.${signature}`
}

async function requestMockLogin(email: string, password: string) {
  void password
  await Promise.resolve()

  return {
    accessToken: createMockAccessToken(email),
    email,
  }
}

async function requestLogin(email: string, password: string) {
  if (USE_MOCK_LOGIN) {
    return requestMockLogin(email, password)
  }

  const response = await apiClient.post<unknown>(
    joinApiUrl(API_BASE_URL, AUTH_LOGIN_PATH),
    { email, password },
    { skipAuth: true },
  )

  return response.data
}

export async function loginWithPassword(email: string, password: string): Promise<AuthSession> {
  const loginPayload = await requestLogin(email, password)
  const accessToken = extractAccessToken(loginPayload)
  const payload = loginPayload as LoginResponseBody | null
  const responseEmail = typeof payload?.email === 'string'
    ? payload.email
    : typeof payload?.user?.email === 'string'
      ? payload.user.email
      : email
  const session: AuthSession = {
    email: responseEmail,
    createdAt: new Date().toISOString(),
  }

  setAccessToken(accessToken)
  saveAuthSession(session)

  return session
}

export async function logoutFromServer() {
  await apiClient.post(
    joinApiUrl(API_BASE_URL, AUTH_LOGOUT_PATH),
    {},
    { skipAuth: true },
  ).catch(() => null)
  clearAuthState({ clearRefreshCookies: true })
}
