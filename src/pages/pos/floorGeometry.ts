export type PctPoint = { x: number; y: number }

/** TableFloorDesignerFrm.IsPointInsideBorder */
export function isPointInsideBorder(p: PctPoint, points: PctPoint[]): boolean {
  if (!points || points.length < 3) return true
  let inside = false
  let j = points.length - 1
  for (let i = 0; i < points.length; i += 1) {
    const pi = points[i]
    const pj = points[j]
    const intersects =
      pi.y > p.y !== pj.y > p.y &&
      p.x < ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y + 0.00001) + pi.x
    if (intersects) inside = !inside
    j = i
  }
  return inside
}

export function distPx(
  a: PctPoint,
  b: PctPoint,
  canvasW: number,
  canvasH: number,
): number {
  const dx = ((a.x - b.x) / 100) * canvasW
  const dy = ((a.y - b.y) / 100) * canvasH
  return Math.sqrt(dx * dx + dy * dy)
}

export function argbToCss(n: number | null | undefined, fallback: string): string {
  if (n == null || !Number.isFinite(Number(n))) return fallback
  const v = Number(n) >>> 0
  const a = (v >>> 24) & 255
  const r = (v >>> 16) & 255
  const g = (v >>> 8) & 255
  const b = v & 255
  if (a === 0) return fallback
  return `rgba(${r}, ${g}, ${b}, ${a / 255})`
}

export function cssToArgb(css: string): number {
  const hex = String(css || '').trim()
  const m = hex.match(/^#([0-9a-f]{6})$/i)
  let r = 211
  let g = 211
  let b = 211
  if (m) {
    r = parseInt(m[1].slice(0, 2), 16)
    g = parseInt(m[1].slice(2, 4), 16)
    b = parseInt(m[1].slice(4, 6), 16)
  }
  return ((255 << 24) | (r << 16) | (g << 8) | b) | 0
}

export function clampPct(n: number, min = 0, max = 100): number {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}

export type BorderTool = 'polygon' | 'square' | 'rectangle' | 'round' | 'oval'
export type BorderBox = { left: number; top: number; right: number; bottom: number }

/** Paint-style drag box. Square/Round stay equal in screen pixels. */
export function dragBox(
  start: PctPoint,
  end: PctPoint,
  equalPx: boolean,
  canvasW: number,
  canvasH: number,
): BorderBox {
  let x2 = end.x
  let y2 = end.y
  if (equalPx && canvasW > 0 && canvasH > 0) {
    const dxPx = ((end.x - start.x) / 100) * canvasW
    const dyPx = ((end.y - start.y) / 100) * canvasH
    const sx = dxPx === 0 ? 1 : Math.sign(dxPx)
    const sy = dyPx === 0 ? 1 : Math.sign(dyPx)
    let side = Math.max(Math.abs(dxPx), Math.abs(dyPx), 12)
    const maxW = sx > 0 ? ((100 - start.x) / 100) * canvasW : (start.x / 100) * canvasW
    const maxH = sy > 0 ? ((100 - start.y) / 100) * canvasH : (start.y / 100) * canvasH
    side = Math.min(side, Math.max(8, maxW), Math.max(8, maxH))
    x2 = start.x + sx * (side / canvasW) * 100
    y2 = start.y + sy * (side / canvasH) * 100
  }
  return {
    left: clampPct(Math.min(start.x, x2)),
    top: clampPct(Math.min(start.y, y2)),
    right: clampPct(Math.max(start.x, x2)),
    bottom: clampPct(Math.max(start.y, y2)),
  }
}

export function rectBorderPoints(box: BorderBox): PctPoint[] {
  return [
    { x: box.left, y: box.top },
    { x: box.right, y: box.top },
    { x: box.right, y: box.bottom },
    { x: box.left, y: box.bottom },
  ]
}

export function ellipseBorderPoints(box: BorderBox, steps = 48): PctPoint[] {
  const cx = (box.left + box.right) / 2
  const cy = (box.top + box.bottom) / 2
  const rx = Math.max((box.right - box.left) / 2, 0.4)
  const ry = Math.max((box.bottom - box.top) / 2, 0.4)
  const pts: PctPoint[] = []
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * Math.PI * 2
    pts.push({
      x: clampPct(cx + rx * Math.cos(a)),
      y: clampPct(cy + ry * Math.sin(a)),
    })
  }
  return pts
}

