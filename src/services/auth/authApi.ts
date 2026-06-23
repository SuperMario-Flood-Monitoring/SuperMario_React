import { apiClient, AUTH_LOGIN_PATH, AUTH_LOGOUT_PATH, API_BASE_URL, extractAccessToken, joinApiUrl } from '../http/apiClient'
import { clearAuthState, saveAuthSession, setAccessToken, type AuthSession } from './authState'

const USE_MOCK_LOGIN = import.meta.env.VITE_AUTH_USE_MOCK_LOGIN === 'true'

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value)
  const binaryValue = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return window.btoa(binaryValue)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function base64UrlDecode(value: string) {
  const normalizedValue = value.replaceAll('-', '+').replaceAll('_', '/')
  const paddedValue = normalizedValue.padEnd(normalizedValue.length + ((4 - normalizedValue.length % 4) % 4), '=')
  const binaryValue = window.atob(paddedValue)
  const bytes = Uint8Array.from(binaryValue, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function decodeAccessTokenPayload(accessToken: string): Record<string, unknown> | null {
  try {
    const [, encodedPayload] = accessToken.split('.')
    if (!encodedPayload) {
      return null
    }

    const payload: unknown = JSON.parse(base64UrlDecode(encodedPayload))
    return payload && typeof payload === 'object' ? payload as Record<string, unknown> : null
  } catch {
    return null
  }
}

function createMockAccessToken(username: string) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64UrlEncode(JSON.stringify({
    iat: Math.floor(Date.now() / 1000),
    iss: 'supermario-react-mock',
    role: 'ADMIN',
    sub: username,
    tokenType: 'access',
    username,
  }))
  const signature = base64UrlEncode(`mock-${crypto.randomUUID()}`)

  return `${header}.${payload}.${signature}`
}

async function requestMockLogin(username: string, password: string) {
  void password
  await Promise.resolve()

  return {
    accessToken: createMockAccessToken(username),
  }
}

async function requestLogin(username: string, password: string) {
  if (USE_MOCK_LOGIN) {
    return requestMockLogin(username, password)
  }

  const response = await apiClient.post<unknown>(
    joinApiUrl(API_BASE_URL, AUTH_LOGIN_PATH),
    { username, password },
    { skipAuth: true },
  )

  return response.data
}

export async function loginWithPassword(username: string, password: string): Promise<AuthSession> {
  const loginPayload = await requestLogin(username, password)
  const accessToken = extractAccessToken(loginPayload)
  const decodedPayload = decodeAccessTokenPayload(accessToken)
  const responseUsername = typeof decodedPayload?.username === 'string'
    ? decodedPayload.username
    : username
  const session: AuthSession = {
    username: responseUsername,
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
  ).catch(() => null)
  clearAuthState({ clearRefreshCookies: true })
}
