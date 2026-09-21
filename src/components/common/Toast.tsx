/**
 * Reusable toast pill — colored circular icon badge + message, on a soft
 * tinted card. Any screen showing a transient status message renders the
 * same component instead of hand-rolling its own toast markup.
 */
import type { ComponentType } from 'react'
import { AlertTriangle, Check, Info, X } from 'lucide-react'
import './Toast.css'

export type ToastKind = 'error' | 'success' | 'alert' | 'info'

export interface ToastProps {
  message: string
  kind?: ToastKind
}

const ICONS: Record<ToastKind, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  error: X,
  success: Check,
  alert: AlertTriangle,
  info: Info,
}

export function Toast({ message, kind = 'error' }: ToastProps) {
  const Icon = ICONS[kind]
  return (
    <div className={`toast toast-${kind}`} role="status">
      <span className="toast-icon" aria-hidden>
        <Icon size={14} strokeWidth={3} />
      </span>
      <span className="toast-message">{message}</span>
    </div>
  )
}
