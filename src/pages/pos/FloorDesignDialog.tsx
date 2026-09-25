/**
 * TableFloorDesignerFrm — same load / border / drag / save rules, modern canvas UI.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Circle,
  Eraser,
  Minus,
  Pentagon,
  Plus,
  RectangleHorizontal,
  RefreshCw,
  Save,
  Square,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import FloorTableMark from './FloorTableMark'
import {
  argbToCss,
  boundsOfPoints,
  clampPct,
  cssToArgb,
  distPx,
  dragBox,
  isPointInsideBorder,
  minBox,
  moveBox,
  pointsFromBox,
  resizeBox,
  scalePoints,
  RESIZE_HANDLES,
  type BorderBox,
  type BorderTool,
  type PctPoint,
  type ResizeHandle,
} from './floorGeometry'

type AreaOpt = { areaId: number; areaName: string; tableCreationType: number }
type ShapeItem = {
  id: string
  shapeType: string
  x: number
  y: number
  w: number
  h: number
  text: string
  color: string
  argb: number
}
type TableItem = {
  tableId: number
  tableName: string
  noOfChairs: number
  tableFormat: string
  x: number
  y: number
  w: number
  h: number
}
type DragState =
  | { mode: 'move'; kind: 'table' | 'shape'; id: string | number; dx: number; dy: number }
  | { mode: 'resize'; kind: 'table' | 'shape'; id: string | number; ox: number; oy: number }
  | { mode: 'move'; kind: 'border'; dx: number; dy: number; w: number; h: number }
  | { mode: 'resize'; kind: 'border'; handle: ResizeHandle; start: BorderBox }
type PaintDraft = { tool: 'square' | 'rectangle' | 'round' | 'oval'; start: PctPoint; current: PctPoint }
type PromptState = { kind: 'label' | 'zone' | 'edit'; id?: string; value: string }

type Props = { onClose: () => void }

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function uid() {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function defaultColor(type: string) {
  const t = type.toUpperCase()
  if (t === 'LABEL') return '#FFFFE0'
  if (t === 'WALL') return '#808080'
  return '#B0C4DE'
}

export default function FloorDesignDialog({ onClose }: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [areas, setAreas] = useState<AreaOpt[]>([])
  const [areaId, setAreaId] = useState(0)
  const [loadedAreaId, setLoadedAreaId] = useState(0)
  const [border, setBorder] = useState<PctPoint[]>([])
  const [borderClosed, setBorderClosed] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [shapes, setShapes] = useState<ShapeItem[]>([])
  const [tables, setTables] = useState<TableItem[]>([])
  const [selected, setSelected] = useState<{ kind: 'table' | 'shape' | 'border'; id: string | number } | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [prompt, setPrompt] = useState<PromptState | null>(null)
  const [hint, setHint] = useState('Select Area, then Load.')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [hover, setHover] = useState<PctPoint | null>(null)
  const [borderTool, setBorderTool] = useState<BorderTool>('polygon')
  const [borderBox, setBorderBox] = useState<BorderBox | null>(null)
  const [paintDraft, setPaintDraft] = useState<PaintDraft | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const tablesRef = useRef(tables)
  const shapesRef = useRef(shapes)
  const borderRef = useRef(border)
  const paintDraftRef = useRef<PaintDraft | null>(null)
  const borderBoxRef = useRef<BorderBox | null>(null)
  const borderToolRef = useRef<BorderTool>('polygon')
  dragRef.current = drag
  tablesRef.current = tables
  shapesRef.current = shapes
  borderRef.current = border
  paintDraftRef.current = paintDraft
  borderBoxRef.current = borderBox
  borderToolRef.current = borderTool

  const manualAreas = useMemo(
    () => areas.filter((a) => a.tableCreationType === 0).sort((a, b) => a.areaName.localeCompare(b.areaName)),
    [areas],
  )

  useEffect(() => {
    let alive = true
    apiService
      .fetchAreas()
      .then((rows) => {
        if (!alive) return
        const mapped = rows.map((r) => ({
          areaId: num(r.areaId ?? r.AreaID),
          areaName: String(r.areaName ?? r.AreaName ?? '').trim(),
          tableCreationType: num(r.tableCreationType ?? r.TableCreationType),
        })).filter((a) => a.areaId > 0)
        setAreas(mapped)
        const first = mapped.find((a) => a.tableCreationType === 0)
        if (first) setAreaId(first.areaId)
      })
      .catch((err) => {
        if (!alive) return
        setError(errMessage(err, 'Could not load areas'))
      })
    return () => {
      alive = false
    }
  }, [])

  const loadFloor = useCallback(async (id: number) => {
    if (id <= 0) {
      setHint('Select Area first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = await apiService.fetchFloorDesign(id)
      const pts = Array.isArray(data.border)
        ? data.border.map((p) => ({ x: num(p.posXPercent ?? p.x), y: num(p.posYPercent ?? p.y) }))
        : []
      setBorder(pts)
      setBorderClosed(pts.length >= 3 && data.borderClosed !== false)
      setBorderBox(pts.length >= 3 ? minBox(boundsOfPoints(pts) as BorderBox, 8, 8) : null)
      setDrawing(false)
      setPaintDraft(null)
      paintDraftRef.current = null
      setBorderTool(pts.length === 4 ? 'rectangle' : pts.length > 12 ? 'oval' : 'polygon')
      setShapes(
        (Array.isArray(data.shapes) ? data.shapes : []).map((s) => {
          const type = String(s.shapeType ?? 'ZONE').toUpperCase()
          const hex = defaultColor(type)
          const argb = s.backColorArgb == null || s.backColorArgb === '' ? cssToArgb(hex) : num(s.backColorArgb)
          return {
            id: uid(),
            shapeType: type,
            x: num(s.posXPercent),
            y: num(s.posYPercent),
            w: num(s.widthPercent) || 8,
            h: num(s.heightPercent) || 4,
            text: String(s.displayText ?? ''),
            color: argbToCss(argb, hex),
            argb,
          }
        }),
      )
      setTables(
        (Array.isArray(data.tables) ? data.tables : []).map((t) => ({
          tableId: num(t.tableId),
          tableName: String(t.tableName ?? ''),
          noOfChairs: num(t.noOfChairs),
          tableFormat: String(t.tableFormat ?? 'SQUARE').toUpperCase(),
          x: num(t.posXPercent),
          y: num(t.posYPercent),
          w: Math.max(num(t.widthPercent) || 8, 8),
          h: Math.max(num(t.heightPercent) || 10, 10),
        })),
      )
      setSelected(null)
      setLoadedAreaId(id)
      setHint(
        pts.length >= 3
          ? 'Drag tables inside the floor. Save when the layout looks right.'
          : 'Start Border, click corners, then click the white start dot to close the loop.',
      )
    } catch (err) {
      setLoadedAreaId(0)
      setHint(id > 0 ? 'Click Load to open this area.' : 'Select Area first.')
      setError(errMessage(err, 'Could not load floor'))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (areaId > 0) void loadFloor(areaId)
  }, [areaId, loadFloor])

  function canvasSize() {
    const el = canvasRef.current
    if (!el) return { w: 0, h: 0 }
    return { w: el.clientWidth, h: el.clientHeight }
  }

  function eventPct(e: { clientX: number; clientY: number }): PctPoint | null {
    const el = canvasRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return null
    return {
      x: clampPct(((e.clientX - r.left) / r.width) * 100),
      y: clampPct(((e.clientY - r.top) / r.height) * 100),
    }
  }

  function beginBorder(tool: BorderTool) {
    if (loadedAreaId <= 0) {
      setHint(areaId > 0 ? 'Click Load first.' : 'Select Area first.')
      return
    }
    setBorderTool(tool)
    setDrawing(true)
    setBorder([])
    setBorderClosed(false)
    setBorderBox(null)
    borderBoxRef.current = null
    setHover(null)
    setPaintDraft(null)
    paintDraftRef.current = null
    setSelected(null)
    if (tool === 'polygon') {
      setHint('Freeform: click corners, then click the white start dot to close. Right-click undoes.')
    } else if (tool === 'square') {
      setHint('Square: click and drag on the canvas like Paint, then release.')
    } else if (tool === 'rectangle') {
      setHint('Rectangle: click and drag a box like Paint, then release.')
    } else if (tool === 'round') {
      setHint('Round: click and drag to draw a circle, then release.')
    } else {
      setHint('Oval: click and drag to draw an ellipse, then release.')
    }
  }

  function clearBorder() {
    setBorder([])
    setBorderClosed(false)
    setDrawing(false)
    setPaintDraft(null)
    paintDraftRef.current = null
    setBorderBox(null)
    borderBoxRef.current = null
    setSelected(null)
    setHint('Border cleared. Pick Square / Rectangle / Oval / Round or Freeform.')
  }

  function finishBorder() {
    setDrawing(false)
    setPaintDraft(null)
    paintDraftRef.current = null
    if (borderClosed && border.length >= 3 && !borderBox) {
      const box = boundsOfPoints(border)
      if (box) {
        const next = minBox(box, 8, 8)
        setBorderBox(next)
        borderBoxRef.current = next
        setSelected({ kind: 'border', id: 0 })
      }
    }
    setHint(borderClosed ? 'Border closed. Drag to move or resize, then Save.' : 'Drawing paused. Close the loop before saving.')
  }

  function undoLastPoint() {
    if (borderClosed) {
      setBorderClosed(false)
      setDrawing(true)
      return
    }
    setBorder((prev) => prev.slice(0, -1))
  }

  function onCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button === 2) {
      e.preventDefault()
      if (borderTool === 'polygon') undoLastPoint()
      return
    }
    if (!drawing || borderClosed) {
      if (e.target === e.currentTarget) setSelected(null)
      return
    }
    if (borderTool !== 'polygon') return
    const pt = eventPct(e)
    if (!pt) return
    const { w, h } = canvasSize()
    if (border.length >= 3 && distPx(pt, border[0], w, h) <= 10) {
      setBorderClosed(true)
      setDrawing(false)
      const box = boundsOfPoints(border)
      if (box) {
        const next = minBox(box, 8, 8)
        setBorderBox(next)
        borderBoxRef.current = next
      }
      setSelected({ kind: 'border', id: 0 })
      setHint('Border selected. Drag to move, use blue handles to resize.')
      return
    }
    setBorder((prev) => [...prev, pt])
  }

  function onPaintPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!drawing || borderTool === 'polygon' || e.button !== 0) return
    const pt = eventPct(e)
    if (!pt) return
    e.preventDefault()
    const draft: PaintDraft = {
      tool: borderTool as PaintDraft['tool'],
      start: pt,
      current: pt,
    }
    paintDraftRef.current = draft
    setPaintDraft(draft)
    setBorder([])
    setBorderClosed(false)
  }

  function addShape(type: 'LABEL' | 'ZONE' | 'WALL', text: string) {
    if (loadedAreaId <= 0) {
      setHint(areaId > 0 ? 'Click Load first.' : 'Select Area first.')
      return
    }
    const { w: cw, h: ch } = canvasSize()
    const px = type === 'WALL' ? { w: 180, h: 24 } : type === 'ZONE' ? { w: 140, h: 80 } : { w: 100, h: 30 }
    const color = defaultColor(type)
    const next: ShapeItem = {
      id: uid(),
      shapeType: type,
      x: cw > 0 ? (20 / cw) * 100 : 2,
      y: ch > 0 ? (20 / ch) * 100 : 2,
      w: cw > 0 ? (px.w / cw) * 100 : 10,
      h: ch > 0 ? (px.h / ch) * 100 : 5,
      text,
      color,
      argb: cssToArgb(color),
    }
    setShapes((prev) => [...prev, next])
    setSelected({ kind: 'shape', id: next.id })
  }

  function confirmPrompt() {
    if (!prompt) return
    const text = prompt.value.trim()
    if (prompt.kind === 'edit' && prompt.id) {
      setShapes((prev) => prev.map((s) => (s.id === prompt.id ? { ...s, text } : s)))
      setPrompt(null)
      return
    }
    if (prompt.kind === 'label') {
      if (!text) {
        setPrompt(null)
        return
      }
      addShape('LABEL', text)
      setPrompt(null)
      return
    }
    addShape('ZONE', text || 'Zone')
    setPrompt(null)
  }

  function moveItem(kind: 'table' | 'shape', id: string | number, x: number, y: number, w: number, h: number) {
    const nx = clampPct(x, 0, 100 - w)
    const ny = clampPct(y, 0, 100 - h)
    if (kind === 'table' && borderRef.current.length >= 3) {
      const center = { x: nx + w / 2, y: ny + h / 2 }
      if (!isPointInsideBorder(center, borderRef.current)) return
    }
    if (kind === 'table') {
      setTables((prev) => prev.map((t) => (t.tableId === id ? { ...t, x: nx, y: ny } : t)))
    } else {
      setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, x: nx, y: ny } : s)))
    }
  }

  useEffect(() => {
    function applyBorder(nextBox: BorderBox, from: BorderBox | null, kind: BorderTool) {
      const box = minBox(nextBox, 8, 8)
      let pts
      if (kind === 'square' || kind === 'rectangle' || kind === 'round' || kind === 'oval') {
        pts = pointsFromBox(kind, box)
      } else if (from) {
        pts = scalePoints(borderRef.current, from, box)
      } else {
        pts = pointsFromBox('square', box)
      }
      borderRef.current = pts
      borderBoxRef.current = box
      setBorder(pts)
      setBorderBox(box)
      setBorderClosed(true)
    }

    function move(e: PointerEvent) {
      const draft = paintDraftRef.current
      if (draft) {
        const pt = eventPct(e)
        if (!pt) return
        const next = { ...draft, current: pt }
        paintDraftRef.current = next
        setPaintDraft(next)
        return
      }
      const current = dragRef.current
      if (!current) return
      const pt = eventPct(e)
      if (!pt) return
      if (current.kind === 'border' && current.mode === 'move') {
        applyBorder(
          moveBox(
            { left: 0, top: 0, right: current.w, bottom: current.h },
            pt.x - current.dx,
            pt.y - current.dy,
          ),
          borderBoxRef.current,
          borderToolRef.current,
        )
        return
      }
      if (current.kind === 'border' && current.mode === 'resize') {
        applyBorder(
          resizeBox(
            current.start,
            current.handle,
            pt,
            8,
            8,
            borderToolRef.current === 'square' || borderToolRef.current === 'round',
          ),
          current.start,
          borderToolRef.current,
        )
        return
      }
      if (current.mode === 'move' && (current.kind === 'table' || current.kind === 'shape')) {
        const item =
          current.kind === 'table'
            ? tablesRef.current.find((t) => t.tableId === current.id)
            : shapesRef.current.find((s) => s.id === current.id)
        if (!item) return
        moveItem(current.kind, current.id, pt.x - current.dx, pt.y - current.dy, item.w, item.h)
        return
      }
      if (current.mode === 'resize' && (current.kind === 'table' || current.kind === 'shape')) {
        const nw = clampPct(pt.x - current.ox, current.kind === 'table' ? 8 : 4, 40)
        const nh = clampPct(pt.y - current.oy, current.kind === 'table' ? 10 : 4, 40)
        if (current.kind === 'table') {
          setTables((prev) => prev.map((t) => (t.tableId === current.id ? { ...t, w: nw, h: nh } : t)))
        } else {
          setShapes((prev) => prev.map((s) => (s.id === current.id ? { ...s, w: nw, h: nh } : s)))
        }
      }
    }
    function up() {
      const draft = paintDraftRef.current
      if (draft) {
        const el = canvasRef.current
        const cw = el?.clientWidth || 0
        const ch = el?.clientHeight || 0
        const bigEnough =
          Math.abs(draft.current.x - draft.start.x) > 0.8 || Math.abs(draft.current.y - draft.start.y) > 0.8
        if (bigEnough) {
          const box = minBox(
            dragBox(
              draft.start,
              draft.current,
              draft.tool === 'square' || draft.tool === 'round',
              cw,
              ch,
            ),
            16,
            16,
          )
          const pts = pointsFromBox(draft.tool, box)
          borderRef.current = pts
          borderBoxRef.current = box
          setBorder(pts)
          setBorderBox(box)
          setBorderClosed(true)
          setDrawing(false)
          setSelected({ kind: 'border', id: 0 })
          setHint('Border selected. Drag to move, use blue handles to resize, then place tables inside.')
        }
        paintDraftRef.current = null
        setPaintDraft(null)
      }
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  function startMove(
    e: React.PointerEvent,
    kind: 'table' | 'shape',
    id: string | number,
    item: { x: number; y: number },
  ) {
    if (drawing && !borderClosed) return
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    setSelected({ kind, id })
    const pt = eventPct(e)
    if (!pt) return
    setDrag({ mode: 'move', kind, id, dx: pt.x - item.x, dy: pt.y - item.y })
  }

  function startResize(
    e: React.PointerEvent,
    kind: 'table' | 'shape',
    id: string | number,
    item: { x: number; y: number },
  ) {
    if (drawing && !borderClosed) return
    e.preventDefault()
    e.stopPropagation()
    setSelected({ kind, id })
    setDrag({ mode: 'resize', kind, id, ox: item.x, oy: item.y })
  }

  function startBorderMove(e: React.PointerEvent) {
    if (drawing && !borderClosed) return
    if (e.button !== 0) return
    const box = borderBoxRef.current
    if (!box) return
    e.preventDefault()
    e.stopPropagation()
    const pt = eventPct(e)
    if (!pt) return
    setSelected({ kind: 'border', id: 0 })
    setDrag({
      mode: 'move',
      kind: 'border',
      dx: pt.x - box.left,
      dy: pt.y - box.top,
      w: box.right - box.left,
      h: box.bottom - box.top,
    })
  }

  function startBorderResize(e: React.PointerEvent, handle: ResizeHandle) {
    if (drawing && !borderClosed) return
    const box = borderBoxRef.current
    if (!box) return
    e.preventDefault()
    e.stopPropagation()
    setSelected({ kind: 'border', id: 0 })
    setDrag({ mode: 'resize', kind: 'border', handle, start: box })
  }

  function deleteSelected() {
    if (!selected || selected.kind !== 'shape') return
    setShapes((prev) => prev.filter((s) => s.id !== selected.id))
    setSelected(null)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelected(null)
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      setSelected((cur) => {
        if (cur?.kind !== 'shape') return cur
        setShapes((prev) => prev.filter((s) => s.id !== cur.id))
        return null
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function onSave() {
    if (loadedAreaId <= 0) {
      setError('Select Area first.')
      return
    }
    if (border.length < 3 || !borderClosed) {
      setError('Please complete the floor border.\nClick again near the starting point to close the loop.')
      return
    }
    const outside = tables
      .filter((t) => !isPointInsideBorder({ x: t.x + t.w / 2, y: t.y + t.h / 2 }, border))
      .map((t) => t.tableName)
    if (outside.length) {
      setError(`These tables are outside the floor boundary:\n${outside.join(', ')}\nPlease move them inside the border before saving.`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiService.saveFloorDesign(loadedAreaId, {
        borderClosed: true,
        border: border.map((p) => ({ posXPercent: p.x, posYPercent: p.y })),
        shapes: shapes.map((s) => ({
          shapeType: s.shapeType,
          posXPercent: s.x,
          posYPercent: s.y,
          widthPercent: s.w,
          heightPercent: s.h,
          backColorArgb: s.argb,
          displayText: s.text,
        })),
        tables: tables.map((t) => ({
          tableId: t.tableId,
          posXPercent: t.x,
          posYPercent: t.y,
          widthPercent: t.w,
          heightPercent: t.h,
          rotationDeg: 0,
        })),
      })
      setHint('Floor border and tables saved successfully.')
    } catch (err) {
      setError(errMessage(err, 'Error saving layout'))
    } finally {
      setBusy(false)
    }
  }

  const { w: canvasW, h: canvasH } = canvasSize()
  const paintBox = paintDraft
    ? dragBox(
        paintDraft.start,
        paintDraft.current,
              paintDraft.tool === 'square' || paintDraft.tool === 'round',
        canvasW,
        canvasH,
      )
    : null
  const drawPts =
    drawing && !borderClosed && hover && border.length > 0 && borderTool === 'polygon'
      ? [...border, hover]
      : border
  const poly = drawPts.map((p) => `${p.x},${p.y}`).join(' ')
  const selectedShape = selected?.kind === 'shape' ? shapes.find((s) => s.id === selected.id) : null

  return (
    <div className="pd-mod-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="pd-fd-dialog" role="dialog" aria-modal="true">
        <header className="pd-fd-bar">
          <div className="pd-fd-bar-left">
            <div>
              <p className="pd-mod-kicker">Entry</p>
              <h2>Floor Design</h2>
            </div>
            <label className="pd-fd-area">
              Area
              <select
                value={areaId}
                onChange={(e) => setAreaId(Number(e.target.value))}
                disabled={busy}
              >
                {manualAreas.length === 0 ? <option value={0}>No manual areas</option> : null}
                {manualAreas.map((a) => (
                  <option key={a.areaId} value={a.areaId}>{a.areaName}</option>
                ))}
              </select>
            </label>
            <button type="button" className="pd-fd-tool" onClick={() => void loadFloor(areaId)} disabled={busy || areaId <= 0}>
              <RefreshCw size={14} /> Load
            </button>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close" disabled={busy}>
            <X size={13} />
          </button>
        </header>

        <div className="pd-fd-tools">
          <div className="pd-fd-group">
            <span>Border</span>
            <button
              type="button"
              className={`pd-fd-tool${drawing && borderTool === 'polygon' ? ' is-on' : ''}`}
              onClick={() => beginBorder('polygon')}
              disabled={busy}
              title="Freeform polygon"
            >
              <Pentagon size={14} /> Freeform
            </button>
            <button
              type="button"
              className={`pd-fd-tool${drawing && borderTool === 'square' ? ' is-on' : ''}`}
              onClick={() => beginBorder('square')}
              disabled={busy}
              title="Square border"
            >
              <Square size={14} /> Square
            </button>
            <button
              type="button"
              className={`pd-fd-tool${drawing && borderTool === 'rectangle' ? ' is-on' : ''}`}
              onClick={() => beginBorder('rectangle')}
              disabled={busy}
              title="Rectangle border"
            >
              <RectangleHorizontal size={14} /> Rectangle
            </button>
            <button
              type="button"
              className={`pd-fd-tool${drawing && borderTool === 'oval' ? ' is-on' : ''}`}
              onClick={() => beginBorder('oval')}
              disabled={busy}
              title="Oval border"
            >
              <span className="pd-fd-oval-ico" aria-hidden /> Oval
            </button>
            <button
              type="button"
              className={`pd-fd-tool${drawing && borderTool === 'round' ? ' is-on' : ''}`}
              onClick={() => beginBorder('round')}
              disabled={busy}
              title="Round border"
            >
              <Circle size={14} /> Round
            </button>
            <button type="button" className="pd-fd-tool" onClick={clearBorder} disabled={busy}>
              <Eraser size={14} /> Clear
            </button>
            <button type="button" className="pd-fd-tool" onClick={finishBorder} disabled={busy}>
              <Check size={14} /> Finish
            </button>
          </div>
          <div className="pd-fd-group">
            <span>Decor</span>
            <button type="button" className="pd-fd-tool" onClick={() => setPrompt({ kind: 'label', value: 'Entrance' })} disabled={busy}>
              <Tag size={14} /> Add Label
            </button>
            <button type="button" className="pd-fd-tool" onClick={() => setPrompt({ kind: 'zone', value: 'Zone' })} disabled={busy}>
              <Plus size={14} /> Add Zone
            </button>
            <button type="button" className="pd-fd-tool" onClick={() => addShape('WALL', '')} disabled={busy}>
              <Minus size={14} /> Add Wall/Block
            </button>
            {selectedShape ? (
              <button type="button" className="pd-fd-tool is-danger" onClick={deleteSelected}>
                <Trash2 size={14} /> Delete
              </button>
            ) : null}
          </div>
          <div className="pd-fd-group is-end">
            <button type="button" className="pd-fd-save" onClick={() => void onSave()} disabled={busy}>
              <Save size={15} /> {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="pd-fd-close" onClick={onClose} disabled={busy}>
              <X size={15} /> Close
            </button>
          </div>
        </div>

        <p className="pd-fd-hint">{hint}</p>
        {error ? <p className="pd-fd-err">{error}</p> : null}

        <div
          ref={canvasRef}
          className={`pd-fd-canvas${drawing ? ' is-draw' : ''}`}
          onClick={onCanvasClick}
          onPointerDown={onPaintPointerDown}
          onPointerMove={(e) => {
            if (!drawing || borderClosed || borderTool !== 'polygon') return
            const pt = eventPct(e)
            if (pt) setHover(pt)
          }}
          onPointerLeave={() => setHover(null)}
          onContextMenu={(e) => {
            e.preventDefault()
            if (borderTool === 'polygon') undoLastPoint()
          }}
        >
          <svg className="pd-fd-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {paintBox ? (
              paintDraft?.tool === 'square' || paintDraft?.tool === 'rectangle' ? (
                <rect
                  x={paintBox.left}
                  y={paintBox.top}
                  width={Math.max(paintBox.right - paintBox.left, 0.2)}
                  height={Math.max(paintBox.bottom - paintBox.top, 0.2)}
                  className="pd-fd-poly is-closed is-live"
                />
              ) : (
                <ellipse
                  cx={(paintBox.left + paintBox.right) / 2}
                  cy={(paintBox.top + paintBox.bottom) / 2}
                  rx={Math.max((paintBox.right - paintBox.left) / 2, 0.2)}
                  ry={Math.max((paintBox.bottom - paintBox.top) / 2, 0.2)}
                  className="pd-fd-poly is-closed is-live"
                />
              )
            ) : drawPts.length >= 2 ? (
              borderClosed && border.length >= 3 ? (
                <polygon points={poly} className="pd-fd-poly is-closed" />
              ) : (
                <polyline points={poly} className={`pd-fd-line${hover && drawing ? ' is-live' : ''}`} />
              )
            ) : null}
          </svg>
          {drawing && borderTool === 'polygon' && border[0] ? (
            <div
              className="pd-fd-start-dot"
              style={{ left: `${border[0].x}%`, top: `${border[0].y}%` }}
              onClick={(e) => {
                e.stopPropagation()
                if (border.length >= 3) {
                  setBorderClosed(true)
                  setDrawing(false)
                  const box = boundsOfPoints(border)
                  if (box) {
                    const next = minBox(box, 8, 8)
                    setBorderBox(next)
                    borderBoxRef.current = next
                  }
                  setSelected({ kind: 'border', id: 0 })
                  setHint('Border selected. Drag to move, use blue handles to resize.')
                }
              }}
            />
          ) : null}

          {borderClosed && borderBox && !paintDraft ? (
            <div
              className={`pd-fd-frame${selected?.kind === 'border' ? ' is-on' : ''}`}
              style={{
                left: `${borderBox.left}%`,
                top: `${borderBox.top}%`,
                width: `${Math.max(borderBox.right - borderBox.left, 1)}%`,
                height: `${Math.max(borderBox.bottom - borderBox.top, 1)}%`,
              }}
              onPointerDown={startBorderMove}
            >
              {selected?.kind === 'border'
                ? RESIZE_HANDLES.map((h) => (
                    <i
                      key={h}
                      className={`pd-fd-grip is-${h}`}
                      onPointerDown={(e) => startBorderResize(e, h)}
                    />
                  ))
                : null}
            </div>
          ) : null}

          {shapes.map((s) => {
            const on = selected?.kind === 'shape' && selected.id === s.id
            return (
              <div
                key={s.id}
                className={`pd-fd-shape is-${s.shapeType.toLowerCase()}${on ? ' is-on' : ''}`}
                style={{
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  width: `${s.w}%`,
                  height: `${s.h}%`,
                  background: s.color,
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => startMove(e, 'shape', s.id, s)}
                onDoubleClick={() => setPrompt({ kind: 'edit', id: s.id, value: s.text })}
              >
                {s.text ? <span>{s.text}</span> : null}
                {on ? (
                  <i
                    className="pd-fd-resize"
                    onPointerDown={(e) => startResize(e, 'shape', s.id, s)}
                  />
                ) : null}
              </div>
            )
          })}

          {tables.map((t) => {
            const on = selected?.kind === 'table' && selected.id === t.tableId
            return (
              <div
                key={t.tableId}
                className={`pd-fd-table${on ? ' is-on' : ''}`}
                style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.w}%`, height: `${t.h}%` }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => startMove(e, 'table', t.tableId, t)}
              >
                <FloorTableMark name={t.tableName} chairs={t.noOfChairs} format={t.tableFormat} compact />
                {on ? (
                  <i
                    className="pd-fd-resize"
                    onPointerDown={(e) => startResize(e, 'table', t.tableId, t)}
                  />
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="pd-fd-foot">
          <button type="button" className="pd-fd-save" onClick={() => void onSave()} disabled={busy}>
            <Save size={15} /> {busy ? 'Saving…' : 'Save'}
          </button>
        </div>

        {prompt ? (
          <div className="pd-fd-prompt-wrap" role="presentation" onClick={() => setPrompt(null)}>
            <div className="pd-fd-prompt" role="dialog" onClick={(e) => e.stopPropagation()}>
              <p>{prompt.kind === 'label' ? 'Enter label text :' : prompt.kind === 'zone' ? 'Enter zone text :' : 'Text'}</p>
              <input
                autoFocus
                value={prompt.value}
                onChange={(e) => setPrompt({ ...prompt, value: e.target.value.slice(0, 100) })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmPrompt()
                  if (e.key === 'Escape') setPrompt(null)
                }}
              />
              <div className="pd-fd-prompt-actions">
                <button type="button" onClick={() => setPrompt(null)}>Cancel</button>
                <button type="button" className="is-ok" onClick={confirmPrompt}>OK</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
