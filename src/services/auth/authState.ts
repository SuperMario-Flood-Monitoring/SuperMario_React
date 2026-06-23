export interface AuthSession {
  email: string
  createdAt: string
}

export type AuthFailureReason = 'forbidden' | 'manual' | 'missing_access_token' | 'refresh_failed'

export const AUTH_SESSION_KEY = 'supermario-react-auth-session'
const ACCESS_TOKEN_KEY = 'supermario-react-access-token'
const REFRESH_COOKIE_NAMES = [
  'refreshToken',
  'refresh_token',
  'supermario_refresh_token',
  'supermario-refresh-token',
]

let authFailureHandler: ((reason: AuthFailureReason) => void) | null = null

export function loadAuthSession(): AuthSession | null {
  try {
    const rawSession = window.sessionStorage.getItem(AUTH_SESSION_KEY)
    const accessToken = getAccessToken()

    if (!rawSession || !accessToken) {
      return null
    }

    const parsedSession: unknown = JSON.parse(rawSession)
    if (parsedSession && typeof parsedSession === 'object') {
      const email = 'email' in parsedSession && typeof parsedSession.email === 'string'
        ? parsedSession.email
        : 'userName' in parsedSession && typeof parsedSession.userName === 'string'
          ? parsedSession.userName
          : null

      if (!email) {
        return null
      }

      return {
        email,
        createdAt: 'createdAt' in parsedSession && typeof parsedSession.createdAt === 'string'
          ? parsedSession.createdAt
          : new Date().toISOString(),
      }
    }
  } catch {
    clearAuthState({ clearRefreshCookies: false })
  }

  return null
}

export function saveAuthSession(session: AuthSession) {
  window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
}

export function getAccessToken() {
  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(accessToken: string) {
  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
}

export function clearAccessToken() {
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function clearRefreshTokenCookies() {
  const expires = 'Thu, 01 Jan 1970 00:00:00 GMT'

  for (const cookieName of REFRESH_COOKIE_NAMES) {
    document.cookie = `${cookieName}=; expires=${expires}; path=/`
    document.cookie = `${cookieName}=; expires=${expires}; path=/api`
  }
}

export function clearAuthState(options: { clearRefreshCookies?: boolean } = {}) {
  window.sessionStorage.removeItem(AUTH_SESSION_KEY)
  window.localStorage.removeItem(AUTH_SESSION_KEY)
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  clearAccessToken()

  if (options.clearRefreshCookies ?? true) {
    clearRefreshTokenCookies()
  }
}

export function setAuthFailureHandler(handler: (reason: AuthFailureReason) => void) {
  authFailureHandler = handler

  return () => {
    if (authFailureHandler === handler) {
      authFailureHandler = null
    }
  }
}

export function notifyAuthFailure(reason: AuthFailureReason) {
  authFailureHandler?.(reason)
}
