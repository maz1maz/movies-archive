import { useMemo } from 'react'
import { formatRange } from '../utils/periodYears.js'
import { buildPeriodTree } from '../utils/periodTree.js'

// نمای کرکره‌ای (آکاردئون) دوره‌ها: قرن‌ها از قدیم به جدید، هرکدوم با کلیک باز می‌شه؛
// زیرش «Decades» و «Eras & events». ردیف آخر (بدون زیرشاخه) فیلم‌هاش رو نشون می‌ده.
// طول نوار = تعداد فیلم نسبت به بزرگ‌ترینِ هم‌سطح‌هاش. وضعیت باز/بسته تو والد
// نگه داشته می‌شه تا بعد از برگشت از فهرست فیلم‌ها همون‌طور بمونه.

function Row({ node, depth, max, open, onToggle, onPick }) {
  const hasKids = Boolean(node.children)
  const isOpen = hasKids && open.has(node.id)
  const range = node.range && node.label !== 'Whole decade' ? formatRange(node.range) : null
  const label = node.fullLabel && node.label !== 'Whole decade' ? node.fullLabel : node.label
  const childMax = hasKids ? Math.max(1, ...node.children.map((c) => c.films.length)) : 1
  return (
    <>
      <button
        type="button"
        className={`pa-row depth-${Math.min(depth, 3)}${hasKids ? ' branch' : ' leaf'}${isOpen ? ' open' : ''}`}
        style={{ paddingLeft: 12 + depth * 22 }}
        onClick={() => (hasKids ? onToggle(node.id) : onPick({ label, films: node.films }))}
        aria-expanded={hasKids ? isOpen : undefined}
      >
        <span className="pa-chevron">{hasKids ? (isOpen ? '▾' : '▸') : '•'}</span>
        <span className="pa-label">{label}</span>
        <span className="pa-range">{range || ""}</span>
        <span className="pa-bar-track">
          <span className="pa-bar" style={{ width: `${Math.max(2, (node.films.length / max) * 100)}%` }} />
        </span>
        <span className="pa-count">{node.films.length}</span>
      </button>
      {isOpen &&
        node.children.map((c) => (
          <Row key={c.id} node={c} depth={depth + 1} max={childMax} open={open} onToggle={onToggle} onPick={onPick} />
        ))}
    </>
  )
}

export default function PeriodAccordion({ periods, onPick, open, setOpen }) {
  const tree = useMemo(() => buildPeriodTree(periods), [periods])
  const max = Math.max(1, ...tree.children.map((c) => c.films.length))
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allBranchIds = useMemo(() => {
    const ids = []
    const walk = (n) => {
      if (!n.children) return
      if (n.id !== 'root') ids.push(n.id)
      n.children.forEach(walk)
    }
    walk(tree)
    return ids
  }, [tree])

  return (
    <div className="pa-wrap">
      <div className="pa-toolbar">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(new Set(allBranchIds))}>Expand all</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(new Set())}>Collapse all</button>
      </div>
      {tree.children.map((c) => (
        <Row key={c.id} node={c} depth={0} max={max} open={open} onToggle={toggle} onPick={onPick} />
      ))}
    </div>
  )
}
