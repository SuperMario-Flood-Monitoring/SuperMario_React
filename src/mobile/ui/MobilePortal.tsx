import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface MobilePortalProps {
  children: ReactNode
}

export function MobilePortal({ children }: MobilePortalProps) {
  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(children, document.body)
}