export function paintBorderPoints(
  tool: 'square' | 'rectangle' | 'round' | 'oval',
  start: PctPoint,
  end: PctPoint,
  canvasW: number,
  canvasH: number,
): PctPoint[] {
  const box = minBox(
    dragBox(start, end, tool === 'square' || tool === 'round', canvasW, canvasH),
    16,
    16,
  )
  return pointsFromBox(tool, box)
}

export function pointsFromBox(
  kind: 'square' | 'rectangle' | 'round' | 'oval' | 'polygon',
  box: BorderBox,
): PctPoint[] {
  if (kind === 'round' || kind === 'oval') return ellipseBorderPoints(box, 56)
  return rectBorderPoints(box)
}

export function boundsOfPoints(pts: PctPoint[]): BorderBox | null {
  if (!pts.length) return null
  return {
    left: Math.min(...pts.map((p) => p.x)),
    top: Math.min(...pts.map((p) => p.y)),
    right: Math.max(...pts.map((p) => p.x)),
    bottom: Math.max(...pts.map((p) => p.y)),
  }
}

export function minBox(box: BorderBox, minW = 12, minH = 12): BorderBox {
  let { left, top, right, bottom } = box
  if (right - left < minW) {
    const cx = (left + right) / 2
    left = clampPct(cx - minW / 2)
    right = clampPct(left + minW)
    if (right - left < minW) left = clampPct(right - minW)
  }
  if (bottom - top < minH) {
    const cy = (top + bottom) / 2
    top = clampPct(cy - minH / 2)
    bottom = clampPct(top + minH)
    if (bottom - top < minH) top = clampPct(bottom - minH)
  }
  return { left, top, right, bottom }
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export function resizeBox(
  box: BorderBox,
  handle: ResizeHandle,
  pt: PctPoint,
  minW = 8,
  minH = 8,
  keepEqual = false,
): BorderBox {
  let { left, top, right, bottom } = box
  if (handle.includes('w')) left = Math.min(pt.x, right - minW)
  if (handle.includes('e')) right = Math.max(pt.x, left + minW)
  if (handle.includes('n')) top = Math.min(pt.y, bottom - minH)
  if (handle.includes('s')) bottom = Math.max(pt.y, top + minH)
  if (keepEqual) {
    const size = Math.max(right - left, bottom - top, minW)
    if (handle.includes('w')) left = right - size
    else right = left + size
    if (handle.includes('n')) top = bottom - size
    else bottom = top + size
  }
  return minBox(
    {
      left: clampPct(left),
      top: clampPct(top),
      right: clampPct(right),
      bottom: clampPct(bottom),
    },
    minW,
    minH,
  )
}

export function moveBox(box: BorderBox, left: number, top: number): BorderBox {
  const w = box.right - box.left
  const h = box.bottom - box.top
  const x = clampPct(left, 0, 100 - w)
  const y = clampPct(top, 0, 100 - h)
  return { left: x, top: y, right: x + w, bottom: y + h }
}

export const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export function scalePoints(pts: PctPoint[], from: BorderBox, to: BorderBox): PctPoint[] {
  const ow = from.right - from.left || 1
  const oh = from.bottom - from.top || 1
  const nw = to.right - to.left
  const nh = to.bottom - to.top
  return pts.map((p) => ({
    x: clampPct(to.left + ((p.x - from.left) / ow) * nw),
    y: clampPct(to.top + ((p.y - from.top) / oh) * nh),
  }))
}
