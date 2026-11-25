import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatRange } from '../utils/periodYears.js'
import { buildPeriodTree } from '../utils/periodTree.js'

// مایند مپ دوره‌ها، به سبک NotebookLM: ریشه ← قرن ← دهه ← سال/رویداد.
// کلیک روی گره‌ی شاخه‌دار بازش می‌کنه یا می‌بنده؛ کلیک روی برگ، فیلم‌هاش رو.
// با چرخ ماوس زوم، با کشیدن جابه‌جا. وضعیت باز/بسته و زوم تو والد نگه داشته
// می‌شه تا بعد از برگشت از فهرست فیلم‌ها، نقشه همون‌جا بمونه.

const ROW = 40 // فاصله‌ی عمودی برگ‌ها
const COL_GAP = 64 // فاصله‌ی افقی ستون‌ها
const NODE_H = 30
const FONT = '600 13px system-ui, -apple-system, "Segoe UI", sans-serif'

let measureCtx = null
function textWidth(text) {
  if (typeof document === 'undefined') return text.length * 7.5
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')
  measureCtx.font = FONT
  return measureCtx.measureText(text).width
}

// چیدمان افقی: هر برگ قابل‌دیدن یه ردیف؛ گره‌ی پدر وسط بچه‌هاش.
function layout(root, expanded) {
  const nodes = []
  const links = []
  const colWidth = []
  let row = 0
  const visit = (n, depth, parent) => {
    // عرض = برچسب + فاصله + عدد + (فلش اگه بچه داره)؛ عدد جدا اندازه گرفته می‌شه
    // تا روی برچسب نیفته
    const labelW = Math.ceil(textWidth(n.label))
    const countW = Math.ceil(textWidth(String(n.films.length)))
    const w = 14 + labelW + 10 + countW + (n.children ? 36 : 14)
    colWidth[depth] = Math.max(colWidth[depth] || 0, w)
    const item = { node: n, depth, w, labelW, parent }
    nodes.push(item)
    const open = n.children && expanded.has(n.id)
    if (open) {
      const kids = n.children.map((c) => visit(c, depth + 1, item))
      item.y = (kids[0].y + kids[kids.length - 1].y) / 2
      for (const k of kids) links.push({ from: item, to: k })
    } else {
      item.y = row++ * ROW
    }
    return item
  }
  visit(root, 0, null)
  const colX = [0]
  for (let d = 1; d < colWidth.length; d++) colX[d] = colX[d - 1] + colWidth[d - 1] + COL_GAP
  for (const n of nodes) n.x = colX[n.depth]
  const height = Math.max(row - 1, 0) * ROW
  return { nodes, links, width: colX[colX.length - 1] + colWidth[colWidth.length - 1], height }
}

