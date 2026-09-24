import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { IconClose, IconBookshelf, IconPrinter } from './icons.jsx'
import { getSpineColor, getEditionBadge, getStudioBadgeText } from '../utils/shelfDisplay.js'

function sortKey(title) {
  return String(title || '')
    .replace(/^the\s+/i, '')
    .toLowerCase()
}

// انیمیشن flex-grow با CSS transition خام هر فریم کل ردیف رو reflow می‌کنه
// (کند می‌شه وقتی صدها اسپاین تو یه ردیف باشن). Framer Motion همون مقدار رو
// با یه spring نرم‌تر می‌ده که رفتارش با کورسِر/دست طبیعی‌تره.
const shelfHoverSpring = { type: 'spring', stiffness: 190, damping: 26, mass: 0.9 }

// روی موبایل/تاچ اصلاً هاور واقعی نداریم — پس تپ اول فقط قاب رو باز می‌کنه
// (مثل هاور دسکتاپ)، تپ دوم روی همون قاب باز جزئیات رو باز می‌کنه. روی
// دستگاه‌های با ماوس/تراک‌پد، کلیک همیشه بلافاصله جزئیات رو باز می‌کنه چون
// هاور واقعی از قبل قاب رو باز کرده.
function useHasHoverInput() {
  const [hasHover, setHasHover] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const sync = () => setHasHover(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return hasHover
}

export default function BookshelfView({ films, onSelectFilm, onClose, onFilmsChanged }) {
  const [closetFilter, setClosetFilter] = useState('')
  const [shelfTheme, setShelfTheme] = useState('wood')
  const [shelfScale, setShelfScale] = useState(1)
  const [hoveredFilm, setHoveredFilm] = useState(null)
  const [hoveredKey, setHoveredKey] = useState(null)
  const hasHoverInput = useHasHoverInput()
  const reduceMotion = useReducedMotion()
  const [searchQuery, setSearchQuery] = useState('')
  const [manageOpen, setManageOpen] = useState(false)
  const [resetCloset, setResetCloset] = useState('')
  const [resetRow, setResetRow] = useState('')
  const [resetShelf, setResetShelf] = useState('')
  const [fillCloset, setFillCloset] = useState('')
  const [fillRow, setFillRow] = useState('')
  const [fillShelf, setFillShelf] = useState('')
  const [fillStartTitle, setFillStartTitle] = useState('')
  const [fillCount, setFillCount] = useState('')
  const [shelfBusy, setShelfBusy] = useState(false)
  const [shelfMessage, setShelfMessage] = useState(null)

  // ساختار واقعیِ کتابخونه: ۸ کمد، هر کمد ۱۰ ردیف. کمدهای ۱ تا ۴ هر ردیف
  // ۲ سکشن دارن، کمدهای ۵ تا ۸ هر ردیف ۳ سکشن — این ثابته و به دیتای فعلی
  // فیلم‌ها بستگی نداره (چون خیلی از این جاها هنوز خالی‌ان).
  const allClosets = ['1', '2', '3', '4', '5', '6', '7', '8']
  const allRows = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
  const shelvesForCloset = (closet) => (Number(closet) <= 4 ? ['1', '2'] : ['1', '2', '3'])

  // برای «Start from this film» — همه‌ی فیلم‌های فیزیکی (چه قفسه‌دار چه
  // نه)، به‌ترتیب الفبا. اونایی که قبلاً قفسه دارن هم تو لیست می‌مونن (فقط
  // رنگ/برچسبشون فرق می‌کنه)، چون انتخاب یکی از اونا هم به‌عنوان نقطه‌ی
  // شروع الفبایی معتبره — فقط خود اون فیلم دوباره جابه‌جا نمی‌شه.
  const physicalFilmEntries = useMemo(() => {
    const map = new Map()
    for (const f of films) {
      if (f.mediaType === 'digital' || !f.title) continue
      if (!map.has(f.title)) {
        const loc = f.closet ? `C${f.closet}${f.row ? `R${f.row}` : ''}${f.shelf ? `S${f.shelf}` : ''}` : ''
        map.set(f.title, { title: f.title, assigned: !!f.closet, loc })
      }
    }
    return Array.from(map.values()).sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title)))
  }, [films])
  const [fillStartOpen, setFillStartOpen] = useState(false)
  const fillStartMatches = useMemo(() => {
    const q = fillStartTitle.trim().toLowerCase()
    if (!q) return physicalFilmEntries
    return physicalFilmEntries.filter((e) => e.title.toLowerCase().includes(q))
  }, [fillStartTitle, physicalFilmEntries])

  const runShelfAction = async (url, payload) => {
    setShelfBusy(true)
    setShelfMessage(null)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action failed')
      if (onFilmsChanged) onFilmsChanged()
      return data
    } catch (e) {
      setShelfMessage({ type: 'error', text: e.message })
      return null
    } finally {
      setShelfBusy(false)
    }
  }

  const handleReset = async () => {
    if (!resetCloset) {
      setShelfMessage({ type: 'error', text: 'Pick a Closet at least' })
      return
    }
    const scope = resetShelf ? 'shelf' : resetRow ? 'row' : 'closet'
    const data = await runShelfAction('/api/shelf/reset', { scope, closet: resetCloset, row: resetRow, shelf: resetShelf })
    if (data) {
      const label = `C${resetCloset}${resetRow ? `R${resetRow}` : ''}${resetShelf ? `S${resetShelf}` : ''}`
      setShelfMessage({ type: 'ok', text: `Cleared ${data.cleared} film(s) from ${label}.` })
    }
  }

  const handleFill = async () => {
    if (!fillCloset || !fillRow || !fillShelf) {
      setShelfMessage({ type: 'error', text: 'Pick Closet, Row, and Shelf' })
      return
    }
    const data = await runShelfAction('/api/shelf/fill', {
      closet: fillCloset,
      row: fillRow,
      shelf: fillShelf,
      startTitle: fillStartTitle,
      count: parseInt(fillCount, 10),
    })
    if (data) {
      setShelfMessage({
        type: 'ok',
        text: `Placed ${data.assigned} title(s) (${data.slotsUsed} spine slot(s), copies included) in C${fillCloset}R${fillRow}S${fillShelf}: "${data.firstTitle}" → "${data.lastTitle}". ${data.remainingAfter} unassigned left.`,
      })
      setFillStartTitle('')
      setFillCount('')
    }
  }

  const [colorAnalysisRunning, setColorAnalysisRunning] = useState(false)
  const [colorAnalysisProgress, setColorAnalysisProgress] = useState(0)
  const [colorAnalysisStop, setColorAnalysisStop] = useState(false)

  // یه پوستر رو تو یه canvas کوچیک می‌کشه و رنگ میانگین پیکسل‌هاش رو
  // برمی‌گردونه. پوسترهایی که CORS اجازه‌ی خوندن pixel data رو نمی‌ده
  // (مثلاً بعضی از هاست‌های آمازون) canvas رو «tainted» می‌کنن — این حالت
  // رو می‌گیریم و به‌جاش رشته‌ی خالی برمی‌گردونیم تا دیگه دوباره امتحان نشه.
  const extractPosterColor = (url) =>
    new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      const done = (v) => resolve(v)
      img.onload = () => {
        try {
          const size = 8
          const canvas = document.createElement('canvas')
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, size, size)
          const { data } = ctx.getImageData(0, 0, size, size)
          let r = 0, g = 0, b = 0, n = 0
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 10) continue // پیکسل تقریباً شفاف رو حساب نکن
            r += data[i]
            g += data[i + 1]
            b += data[i + 2]
            n++
          }
          if (!n) return done('')
          r = Math.round(r / n)
          g = Math.round(g / n)
          b = Math.round(b / n)
          done(`#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`)
        } catch {
          done('') // canvas tainted (CORS) — بی‌خیال این یکی
        }
      }
      img.onerror = () => done('')
      img.src = url
      // یه سقف زمانی برای هر عکس، وگرنه یه لینک مرده کل حلقه رو معطل می‌کنه
      setTimeout(() => done(''), 8000)
    })

  const runColorAnalysis = async () => {
    setColorAnalysisRunning(true)
    setColorAnalysisStop(false)
    setColorAnalysisProgress(0)
    let total = 0
    try {
      while (true) {
        if (colorAnalysisStop) break
        const res = await fetch('/api/films/poster-color-batch?limit=40')
        const batch = await res.json()
        if (!Array.isArray(batch) || !batch.length) break
        const colors = []
        for (const f of batch) {
          const color = await extractPosterColor(f.poster)
          colors.push({ id: f.id, color })
        }
        await fetch('/api/films/poster-color-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ colors }),
        })
        total += batch.length
        setColorAnalysisProgress(total)
      }
      setShelfMessage({ type: 'ok', text: `Poster color analysis done — processed ${total} film(s).` })
      if (onFilmsChanged) onFilmsChanged()
    } catch (e) {
      setShelfMessage({ type: 'error', text: `Poster color analysis stopped: ${e.message}` })
    } finally {
      setColorAnalysisRunning(false)
    }
  }

  const physicalFilms = useMemo(() => {
    return films
      .filter((f) => f.mediaType !== 'digital')
      .slice()
      .sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title)))
  }, [films])

  // بعد از انتخاب یه فیلم به‌عنوان نقطه‌ی شروع، هدف سرچ دیدن خود فیلم
  // نیست — می‌خوایم ببینیم پر کردن از کجا ادامه پیدا می‌کنه. برای همین چند
  // تا فیلمِ بی‌قفسه‌ی بعدی (به‌ترتیب الفبا، از همون نقطه) رو نشون می‌دیم.
  const fillContinuation = useMemo(() => {
    const q = fillStartTitle.trim()
    if (!q) return []
    const unassigned = physicalFilms.filter((f) => !f.closet)
    const startKey = sortKey(q)
    const startIdx = unassigned.findIndex((f) => sortKey(f.title).localeCompare(startKey) >= 0)
    if (startIdx === -1) return []
    const seen = new Set()
    const out = []
    for (let i = startIdx; i < unassigned.length && out.length < 8; i++) {
      if (seen.has(unassigned[i].title)) continue
      seen.add(unassigned[i].title)
      out.push(unassigned[i].title)
    }
    return out
  }, [fillStartTitle, physicalFilms])

  const closets = useMemo(() => {
    const set = new Set()
    for (const f of physicalFilms) {
      if (f.closet) set.add(String(f.closet))
    }
    return Array.from(set).sort((a, b) => Number(a) - Number(b))
  }, [physicalFilms])

  const filteredFilms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let base = physicalFilms
    if (closetFilter) {
      base = base.filter((f) => String(f.closet || '') === closetFilter)
    }
    if (!q) return base
    return base.filter(
      (f) =>
        String(f.title || '').toLowerCase().includes(q) ||
        String(f.director || '').toLowerCase().includes(q) ||
        String(f.year || '').includes(q)
    )
  }, [physicalFilms, closetFilter, searchQuery])

  const shelfSections = useMemo(() => {
    const map = {}
    for (const f of filteredFilms) {
      const c = String(f.closet || 'Unassigned')
      const r = c === 'Unassigned' ? '1' : String(f.row || '1')
      const s = c === 'Unassigned' ? '1' : String(f.shelf || '1')
      const key = c === 'Unassigned' ? 'Unassigned' : `${c}|${r}|${s}`
      if (!map[key]) {
        map[key] = {
          closet: c,
          row: r,
          shelf: s,
          label: c === 'Unassigned' ? 'Unassigned Shelf' : `Closet ${c} · Row ${r} · Section ${s}`,
          films: [],
        }
      }
      map[key].films.push(f)
    }
    return Object.values(map)
  }, [filteredFilms])

  const totalCopies = useMemo(
    () => filteredFilms.reduce((sum, f) => sum + (Number(f.copies) || 1), 0),
    [filteredFilms]
  )

  return (
    <div className="modal-overlay" style={{ zIndex: 40 }} onClick={onClose}>
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
                <IconBookshelf width={20} height={20} /> 3D Physical Bookshelf
              </h2>
              <p className="export-sub" style={{ margin: '4px 0 0' }}>
                {filteredFilms.length} titles · {totalCopies} copies · Pure exhibition view without edit buttons
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className={manageOpen ? 'location-chip location-chip-active' : 'location-chip'}
              onClick={() => setManageOpen((v) => !v)}
              title="Manage shelves: reset or auto-fill alphabetically"
            >
              Manage Shelves
            </button>
            <button className="modal-close cine-close" onClick={onClose} aria-label="Close">
              <IconClose width={16} height={16} />
            </button>
          </div>
        </header>

        {manageOpen && (
          <div
            style={{
              margin: '0 28px 16px',
              padding: '16px',
              background: 'var(--surface-2, #212227)',
              border: '1px solid var(--border-strong, #3a3b42)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {shelfMessage && (
              <div style={{ fontSize: '13px', color: shelfMessage.type === 'error' ? '#d97066' : '#4caf50' }}>
                {shelfMessage.text}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <strong style={{ fontSize: '13px', minWidth: '90px' }}>Reset</strong>
              <select
                value={resetCloset}
                onChange={(e) => {
                  setResetCloset(e.target.value)
                  setResetRow('')
                  setResetShelf('')
                }}
                style={{ width: '80px', height: '34px', borderRadius: '8px' }}
              >
                <option value="">Closet</option>
                {allClosets.map((c) => (
                  <option key={c} value={c}>C{c}</option>
                ))}
              </select>
              <select
                value={resetRow}
                onChange={(e) => {
                  setResetRow(e.target.value)
                  setResetShelf('')
                }}
                disabled={!resetCloset}
                style={{ width: '95px', height: '34px', borderRadius: '8px' }}
              >
                <option value="">Row (opt.)</option>
                {allRows.map((r) => (
                  <option key={r} value={r}>R{r}</option>
                ))}
              </select>
              <select
                value={resetShelf}
                onChange={(e) => setResetShelf(e.target.value)}
                disabled={!resetCloset || !resetRow}
                style={{ width: '100px', height: '34px', borderRadius: '8px' }}
              >
                <option value="">Shelf (opt.)</option>
                {resetCloset && shelvesForCloset(resetCloset).map((s) => (
                  <option key={s} value={s}>S{s}</option>
                ))}
              </select>
              <span style={{ fontSize: '12px', opacity: 0.65 }}>Closet only = whole closet · +Row = whole row · +Shelf = one section</span>
              <button type="button" className="location-chip" disabled={shelfBusy} onClick={handleReset}>
                Reset
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <strong style={{ fontSize: '13px', minWidth: '90px' }}>Auto-fill</strong>
              <select
                value={fillCloset}
                onChange={(e) => {
                  setFillCloset(e.target.value)
                  setFillRow('')
                  setFillShelf('')
                }}
                style={{ width: '80px', height: '34px', borderRadius: '8px' }}
              >
                <option value="">Closet</option>
                {allClosets.map((c) => (
                  <option key={c} value={c}>C{c}</option>
                ))}
              </select>
              <select
                value={fillRow}
                onChange={(e) => {
                  setFillRow(e.target.value)
                  setFillShelf('')
                }}
                disabled={!fillCloset}
                style={{ width: '85px', height: '34px', borderRadius: '8px' }}
              >
                <option value="">Row</option>
                {allRows.map((r) => (
                  <option key={r} value={r}>R{r}</option>
                ))}
              </select>
              <select
                value={fillShelf}
                onChange={(e) => setFillShelf(e.target.value)}
                disabled={!fillCloset || !fillRow}
                style={{ width: '85px', height: '34px', borderRadius: '8px' }}
              >
                <option value="">Shelf</option>
                {fillCloset && shelvesForCloset(fillCloset).map((s) => (
                  <option key={s} value={s}>S{s}</option>
                ))}
              </select>
              <div style={{ position: 'relative', width: '340px' }}>
                <input
                  type="text"
                  placeholder="Start from this film…"
                  value={fillStartTitle}
                  onChange={(e) => setFillStartTitle(e.target.value)}
                  onFocus={() => setFillStartOpen(true)}
                  onBlur={() => setTimeout(() => setFillStartOpen(false), 150)}
                  style={{ width: '100%', height: '34px', borderRadius: '8px' }}
                />
                {fillStartOpen && fillStartMatches.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '38px',
                      left: 0,
                      right: 0,
                      maxHeight: '260px',
                      overflowY: 'auto',
                      background: 'var(--surface-2, #212227)',
                      border: '1px solid var(--border-strong, #3a3b42)',
                      borderRadius: '8px',
                      zIndex: 20,
                    }}
                  >
                    {fillStartMatches.map((e) => (
                      <div
                        key={e.title}
                        onMouseDown={() => {
                          setFillStartTitle(e.title)
                          setFillStartOpen(false)
                        }}
                        title={e.title}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 10px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          color: e.assigned ? '#7a8a99' : '#e8edf2',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                          {e.title}
                        </span>
                        {e.assigned && (
                          <span style={{ fontSize: '11px', color: '#4C9BD6', flexShrink: 0 }}>{e.loc}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="number"
                placeholder="Count"
                min="1"
                value={fillCount}
                onChange={(e) => setFillCount(e.target.value)}
                style={{ width: '80px', height: '34px', borderRadius: '8px' }}
              />
              <button type="button" className="location-chip" disabled={shelfBusy} onClick={handleFill}>
                Fill
              </button>
            </div>
            {!fillStartOpen && fillContinuation.length > 0 && (
              <p style={{ margin: 0, fontSize: '12px', color: '#8fa0ad' }}>
                Continues with (unassigned): {fillContinuation.join(' → ')}
                {fillContinuation.length === 8 ? ' → …' : ''}
              </p>
            )}
            <p style={{ margin: 0, fontSize: '12px', opacity: 0.65 }}>
              8 closets, 10 rows each. Closets 1–4 have 2 shelves per row, closets 5–8 have 3.
              Fill only touches unassigned physical films, sorted alphabetically (leading "The" ignored). Already-shelved films are shown too (greyed, with their location) so you can see where you are — pick one just to anchor the alphabetical start point. Use the returned last title as the next section's start.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', borderTop: '1px solid var(--border, #2b2c32)', paddingTop: '12px' }}>
              <strong style={{ fontSize: '13px', minWidth: '90px' }}>Spine colors</strong>
              {!colorAnalysisRunning ? (
                <button type="button" className="location-chip" onClick={runColorAnalysis}>
                  Analyze poster colors
                </button>
              ) : (
                <>
                  <span style={{ fontSize: '13px' }}>Processing… {colorAnalysisProgress} done</span>
                  <button type="button" className="location-chip" onClick={() => setColorAnalysisStop(true)}>
                    Stop
                  </button>
                </>
              )}
              <span style={{ fontSize: '12px', opacity: 0.65 }}>
                Runs once per film (in this browser) — reads each poster's average color so spines can use it. Safe to stop and resume later; already-processed films are skipped.
              </span>
            </div>
          </div>
        )}

        <div className="location-browser-selectors">
          <div className="location-browser-selector-group" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: '10px', width: '100%' }}>
            <span className="location-browser-selector-label">Filter Closet</span>
            <div className="location-chip-list" style={{ flexWrap: 'wrap', maxHeight: 'none', overflow: 'visible' }}>
              <button
                type="button"
                className={!closetFilter ? 'location-chip location-chip-active' : 'location-chip'}
                onClick={() => setClosetFilter('')}
              >
                All Closets ({physicalFilms.length})
              </button>
              {closets.map((c) => {
                const count = physicalFilms.filter((f) => String(f.closet) === c).length
                return (
                  <button
                    key={c}
                    type="button"
                    className={closetFilter === c ? 'location-chip location-chip-active' : 'location-chip'}
                    onClick={() => setClosetFilter(c)}
                  >
                    Closet {c} ({count})
                  </button>
                )
              })}
            </div>

            <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="film-selector-search"
                placeholder="Search bookshelf…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ minWidth: '180px', height: '34px' }}
              />

              <div className="shelf-zoom-control" style={{ margin: 0 }}>
                <button
                  type="button"
                  className="shelf-zoom-btn"
                  onClick={() => setShelfScale((s) => Math.max(0.7, Number((s - 0.15).toFixed(2))))}
                  title="Zoom Out shelf cases"
                >
                  −
                </button>
                <span className="shelf-zoom-label">{Math.round(shelfScale * 100)}%</span>
                <button
                  type="button"
                  className="shelf-zoom-btn"
                  onClick={() => setShelfScale((s) => Math.min(1.45, Number((s + 0.15).toFixed(2))))}
                  title="Zoom In shelf cases"
                >
                  +
                </button>
              </div>

              <div className="shelf-theme-picker" style={{ margin: 0 }}>
                <button
                  type="button"
                  className={`shelf-theme-btn ${shelfTheme === 'wood' ? 'active' : ''}`}
                  onClick={() => setShelfTheme('wood')}
                >
                  🪵 Wood
                </button>
                <button
                  type="button"
                  className={`shelf-theme-btn ${shelfTheme === 'slate' ? 'active' : ''}`}
                  onClick={() => setShelfTheme('slate')}
                >
                  ⚙️ Slate
                </button>
                <button
                  type="button"
                  className={`shelf-theme-btn ${shelfTheme === 'cinema' ? 'active' : ''}`}
                  onClick={() => setShelfTheme('cinema')}
                >
                  🎬 Cinema
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="location-browser-body" style={{ padding: '24px 28px 40px' }}>
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
                <span>Hover over any Blu-ray case on the bookshelves below to inspect its poster and details.</span>
              </div>
            )}
          </div>

          {shelfSections.length === 0 ? (
            <div className="status empty-state">
              <p>No films found on this bookshelf.</p>
            </div>
          ) : (
            shelfSections.map((sec) => (
              <div key={`${sec.closet}-${sec.row}-${sec.shelf}`} style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>
                    {sec.label}
                  </h3>
                  <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>
                    {sec.films.length} titles ({sec.films.reduce((s, f) => s + (Number(f.copies) || 1), 0)} copies)
                  </span>
                </div>

                <div className={`cinema-wood-shelf-wrapper shelf-theme-${shelfTheme}`}>
                  <div className="shelf-overhead-light" />
                  <div className="cinema-wood-shelf" style={{ '--spine-scale': shelfScale }}>
                    <div className="shelf-inner-shadow" />
                    <div className="shelf-hover-row">
                      {sec.films.flatMap((f, idx) => {
                        const style = getSpineColor(f, idx)
                        const isCriterion = f.criterion || style.type === 'criterion'
                        const is4k = style.type === '4k'
                        const isSteelbook = style.type === 'steelbook'
                        const formatLabel = isCriterion ? 'CRITERION' : is4k ? '4K UHD' : isSteelbook ? 'STEELBOOK' : 'BLU-RAY'
                        // نسخه‌های اضافه (copies > 1) واقعاً کنار هم به‌عنوان
                        // جلدهای جدا رو قفسه می‌ذاریم — نه یه جلد با بج «×N»،
                        // چون تو یه قفسه‌ی واقعی هم چند نسخه از یه فیلم واقعاً
                        // چندتا جلد جدا هستن، نه یکی با یه برچسب.
                        const copyCount = Math.max(1, Number(f.copies) || 1)
                        return Array.from({ length: copyCount }, (_, copyIdx) => {
                          const key = `${f.id}-${copyIdx}`
                          const active = hoveredKey === key
                          return (
                            <motion.div
                              key={key}
                              className={`shelf-hover-frame ${active ? 'is-active' : ''} ${isCriterion ? 'criterion' : is4k ? 'four-k' : isSteelbook ? 'steelbook' : ''}`}
                              style={{ '--accent': style.bg, '--accent-text': style.text }}
                              animate={{ flexGrow: active ? 14 : 1 }}
                              transition={reduceMotion ? { duration: 0 } : shelfHoverSpring}
                              onMouseEnter={() => {
                                setHoveredFilm(f)
                                setHoveredKey(key)
                              }}
                              onMouseLeave={() => {
                                setHoveredFilm(null)
                                setHoveredKey(null)
                              }}
                              onClick={() => {
                                if (!hasHoverInput && hoveredKey !== key) {
                                  setHoveredFilm(f)
                                  setHoveredKey(key)
                                  return
                                }
                                onSelectFilm(f)
                              }}
                              title={`${f.title} (${f.year || 'N/A'}) — Dir: ${f.director || 'Unknown'}${copyCount > 1 ? ` — copy ${copyIdx + 1}/${copyCount}` : ''}`}
                            >
                              <span className="shelf-hover-edge" />
                              <div className="shelf-hover-rail">
                                <span className="shelf-hover-index">{String(idx + 1).padStart(2, '0')}</span>
                                <span className="shelf-hover-year">{f.year || ''}</span>
                                <span className="shelf-hover-title">{f.title}</span>
                              </div>
                              <div className="shelf-hover-photo">
                                {f.poster ? (
                                  <img src={f.poster} alt={f.title} className="shelf-hover-img" loading="lazy" />
                                ) : (
                                  <div className="shelf-hover-noimg">🎬</div>
                                )}
                                <span className="shelf-hover-gradient" />
                                <span className="shelf-hover-badge">
                                  {isCriterion ? 'C' : is4k ? '4K' : ''}
                                </span>
                                <div className="shelf-hover-label">
                                  <span className="shelf-hover-label-format">
                                    {style.badgeText || getStudioBadgeText(f.studio) || getEditionBadge(f) || formatLabel}
                                  </span>
                                  {f.director && <span className="shelf-hover-label-dir">Dir: {f.director}</span>}
                                </div>
                              </div>
                            </motion.div>
                          )
                        })
                      })}
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
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
