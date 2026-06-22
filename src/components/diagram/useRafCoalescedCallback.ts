import { useCallback, useEffect, useRef } from 'react'

export function useRafCoalescedCallback<T>(callback: (value: T) => void) {
  const callbackRef = useRef(callback)
  const frameRef = useRef<number | null>(null)
  const latestValueRef = useRef<T | null>(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const cancel = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    latestValueRef.current = null
  }, [])

  const schedule = useCallback((value: T) => {
    latestValueRef.current = value
    if (frameRef.current !== null) {
      return
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      const latestValue = latestValueRef.current
      latestValueRef.current = null
      if (latestValue !== null) {
        callbackRef.current(latestValue)
      }
    })
  }, [])

  useEffect(() => cancel, [cancel])

  return { schedule, cancel }
}
