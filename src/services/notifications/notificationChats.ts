import { API_BASE_URL, apiClient, joinApiUrl } from '../http/apiClient'

export interface NotificationChatRecord {
  id: string
  employeeName: string
  chatId: string
  createdAt?: string
}

export interface NotificationChatInput {
  employeeName: string
  chatId: string
}

const NOTIFICATION_LIST_API_PATH = '/api/notification/list'
const NOTIFICATION_CREATE_API_PATH = '/api/notification/'
const NOTIFICATION_DETAIL_API_PATH = '/api/notification'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toStringValue(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return undefined
}

function normalizeNotificationChat(value: unknown): NotificationChatRecord | null {
  if (!isRecord(value)) {
    return null
  }

  const id = toStringValue(value.id ?? value.notification_id ?? value.notificationId ?? value.pk)
  const employeeName = toStringValue(value.employee_name ?? value.employeeName ?? value.name)
  const chatId = toStringValue(value.chat_id ?? value.chatId)
  const createdAt = toStringValue(value.created_at ?? value.createdAt)

  if (!id || !employeeName || !chatId) {
    return null
  }

  return {
    id,
    employeeName,
    chatId,
    createdAt,
  }
}

function extractListPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (!isRecord(payload)) {
    return []
  }

  const candidates = [
    payload.notifications,
    payload.notificationChats,
    payload.items,
    payload.results,
    payload.data,
    payload.list,
  ]

  const listPayload = candidates.find(Array.isArray)
  return Array.isArray(listPayload) ? listPayload : []
}

function extractDetailPayload(payload: unknown): NotificationChatRecord {
  const directRecord = normalizeNotificationChat(payload)
  if (directRecord) {
    return directRecord
  }

  if (isRecord(payload)) {
    const candidates = [
      payload.notification,
      payload.notificationChat,
      payload.item,
      payload.result,
      payload.data,
    ]

    for (const candidate of candidates) {
      const nestedRecord = normalizeNotificationChat(candidate)
      if (nestedRecord) {
        return nestedRecord
      }
    }
  }

  throw new Error('알림 채팅방 응답 형식이 올바르지 않습니다.')
}

export async function listNotificationChats() {
  const response = await apiClient.get<unknown>(
    joinApiUrl(API_BASE_URL, NOTIFICATION_LIST_API_PATH),
  )

  return extractListPayload(response.data)
    .map(normalizeNotificationChat)
    .filter((item): item is NotificationChatRecord => Boolean(item))
}

export async function createNotificationChat(input: NotificationChatInput) {
  const response = await apiClient.post<unknown>(
    joinApiUrl(API_BASE_URL, NOTIFICATION_CREATE_API_PATH),
    {
      employee_name: input.employeeName.trim(),
      chat_id: input.chatId.trim(),
    },
  )

  return extractDetailPayload(response.data)
}

export async function deleteNotificationChat(notificationId: string) {
  await apiClient.delete(
    joinApiUrl(API_BASE_URL, `${NOTIFICATION_DETAIL_API_PATH}/${encodeURIComponent(notificationId)}`),
  )
}
