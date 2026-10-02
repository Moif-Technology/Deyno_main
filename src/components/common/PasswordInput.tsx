/**
 * PasswordInput — a password box with an eye button that shows / hides what
 * was typed. Sits inside a `.pd-form-row` like any other input.
 *
 *   <PasswordInput value={pw} onChange={setPw} />
 */
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import './PasswordInput.css'

export type PasswordInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  autoFocus?: boolean
  disabled?: boolean
  /** Called when Enter is pressed in the box. */
  onEnter?: () => void
}

export function PasswordInput({ value, onChange, placeholder, autoComplete, autoFocus, disabled, onEnter }: PasswordInputProps) {
  const [shown, setShown] = useState(false)
  return (
    <span className="ui-pw">
      <input
        type={shown ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault()
            onEnter()
          }
        }}
      />
      <button
        type="button"
        className="ui-pw-eye"
        tabIndex={-1}
        disabled={disabled}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        // Keep the cursor in the box when the eye is tapped.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShown((v) => !v)}
      >
        {shown ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </span>
  )
}

export default PasswordInput
