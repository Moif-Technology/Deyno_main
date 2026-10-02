/**
 * SearchSelect — a dropdown with a search box at the top of its list.
 * Looks like a regular select field; opening it shows the shared SearchBar
 * plus the options, filtered by name or code as you type. ↑ ↓ move, Enter
 * picks, Esc closes. The list renders in a portal with fixed positioning so
 * a scrolling modal body can't clip it.
 *
 * `typeahead` (default on): no separate search box — the field itself is typeable; the
 * list opens when the cursor enters it and filters as you type.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, LoaderCircle } from 'lucide-react'
import { SearchBar } from './SearchBar'
import { uiZoom } from '../../utils/useUiZoom'
import './SearchSelect.css'

export type SearchSelectOption = { id: number | string; name: string; code?: string }

type Props = {
  /** Selected option id; 0 / '' / null means nothing selected. */
  value: number | string | null
  /** Text shown for the selection (so it can show before options load). */
  valueLabel?: string
  options: SearchSelectOption[]
  onChange: (option: SearchSelectOption) => void
  /** Runs each time the list opens — e.g. (re)load the options. */
  onOpen?: () => void
  loading?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  /** Shown instead of opening when disabled, e.g. "Pick a Group first". */
  disabledHint?: string
  className?: string
  id?: string
  /** Type straight into the field (default). false = search bar inside the list. */
  typeahead?: boolean
}

type Pos = { left: number; width: number; top?: number; bottom?: number; maxHeight: number }

export function SearchSelect({
  value,
  valueLabel,
  options,
  onChange,
  onOpen,
  loading,
  placeholder = 'Select',
  searchPlaceholder = 'Search',
  emptyText = 'Nothing to show',
  disabled,
  disabledHint,
  className,
  id,
  typeahead = true,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<Pos | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const selected = options.find((o) => o.id === value)
  const label = selected?.name || valueLabel || ''

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.name.toLowerCase().includes(q) || (o.code ?? '').toLowerCase().includes(q))
  }, [options, query])

  function place() {
    const el = triggerRef.current
    if (!el) return
    // Rects and innerHeight are in on-screen pixels; the popup's own px get
    // multiplied by the page zoom, so convert back into CSS px.
    const z = uiZoom()
    const rr = el.getBoundingClientRect()
    const vh = window.innerHeight / z
    const r = { left: rr.left / z, top: rr.top / z, bottom: rr.bottom / z, width: rr.width / z }
    const gap = 4
    const below = vh - r.bottom - gap - 8
    const above = r.top - gap - 8
    const openUp = below < 220 && above > below
    setPos({
      left: r.left,
      width: r.width,
      ...(openUp ? { bottom: vh - r.top + gap } : { top: r.bottom + gap }),
      maxHeight: Math.min(320, openUp ? above : below),
    })
  }

  function openList() {
    if (disabled) return
    setQuery('')
    setActive(0)
    place()
    setOpen(true)
    onOpen?.()
  }

  function close(focusTrigger = true) {
    setOpen(false)
    setQuery('')
    // Typeahead keeps focus in its own input already; refocusing would reopen it.
    if (focusTrigger && !typeahead) triggerRef.current?.focus()
  }

  function pick(o: SearchSelectOption) {
    onChange(o)
    close()
  }

  // Start on the current selection when the list opens / options arrive.
  useEffect(() => {
    if (!open) return
    const i = filtered.findIndex((o) => o.id === value)
    setActive(i >= 0 ? i : 0)
  }, [open, options])

  useLayoutEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (popRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      close(false)
    }
    const onMove = (e: Event) => {
      if (popRef.current?.contains(e.target as Node)) return
      place()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('.is-active')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const o = filtered[active]
      if (o) pick(o)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (e.key === 'Tab') {
      close(false)
    }
  }

  return (
    <>
      {typeahead ? (
        <div
          ref={(el) => {
            triggerRef.current = el
          }}
          className={`ui-ss is-typeahead${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}
          title={disabled ? disabledHint : undefined}
          onMouseDown={(e) => {
            if (disabled) return
            if (e.target !== inputRef.current) e.preventDefault()
            inputRef.current?.focus()
            if (!open) openList()
          }}
        >
          <input
            ref={inputRef}
            id={id}
            className="ui-ss-input"
            role="combobox"
            aria-expanded={open}
            aria-controls={id ? `${id}-list` : undefined}
            autoComplete="off"
            disabled={disabled}
            value={open ? query : label}
            placeholder={open && label ? label : disabled && disabledHint ? disabledHint : placeholder}
            onFocus={() => {
              if (!open) openList()
            }}
            onChange={(e) => {
              if (!open) openList()
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
                e.preventDefault()
                openList()
                return
              }
              if (open) onSearchKey(e)
            }}
          />
          <ChevronDown size={15} className="ui-ss-chevron" />
        </div>
      ) : (
      <button
        ref={(el) => {
          triggerRef.current = el
        }}
        id={id}
        type="button"
        className={`ui-ss${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={disabled ? disabledHint : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            openList()
          }
        }}
      >
        <span className={label ? 'ui-ss-value' : 'ui-ss-placeholder'}>
          {label || (disabled && disabledHint ? disabledHint : placeholder)}
        </span>
        <ChevronDown size={15} className="ui-ss-chevron" />
      </button>
      )}

      {open && pos
        ? createPortal(
            <div
              ref={popRef}
              className="ui-ss-pop"
              style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
            >
              {typeahead ? null : (
              <SearchBar
                size="sm"
                autoFocus
                value={query}
                onValueChange={(v) => {
                  setQuery(v)
                  setActive(0)
                }}
                onKeyDown={onSearchKey}
                placeholder={searchPlaceholder}
                aria-controls={id ? `${id}-list` : undefined}
              />
              )}
              <div ref={listRef} className="ui-ss-list" role="listbox" id={id ? `${id}-list` : undefined}>
                {loading && !options.length ? (
                  <p className="ui-ss-msg">
                    <LoaderCircle size={14} className="ui-ss-spin" /> Loading…
                  </p>
                ) : filtered.length === 0 ? (
                  <p className="ui-ss-msg">{query.trim() ? 'No matches' : emptyText}</p>
                ) : (
                  filtered.map((o, i) => {
                    const isSel = o.id === value
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="option"
                        aria-selected={isSel}
                        className={`ui-ss-opt${i === active ? ' is-active' : ''}${isSel ? ' is-selected' : ''}`}
                        onMouseEnter={() => setActive(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(o)}
                      >
                        <span className="ui-ss-opt-name">{o.name}</span>
                        {o.code ? <span className="ui-ss-opt-code">{o.code}</span> : null}
                        {isSel ? <Check size={14} className="ui-ss-check" /> : null}
                      </button>
                    )
                  })
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

export default SearchSelect
