import { useEffect } from 'react'

let activeLockCount = 0
let savedScrollY = 0
let savedBodyOverflow = ''
let savedBodyPosition = ''
let savedBodyTop = ''
let savedBodyLeft = ''
let savedBodyRight = ''
let savedBodyWidth = ''
let savedHtmlOverflow = ''
let savedHtmlOverscrollBehavior = ''

function acquireBodyScrollLock() {
  if (activeLockCount === 0) {
    const { body, documentElement } = document

    savedScrollY = window.scrollY
    savedBodyOverflow = body.style.overflow
    savedBodyPosition = body.style.position
    savedBodyTop = body.style.top
    savedBodyLeft = body.style.left
    savedBodyRight = body.style.right
    savedBodyWidth = body.style.width
    savedHtmlOverflow = documentElement.style.overflow
    savedHtmlOverscrollBehavior = documentElement.style.overscrollBehavior

    documentElement.style.overflow = 'hidden'
    documentElement.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${savedScrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
  }

  activeLockCount += 1
}

function releaseBodyScrollLock() {
  activeLockCount = Math.max(0, activeLockCount - 1)

  if (activeLockCount > 0) {
    return
  }

  const { body, documentElement } = document

  documentElement.style.overflow = savedHtmlOverflow
  documentElement.style.overscrollBehavior = savedHtmlOverscrollBehavior
  body.style.overflow = savedBodyOverflow
  body.style.position = savedBodyPosition
  body.style.top = savedBodyTop
  body.style.left = savedBodyLeft
  body.style.right = savedBodyRight
  body.style.width = savedBodyWidth
  window.scrollTo(0, savedScrollY)
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined
    }

    acquireBodyScrollLock()

    return () => {
      releaseBodyScrollLock()
    }
  }, [active])
}
