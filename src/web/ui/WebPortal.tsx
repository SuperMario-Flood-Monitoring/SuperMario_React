import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface WebPortalProps {
  children: ReactNode
}

export function WebPortal({ children }: WebPortalProps) {
  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(children, document.body)
}
