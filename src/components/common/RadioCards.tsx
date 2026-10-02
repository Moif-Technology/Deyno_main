/**
 * Reusable single-choice picker: equal cards side by side, each with a radio
 * dot. Use it for a short list of options (2–4) where one must be picked.
 */
import './RadioCards.css'

export interface RadioCardsProps {
  value: string
  onChange: (value: string) => void
  /** [value, label] pairs, in display order. */
  options: readonly (readonly [string, string])[]
  /** Accessible name of the group, e.g. "Report type". */
  label?: string
  disabled?: boolean
}

export function RadioCards({ value, onChange, options, label, disabled }: RadioCardsProps) {
  return (
    <div
      className="rc-root"
      role="radiogroup"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(([v, text]) => {
        const on = v === value
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            className={`rc-card${on ? ' is-on' : ''}`}
            onClick={() => onChange(v)}
          >
            <i aria-hidden />
            <span>{text}</span>
          </button>
        )
      })}
    </div>
  )
}
