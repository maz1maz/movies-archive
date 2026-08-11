import { useEffect, useMemo, useState } from 'react'
import { IconClose, IconPin, IconFilm, IconBookshelf, IconPrinter, IconDownload, IconArchive } from './icons.jsx'

const CLOSET_COUNT = 8
const ROW_COUNT = 10
const PREVIEW_TITLES = 3

// هر ردیف دو بخش (shelf = بخش) داره:
//   بخش ۱: ظرفیت ۶۰ بلوری
//   بخش ۲: ظرفیت ۶۰ بلوری
const SECTIONS = [
  { num: '1', capacity: 60, label: 'Section 1' },
  { num: '2', capacity: 60, label: 'Section 2' },
]

function countCopies(list) {
  return list.reduce((sum, f) => sum + (Number(f.copies) || 1), 0)
}

function sortKey(title) {
  return String(title || '')
    .replace(/^the\s+/i, '')
    .toLowerCase()
}

export default function LocationBrowserModal({ films, onSelectFilm, onClose, canEdit = false, onFilmsChanged }) {
  const [closet, setCloset] = useState('')
  const [row, setRow] = useState('')
  const [shelf, setShelf] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [filmQuery, setFilmQuery] = useState('')
  const [moving, setMoving] = useState(false)
  const [hideShelved, setHideShelved] = useState(true)

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
  // فقط فیلم‌هایی که مکان دارند — برای شمارش و نقشه‌ی کمد
  const physical = useMemo(
    () => physicalAll.filter((f) => f.closet || f.row || f.shelf),
    [physicalAll]
  )

  const physicalSorted = useMemo(
    () => [...physicalAll].sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title))),
    [physicalAll]
  )

  const shelvedCount = useMemo(
    () => physicalSorted.filter((f) => f.closet || f.row || f.shelf).length,
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
      base = base.filter((f) => !f.closet && !f.row && !f.shelf)
    } else if (closet && row && shelf) {
      base = base.filter((f) => !atTarget(f))
    }
    if (!q) return base
    return base.filter(
      (f) =>
        String(f.title || '').toLowerCase().includes(q) ||
        String(f.year || '').includes(q)
    )
  }, [physicalSorted, filmQuery, hideShelved, closet, row, shelf])

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
    if (!shelf) return 60
    const sec = SECTIONS.find((s) => s.num === shelf)
    return sec ? sec.capacity : 60
  }, [shelf])

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
          .sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title)))
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
  }, [closet, rows, sectionIndex])

  // فیلم‌های قفسه‌ی (بخش) انتخاب‌شده
  const shelfFilms = useMemo(() => {
    if (!closet || !row || !shelf) return []
    return (sectionIndex[`${closet}|${row}|${shelf}`] || [])
      .slice()
      .sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title)))
  }, [closet, row, shelf, sectionIndex])

  const shelfCopiesCount = useMemo(() => countCopies(shelfFilms), [shelfFilms])

  const currentSection = SECTIONS.find((s) => s.num === shelf) || null

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
        <td class="cell-title">${f.title}${f.originalTitle && f.originalTitle !== f.title ? ` <span class="cell-orig">(${f.originalTitle})</span>` : ''}</td>
        <td class="cell-nowrap">${f.year || '—'}</td>
        <td class="cell-nowrap">${f.director || '—'}</td>
        <td class="cell-nowrap">★ ${f.rating ? f.rating.toFixed(1) : '—'}</td>
        <td class="cell-nowrap">C${f.closet || '—'} R${f.row || '—'} S${f.shelf || '—'}</td>
        <td class="cell-nowrap">${f.format || 'Blu-ray'}</td>
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

  return (
    <div className="modal-overlay" onClick={onClose}>
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
                <IconPin width={18} height={18} /> Browse by Location
              </h2>
              <p className="export-sub" style={{ margin: '4px 0 0' }}>Choose a closet, row and section — the shelf will appear below</p>
            </div>
          </div>
          <button className="modal-close cine-close" onClick={onClose} aria-label="Close">
            <IconClose width={16} height={16} />
          </button>
        </header>

        <div className={`location-browser-selectors ${closet && row && shelf ? 'location-browser-selectors-collapsed' : ''}`}>
          <div className="location-browser-selector-group">
            <span className="location-browser-selector-label">Closet</span>
            <div className="location-chip-list">
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
            <div className={'location-chip-list' + (closet ? '' : ' location-chip-list-disabled')}>
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
                  <span className="cabinet-map-title">Cabinet {closet} — pick a row or section</span>
                </div>
                <span className="cabinet-map-meta">{cabinetRows.length} rows · {countFor(closet, null, null)} copies</span>
              </div>
              <div className="cabinet-map-legend">
                <span className="cabinet-map-legend-item">
                  <span className="cabinet-map-legend-swatch cabinet-map-legend-swatch-s1" /> Section 1 · cap {SECTIONS[0].capacity}
                </span>
                <span className="cabinet-map-legend-item">
                  <span className="cabinet-map-legend-swatch cabinet-map-legend-swatch-s2" /> Section 2 · cap {SECTIONS[1].capacity}
                </span>
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
                              (sec.num === '1' ? ' cabinet-section-s1' : ' cabinet-section-s2') +
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
              </div>
              <div className="shelf-pick-sections">
                {SECTIONS.map((sec) => {
                  const n = countFor(closet, row, sec.num)
                  const pct = Math.min(100, Math.round((n / sec.capacity) * 100))
                  return (
                    <button
                      key={sec.num}
                      className={'shelf-pick-card' + (sec.num === '2' ? ' shelf-pick-card-s2' : '')}
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
                  {canEdit && <div className="shelf-view-hint">Use ✕ to remove a film from this section (moves it to unassigned)</div>}
                </div>
                <div className="shelf-view-actions">
                  {shelfViewMode === 'spine' && (
                    <>
                      <div className="shelf-zoom-control">
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
                    <div className="cinema-wood-shelf" style={{ '--spine-scale': shelfScale }}>
                      <div className="shelf-inner-shadow" />
                      <div className="bluray-shelf" id="shelf">
                        {shelfFilms.map((f, idx) => {
                          const style = getSpineColor(f, idx)
                          const isCriterion = f.criterion || style.type === 'criterion'
                          const is4k = style.type === '4k'
                          const isSteelbook = style.type === 'steelbook'
                          return (
                            <div
                              key={f.id}
                              className={`bluray-case ${isCriterion ? 'criterion' : is4k ? 'four-k' : isSteelbook ? 'steelbook' : ''}`}
                              style={{
                                backgroundColor: style.bg,
                                background: style.bg,
                                '--spine-text': style.text,
                              }}
                              onMouseEnter={() => setHoveredFilm(f)}
                              onMouseLeave={() => setHoveredFilm(null)}
                              onClick={() => onSelectFilm(f)}
                              title={`${f.title} (${f.year || 'N/A'}) — Dir: ${f.director || 'Unknown'} · ${f.format || 'Blu-ray'}${f.copies > 1 ? ` ×${f.copies} copies` : ''}`}
                            >
                              <div className="case-glare" />

                              <div className="case-header">
                                {isCriterion ? 'C' : is4k ? '4K UHD' : isSteelbook ? 'STEELBOOK' : 'BLU-RAY'}
                              </div>

                              <div className="case-spine">
                                <span className="spine-title" style={{ color: style.text || '#fff' }}>
                                  {f.title}
                                  {f.copies > 1 && <span className="spine-copy-badge">×{f.copies}</span>}
                                </span>
                              </div>

                              <div className={`case-footer footer-${style.badge || 'dts'}`} style={{ color: style.text || '#aaa' }}>
                                <span>{style.badgeText || getStudioBadgeText(f.studio) || getEditionBadge(f) || 'DTS'}</span>
                                {canEdit && (
                                  <button
                                    type="button"
                                    className="spine-remove-btn"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      removeFromLocation(f)
                                    }}
                                    disabled={removingId === f.id}
                                    title="Remove from this location"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          )
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
                <h3>Available Inventory ({filteredFilms.length})</h3>
                <span className="film-selector-sub">
                  Select unassigned films from inventory, then pick a Closet / Row / Section above to assign them.
                  {hideShelved
                    ? ` Showing only unassigned films (${shelvedCount} already shelved hidden).`
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
                  <span>Hide already shelved ({shelvedCount})</span>
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

            <div className="film-selector-actions">
              <span className="film-selector-count">
                {selectedCount} selected {selectedCount > 0 && `(${selectedCopiesCount} ${selectedCopiesCount === 1 ? 'copy' : 'copies'})`}
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllFiltered} disabled={!filteredFilms.length}>
                Select all ({filteredFilms.length})
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
                  {moving ? 'Moving…' : `Move ${selectedCount} selected (${selectedCopiesCount} ${selectedCopiesCount === 1 ? 'copy' : 'copies'}) → ${targetLabel || '…'}`}
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
                        {f.copies > 1 && <span className="copies-badge">×{f.copies}</span>}
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
      </div>
    </div>
  )
}
