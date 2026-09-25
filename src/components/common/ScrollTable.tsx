/**
 * ScrollTable — a compact list table with a fixed height. Extra rows scroll
 * inside it (the header stays pinned), so the surrounding modal never grows.
 * Click a row to select it; the selected row is highlighted.
 */
import type { ReactNode } from 'react'
import './ScrollTable.css'

export type ScrollTableColumn<T> = {
  key: string
  header: ReactNode
  render: (row: T, index: number) => ReactNode
  align?: 'left' | 'right' | 'center'
  width?: number | string
}

type Props<T> = {
  columns: ScrollTableColumn<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string | number
  /** Fixed height of the whole table box (px or any CSS length). */
  height?: number | string
  emptyText?: ReactNode
  isSelected?: (row: T, index: number) => boolean
  onRowClick?: (row: T, index: number) => void
  className?: string
}

export function ScrollTable<T>({
  columns,
  rows,
  rowKey,
  height = 240,
  emptyText = 'Nothing added yet',
  isSelected,
  onRowClick,
  className,
}: Props<T>) {
  return (
    <div className={`ui-st${className ? ` ${className}` : ''}`} style={{ height }}>
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width, textAlign: c.align }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="ui-st-empty">
              <td colSpan={columns.length}>{emptyText}</td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                className={`${isSelected?.(row, i) ? 'is-selected' : ''}${onRowClick ? ' is-clickable' : ''}`}
                onClick={onRowClick ? () => onRowClick(row, i) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align }}>
                    {c.render(row, i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default ScrollTable
