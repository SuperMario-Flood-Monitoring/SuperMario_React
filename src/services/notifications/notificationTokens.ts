export interface NotificationTokenRecord {
  id: string
  name: string
  token: string
  createdAt: string
}

interface NotificationTokenInput {
  name: string
  token: string
}

// Backend API draft, kept disabled until Django provides the endpoints.
// apiClient attaches `Authorization: Bearer <accessToken>` through its request interceptor.
// import { apiClient, API_BASE_URL, joinApiUrl } from '../http/apiClient'
//
// const NOTIFICATION_TOKEN_API_PATH = '/api/notification-tokens'
//
// interface NotificationTokenListResponse {
//   ok: boolean
//   tokens: NotificationTokenRecord[]
// }
//
// interface NotificationTokenDetailResponse {
//   ok: boolean
//   token: NotificationTokenRecord
// }
//
// export async function listNotificationTokensFromApi() {
//   const response = await apiClient.get<NotificationTokenListResponse>(
//     joinApiUrl(API_BASE_URL, NOTIFICATION_TOKEN_API_PATH),
//   )
//   return response.data.tokens
// }
//
// export async function createNotificationTokenFromApi(input: NotificationTokenInput) {
//   const response = await apiClient.post<NotificationTokenDetailResponse>(
//     joinApiUrl(API_BASE_URL, NOTIFICATION_TOKEN_API_PATH),
//     {
//       name: input.name.trim(),
//       token: input.token.trim(),
//     },
//   )
//   return response.data.token
// }
//
// export async function deleteNotificationTokenFromApi(tokenId: string) {
//   await apiClient.delete(
//     joinApiUrl(API_BASE_URL, `${NOTIFICATION_TOKEN_API_PATH}/${tokenId}`),
//   )
// }

const STORAGE_KEY = 'supermario-notification-tokens'

function createId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function readStoredTokens(): NotificationTokenRecord[] {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)
    const parsedValue: unknown = rawValue ? JSON.parse(rawValue) : []

    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue.filter((item): item is NotificationTokenRecord => (
      item &&
      typeof item === 'object' &&
      'id' in item &&
      'name' in item &&
      'token' in item &&
      'createdAt' in item &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.token === 'string' &&
      typeof item.createdAt === 'string'
    ))
  } catch {
    return []
  }
}

function writeStoredTokens(tokens: NotificationTokenRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}

export function listNotificationTokens() {
  return readStoredTokens()
}

export function createNotificationToken(input: NotificationTokenInput) {
  const nextToken: NotificationTokenRecord = {
    id: createId(),
    name: input.name.trim(),
    token: input.token.trim(),
    createdAt: new Date().toISOString(),
  }
  const nextTokens = [nextToken, ...readStoredTokens()]

  writeStoredTokens(nextTokens)
  return nextToken
}

export function deleteNotificationToken(tokenId: string) {
  const nextTokens = readStoredTokens().filter((token) => token.id !== tokenId)
  writeStoredTokens(nextTokens)
  return nextTokens
}