export default function PeriodMindMap({ periods, onPick, state, setState }) {
  const tree = useMemo(() => buildPeriodTree(periods), [periods])
  const expanded = state.expanded
  const view = state.view
  const { nodes, links, width, height } = useMemo(() => layout(tree, expanded), [tree, expanded])
  const wrapRef = useRef(null)
  const drag = useRef(null)
  const anchor = useRef(null) // گره‌ای که روش کلیک شد؛ بعد از چیدمان دوباره سر جاش بمونه
  const [animate, setAnimate] = useState(false)

  const fit = () => {
    const el = wrapRef.current
    if (!el) return
    const pad = 40
    const k = Math.min(1.4, (el.clientWidth - pad * 2) / Math.max(width, 1), (el.clientHeight - pad * 2) / Math.max(height + NODE_H, 1))
    setState((s) => ({ ...s, view: { k, x: pad, y: (el.clientHeight - height * k) / 2 } }))
  }

  // بار اول: کل نقشه تو قاب
  useEffect(() => {
    if (!view) fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // بعد از باز/بسته کردن، گره‌ی کلیک‌شده همون‌جای صفحه بمونه (نقشه نپره)
  useLayoutEffect(() => {
    const a = anchor.current
    if (!a || !view) return
    anchor.current = null
    const now = nodes.find((n) => n.node.id === a.id)
    if (!now) return
    const dy = (a.y - now.y) * view.k
    const dx = (a.x - now.x) * view.k
    if (dx || dy) setState((s) => ({ ...s, view: { ...s.view, x: s.view.x + dx, y: s.view.y + dy } }))
  }, [nodes]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (item) => {
    if (!item.node.children) {
      onPick({ label: item.node.fullLabel || item.node.label, films: item.node.films })
      return
    }
    anchor.current = { id: item.node.id, x: item.x, y: item.y }
    setAnimate(true)
    setState((s) => {
      const next = new Set(s.expanded)
      if (next.has(item.node.id)) {
        // بستن یه گره، زیرشاخه‌هاش رو هم می‌بنده
        const close = (n) => {
          next.delete(n.id)
          n.children?.forEach(close)
        }
        close(item.node)
      } else next.add(item.node.id)
      return { ...s, expanded: next }
    })
  }

  const zoomAt = (factor, cx, cy) => {
    setAnimate(false)
    setState((s) => {
      const v = s.view
      const k = Math.min(3, Math.max(0.2, v.k * factor))
      const r = k / v.k
      return { ...s, view: { k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r } }
    })
  }

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    // wheel باید passive:false باشه تا اسکرول صفحه رو نگه داره
    const onWheel = (e) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  const onPointerDown = (e) => {
    if (e.target.closest('.mm-node')) return
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
    e.currentTarget.setPointerCapture(e.pointerId)
    setAnimate(false)
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    setState((s) => ({ ...s, view: { ...s.view, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y } }))
  }
  const onPointerUp = () => {
    drag.current = null
  }

  const center = (factor) => {
    const el = wrapRef.current
    if (el) zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2)
  }
  const expandAll = () => {
    const all = new Set()
    const walk = (n) => {
      if (n.children) {
        all.add(n.id)
        n.children.forEach(walk)
      }
    }
    walk(tree)
    setAnimate(false)
    setState((s) => ({ ...s, expanded: all }))
    setTimeout(fit, 0)
  }
  const collapseAll = () => {
    setAnimate(false)
    setState((s) => ({ ...s, expanded: new Set(['root']) }))
    setTimeout(fit, 0)
  }

  const v = view || { k: 1, x: 0, y: 0 }
  return (
    <div className="mm-wrap" ref={wrapRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div className="mm-toolbar" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => center(1.2)} title="Zoom in">+</button>
        <button type="button" onClick={() => center(1 / 1.2)} title="Zoom out">−</button>
        <button type="button" onClick={fit} title="Fit to screen">⤢</button>
        <button type="button" onClick={expandAll} title="Expand all">Expand all</button>
        <button type="button" onClick={collapseAll} title="Collapse all">Collapse</button>
      </div>
      <svg className="mm-svg">
        <g style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.k})`, transition: animate ? 'transform 0.35s ease' : 'none' }}>
          {links.map(({ from, to }) => {
            const x1 = from.x + from.w
            const y1 = from.y
            const x2 = to.x
            const y2 = to.y
            const mx = (x1 + x2) / 2
            return <path key={`${from.node.id}>${to.node.id}`} className="mm-link" d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} />
          })}
          {nodes.map((item) => {
            const { node, depth, w, labelW, x, y } = item
            const hasKids = Boolean(node.children)
            const open = hasKids && expanded.has(node.id)
            const range = node.range && node.label !== 'Whole decade' ? formatRange(node.range) : null
            return (
              <g
                key={node.id}
                className={`mm-node depth-${Math.min(depth, 3)}${hasKids ? '' : ' leaf'}`}
                style={{ transform: `translate(${x}px, ${y - NODE_H / 2}px)`, transition: animate ? 'transform 0.35s ease' : 'none' }}
                onClick={() => toggle(item)}
              >
                <title>{`${node.fullLabel || node.label}${range ? ` (${range})` : ''} — ${node.films.length} film${node.films.length === 1 ? '' : 's'}`}</title>
                <rect width={w} height={NODE_H} rx={NODE_H / 2} />
                <text x={14} y={NODE_H / 2 + 4.5}>{node.label}</text>
                <text className="mm-count" x={14 + labelW + 10} y={NODE_H / 2 + 4.5}>
                  {node.films.length}
                </text>
                {hasKids && (
                  <g className="mm-chevron" transform={`translate(${w - 15}, ${NODE_H / 2})`}>
                    <circle r={9} />
                    <path d={open ? 'M2,-4 L-2,0 L2,4' : 'M-2,-4 L2,0 L-2,4'} />
                  </g>
                )}
              </g>
            )
          })}
        </g>
      </svg>
      <div className="mm-hint">Scroll to zoom · drag to move · click a period to see its films</div>
    </div>
  )
}
