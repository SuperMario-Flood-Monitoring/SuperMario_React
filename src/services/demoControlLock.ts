const DEMO_CONTROL_LOCK_STORAGE_KEY = 'supermario.demoControlLocked'

function storage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function enableDemoControlLock() {
  storage()?.setItem(DEMO_CONTROL_LOCK_STORAGE_KEY, 'true')
}

export function clearDemoControlLock() {
  storage()?.removeItem(DEMO_CONTROL_LOCK_STORAGE_KEY)
}

export function isDemoControlLocked() {
  return storage()?.getItem(DEMO_CONTROL_LOCK_STORAGE_KEY) === 'true'
}
