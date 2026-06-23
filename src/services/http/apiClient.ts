import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import {
  clearAuthState,
  getAccessToken,
  notifyAuthFailure,
  setAccessToken,
} from '../auth/authState'

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuth?: boolean
    retryAfterRefresh?: boolean
  }

  export interface InternalAxiosRequestConfig {
    skipAuth?: boolean
    retryAfterRefresh?: boolean
  }
}

export const API_BASE_URL = import.meta.env.VITE_SWMM_ENGINE_URL ?? '/api'
export const AUTH_LOGIN_PATH = import.meta.env.VITE_AUTH_LOGIN_PATH ?? '/api/auth/login'
export const AUTH_REFRESH_PATH = import.meta.env.VITE_AUTH_REFRESH_PATH ?? '/api/auth/refresh'
export const AUTH_LOGOUT_PATH = import.meta.env.VITE_AUTH_LOGOUT_PATH ?? '/api/auth/logout'

interface AccessTokenBody {
  accessToken?: unknown
  access_token?: unknown
  access?: unknown
  token?: unknown
}

const refreshClient = axios.create({
  withCredentials: true,
})

let refreshPromise: Promise<string> | null = null

export const apiClient = axios.create({
  withCredentials: true,
})

function isAbsoluteUrl(value: string) {
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(value)
}

export function joinApiUrl(baseUrl: string, path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (isAbsoluteUrl(path)) {
    return path
  }

  if (isAbsoluteUrl(baseUrl)) {
    const url = new URL(baseUrl)
    const normalizedBasePath = url.pathname.replace(/\/+$/, '') || '/'

    url.pathname = normalizedPath === normalizedBasePath || normalizedPath.startsWith(`${normalizedBasePath}/`)
      ? normalizedPath
      : `${normalizedBasePath === '/' ? '' : normalizedBasePath}${normalizedPath}`
    url.search = ''
    url.hash = ''

    return url.toString()
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  if (normalizedPath === normalizedBaseUrl || normalizedPath.startsWith(`${normalizedBaseUrl}/`)) {
    return normalizedPath
  }

  return `${normalizedBaseUrl}${normalizedPath}`
}

export function extractAccessToken(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    throw new Error('로그인 응답에 access token이 없습니다.')
  }

  const body = payload as AccessTokenBody
  const accessToken = body.accessToken ?? body.access_token ?? body.access ?? body.token

  if (typeof accessToken !== 'string' || !accessToken.trim()) {
    throw new Error('로그인 응답에 access token이 없습니다.')
  }

  return accessToken
}

function getAxiosErrorMessage(error: AxiosError) {
  const payload = error.response?.data

  if (payload && typeof payload === 'object') {
    if ('detail' in payload && typeof payload.detail === 'string') {
      return payload.detail
    }
    if ('message' in payload && typeof payload.message === 'string') {
      return payload.message
    }
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }

  return error.response?.status
    ? `API 요청이 실패했습니다. (${error.response.status})`
    : error.message
}

function toError(error: unknown) {
  if (axios.isAxiosError(error)) {
    return new Error(getAxiosErrorMessage(error))
  }

  return error instanceof Error ? error : new Error('API 요청이 실패했습니다.')
}

async function requestAccessTokenRefresh() {
  const response = await refreshClient.post<unknown>(
    joinApiUrl(API_BASE_URL, AUTH_REFRESH_PATH),
    {},
    { skipAuth: true },
  )
  const accessToken = extractAccessToken(response.data)
  setAccessToken(accessToken)
  return accessToken
}

function refreshAccessToken() {
  refreshPromise ??= requestAccessTokenRefresh().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

apiClient.interceptors.request.use((config) => {
  if (config.skipAuth) {
    return config
  }

  const accessToken = getAccessToken()
  if (!accessToken) {
    clearAuthState({ clearRefreshCookies: false })
    notifyAuthFailure('missing_access_token')
    throw new Error('로그인이 필요합니다.')
  }

  config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(toError(error))
    }

    const responseStatus = error.response?.status
    const originalRequest = error.config as InternalAxiosRequestConfig | undefined

    if (
      responseStatus === 401 &&
      originalRequest &&
      !originalRequest.skipAuth &&
      !originalRequest.retryAfterRefresh
    ) {
      originalRequest.retryAfterRefresh = true

      try {
        const accessToken = await refreshAccessToken()
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        clearAuthState({ clearRefreshCookies: true })
        notifyAuthFailure('refresh_failed')
        return Promise.reject(toError(refreshError))
      }
    }

    if (responseStatus === 403) {
      clearAuthState({ clearRefreshCookies: true })
      notifyAuthFailure('forbidden')
    }

    return Promise.reject(toError(error))
  },
)
