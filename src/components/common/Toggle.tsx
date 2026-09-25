/**
 * Reusable branded toggle switch — replaces plain checkboxes for single
 * boolean settings (not for row-select or multi-pick lists, where a
 * checkbox is still the right control).
 */
import './Toggle.css'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Optional trailing text label, e.g. "Show on Tablet". */
  label?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <label className={`tg-root${disabled ? ' is-disabled' : ''}`}>
      <input
        type="checkbox"
        className="tg-input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="tg-track">
        <span className="tg-knob" />
      </span>
      {label ? <span className="tg-text">{label}</span> : null}
    </label>
  )
}
