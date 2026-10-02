/**
 * Keeps a freshly added table row in view for every modal in the app.
 *
 * When an "Add" appends one row to a table inside a dialog/overlay, the row
 * usually lands below the visible part of the scroll box. This watches the
 * DOM and scrolls the table's nearest scroll container so the new row shows.
 *
 * Only a single appended row triggers it — a search/report filling the table
 * with many rows at once is left at the top.
 */

const MODAL_SELECTOR = '[role="dialog"], [class*="overlay"]'

function scrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement
  while (node && node !== document.body) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node
    }
    node = node.parentElement
  }
  return null
}

export function installAutoScrollNewRows(): () => void {
  const observer = new MutationObserver((records) => {
    const added = new Map<Element, HTMLTableRowElement[]>()
    for (const r of records) {
      if (!(r.target instanceof HTMLTableSectionElement) || r.target.tagName !== 'TBODY') continue
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLTableRowElement) {
          const list = added.get(r.target as Element) ?? []
          list.push(n)
          added.set(r.target as Element, list)
        }
      })
    }

    added.forEach((rows, tbody) => {
      if (rows.length !== 1 || !tbody.closest(MODAL_SELECTOR)) return
      const row = rows[0]
      // Only react to appended rows, not a re-render at the top of the list.
      if (row !== tbody.lastElementChild) return
      const box = scrollParent(row)
      if (!box) return
      requestAnimationFrame(() => {
        box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' })
      })
    })
  })

  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
