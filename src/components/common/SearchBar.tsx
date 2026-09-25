/**
 * SearchBar — the one search input used across the app (product search,
 * customer/receipt/order-list pickers, the side-menu global search, …).
 * Search icon on the left, clear button when there's text, Enter submits.
 */
import type { InputHTMLAttributes, KeyboardEvent, ReactNode, Ref } from 'react'
import { Search, X } from 'lucide-react'
import './SearchBar.css'

type SearchBarProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size' | 'onSubmit'> & {
  value: string
  onValueChange: (value: string) => void
  /** Enter key — e.g. run a server-side search. */
  onSubmit?: (value: string) => void
  /** Runs after the clear (×) button empties the field. */
  onClear?: () => void
  size?: 'sm' | 'md' | 'lg'
  /** Small keyboard hint shown while empty, e.g. "Ctrl K". */
  shortcut?: string
  /** Extra content inside the bar, after the clear button. */
  trailing?: ReactNode
  className?: string
  ref?: Ref<HTMLInputElement>
}

export function SearchBar({
  value,
  onValueChange,
  onSubmit,
  onClear,
  size = 'md',
  shortcut,
  trailing,
  className,
  placeholder = 'Search',
  onKeyDown,
  ref,
  ...inputProps
}: SearchBarProps) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(e)
    if (e.defaultPrevented) return
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault()
      onSubmit(e.currentTarget.value)
    } else if (e.key === 'Escape' && value) {
      e.preventDefault()
      e.stopPropagation()
      onValueChange('')
      onClear?.()
    }
  }

  return (
    <label className={`ui-search is-${size}${className ? ` ${className}` : ''}`}>
      <Search className="ui-search-icon" aria-hidden />
      <input
        ref={ref}
        type="search"
        autoComplete="off"
        spellCheck={false}
        aria-label={inputProps['aria-label'] ?? placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
        {...inputProps}
      />
      {value ? (
        <button
          type="button"
          className="ui-search-clear"
          aria-label="Clear search"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onValueChange('')
            onClear?.()
          }}
        >
          <X size={12} />
        </button>
      ) : shortcut ? (
        <kbd className="ui-search-kbd">{shortcut}</kbd>
      ) : null}
      {trailing}
    </label>
  )
}

export default SearchBar
