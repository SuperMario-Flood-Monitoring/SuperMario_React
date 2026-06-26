import type { ReactNode } from 'react'

type MobileFloatingActionTone = 'slate' | 'blue' | 'systemDark' | 'systemLight'

interface MobileFloatingActionButtonProps {
  label: string
  title?: string
  tone?: MobileFloatingActionTone
  withRingOffset?: boolean
  className?: string
  children: ReactNode
  onClick: () => void
}

const TONE_CLASS_NAMES: Record<MobileFloatingActionTone, string> = {
  slate: 'border-white/15 bg-black/90 text-white hover:bg-slate-950 focus-visible:ring-slate-300',
  blue: 'border-blue-300 bg-blue-600 text-white hover:bg-blue-500 focus-visible:ring-blue-300',
  systemDark: 'border-white bg-white text-slate-950 hover:bg-slate-100 focus-visible:ring-white',
  systemLight: 'border-slate-950 bg-slate-950 text-white hover:bg-slate-900 focus-visible:ring-slate-500',
}

export function MobileFloatingActionButton({
  label,
  title,
  tone = 'blue',
  withRingOffset = false,
  className = '',
  children,
  onClick,
}: MobileFloatingActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      className={`flex h-12 w-12 items-center justify-center rounded-full border shadow-xl backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 ${
        TONE_CLASS_NAMES[tone]
      } ${
        withRingOffset ? 'focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950' : ''
      } ${className}`}
    >
      {children}
    </button>
  )
}
