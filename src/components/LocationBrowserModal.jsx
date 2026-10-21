import { useEffect, useMemo, useRef, useState } from 'react'
import { IconClose, IconPin, IconFilm, IconBookshelf, IconPrinter, IconDownload, IconArchive } from './icons.jsx'
import { getSpineColor, getEditionBadge, getStudioBadgeText } from '../utils/shelfDisplay.js'
import { proxyImg } from '../utils/proxyImg.js'
import { escapeHtml } from '../utils/escapeHtml.js'
import { useOverlayClose } from '../hooks/useOverlayClose.js'
import { useShelfZoom, useShelfTheme, MIN_SHELF_ZOOM, MAX_SHELF_ZOOM } from '../hooks/useShelfZoom.js'
import BookshelfView from './BookshelfView.jsx'
import { alphabetRange } from '../utils/shelfRange.js'

// زوم پایه: تو این زوم یه ردیف قفسه دقیقاً SLOTS_PER_ROW_AT_BASE جلد جا می‌گیره
const BASE_ZOOM = 0.8
const SLOTS_PER_ROW_AT_BASE = 65
const SPINE_GAP = 2

const CLOSET_COUNT = 8
const ROW_COUNT = 10
const PREVIEW_TITLES = 3

// هر ردیف دو بخش (shelf = بخش) داره:
//   بخش ۱: ظرفیت ۶۰ بلوری
//   بخش ۲: ظرفیت ۶۰ بلوری
// ظرفیت هر بخش از سرور (/api/settings/section-capacities) میاد؛ این فقط پیش‌فرضه
const DEFAULT_CAPACITY = 65 // پیش‌فرض و سقف هر بخش
const BASE_SECTIONS = [
  { num: '1', label: 'Section 1' },
  { num: '2', label: 'Section 2' },
  { num: '3', label: 'Section 3' },
]

function countCopies(list) {
  return list.reduce((sum, f) => sum + (Number(f.copies) || 1), 0)
}

function sortKey(title) {
  return String(title || '')
    .replace(/^the\s+/i, '')
    .toLowerCase()
}
// ترتیب طبیعی: «Film 2» قبل از «Film 10»
const compareTitles = (a, b) => sortKey(a.title).localeCompare(sortKey(b.title), undefined, { numeric: true })

const SPINE_NEAR_RADIUS = 9
const AZ_LETTERS = ['#', ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))]

function firstLetterOf(title) {
  const t = sortKey(title).trim()
  const ch = (t[0] || '').toUpperCase()
  return ch >= 'A' && ch <= 'Z' ? ch : '#'
}

