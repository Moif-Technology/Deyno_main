/**
 * Reusable toast pill — white rounded card: ringed status icon + message. Any
 * screen showing a transient status message renders the same component
 * instead of hand-rolling its own toast markup.
 */
import type { ComponentType } from 'react'
import { AlertTriangle, Check, Info, X } from 'lucide-react'
import './Toast.css'

export type ToastKind = 'error' | 'success' | 'alert' | 'info'

export interface ToastProps {
  message: string
  kind?: ToastKind
  /** How long (ms) the toast stays; drives the closing ring around the icon. */
  duration?: number
}

type IconType = ComponentType<{ size?: number; strokeWidth?: number }>

const ICONS: Record<ToastKind, IconType> = {
  error: X,
  success: Check,
  alert: AlertTriangle,
  info: Info,
}

/** Pick a kind from the wording, for screens that only pass a message. */
export function toastKindFor(message: string): ToastKind {
  return /success|saved|updated|deleted|completed/i.test(message) ? 'success' : 'error'
}

export function Toast({ message, kind = 'error', duration }: ToastProps) {
  const Icon = ICONS[kind]
  return (
    <div className={`toast toast-${kind}`} role="status">
      <span className="toast-icon-wrap" aria-hidden>
        {/* Countdown ring: drains over `duration` until the toast closes. */}
        <svg className="toast-ring" viewBox="0 0 36 36">
          <circle className="toast-ring-track" cx="18" cy="18" r="16" />
          {duration ? (
            <circle
              className="toast-ring-bar"
              cx="18"
              cy="18"
              r="16"
              pathLength={100}
              style={{ animationDuration: `${duration}ms` }}
            />
          ) : null}
        </svg>
        <span className="toast-icon">
          <Icon size={12} strokeWidth={3.2} />
        </span>
      </span>
      <span className="toast-message">{message}</span>
    </div>
  )
}
