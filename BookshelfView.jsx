import { useMemo, useState } from 'react'
import { IconClose, IconBookshelf, IconPrinter } from './icons.jsx'
import { getSpineColor, getEditionBadge, getStudioBadgeText } from '../utils/shelfDisplay.js'

function sortKey(title) {
  return String(title || '')
    .replace(/^the\s+/i, '')
    .toLowerCase()
}

export default function BookshelfView({ films, onSelectFilm, onClose, onFilmsChanged }) {
  const [closetFilter, setClosetFilter] = useState('')
  const [shelfTheme, setShelfTheme] = useState('wood')
  const [shelfScale, setShelfScale] = useState(1)
  const [hoveredFilm, setHoveredFilm] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [manageOpen, setManageOpen] = useState(false)
  const [resetForm, setResetForm] = useState({ scope: 'shelf', closet: '1', row: '', shelf: '' })
  const [fillForm, setFillForm] = useState({ closet: '1', row: '', shelf: '', startTitle: '', count: '' })
  const [shelfBusy, setShelfBusy] = useState(false)
  const [shelfMessage, setShelfMessage] = useState(null)

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
      if (!res.ok) throw new Error(data.error || 'عملیات ناموفق بود')
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
    const data = await runShelfAction('/api/shelf/reset', resetForm)
    if (data) setShelfMessage({ type: 'ok', text: `${data.cleared} فیلم از قفسه خارج شد.` })
  }

  const handleFill = async () => {
    const data = await runShelfAction('/api/shelf/fill', {
      ...fillForm,
      count: parseInt(fillForm.count, 10),
    })
    if (data) {
      setShelfMessage({
        type: 'ok',
        text: `${data.assigned} فیلم جا گرفت: از «${data.firstTitle}» تا «${data.lastTitle}». ${data.remainingAfter} فیلم بی‌قفسه‌ی دیگه باقی مونده.`,
      })
      setFillForm((f) => ({ ...f, startTitle: '', count: '' }))
    }
  }

  const physicalFilms = useMemo(() => {
    return films
      .filter((f) => f.mediaType !== 'digital')
      .slice()
      .sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title)))
  }, [films])

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
      const r = String(f.row || '1')
      const s = String(f.shelf || '1')
      const key = `${c}|${r}|${s}`
      if (!map[key]) {
        map[key] = {
          closet: c,
          row: r,
          shelf: s,
          label: c === 'Unassigned' ? 'Unassigned Shelf' : `Cabinet ${c} · Row ${r} · Section ${s}`,
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
              className="location-chip"
              onClick={() => setManageOpen((v) => !v)}
              title="مدیریت قفسه‌ها: ریست یا پرکردن الفبایی"
            >
              🛠 مدیریت قفسه‌ها
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
              gap: '16px',
            }}
          >
            {shelfMessage && (
              <div style={{ fontSize: '13px', color: shelfMessage.type === 'error' ? '#d97066' : '#4caf50' }}>
                {shelfMessage.text}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
              <strong style={{ fontSize: '13px', minWidth: '140px' }}>Reset (خالی کردن)</strong>
              <select
                value={resetForm.scope}
                onChange={(e) => setResetForm((f) => ({ ...f, scope: e.target.value }))}
                style={{ height: '34px', borderRadius: '8px' }}
              >
                <option value="shelf">یه Shelf (سکشن)</option>
                <option value="row">یه کل Row (ردیف)</option>
                <option value="closet">یه کل Closet (کابینت)</option>
              </select>
              <input
                type="text"
                placeholder="Closet"
                value={resetForm.closet}
                onChange={(e) => setResetForm((f) => ({ ...f, closet: e.target.value }))}
                style={{ width: '80px', height: '34px', borderRadius: '8px' }}
              />
              {resetForm.scope !== 'closet' && (
                <input
                  type="text"
                  placeholder="Row"
                  value={resetForm.row}
                  onChange={(e) => setResetForm((f) => ({ ...f, row: e.target.value }))}
                  style={{ width: '80px', height: '34px', borderRadius: '8px' }}
                />
              )}
              {resetForm.scope === 'shelf' && (
                <input
                  type="text"
                  placeholder="Shelf"
                  value={resetForm.shelf}
                  onChange={(e) => setResetForm((f) => ({ ...f, shelf: e.target.value }))}
                  style={{ width: '80px', height: '34px', borderRadius: '8px' }}
                />
              )}
              <button type="button" className="shelf-back-btn" disabled={shelfBusy} onClick={handleReset} style={{ height: '34px' }}>
                Reset
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
              <strong style={{ fontSize: '13px', minWidth: '140px' }}>پرکردن الفبایی</strong>
              <input
                type="text"
                placeholder="Closet"
                value={fillForm.closet}
                onChange={(e) => setFillForm((f) => ({ ...f, closet: e.target.value }))}
                style={{ width: '70px', height: '34px', borderRadius: '8px' }}
              />
              <input
                type="text"
                placeholder="Row"
                value={fillForm.row}
                onChange={(e) => setFillForm((f) => ({ ...f, row: e.target.value }))}
                style={{ width: '70px', height: '34px', borderRadius: '8px' }}
              />
              <input
                type="text"
                placeholder="Shelf"
                value={fillForm.shelf}
                onChange={(e) => setFillForm((f) => ({ ...f, shelf: e.target.value }))}
                style={{ width: '70px', height: '34px', borderRadius: '8px' }}
              />
              <input
                type="text"
                placeholder="از این فیلم شروع کن…"
                value={fillForm.startTitle}
                onChange={(e) => setFillForm((f) => ({ ...f, startTitle: e.target.value }))}
                style={{ width: '220px', height: '34px', borderRadius: '8px' }}
              />
              <input
                type="number"
                placeholder="تعداد"
                min="1"
                value={fillForm.count}
                onChange={(e) => setFillForm((f) => ({ ...f, count: e.target.value }))}
                style={{ width: '90px', height: '34px', borderRadius: '8px' }}
              />
              <button type="button" className="shelf-back-btn" disabled={shelfBusy} onClick={handleFill} style={{ height: '34px' }}>
                پر کن
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '12px', opacity: 0.7 }}>
              پرکردن فقط روی فیلم‌های فیزیکیِ بی‌قفسه (بدون closet/row/shelf) کار می‌کنه، به ترتیب الفبا (حرف «The» تو سورت تاثیر نداره). دفعه‌ی بعد که می‌خوای سکشن بعدی رو پر کنی، «از این فیلم شروع کن» رو با اولین فیلمی که این‌بار جا نشده پر کن.
            </p>
          </div>
        )}

        <div className="location-browser-selectors">
          <div className="location-browser-selector-group" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: '10px', width: '100%' }}>
            <span className="location-browser-selector-label">Filter Cabinet</span>
            <div className="location-chip-list" style={{ flexWrap: 'wrap', maxHeight: 'none', overflow: 'visible' }}>
              <button
                type="button"
                className={!closetFilter ? 'location-chip location-chip-active' : 'location-chip'}
                onClick={() => setClosetFilter('')}
              >
                All Cabinets ({physicalFilms.length})
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
                    Cabinet {c} ({count})
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
                    <div className="bluray-shelf">
                      {sec.films.flatMap((f, idx) => {
                        const style = getSpineColor(f, idx)
                        const isCriterion = f.criterion || style.type === 'criterion'
                        const is4k = style.type === '4k'
                        const isSteelbook = style.type === 'steelbook'
                        // نسخه‌های اضافه (copies > 1) واقعاً کنار هم به‌عنوان
                        // جلدهای جدا رو قفسه می‌ذاریم — نه یه جلد با بج «×N»،
                        // چون تو یه قفسه‌ی واقعی هم چند نسخه از یه فیلم واقعاً
                        // چندتا جلد جدا هستن، نه یکی با یه برچسب.
                        const copyCount = Math.max(1, Number(f.copies) || 1)
                        return Array.from({ length: copyCount }, (_, copyIdx) => (
                          <div
                            key={`${f.id}-${copyIdx}`}
                            className={`bluray-case ${isCriterion ? 'criterion' : is4k ? 'four-k' : isSteelbook ? 'steelbook' : ''}`}
                            style={{
                              backgroundColor: style.bg,
                              background: style.bg,
                              '--spine-text': style.text,
                            }}
                            onMouseEnter={() => setHoveredFilm(f)}
                            onMouseLeave={() => setHoveredFilm(null)}
                            onClick={() => onSelectFilm(f)}
                            title={`${f.title} (${f.year || 'N/A'}) — Dir: ${f.director || 'Unknown'}${copyCount > 1 ? ` — copy ${copyIdx + 1}/${copyCount}` : ''}`}
                          >
                            <div className="case-glare" />

                            <div className="case-header">
                              {isCriterion ? 'C' : is4k ? '4K UHD' : isSteelbook ? 'STEELBOOK' : 'BLU-RAY'}
                            </div>

                            <div className="case-spine">
                              <span className="spine-title" style={{ color: style.text || '#fff' }}>
                                {f.title}
                              </span>
                            </div>

                            <div className={`case-footer footer-${style.badge || 'dts'}`} style={{ color: style.text || '#aaa' }}>
                              <span>{style.badgeText || getStudioBadgeText(f.studio) || getEditionBadge(f) || 'DTS'}</span>
                            </div>
                          </div>
                        ))
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