export default function LocationBrowserModal({ films, onSelectFilm, onClose, canEdit = false, onFilmsChanged, initialView = 'section' }) {
  // دو نمای صفحه‌ی Shelves: «section» (یه بخش + پر/خالی/جابه‌جایی) و «wall» (همه‌ی بخش‌ها پشت سر هم)
  const [shelvesView, setShelvesView] = useState(initialView)
  const overlayHandlers = useOverlayClose(onClose)
  const [capacities, setCapacities] = useState({})
  const SECTIONS = useMemo(
    () => BASE_SECTIONS.map((sec) => ({ ...sec, capacity: Number(capacities[sec.num]) || DEFAULT_CAPACITY })),
    [capacities]
  )
  useEffect(() => {
    fetch('/api/settings/section-capacities')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setCapacities(data))
      .catch(() => {})
  }, [])
  const [capEditor, setCapEditor] = useState(null) // {1:'60',2:'60',3:'60'} | null
  const [capSaving, setCapSaving] = useState(false)
  const saveCapacities = async () => {
    setCapSaving(true)
    try {
      const res = await fetch('/api/settings/section-capacities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capEditor),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'save failed')
      setCapacities(data)
      setCapEditor(null)
    } catch (e) {
      alert(e.message)
    } finally {
      setCapSaving(false)
    }
  }
  // جلدها باید ایستاده و کنار هم (افقی) باشن، مثل BookshelfView: قفسه به
  // ردیف‌های bluray-shelf-row تقسیم می‌شه و تعداد هر ردیف از عرض قفسه میاد
  const shelfRef = useRef(null)
  const [casesPerRow, setCasesPerRow] = useState(20)
  const [spineHover, setSpineHover] = useState(null) // {rowIdx, itemIdx}
  const [closet, setCloset] = useState('')
  const [row, setRow] = useState('')
  const [shelf, setShelf] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [filmQuery, setFilmQuery] = useState('')
  const [moving, setMoving] = useState(false)
  const [hideShelved, setHideShelved] = useState(true)
  const [azLetter, setAzLetter] = useState(null)
  const [shelfViewMode, setShelfViewMode] = useState('spine')
  const [shelfScale, setShelfScale] = useShelfZoom(BASE_ZOOM)
  const [spineWidth, setSpineWidth] = useState(null) // همون اندازه‌ی پیش‌فرض BookshelfView
  useEffect(() => {
    const el = shelfRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = () => {
      // .cinema-wood-shelf حدود 28px padding از هر طرف داره
      const w = el.clientWidth - 56
      if (w <= 0) return
      // تو زوم ۸۰٪ دقیقاً ۶۵ جلد (ظرفیت یه بخش) یه ردیف کامل رو پر می‌کنن؛
      // زوم‌های دیگه به همون نسبت پهن‌تر/باریک‌ترن
      const spineW = (w / SLOTS_PER_ROW_AT_BASE - SPINE_GAP) * (shelfScale / BASE_ZOOM)
      setSpineWidth(spineW)
      setCasesPerRow(Math.max(6, Math.floor((w + 0.5) / (spineW + SPINE_GAP))))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [shelfScale, closet, row, shelf, shelfViewMode])
  const [shelfTheme, setShelfTheme] = useShelfTheme()
  const [hoveredFilm, setHoveredFilm] = useState(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // همه فیلم‌های فیزیکی (بلوری) — برای لیست انتخاب
  const physicalAll = useMemo(
    () => films.filter((f) => f.mediaType !== 'digital'),
    [films]
  )
  // فقط فیلم‌هایی که مکان دارند — برای شمارش و نقشه‌ی کمد. «مکان» یعنی کمد
  // داشته باشه؛ فیلمی که فقط بخش/ردیف داره (بدون کمد) هیچ‌جای نقشه دیده
  // نمی‌شه، پس باید بی‌آدرس حساب بشه تا تو موجودی بیاد و بشه جاش داد.
  const isShelved = (f) => !!f.closet
  const physical = useMemo(
    () => physicalAll.filter(isShelved),
    [physicalAll]
  )

  const physicalSorted = useMemo(
    () => [...physicalAll].sort(compareTitles),
    [physicalAll]
  )

  const shelvedCount = useMemo(
    () => countCopies(physicalSorted.filter(isShelved)),
    [physicalSorted]
  )

  // آیا یک فیلم در مکان هدفِ (کاملاً) انتخاب‌شده هست؟ اگر بله، از لیست انتخاب حذفش می‌کنیم
  // تا فیلمی که همین حالا در اون گروه هست دوباره نشون داده نشه.
  const atTarget = (f) =>
    closet && row && shelf &&
    String(f.closet || '') === closet &&
    String(f.row || '') === row &&
    String(f.shelf || '') === shelf

  const filteredFilms = useMemo(() => {
    const q = filmQuery.trim().toLowerCase()
    let base = physicalSorted
    if (hideShelved) {
      base = base.filter((f) => !isShelved(f))
    } else if (closet && row && shelf) {
      base = base.filter((f) => !atTarget(f))
    }
    if (azLetter) {
      base = base.filter((f) => firstLetterOf(f.title) === azLetter)
    }
    if (!q) return base
    return base.filter(
      (f) =>
        String(f.title || '').toLowerCase().includes(q) ||
        String(f.year || '').includes(q)
    )
  }, [physicalSorted, filmQuery, hideShelved, closet, row, shelf, azLetter])

  const targetExcludedCount = useMemo(() => {
    if (!(closet && row && shelf)) return 0
    return physicalSorted.filter((f) => atTarget(f)).length
  }, [physicalSorted, closet, row, shelf])

  const selectedCount = selectedIds.size

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredFilms.map((f) => f.id)))
  }
  const clearSelection = () => setSelectedIds(new Set())

  const hasTarget = Boolean(closet && row && shelf)
  const targetLabel = hasTarget ? `C${closet}R${row}S${shelf}` : ''

  const countFor = (c, r, s) =>
    countCopies(
      physical.filter(
        (f) =>
          (!c || String(f.closet || '–') === c) &&
          (!r || String(f.row || '–') === r) &&
          (!s || String(f.shelf || '–') === s)
      )
    )

  const currentTargetCopies = useMemo(() => {
    return countFor(closet, row, shelf)
  }, [closet, row, shelf, physical])

  const selectedCopiesCount = useMemo(() => {
    const selectedSet = selectedIds
    return countCopies(filteredFilms.filter((f) => selectedSet.has(f.id)))
  }, [selectedIds, filteredFilms])

  const targetCapacity = useMemo(() => {
    if (!shelf) return DEFAULT_CAPACITY
    const sec = SECTIONS.find((s) => s.num === shelf)
    return sec ? sec.capacity : DEFAULT_CAPACITY
  }, [shelf, SECTIONS])

  const wouldExceedCapacity = Boolean(
    hasTarget && currentTargetCopies + selectedCopiesCount > targetCapacity
  )

  const moveSelected = async () => {
    if (!hasTarget || !selectedCount || moving) return
    if (currentTargetCopies + selectedCopiesCount > targetCapacity) {
      alert(
        `Cannot exceed section capacity of ${targetCapacity} copies. Currently ${currentTargetCopies}/${targetCapacity} copies in C${closet}R${row}S${shelf}, and you selected ${selectedCopiesCount} copies (${Math.max(
          0,
          targetCapacity - currentTargetCopies
        )} spots left).`
      )
      return
    }
    setMoving(true)
    try {
      const res = await fetch('/api/films/bulk-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          closet,
          row,
          shelf,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'move failed')
      setSelectedIds(new Set())
      if (onFilmsChanged) onFilmsChanged()
    } catch (e) {
      console.error(e)
      alert(e.message)
    } finally {
      setMoving(false)
    }
  }

  // حذف تکی: مکان یک فیلم را خالی می‌کند تا به «بی‌آدرس» منتقل شود
  const [removingId, setRemovingId] = useState(null)
  const removeFromLocation = async (f) => {
    if (removingId) return
    setRemovingId(f.id)
    try {
      const res = await fetch('/api/films/' + f.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closet: '', row: '', shelf: '' }),
      })
      if (!res.ok) throw new Error('remove failed')
      if (onFilmsChanged) onFilmsChanged()
    } catch (e) {
      console.error(e)
    } finally {
      setRemovingId(null)
    }
  }

  // خالی کردن کامل یه بخش یا ردیف: همه‌ی فیلم‌هاش به «بی‌آدرس» برمی‌گردن
  const [emptying, setEmptying] = useState(false)
  const emptyLocation = async (list, label) => {
    if (emptying || !list.length) return
    const copies = list.reduce((sum, f) => sum + Math.max(1, Number(f.copies) || 1), 0)
    if (!window.confirm(`Empty ${label}?\n\n${copies} copies (${list.length} titles) will move back to unassigned inventory. Nothing is deleted.`)) return
    setEmptying(true)
    try {
      const res = await fetch('/api/films/bulk-unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: list.map((f) => f.id) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'empty failed')
      if (onFilmsChanged) onFilmsChanged()
    } catch (e) {
      console.error(e)
      alert(e.message)
    } finally {
      setEmptying(false)
    }
  }
  // انتقال کامل یه بخش (یا یه ردیف، بخش‌به‌بخش) به جای دیگه — با همون
  // bulk-move که سقف ۶۰ نسخه‌ی هر بخش رو سمت سرور چک می‌کنه
  const [moveTarget, setMoveTarget] = useState(null) // {mode:'section'|'row', closet, row, shelf} | null
  const [relocating, setRelocating] = useState(false)
  useEffect(() => setMoveTarget(null), [closet, row, shelf])
  const bulkMove = async (ids, c, r, s) => {
    const res = await fetch('/api/films/bulk-move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, closet: c, row: r, shelf: s }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'move failed')
  }
  const relocate = async () => {
    if (!moveTarget || relocating) return
    const t = moveTarget
    const plan =
      t.mode === 'section'
        ? [{ from: shelf, to: t.shelf }]
        : SECTIONS.map((sec) => ({ from: sec.num, to: sec.num }))
    const steps = plan
      .map((p) => ({ ...p, ids: (sectionIndex[`${closet}|${row}|${p.from}`] || []).map((f) => f.id) }))
      .filter((p) => p.ids.length)
    if (!steps.length) return
    const targetLabel = t.mode === 'section' ? `C${t.closet} · R${t.row} · S${t.shelf}` : `C${t.closet} · R${t.row}`
    const sourceLabel = t.mode === 'section' ? `C${closet} · R${row} · S${shelf}` : `C${closet} · R${row}`
    const total = steps.reduce((n, p) => n + p.ids.length, 0)
    const totalCopies = steps.reduce((n, p) => n + countCopies(sectionIndex[`${closet}|${row}|${p.from}`] || []), 0)
    if (!window.confirm(`Move ${totalCopies} copies (${total} titles) from ${sourceLabel} to ${targetLabel}?\n\nFilms already there stay; each section holds at most ${SECTIONS.map((sec) => `S${sec.num}: ${sec.capacity}`).join(', ')} copies.`)) return
    setRelocating(true)
    const failed = []
    for (const p of steps) {
      try {
        await bulkMove(p.ids, t.closet, t.row, p.to)
      } catch (e) {
        failed.push(`S${p.from} → S${p.to}: ${e.message}`)
      }
    }
    setRelocating(false)
    setMoveTarget(null)
    if (onFilmsChanged) onFilmsChanged()
    if (failed.length) alert(`Some sections were not moved:\n\n${failed.join('\n')}`)
  }
  const renderMovePicker = (mode) =>
    moveTarget?.mode === mode && (
      <span className="shelf-move-picker">
        Move to
        <select value={moveTarget.closet} onChange={(e) => setMoveTarget({ ...moveTarget, closet: e.target.value })}>
          {Array.from({ length: CLOSET_COUNT }, (_, i) => String(i + 1)).map((c) => (
            <option key={c} value={c}>C{c}</option>
          ))}
        </select>
        <select value={moveTarget.row} onChange={(e) => setMoveTarget({ ...moveTarget, row: e.target.value })}>
          {Array.from({ length: ROW_COUNT }, (_, i) => String(i + 1)).map((r) => (
            <option key={r} value={r}>R{r}</option>
          ))}
        </select>
        {mode === 'section' && (
          <select value={moveTarget.shelf} onChange={(e) => setMoveTarget({ ...moveTarget, shelf: e.target.value })}>
            {SECTIONS.map((sec) => (
              <option key={sec.num} value={sec.num}>S{sec.num}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="shelf-back-btn"
          disabled={
            relocating ||
            (moveTarget.closet === String(closet) &&
              moveTarget.row === String(row) &&
              (mode === 'row' || moveTarget.shelf === String(shelf)))
          }
          onClick={relocate}
        >
          {relocating ? 'Moving…' : 'Move'}
        </button>
        <button type="button" className="shelf-back-btn" onClick={() => setMoveTarget(null)}>
          Cancel
        </button>
      </span>
    )

  const filmsInRow = (c, r) =>
    Object.entries(sectionIndex)
      .filter(([key]) => key.startsWith(`${c}|${r}|`))
      .flatMap(([, list]) => list)

  const closets = useMemo(() => Array.from({ length: CLOSET_COUNT }, (_, i) => String(i + 1)), [])
  const rows = useMemo(() => Array.from({ length: ROW_COUNT }, (_, i) => String(i + 1)), [])

  // ایندکس سریع: closet|row|shelf -> لیست فیلم‌ها
  const sectionIndex = useMemo(() => {
    const map = {}
    for (const f of physical) {
      if (!f.closet) continue
      const c = String(f.closet)
      const r = String(f.row || '–')
      const s = String(f.shelf || '–')
      const key = `${c}|${r}|${s}`
      ;(map[key] = map[key] || []).push(f)
    }
    return map
  }, [physical])

  // نقشه‌ی کمد انتخاب‌شده: ۱۰ ردیف × ۲ بخش
  const cabinetRows = useMemo(() => {
    if (!closet) return []
    return rows.map((r) => {
      const sections = SECTIONS.map((sec) => {
        const list = (sectionIndex[`${closet}|${r}|${sec.num}`] || [])
          .slice()
          .sort(compareTitles)
        const copiesCount = countCopies(list)
        return {
          num: sec.num,
          capacity: sec.capacity,
          label: sec.label,
          count: copiesCount,
          filmCount: list.length,
          previews: list.slice(0, PREVIEW_TITLES),
        }
      })
      return {
        row: r,
        sections,
        total: sections.reduce((sum, s) => sum + s.count, 0),
      }
    })
  }, [closet, rows, sectionIndex, SECTIONS])

  // فیلم‌های قفسه‌ی (بخش) انتخاب‌شده
  const shelfFilms = useMemo(() => {
    if (!closet || !row || !shelf) return []
    return (sectionIndex[`${closet}|${row}|${shelf}`] || [])
      .slice()
      .sort(compareTitles)
  }, [closet, row, shelf, sectionIndex])

  // هر نسخه یه جلد جدا رو قفسه‌ست (مثل BookshelfView)، نه یه جلد با «×N»
  const shelfCases = useMemo(
    () =>
      shelfFilms.flatMap((f) =>
        Array.from({ length: Math.max(1, Number(f.copies) || 1) }, (_, copyIdx) => ({ f, copyIdx }))
      ),
    [shelfFilms]
  )

  const shelfCopiesCount = useMemo(() => countCopies(shelfFilms), [shelfFilms])

  const currentSection = SECTIONS.find((s) => s.num === shelf) || null

  // جای خالیِ بخش (ظرفیت منهای نسخه‌ها) به‌صورت جلدهای کم‌رنگ، بعد از جلدهای
  // واقعی — ولی فقط تا آخر آخرین ردیفی که جلد واقعی داره، تا قفسه هم‌قدِ
  // Bookshelf بمونه و ردیف خالیِ اضافه نسازه (نوار «x / ظرفیت» ظرفیت کامل رو نشون می‌ده)
  const shelfSlots = useMemo(() => {
    const free = Math.max(0, (currentSection?.capacity || 0) - shelfCases.length)
    const rowsUsed = Math.max(1, Math.ceil(shelfCases.length / casesPerRow))
    const roomInRows = rowsUsed * casesPerRow - shelfCases.length
    const ghosts = Math.min(free, roomInRows)
    return [...shelfCases, ...Array.from({ length: ghosts }, (_, i) => ({ ghost: true, ghostIdx: i }))]
  }, [shelfCases, currentSection, casesPerRow])

  const selectCloset = (v) => {
    setCloset(v)
    setRow('')
    setShelf('')
  }
  const selectRow = (v) => {
    setRow(v)
    setShelf('')
  }
  const selectShelf = (v) => setShelf(v)

  // ---- پر کردن بخش با «حرف + تعداد»: از اولین فیلم بی‌آدرس با این حرف،
  // به ترتیب الفبا، تا «تعداد» نسخه. بعد از هر بار پر کردن، خودش می‌ره بخش
  // بعدی و حرفِ فیلم بعدی رو انتخاب می‌کنه تا فقط تعداد رو بدی. ----
  const [fillLetter, setFillLetter] = useState('#')
  const [fillCount, setFillCount] = useState('')
  const [fillPreview, setFillPreview] = useState(null)
  const [fillBusy, setFillBusy] = useState(false)
  const [fillMessage, setFillMessage] = useState(null) // {type, text}
  const [lastFill, setLastFill] = useState(null) // {ids, label}
  const letterOf = (title) => {
    const ch = String(title || '').replace(/^the\s+/i, '').replace(/^[^\p{L}\p{N}]+/u, '').charAt(0).toUpperCase()
    return /[A-Z]/.test(ch) ? ch : '#'
  }
  // باقی‌مونده‌ی هر حرف: چند نسخه‌ی بی‌آدرس با این حرف شروع می‌شن (روی دکمه‌ی حرف)
  const unassignedByLetter = useMemo(() => {
    const out = {}
    for (const f of physicalAll) {
      if (f.closet) continue
      const L = letterOf(f.title)
      out[L] = (out[L] || 0) + Math.max(1, Number(f.copies) || 1)
    }
    return out
  }, [physicalAll])
  const nextSection = (c, r, sh) => {
    const s3 = Number(sh)
    if (s3 < SECTIONS.length) return [c, r, String(s3 + 1)]
    if (Number(r) < ROW_COUNT) return [c, String(Number(r) + 1), '1']
    if (Number(c) < CLOSET_COUNT) return [String(Number(c) + 1), '1', '1']
    return null
  }
  useEffect(() => {
    setFillPreview(null)
    setFillCount('')
  }, [closet, row, shelf])
  const runFill = async (dryRun) => {
    const count = parseInt(fillCount, 10)
    if (!Number.isFinite(count) || count < 1) {
      setFillMessage({ type: 'error', text: 'Enter how many copies go in this section' })
      return
    }
    setFillBusy(true)
    setFillMessage(null)
    try {
      const res = await fetch('/api/shelf/fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closet, row, shelf, startTitle: fillLetter, count, dryRun }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'fill failed')
      if (dryRun) {
        setFillPreview(data)
        return
      }
      const label = `C${closet} · R${row} · S${shelf}`
      setLastFill({ ids: data.titles.map((t) => t.id), label })
      setFillPreview(null)
      setFillMessage({
        type: 'ok',
        text:
          `${label}: placed ${data.slotsUsed} copies (${data.assigned} titles), “${data.firstTitle}” → “${data.lastTitle}”.` +
          (data.cappedByCapacity ? ` Stopped at the section capacity (${data.capacity}).` : '') +
          (data.nextTitle ? ` Next up: “${data.nextTitle}”.` : ' No unassigned films left.'),
      })
      if (onFilmsChanged) onFilmsChanged()
      // خودکار برو بخش بعدی، با حرفِ فیلم بعدی
      const nxt = nextSection(closet, row, shelf)
      if (nxt && data.nextTitle) {
        setCloset(nxt[0])
        setRow(nxt[1])
        setShelf(nxt[2])
        setFillLetter(letterOf(data.nextTitle))
      }
    } catch (e) {
      setFillMessage({ type: 'error', text: e.message })
    } finally {
      setFillBusy(false)
    }
  }
  const undoLastFill = async () => {
    if (!lastFill || fillBusy) return
    setFillBusy(true)
    try {
      const res = await fetch('/api/films/bulk-unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: lastFill.ids }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'undo failed')
      setFillMessage({ type: 'ok', text: `Undid the last fill of ${lastFill.label} (${lastFill.ids.length} titles back to unassigned).` })
      setLastFill(null)
      if (onFilmsChanged) onFilmsChanged()
    } catch (e) {
      setFillMessage({ type: 'error', text: e.message })
    } finally {
      setFillBusy(false)
    }
  }

  // کلیک روی بخش‌های نقشه‌ی کمد => همون ردیف/بخش رو انتخاب می‌کنه و قفسه رو نشون می‌ده
  const pickFromMap = (r, s) => {
    setRow(r)
    setShelf(s)
  }

  const locationLabel = closet || row || shelf
    ? `${closet ? `C${closet}` : ''}${row ? `R${row}` : ''}${shelf ? `S${shelf}` : ''}`
    : 'all-locations'

  const excelExportUrl = () => {
    const params = new URLSearchParams()
    if (closet) params.set('closet', closet)
    if (row) params.set('row', row)
    if (shelf) params.set('shelf', shelf)
    const qs = params.toString()
    return `/api/export/excel${qs ? `?${qs}` : ''}`
  }

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const list = shelfFilms.length ? shelfFilms : (closet ? physical.filter((f) => String(f.closet || '–') === closet) : physical)
    const rows = list
      .map(
        (f, idx) => `
      <tr>
        <td class="cell-nowrap">${idx + 1}</td>
        <td class="cell-title">${escapeHtml(f.title)}${f.originalTitle && f.originalTitle !== f.title ? ` <span class="cell-orig">(${escapeHtml(f.originalTitle)})</span>` : ''}</td>
        <td class="cell-nowrap">${f.year || '—'}</td>
        <td class="cell-nowrap">${escapeHtml(f.director) || '—'}</td>
        <td class="cell-nowrap">★ ${f.rating ? f.rating.toFixed(1) : '—'}</td>
        <td class="cell-nowrap">C${escapeHtml(f.closet) || '—'} R${escapeHtml(f.row) || '—'} S${escapeHtml(f.shelf) || '—'}</td>
        <td class="cell-nowrap">${escapeHtml(f.format) || 'Blu-ray'}</td>
        <td class="cell-nowrap">${f.criterion ? `Criterion${f.criterionCopies > 1 ? ` ×${f.criterionCopies}` : ''}` : '—'}</td>
        <td class="cell-nowrap">${f.copies > 1 ? f.copies : 1}</td>
      </tr>
    `
      )
      .join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Location Catalog ${locationLabel} - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #111; }
            .catalog-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
            .catalog-header-logo { height: 62px; width: auto; flex-shrink: 0; }
            .catalog-header-text { text-align: right; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            .catalog-header p { font-size: 12px; color: #666; margin: 0; }
            table { width: 100%; border-collapse: collapse; font-size: 10.5px; table-layout: fixed; }
            th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .cell-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
            .cell-orig { font-weight: 400; color: #777; }
            .cell-nowrap { white-space: nowrap; }
            th { background: #f0f0f0; font-weight: bold; }
            tr:nth-child(even) { background: #f9f9f9; }
            @media print { body { padding: 0; } button { display: none; } }
          </style>
        </head>
        <body>
          <div class="catalog-header">
            <img class="catalog-header-logo" src="${window.location.origin}/logo.png" alt="Cinefilm Archive" />
            <div class="catalog-header-text">
              <h1>🎬 Location Catalog — ${locationLabel}</h1>
              <p>Total Items: ${list.length} titles (${countCopies(list)} copies) · Generated on ${new Date().toLocaleString()}</p>
            </div>
          </div>
          <button onclick="window.print()" style="padding:10px 18px; margin-bottom:15px; font-weight:bold; cursor:pointer;">🖨️ Print / Save as PDF</button>
          <table>
            <colgroup>
              <col style="width:4%"><col style="width:26%"><col style="width:7%"><col style="width:14%">
              <col style="width:6%"><col style="width:13%"><col style="width:9%"><col style="width:11%"><col style="width:7%">
            </colgroup>
            <thead>
              <tr>
                <th>#</th><th>Title</th><th>Year</th><th>Director</th><th>IMDb</th>
                <th>Location</th><th>Format</th><th>Criterion</th><th>Copies</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // برگه‌ی چیدمان: همه‌ی بخش‌های پرشده به ترتیب کمد → ردیف → بخش، هر بخش با
  // تیتر خودش و فیلم‌ها به ترتیب الفبا با شماره‌ی جا (هر نسخه یه جا) — برای
  // چیدن قفسه‌ی واقعی از روی برنامه. اگه کمدی انتخاب شده باشه فقط همون کمد.
  const handlePrintPlan = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const num = (v) => Number(v) || 0
    const keys = Object.keys(sectionIndex)
      .filter((k) => !closet || k.startsWith(`${closet}|`))
      .sort((a, b) => {
        const [ac, ar, as] = a.split('|').map(num)
        const [bc, br, bs] = b.split('|').map(num)
        return ac - bc || ar - br || as - bs
      })
    const sectionsHtml = keys
      .map((k) => {
        const [c, r, sh] = k.split('|')
        const films = [...sectionIndex[k]].sort(compareTitles)
        const cap = SECTIONS.find((x) => x.num === sh)?.capacity || DEFAULT_CAPACITY
        let slot = 0
        const items = films
          .map((f) => {
            const n = Math.max(1, Number(f.copies) || 1)
            const from = slot + 1
            slot += n
            const slots = n > 1 ? `${from}–${slot}` : `${from}`
            return `<li><span class="slot">${slots}</span><span class="t">${escapeHtml(f.title)}</span>${f.year ? `<span class="y">${f.year}</span>` : ''}${n > 1 ? `<span class="x">×${n}</span>` : ''}</li>`
          })
          .join('')
        return `<section><h2>Closet ${escapeHtml(c)} · Row ${escapeHtml(r)} · Section ${escapeHtml(sh)}<span>${slot} / ${cap} copies · ${films.length} titles</span></h2><ol>${items}</ol></section>`
      })
      .join('')
    const scopeLabel = closet ? `Closet ${closet}` : 'All closets'
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Shelf Plan — ${scopeLabel} — ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #111; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            .sub { font-size: 12px; color: #666; margin: 0 0 14px; }
            section { break-inside: avoid-page; margin: 0 0 18px; }
            h2 { display: flex; justify-content: space-between; gap: 10px; font-size: 14px; margin: 0 0 6px; padding: 6px 8px; background: #f0f0f0; border-left: 4px solid #b8860b; }
            h2 span { font-weight: 400; color: #555; font-size: 12px; }
            ol { list-style: none; margin: 0; padding: 0; columns: 3; column-gap: 18px; font-size: 11px; }
            li { display: flex; gap: 6px; padding: 2px 0; border-bottom: 1px dotted #ddd; break-inside: avoid; }
            .slot { min-width: 34px; color: #888; font-variant-numeric: tabular-nums; }
            .t { flex: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .y, .x { color: #777; }
            @media print { body { padding: 0; } button { display: none; } }
          </style>
        </head>
        <body>
          <h1>🎬 Shelf Plan — ${scopeLabel}</h1>
          <p class="sub">${keys.length} sections · numbers are shelf slots from the left (each copy takes one slot) · Generated on ${new Date().toLocaleString()}</p>
          <button onclick="window.print()" style="padding:10px 18px; margin-bottom:15px; font-weight:bold; cursor:pointer;">🖨️ Print / Save as PDF</button>
          ${sectionsHtml || '<p>No films are shelved yet.</p>'}
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // برچسب لبه‌ی قفسه: برای هر بخش پرشده یه کارت کوچیک با «C1 · R1 · S1» و
  // بازه‌ی الفبا (دو حرف اول اولین و آخرین عنوان، مثل «A – Ba») — برای
  // چسبوندن جلوی هر بخش تا بعداً جای فیلم‌ها راحت پیدا بشه.
  const handlePrintLabels = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const num = (v) => Number(v) || 0
    const keys = Object.keys(sectionIndex)
      .filter((k) => !closet || k.startsWith(`${closet}|`))
      .sort((a, b) => {
        const [ac, ar, as] = a.split('|').map(num)
        const [bc, br, bs] = b.split('|').map(num)
        return ac - bc || ar - br || as - bs
      })
    const labels = keys
      .map((k) => {
        const [c, r, sh] = k.split('|')
        const films = [...sectionIndex[k]].sort(compareTitles)
        const first = films[0]
        const last = films[films.length - 1]
        return `<div class="label">
          <div class="loc">C${escapeHtml(c)} · R${escapeHtml(r)} · S${escapeHtml(sh)}</div>
          <div class="range">${escapeHtml(alphabetRange(first.title, last.title))}</div>
          <div class="titles">${escapeHtml(first.title)} → ${escapeHtml(last.title)}</div>
        </div>`
      })
      .join('')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Shelf Labels — ${closet ? `Closet ${closet}` : 'All closets'}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 16px; color: #111; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
            .label { border: 1.5px dashed #999; border-radius: 6px; padding: 8px 10px; break-inside: avoid; }
            .loc { font-size: 15px; font-weight: 800; letter-spacing: 0.5px; }
            .range { font-size: 22px; font-weight: 800; color: #8a6400; margin: 2px 0; }
            .titles { font-size: 10px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            @media print { body { padding: 0; } button { display: none; } }
          </style>
        </head>
        <body>
          <button onclick="window.print()" style="padding:10px 18px; margin-bottom:12px; font-weight:bold; cursor:pointer;">🖨️ Print labels</button>
          <div class="grid">${labels || '<p>No films are shelved yet.</p>'}</div>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="modal-overlay" {...overlayHandlers}>
      <div className="location-browser" onClick={(e) => e.stopPropagation()}>
        <header className="location-browser-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="shelf-back-btn"
              onClick={onClose}
              title="Back to Posters / Library"
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              ← Back to Posters
            </button>
            <div className="location-browser-title">
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconBookshelf width={18} height={18} /> Shelves
              </h2>
              <p className="export-sub" style={{ margin: '4px 0 0' }}>Section: pick a closet, row and section to fill, empty or move it · Wall: every filled section, one after another</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {physical.length > 0 && (
              <button
                type="button"
                className="shelf-back-btn"
                onClick={handlePrintPlan}
                title="Printable list of every filled section, in order, with slot numbers — for arranging the real shelves"
              >
                <IconPrinter width={14} height={14} /> Print shelf plan{closet ? ` (C${closet})` : ''}
              </button>
            )}
            {physical.length > 0 && (
              <button
                type="button"
                className="shelf-back-btn"
                onClick={handlePrintLabels}
                title="Small cut-out labels for the front of each section: location and alphabetical range"
              >
                <IconPrinter width={14} height={14} /> Print shelf labels{closet ? ` (C${closet})` : ''}
              </button>
            )}
          <button className="modal-close cine-close" onClick={onClose} aria-label="Close">
            <IconClose width={16} height={16} />
          </button>
          </div>
        </header>

        <div className={`location-browser-selectors ${closet && row && shelf ? 'location-browser-selectors-collapsed' : ''}`}>
          <div className="location-browser-selector-group">
            <span className="location-browser-selector-label">Closet</span>
            <div className="location-chip-list location-chip-grid-4">
              {closets.map((c) => {
                const n = countFor(c, null, null)
                return (
                  <button
                    key={c}
                    className={
                      (c === closet ? 'location-chip location-chip-active' : 'location-chip') +
                      (n === 0 ? ' location-chip-empty' : '')
                    }
                    onClick={() => selectCloset(c)}
                  >
                    C{c} <span className="location-chip-count">{n}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="location-browser-selector-group">
            <span className="location-browser-selector-label">Row</span>
            <div className={'location-chip-list location-chip-grid-5' + (closet ? '' : ' location-chip-list-disabled')}>
              {rows.map((r) => {
                const n = countFor(closet, r, null)
                return (
                  <button
                    key={r}
                    className={
                      (r === row ? 'location-chip location-chip-active' : 'location-chip') +
                      (n === 0 ? ' location-chip-empty' : '') +
                      (closet ? '' : ' location-chip-disabled')
                    }
                    disabled={!closet}
                    onClick={() => selectRow(r)}
                  >
                    R{r} <span className="location-chip-count">{n}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="location-browser-selector-group">
            <span className="location-browser-selector-label">Section</span>
            <div className={'location-chip-list' + (row ? '' : ' location-chip-list-disabled')}>
              {SECTIONS.map((s) => {
                const n = countFor(closet, row, s.num)
                return (
                  <button
                    key={s.num}
                    className={
                      (s.num === shelf ? 'location-chip location-chip-active' : 'location-chip') +
                      (n === 0 ? ' location-chip-empty' : '') +
                      (row ? '' : ' location-chip-disabled')
                    }
                    disabled={!row}
                    onClick={() => selectShelf(s.num)}
                  >
                    S{s.num} <span className="location-chip-count">{n}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="shelves-view-switch">
          <button
            type="button"
            className={shelvesView === 'section' ? 'active' : ''}
            onClick={() => setShelvesView('section')}
          >
            Section
          </button>
          <button
            type="button"
            className={shelvesView === 'wall' ? 'active' : ''}
            onClick={() => setShelvesView('wall')}
          >
            Wall{closet ? ` · C${closet}` : ' · all closets'}
          </button>
        </div>

        {shelvesView === 'wall' ? (
          <div className="location-browser-body">
            <BookshelfView
              films={films}
              onSelectFilm={onSelectFilm}
              onFilmsChanged={onFilmsChanged}
              closet={closet}
              capacityFor={(sh) => SECTIONS.find((x) => x.num === String(sh))?.capacity || DEFAULT_CAPACITY}
              onPickSection={(c, r, sh) => {
                setCloset(c)
                setRow(r)
                setShelf(sh)
                setShelvesView('section')
              }}
            />
          </div>
        ) : (
        <div className="location-browser-body">
          <div className="location-browser-top">
          {!closet && (
            <div className="closet-grid-wrap">
              <div className="closet-grid">
                {closets.map((c) => {
                  const n = countFor(c, null, null)
                  return (
                    <button key={c} className="closet-card" onClick={() => selectCloset(c)}>
                      <span className="closet-card-idx">C{c}</span>
                      <span className="closet-card-count">{n} copies</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {closet && !row && (
            <div className="cabinet-map cabinet-map-full">
              <div className="cabinet-map-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    className="shelf-back-btn"
                    onClick={() => setCloset('')}
                  >
                    ← All Closets
                  </button>
                  <span className="cabinet-map-title">Closet {closet} — pick a row or section</span>
                </div>
                <span className="cabinet-map-meta">{cabinetRows.length} rows · {countFor(closet, null, null)} copies</span>
              </div>
              <div className="cabinet-map-legend">
                {SECTIONS.map((sec) => (
                  <span className="cabinet-map-legend-item" key={sec.num}>
                    <span className={`cabinet-map-legend-swatch cabinet-map-legend-swatch-s${sec.num}`} /> {sec.label} · cap{' '}
                    {capEditor ? (
                      <input
                        type="number"
                        min="1"
                        max={DEFAULT_CAPACITY}
                        className="capacity-input"
                        value={capEditor[sec.num]}
                        onChange={(e) => setCapEditor({ ...capEditor, [sec.num]: e.target.value })}
                      />
                    ) : (
                      sec.capacity
                    )}
                  </span>
                ))}
                {canEdit &&
                  (capEditor ? (
                    <>
                      <button type="button" className="shelf-back-btn" disabled={capSaving} onClick={saveCapacities}>
                        {capSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" className="shelf-back-btn" onClick={() => setCapEditor(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="shelf-back-btn"
                      onClick={() => setCapEditor(Object.fromEntries(SECTIONS.map((sec) => [sec.num, String(sec.capacity)])))}
                      title="Change how many copies each section holds (applies to every closet and row)"
                    >
                      Edit capacities
                    </button>
                  ))}
              </div>
              <div className="cabinet-map-body">
                {cabinetRows.map((r) => (
                  <div className="cabinet-row" key={r.row}>
                    <div className="cabinet-row-label">
                      <span className="cabinet-row-num">R{r.row}</span>
                      <span className="cabinet-row-total">{r.total}</span>
                    </div>
                    <div className="cabinet-row-shelves">
                      {r.sections.map((sec) => {
                        const pct = Math.min(100, Math.round((sec.count / sec.capacity) * 100))
                        return (
                          <button
                            key={sec.num}
                            className={
                              'cabinet-section' +
                              ` cabinet-section-s${sec.num}` +
                              (sec.count === 0 ? ' cabinet-section-empty' : '')
                            }
                            onClick={() => pickFromMap(r.row, sec.num)}
                            title={`${sec.label} · ${sec.count} copies of ${sec.capacity} (${sec.filmCount} films)`}
                          >
                            <div className="cabinet-section-top">
                              <span className="cabinet-section-label">S{sec.num}</span>
                              <span className="cabinet-section-cap">
                                {sec.count}<span className="cabinet-section-cap-slash">/{sec.capacity}</span>
                              </span>
                            </div>
                            <div className="cabinet-section-track">
                              <div className="cabinet-section-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="cabinet-section-previews">
                              {sec.previews.length === 0 ? (
                                <span className="cabinet-section-preview-empty">Empty section</span>
                              ) : (
                                sec.previews.map((f) => (
                                  <span className="cabinet-section-preview" key={f.id}>
                                    <IconFilm width={9} height={9} /> {f.title}
                                  </span>
                                ))
                              )}
                              {sec.filmCount > sec.previews.length && (
                                <span className="cabinet-section-preview-more">+{sec.filmCount - sec.previews.length} more</span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {closet && row && !shelf && (
            <div className="shelf-pick">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <button
                  type="button"
                  className="shelf-back-btn"
                  onClick={() => setRow('')}
                >
                  ← Back to C{closet}
                </button>
                <p className="shelf-pick-label" style={{ margin: 0 }}>Cabinet {closet} · Row {row} — choose a section</p>
                {canEdit && filmsInRow(closet, row).length > 0 && (
                  <button
                    type="button"
                    className="shelf-back-btn shelf-empty-btn"
                    disabled={emptying}
                    onClick={() => emptyLocation(filmsInRow(closet, row), `Cabinet ${closet} · Row ${row} (all sections)`)}
                    title="Move every film in this row back to unassigned inventory"
                  >
                    {emptying ? 'Emptying…' : `Empty row (${countCopies(filmsInRow(closet, row))} copies)`}
                  </button>
                )}
                {canEdit && filmsInRow(closet, row).length > 0 && !moveTarget && (
                  <button
                    type="button"
                    className="shelf-back-btn"
                    onClick={() => setMoveTarget({ mode: 'row', closet: String(closet), row: String(row) })}
                    title="Move this whole row (section by section) to another row"
                  >
                    Move row to…
                  </button>
                )}
                {renderMovePicker('row')}
              </div>
              <div className="shelf-pick-sections">
                {SECTIONS.map((sec) => {
                  const n = countFor(closet, row, sec.num)
                  const pct = Math.min(100, Math.round((n / sec.capacity) * 100))
                  return (
                    <button
                      key={sec.num}
                      className={'shelf-pick-card' + (sec.num !== '1' ? ` shelf-pick-card-s${sec.num}` : '')}
                      onClick={() => selectShelf(sec.num)}
                    >
                      <span className="shelf-pick-card-title">S{sec.num} · {sec.label}</span>
                      <span className="shelf-pick-card-cap">{n} / {sec.capacity} copies</span>
                      <span className="shelf-pick-card-track">
                        <span className="shelf-pick-card-fill" style={{ width: `${pct}%` }} />
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {closet && row && shelf && currentSection && (
            <div className="shelf-view">
              <div className="shelf-view-head">
                <div className="shelf-view-head-left">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <button
                      type="button"
                      className="shelf-back-btn"
                      onClick={() => setShelf('')}
                    >
                      ← Back to C{closet} · R{row}
                    </button>
                    <div className="shelf-view-loc" style={{ margin: 0 }}>
                      C{closet} <span className="shelf-view-sep">·</span> R{row} <span className="shelf-view-sep">·</span> S{shelf}
                    </div>
                  </div>
                  <div className="shelf-view-title">
                    {currentSection.label} <span className="shelf-view-cap">(capacity {currentSection.capacity})</span>
                  </div>
                  {canEdit && (
                    <div className="shelf-view-hint">
                      To remove one film, switch to List View and use ✕ (moves it to unassigned)
                      {(sectionIndex[`${closet}|${row}|${shelf}`] || []).length > 0 && (
                        <button
                          type="button"
                          className="shelf-back-btn shelf-empty-btn"
                          disabled={emptying}
                          onClick={() =>
                            emptyLocation(sectionIndex[`${closet}|${row}|${shelf}`] || [], `C${closet} · R${row} · S${shelf}`)
                          }
                          title="Move every film in this section back to unassigned inventory"
                        >
                          {emptying ? 'Emptying…' : `Empty section (${countCopies(sectionIndex[`${closet}|${row}|${shelf}`] || [])} copies)`}
                        </button>
                      )}
                      {(sectionIndex[`${closet}|${row}|${shelf}`] || []).length > 0 && !moveTarget && (
                        <button
                          type="button"
                          className="shelf-back-btn shelf-move-btn"
                          onClick={() =>
                            setMoveTarget({ mode: 'section', closet: String(closet), row: String(row), shelf: String(shelf) })
                          }
                          title="Move every film in this section to another closet / row / section"
                        >
                          Move section to…
                        </button>
                      )}
                      {renderMovePicker('section')}
                    </div>
                  )}
                </div>
                <div className="shelf-view-actions">
                  {shelfViewMode === 'spine' && (
                    <>
                      <div className="shelf-zoom-control">
                        <button
                          type="button"
                          className="shelf-zoom-btn"
                          onClick={() => setShelfScale((s) => Math.max(MIN_SHELF_ZOOM, Number((s - 0.1).toFixed(2))))}
                          title="Zoom Out shelf cases"
                        >
                          −
                        </button>
                        <span className="shelf-zoom-label">{Math.round(shelfScale * 100)}%</span>
                        <button
                          type="button"
                          className="shelf-zoom-btn"
                          onClick={() => setShelfScale((s) => Math.min(MAX_SHELF_ZOOM, Number((s + 0.1).toFixed(2))))}
                          title="Zoom In shelf cases"
                        >
                          +
                        </button>
                      </div>
                      <div className="shelf-theme-picker">
                        <button
                          type="button"
                          className={`shelf-theme-btn ${shelfTheme === 'wood' ? 'active' : ''}`}
                          onClick={() => setShelfTheme('wood')}
                          title="Classic Walnut Wood Shelf"
                        >
                          🪵 Wood
                        </button>
                        <button
                          type="button"
                          className={`shelf-theme-btn ${shelfTheme === 'slate' ? 'active' : ''}`}
                          onClick={() => setShelfTheme('slate')}
                          title="Modern Brushed Slate Shelf"
                        >
                          ⚙️ Slate
                        </button>
                        <button
                          type="button"
                          className={`shelf-theme-btn ${shelfTheme === 'cinema' ? 'active' : ''}`}
                          onClick={() => setShelfTheme('cinema')}
                          title="Dark Cinema Neon LED Shelf"
                        >
                          🎬 Cinema
                        </button>
                      </div>
                    </>
                  )}
                  <div className="view-toggle" style={{ marginInlineEnd: '6px' }}>
                    <button
                      type="button"
                      className={shelfViewMode === 'spine' ? 'active' : ''}
                      onClick={() => setShelfViewMode('spine')}
                      title="Physical Spine Shelf View"
                    >
                      📚 Spine View
                    </button>
                    <button
                      type="button"
                      className={shelfViewMode === 'list' ? 'active' : ''}
                      onClick={() => setShelfViewMode('list')}
                      title="Table / List View"
                    >
                      ☰ List View
                    </button>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handlePrintPDF} title="Print / Save as PDF">
                    <IconPrinter width={13} height={13} /> PDF
                  </button>
                  <a href={excelExportUrl()} download className="btn btn-ghost btn-sm" title="Download Excel">
                    <IconDownload width={13} height={13} /> Excel
                  </a>
                </div>
              </div>

              {canEdit && (
                <div className="shelf-fill-panel">
                  <div className="shelf-fill-head">
                    <strong>Fill this section</strong>
                    <span className="shelf-fill-sub">
                      Pick the starting letter and how many copies fit — unassigned films go in alphabetically. After each fill it jumps to the next section.
                    </span>
                  </div>
                  <div className="shelf-fill-letters">
                    {AZ_LETTERS.map((L) => {
                      const left = unassignedByLetter[L] || 0
                      return (
                        <button
                          type="button"
                          key={L}
                          className={
                            'film-selector-az-btn shelf-fill-letter' +
                            (fillLetter === L ? ' film-selector-az-btn-active' : '') +
                            (left ? '' : ' shelf-fill-letter-done')
                          }
                          onClick={() => {
                            setFillLetter(L)
                            setFillPreview(null)
                            // تعداد پیش‌فرض: هر کدوم کمتره — باقی‌مونده‌ی این حرف یا جای خالی بخش
                            const free = Math.max(0, currentSection.capacity - shelfCopiesCount)
                            if (left && free) setFillCount(String(Math.min(left, free)))
                          }}
                          title={left ? `${left} unassigned copies start with ${L}` : `No unassigned copies left for ${L}`}
                        >
                          <span>{L}</span>
                          <span className="shelf-fill-letter-left">{left}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="shelf-fill-controls">
                    <label>
                      Copies
                      <input
                        type="number"
                        min="1"
                        max={currentSection.capacity}
                        value={fillCount}
                        placeholder={String(Math.max(0, currentSection.capacity - shelfCopiesCount))}
                        onChange={(e) => {
                          setFillCount(e.target.value)
                          setFillPreview(null)
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && runFill(!fillPreview)}
                      />
                    </label>
                    <span className="shelf-fill-free">{Math.max(0, currentSection.capacity - shelfCopiesCount)} free</span>
                    {(() => {
                      // اگه تعداد از باقی‌مونده‌ی این حرف بیشتره، فیلم‌های حرف(های) بعدی هم میان
                      const count = parseInt(fillCount, 10)
                      const left = unassignedByLetter[fillLetter] || 0
                      if (!Number.isFinite(count) || fillLetter === '#' || count <= left) return null
                      return (
                        <span className="shelf-fill-warn">
                          Only {left} copies left for {fillLetter} — the rest will continue into the next letter{count - left > 1 ? 's' : ''}
                        </span>
                      )
                    })()}
                    <button type="button" className="shelf-back-btn" disabled={fillBusy} onClick={() => runFill(true)}>
                      Preview
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" disabled={fillBusy} onClick={() => runFill(false)}>
                      {fillBusy ? 'Working…' : `Fill C${closet} · R${row} · S${shelf}`}
                    </button>
                    {lastFill && (
                      <button type="button" className="shelf-back-btn" disabled={fillBusy} onClick={undoLastFill}>
                        Undo last fill ({lastFill.label})
                      </button>
                    )}
                  </div>
                  {fillPreview && (
                    <div className="shelf-fill-preview">
                      <div>
                        {fillPreview.slotsUsed} copies ({fillPreview.assigned} titles): “{fillPreview.firstTitle}” → “{fillPreview.lastTitle}”
                        {fillPreview.cappedByCapacity && ` — capped at capacity ${fillPreview.capacity}`}
                        {fillPreview.nextTitle && <span className="shelf-fill-next"> · next section starts with “{fillPreview.nextTitle}”</span>}
                      </div>
                      <ol>
                        {fillPreview.titles.map((t) => (
                          <li key={t.id}>
                            {t.title}
                            {t.copies > 1 && <span className="copies-badge">×{t.copies}</span>}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {fillMessage && <div className={`shelf-fill-msg shelf-fill-msg-${fillMessage.type}`}>{fillMessage.text}</div>}
                </div>
              )}

              <div className="shelf-view-meter">
                <span className="shelf-view-meter-count">
                  {shelfCopiesCount} <span className="shelf-view-meter-total">/ {currentSection.capacity}</span> copies
                  {shelfFilms.length !== shelfCopiesCount && (
                    <span className="shelf-view-meter-sub"> ({shelfFilms.length} titles)</span>
                  )}
                </span>
                <span className="shelf-view-meter-track">
                  <span
                    className="shelf-view-meter-fill"
                    style={{ width: `${Math.min(100, Math.round((shelfCopiesCount / currentSection.capacity) * 100))}%` }}
                  />
                </span>
              </div>

              {shelfFilms.length === 0 ? (
                <div className="status empty-state">
                  <span className="empty-icon"><IconArchive width={22} height={22} /></span>
                  <p>Nothing shelved here yet. Move available films from inventory below.</p>
                </div>
              ) : shelfViewMode === 'spine' ? (
                <>
                  <div className="spine-inspector-bar">
                    {hoveredFilm ? (
                      <div className="spine-inspector-content">
                        <div className="spine-inspector-poster">
                          {hoveredFilm.poster ? (
                            <img src={hoveredFilm.poster} alt={hoveredFilm.title} />
                          ) : (
                            <div className="spine-inspector-poster-fallback">🎬</div>
                          )}
                        </div>
                        <div className="spine-inspector-details">
                          <div className="spine-inspector-line1">
                            <span className="spine-inspector-title">{hoveredFilm.title}</span>
                            {hoveredFilm.originalTitle && hoveredFilm.originalTitle !== hoveredFilm.title && (
                              <span className="spine-inspector-orig">({hoveredFilm.originalTitle})</span>
                            )}
                            {hoveredFilm.year && <span className="spine-inspector-year">{hoveredFilm.year}</span>}
                          </div>
                          <div className="spine-inspector-line2">
                            {hoveredFilm.director && (
                              <span className="spine-inspector-dir">Dir: {hoveredFilm.director}</span>
                            )}
                            {hoveredFilm.studio && (
                              <span className="spine-inspector-studio">{hoveredFilm.studio}</span>
                            )}
                          </div>
                          <div className="spine-inspector-badges">
                            {hoveredFilm.rating && (
                              <span className="spine-inspector-badge badge-imdb">★ {hoveredFilm.rating.toFixed(1)} IMDb</span>
                            )}
                            <span className="spine-inspector-badge badge-loc">
                              C{hoveredFilm.closet || '–'} R{hoveredFilm.row || '–'} S{hoveredFilm.shelf || '–'}
                            </span>
                            <span className="spine-inspector-badge badge-format">
                              {hoveredFilm.format || 'Blu-ray'}
                            </span>
                            {hoveredFilm.criterion && (
                              <span className="spine-inspector-badge badge-criterion">
                                CRITERION{hoveredFilm.criterionCopies > 1 ? ` ×${hoveredFilm.criterionCopies}` : ''}
                              </span>
                            )}
                            {hoveredFilm.copies > 1 && (
                              <span className="spine-inspector-badge badge-copies">×{hoveredFilm.copies} copies</span>
                            )}
                          </div>
                        </div>
                        <div className="spine-inspector-cta">
                          <span>Click case to open full details →</span>
                        </div>
                      </div>
                    ) : (
                      <div className="spine-inspector-empty">
                        <span className="spine-inspector-empty-icon">✨</span>
                        <span>Hover over any Blu-ray case below to inspect its poster and details, or click to open the film page.</span>
                      </div>
                    )}
                  </div>

                  <div className={`cinema-wood-shelf-wrapper shelf-theme-${shelfTheme}`}>
                    <div className="shelf-overhead-light" />
                    <div className="cinema-wood-shelf" style={{ '--spine-scale': shelfScale, ...(spineWidth ? { '--spine-w': `${spineWidth}px` } : {}) }} ref={shelfRef}>
                      <div className="shelf-inner-shadow" />
                      <div className="bluray-shelf" id="shelf">
                        {Array.from({ length: Math.ceil(shelfSlots.length / casesPerRow) }, (_, rowIdx) => (
                        <div className="bluray-shelf-row" key={rowIdx}>
                        {shelfSlots.slice(rowIdx * casesPerRow, (rowIdx + 1) * casesPerRow).map((slot, itemIdx) => {
                          if (slot.ghost) {
                            return <div key={`ghost-${slot.ghostIdx}`} className="bluray-case bluray-case-ghost" aria-hidden="true" />
                          }
                          const { f, copyIdx } = slot
                          // رنگ از جای خودِ فیلم میاد تا همه‌ی نسخه‌هاش یه رنگ باشن
                          const style = getSpineColor(f, shelfFilms.indexOf(f))
                          const isCriterion = f.criterion || style.type === 'criterion'
                          const is4k = style.type === '4k'
                          const isSteelbook = style.type === 'steelbook'
                          const copyCount = Math.max(1, Number(f.copies) || 1)
                          // همون رفتار BookshelfView: با هاور فقط همسایه‌های نزدیک جا باز می‌کنن
                          const isNear =
                            spineHover &&
                            spineHover.rowIdx === rowIdx &&
                            spineHover.itemIdx !== itemIdx &&
                            Math.abs(spineHover.itemIdx - itemIdx) <= SPINE_NEAR_RADIUS
                          return (
                            <div
                              key={`${f.id}-${copyIdx}`}
                              className={`bluray-case ${isCriterion ? 'criterion' : is4k ? 'four-k' : isSteelbook ? 'steelbook' : ''} ${isNear ? 'bluray-case-near' : ''}`}
                              style={{
                                backgroundColor: style.bg,
                                background: style.bg,
                                '--spine-text': style.text,
                              }}
                              onMouseEnter={() => {
                                setHoveredFilm(f)
                                setSpineHover({ rowIdx, itemIdx })
                              }}
                              onMouseLeave={() => {
                                setHoveredFilm(null)
                                setSpineHover(null)
                              }}
                              onClick={() => onSelectFilm(f)}
                              title={`${f.title} (${f.year || 'N/A'}) — Dir: ${f.director || 'Unknown'}${copyCount > 1 ? ` — copy ${copyIdx + 1}/${copyCount}` : ''}`}
                            >
                              <div className="case-glare" />

                              <div className="case-spine-view">
                                <div className="case-spine">
                                  <span className="spine-title" style={{ color: style.text || '#fff' }}>
                                    {f.title}
                                  </span>
                                </div>
                              </div>

                              <div className="case-expand-view">
                                <div className="case-expand-poster">
                                  {f.poster ? (
                                    <img src={proxyImg(f.poster)} alt="" loading="lazy" decoding="async" />
                                  ) : (
                                    <div className="case-expand-poster-fallback">🎬</div>
                                  )}
                                </div>
                                <div className="case-expand-info">
                                  <div className="case-expand-title-row">
                                    <span className="case-expand-title">{f.title}</span>
                                    {f.year && <span className="case-expand-year">{f.year}</span>}
                                  </div>
                                  <div className="case-expand-meta-row">
                                    {f.director && <span className="case-expand-director">Dir: {f.director}</span>}
                                    {(f.rating || copyCount > 1) && (
                                      <span className="case-expand-badges">
                                        {f.rating && <span>★ {Number(f.rating).toFixed(1)}</span>}
                                        {copyCount > 1 && <span>{copyIdx + 1}/{copyCount}</span>}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        </div>
                        ))}
                      </div>

                      <div className="shelf-props-layer">
                        <div className="shelf-prop prop-ticket-stub" title="Vintage Cinema Ticket" />
                        <div className="shelf-prop prop-notebook" title="Aide-Mémoire">
                          <span>Aide-Mémoire</span>
                        </div>
                        <div className="shelf-prop prop-clapperboard" title="Scene 2 Clapperboard">
                          <div className="clapper-top" />
                          <div className="clapper-number">2</div>
                        </div>
                        <div className="shelf-prop prop-receipts" title="Movie Receipt Stubs" />
                      </div>
                    </div>
                    <div className="cinema-wood-ledge" />
                  </div>
                </>
              ) : (
                <ul className="shelf-film-list">
                  {shelfFilms.map((f) => (
                    <li key={f.id} className="shelf-film-item">
                      <button className="location-title-row" onClick={() => onSelectFilm(f)}>
                        <span className="location-title-icon">
                          {f.itemType === 'series' ? <IconBookshelf width={13} height={13} /> : <IconFilm width={13} height={13} />}
                        </span>
                        <span className="location-title-main">
                          <span className="location-title-line1">
                            <span className="location-title-text">{f.title}</span>
                            {f.year && <span className="location-title-year">{f.year}</span>}
                          </span>
                          {f.director && <span className="location-title-director">{f.director}</span>}
                        </span>
                        <span className="location-title-loc">C{f.closet || '–'} R{f.row || '–'} S{f.shelf || '–'}</span>
                        {f.criterion && (
                          <span className="criterion-badge criterion-badge-list">
                            CRITERION{f.criterionCopies > 1 ? ` ×${f.criterionCopies}` : ''}
                          </span>
                        )}
                        {f.copies > 1 && <span className="copies-badge">×{f.copies}</span>}
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          className="shelf-remove-btn"
                          onClick={() => removeFromLocation(f)}
                          disabled={removingId === f.id}
                          title="Remove from this location (moves to unassigned)"
                        >
                          {removingId === f.id ? '…' : '✕'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          </div>

          <div className="film-selector">
            <div className="film-selector-head">
              <div className="film-selector-title">
                <h3>
                  Available Inventory ({countCopies(filteredFilms)} copies
                  <span className="inventory-title-count"> · {filteredFilms.length} titles</span>)
                </h3>
                <span className="film-selector-sub">
                  Select unassigned films from inventory, then pick a Closet / Row / Section above to assign them.
                  {hideShelved
                    ? ` Showing only unassigned films (${shelvedCount} shelved copies hidden).`
                    : targetExcludedCount > 0
                    ? ` Films already in ${targetLabel} are hidden.`
                    : ''}
                </span>
              </div>
              <div className="film-selector-controls">
                <label className="film-selector-toggle">
                  <input
                    type="checkbox"
                    checked={hideShelved}
                    onChange={(e) => {
                      setHideShelved(e.target.checked)
                      setSelectedIds(new Set())
                    }}
                  />
                  <span>Hide already shelved ({shelvedCount} copies)</span>
                </label>
                <input
                  className="film-selector-search"
                  type="text"
                  placeholder="Search available inventory…"
                  value={filmQuery}
                  onChange={(e) => setFilmQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="film-selector-az">
              <button
                type="button"
                className={'film-selector-az-btn' + (!azLetter ? ' film-selector-az-btn-active' : '')}
                onClick={() => setAzLetter(null)}
              >
                All
              </button>
              {AZ_LETTERS.map((L) => (
                <button
                  key={L}
                  type="button"
                  className={'film-selector-az-btn' + (azLetter === L ? ' film-selector-az-btn-active' : '')}
                  onClick={() => setAzLetter(azLetter === L ? null : L)}
                >
                  {L}
                </button>
              ))}
            </div>

            <div className="film-selector-actions">
              <span className="film-selector-count">
                {selectedCount} selected {selectedCount > 0 && `(${selectedCopiesCount} ${selectedCopiesCount === 1 ? 'copy' : 'copies'})`}
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllFiltered} disabled={!filteredFilms.length}>
                Select all ({countCopies(filteredFilms)} copies)
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearSelection} disabled={!selectedCount}>
                Clear
              </button>
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm film-selector-move"
                  onClick={moveSelected}
                  disabled={!selectedCount || !hasTarget || moving || wouldExceedCapacity}
                >
                  {moving
                    ? 'Moving…'
                    : hasTarget && currentTargetCopies >= targetCapacity
                    ? `${targetLabel} is full (${currentTargetCopies}/${targetCapacity})`
                    : `Move ${selectedCount} selected (${selectedCopiesCount} ${selectedCopiesCount === 1 ? 'copy' : 'copies'}) → ${targetLabel || '…'}`}
                </button>
              )}
              {wouldExceedCapacity && (
                <span className="film-selector-capacity-error">
                  Cannot add: {selectedCopiesCount} selected, but only {Math.max(0, targetCapacity - currentTargetCopies)} spots left in {targetLabel} (cap {targetCapacity})
                </span>
              )}
              {!canEdit && hasTarget && selectedCount > 0 && (
                <span className="film-selector-login-hint">Log in to move films</span>
              )}
            </div>

            <div className="film-selector-list">
              {filteredFilms.length === 0 ? (
                <div className="status empty-state">
                  <p>
                    {hideShelved && !filmQuery.trim()
                      ? 'No unassigned films available in inventory. All physical films have been added to a location.'
                      : 'No films match your search.'}
                  </p>
                </div>
              ) : (
                filteredFilms.map((f) => {
                  const isSel = selectedIds.has(f.id)
                  return (
                    <label
                      key={f.id}
                      className={'film-selector-row' + (isSel ? ' film-selector-row-selected' : '')}
                    >
                      <input
                        type="checkbox"
                        className="film-selector-check"
                        checked={isSel}
                        onChange={() => toggleSelect(f.id)}
                      />
                      <span className="film-selector-title">
                        <span className="film-selector-title-text">{f.title}</span>
                        {f.year && <span className="film-selector-year">{f.year}</span>}
                        <span className={'copies-badge' + (f.copies > 1 ? '' : ' copies-badge-single')}>×{f.copies || 1}</span>
                      </span>
                      <span className="film-selector-loc">
                        C{f.closet || '–'} R{f.row || '–'} S{f.shelf || '–'}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
