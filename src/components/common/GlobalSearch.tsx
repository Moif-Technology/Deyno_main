/**
 * GlobalSearch — one search box over everything a screen offers (menu
 * screens, actions, products, categories, areas, …). The screen passes a flat
 * list of items; this component filters, ranks, groups and handles the
 * keyboard (↑ ↓ to move, Enter to open, Esc to clear).
 */
import { useMemo, useState } from 'react'
import type { ComponentType, KeyboardEvent, Ref } from 'react'
import { SearchBar } from './SearchBar'
import './GlobalSearch.css'

export type GlobalSearchItem = {
  id: string
  label: string
  /** Section heading the item is listed under, e.g. "Menu", "Products". */
  group: string
  /** Secondary text on the right/below, e.g. a menu path or a price. */
  hint?: string
  /** Extra words that should match but aren't shown. */
  keywords?: string
  icon?: ComponentType<{ size?: number; strokeWidth?: number }>
  onSelect: () => void
}

type Props = {
  items: GlobalSearchItem[]
  placeholder?: string
  shortcut?: string
  /** Max results per group, keyed by group name; defaults to 6. */
  limits?: Record<string, number>
  autoFocus?: boolean
  inputRef?: Ref<HTMLInputElement>
  /** Called with the query whenever it changes, so the host can hide its own
   * content while results are showing. */
  onQueryChange?: (query: string) => void
  /** Runs after an item is picked (e.g. close the side menu). */
  onPicked?: () => void
  className?: string
}

function score(item: GlobalSearchItem, words: string[]) {
  const label = item.label.toLowerCase()
  const hay = `${label} ${item.hint ?? ''} ${item.keywords ?? ''} ${item.group}`.toLowerCase()
  if (!words.every((w) => hay.includes(w))) return -1
  const first = words[0]
  if (label === words.join(' ')) return 0
  if (label.startsWith(first)) return 1
  if (label.split(/[\s/\-()]+/).some((part) => part.startsWith(first))) return 2
  if (label.includes(first)) return 3
  return 4
}

export function GlobalSearch({
  items,
  placeholder = 'Search anything…',
  shortcut,
  limits,
  autoFocus,
  inputRef,
  onQueryChange,
  onPicked,
  className,
}: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const sections = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return []
    const byGroup = new Map<string, { item: GlobalSearchItem; s: number }[]>()
    for (const item of items) {
      const s = score(item, words)
      if (s < 0) continue
      const list = byGroup.get(item.group) ?? []
      list.push({ item, s })
      byGroup.set(item.group, list)
    }
    return [...byGroup.entries()].map(([group, list]) => {
      const sorted = list.sort((a, b) => a.s - b.s || a.item.label.localeCompare(b.item.label))
      const limit = limits?.[group] ?? 6
      return { group, total: sorted.length, results: sorted.slice(0, limit).map((x) => x.item) }
    })
  }, [items, query, limits])

  const flat = useMemo(() => sections.flatMap((s) => s.results), [sections])

  function update(q: string) {
    setQuery(q)
    setActive(0)
    onQueryChange?.(q)
  }

  function pick(item: GlobalSearchItem) {
    item.onSelect()
    update('')
    onPicked?.()
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!flat.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % flat.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + flat.length) % flat.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flat[active]
      if (item) pick(item)
    }
  }

  let index = -1
  return (
    <div className={`ui-gsearch${className ? ` ${className}` : ''}`}>
      <SearchBar
        ref={inputRef}
        value={query}
        onValueChange={update}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        shortcut={shortcut}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={Boolean(query.trim())}
        aria-controls="ui-gsearch-results"
        aria-activedescendant={flat[active] ? `ui-gsearch-${flat[active].id}` : undefined}
      />

      {query.trim() ? (
        <div className="ui-gsearch-results" id="ui-gsearch-results" role="listbox">
          {flat.length === 0 ? (
            <p className="ui-gsearch-empty">
              No results for “<b>{query.trim()}</b>”
            </p>
          ) : (
            sections.map((section) => (
              <div key={section.group} className="ui-gsearch-section" role="group" aria-label={section.group}>
                <p className="ui-gsearch-heading">
                  {section.group}
                  <span>{section.total}</span>
                </p>
                {section.results.map((item) => {
                  index += 1
                  const i = index
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      id={`ui-gsearch-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      className={`ui-gsearch-item${i === active ? ' is-active' : ''}`}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(item)}
                    >
                      {Icon ? (
                        <span className="ui-gsearch-ic">
                          <Icon size={16} strokeWidth={2} />
                        </span>
                      ) : null}
                      <span className="ui-gsearch-text">
                        <span className="ui-gsearch-label">{item.label}</span>
                        {item.hint ? <span className="ui-gsearch-hint">{item.hint}</span> : null}
                      </span>
                    </button>
                  )
                })}
                {section.total > section.results.length ? (
                  <p className="ui-gsearch-more">+{section.total - section.results.length} more — keep typing</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

export default GlobalSearch
