import { useMemo, useState, useEffect } from 'react'
import { IconClose, IconHardDrive, IconFilm, IconBookshelf } from './icons.jsx'
import { parseDriveNumbers, driveLabel, driveSortValue } from '../utils/driveDisplay.js'

function sortKey(title) {
  return String(title || '')
    .replace(/^the\s+/i, '')
    .toLowerCase()
}

// چند فیلم روی همین درایو هستن، شامل فصل‌های سریال‌هایی که فصل‌هاشون رو
// جداگونه رو هاردهای مختلف پخش کردیم (seasonDrives)
function itemsOnDrive(digitalFilms, drive) {
  return digitalFilms.filter((f) => {
    if (parseDriveNumbers(f.driveNumber).includes(drive)) return true
    if (Array.isArray(f.seasonDrives)) {
      return f.seasonDrives.some((sd) => parseDriveNumbers(sd.drive).includes(drive))
    }
    return false
  })
}

export default function DriveBrowserModal({ films, onSelectFilm, onClose, canEdit = false, onFilmsChanged }) {
  const [drive, setDrive] = useState('')
  const [newDriveInput, setNewDriveInput] = useState('')
  const [extraDrives, setExtraDrives] = useState([]) // درایوهای تازه‌ساخته که هنوز فیلمی روشون نیست
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [filmQuery, setFilmQuery] = useState('')
  const [moving, setMoving] = useState(false)
  const [hideAssigned, setHideAssigned] = useState(false)
  const [driveItemQuery, setDriveItemQuery] = useState('')
  const [driveTypeFilter, setDriveTypeFilter] = useState('all') // 'all' | 'movie' | 'series'
  const [driveSelectedIds, setDriveSelectedIds] = useState(() => new Set())
  const [moveTarget, setMoveTarget] = useState('')
  const [movingOut, setMovingOut] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const digitalFilms = useMemo(() => films.filter((f) => f.mediaType === 'digital'), [films])

  const digitalSorted = useMemo(
    () => [...digitalFilms].sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title))),
    [digitalFilms]
  )

  // لیست همه‌ی درایوهای موجود (از روی خود فیلم‌ها + درایوهای تازه‌ساخته‌ی خالی)
  const drives = useMemo(() => {
    const set = new Set(extraDrives)
    for (const f of digitalFilms) {
      parseDriveNumbers(f.driveNumber).forEach((d) => set.add(d))
      if (Array.isArray(f.seasonDrives)) {
        f.seasonDrives.forEach((sd) => parseDriveNumbers(sd.drive).forEach((d) => set.add(d)))
      }
    }
    return Array.from(set).sort((a, b) => driveSortValue(a) - driveSortValue(b) || a.localeCompare(b))
  }, [digitalFilms, extraDrives])

  const unassignedCount = useMemo(
    () => digitalFilms.filter((f) => !f.driveNumber).length,
    [digitalFilms]
  )

  const driveFilms = useMemo(() => {
    if (!drive) return []
    return itemsOnDrive(digitalSorted, drive)
  }, [digitalSorted, drive])

  const driveFilmsFiltered = useMemo(() => {
    const q = driveItemQuery.trim().toLowerCase()
    if (!q) return driveFilms
    return driveFilms.filter(
      (f) => String(f.title || '').toLowerCase().includes(q) || String(f.year || '').includes(q)
    )
  }, [driveFilms, driveItemQuery])

  const driveMovies = useMemo(
    () => (driveTypeFilter === 'series' ? [] : driveFilmsFiltered.filter((f) => f.itemType !== 'series')),
    [driveFilmsFiltered, driveTypeFilter]
  )
  const driveSeries = useMemo(
    () => (driveTypeFilter === 'movie' ? [] : driveFilmsFiltered.filter((f) => f.itemType === 'series')),
    [driveFilmsFiltered, driveTypeFilter]
  )

  useEffect(() => {
    setDriveSelectedIds(new Set())
    setDriveItemQuery('')
    setDriveTypeFilter('all')
    setMoveTarget('')
  }, [drive])

  const driveSelectedCount = driveSelectedIds.size
  const toggleDriveSelect = (id) => {
    setDriveSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAllDriveFiltered = () => setDriveSelectedIds(new Set(driveFilmsFiltered.map((f) => f.id)))
  const clearDriveSelection = () => setDriveSelectedIds(new Set())

  const moveDriveSelected = async () => {
    if (!moveTarget || !driveSelectedCount || movingOut) return
    setMovingOut(true)
    try {
      const res = await fetch('/api/films/bulk-set-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(driveSelectedIds), driveNumber: moveTarget }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'move failed')
      setDriveSelectedIds(new Set())
      setMoveTarget('')
      if (onFilmsChanged) onFilmsChanged()
    } catch (e) {
      console.error(e)
      alert(e.message)
    } finally {
      setMovingOut(false)
    }
  }

  const addDrive = () => {
    const name = newDriveInput.trim()
    if (!name) return
    setExtraDrives((prev) => (prev.includes(name) ? prev : [...prev, name]))
    setNewDriveInput('')
    setDrive(name)
  }

  const filteredAvailable = useMemo(() => {
    const q = filmQuery.trim().toLowerCase()
    let base = digitalSorted
    if (hideAssigned) base = base.filter((f) => !f.driveNumber)
    if (drive) base = base.filter((f) => !parseDriveNumbers(f.driveNumber).includes(drive))
    if (!q) return base
    return base.filter(
      (f) => String(f.title || '').toLowerCase().includes(q) || String(f.year || '').includes(q)
    )
  }, [digitalSorted, filmQuery, hideAssigned, drive])

  const selectedCount = selectedIds.size
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAllFiltered = () => setSelectedIds(new Set(filteredAvailable.map((f) => f.id)))
  const clearSelection = () => setSelectedIds(new Set())

  const moveSelected = async () => {
    if (!drive || !selectedCount || moving) return
    setMoving(true)
    try {
      const res = await fetch('/api/films/bulk-set-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), driveNumber: drive }),
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

  return (
    <div className="modal-overlay drive-browser-glass-overlay" onClick={onClose}>
      <div className="location-browser drive-browser-glass" onClick={(e) => e.stopPropagation()}>
        <header
          className="location-browser-head"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {drive ? (
              <button type="button" className="shelf-back-btn" onClick={() => setDrive('')} title="Back to all drives" style={{ fontSize: '13px', padding: '6px 12px' }}>
                ← All Drives
              </button>
            ) : (
              <button type="button" className="shelf-back-btn" onClick={onClose} title="Back to Posters / Library" style={{ fontSize: '13px', padding: '6px 12px' }}>
                ← Back to Posters
              </button>
            )}
            <div className="location-browser-title">
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconHardDrive width={18} height={18} /> {drive ? driveLabel(drive) : 'Browse by Drive'}
              </h2>
              <p className="export-sub" style={{ margin: '4px 0 0' }}>
                {drive
                  ? `${driveFilms.length} item${driveFilms.length === 1 ? '' : 's'} on this drive`
                  : 'Pick a hard drive to see what’s on it — or move digital items to a new one'}
              </p>
            </div>
          </div>
          <button className="modal-close cine-close" onClick={onClose} aria-label="Close">
            <IconClose width={16} height={16} />
          </button>
        </header>

        <div className="location-browser-body">
          <div className="location-browser-top">
            {!drive && (
              <div className="closet-grid-wrap">
                <div className="closet-grid">
                  {drives.map((d) => {
                    const n = itemsOnDrive(digitalFilms, d).length
                    return (
                      <button key={d} className="closet-card" onClick={() => setDrive(d)}>
                        <span className="closet-card-idx">{driveLabel(d)}</span>
                        <span className="closet-card-count">
                          {n} item{n === 1 ? '' : 's'}
                        </span>
                      </button>
                    )
                  })}
                  {unassignedCount > 0 && (
                    <div
                      key="__unassigned"
                      className="closet-card"
                      style={{ cursor: 'default', opacity: 0.75 }}
                      title="Digital items with no drive set yet — use “Only show unassigned” below to find and assign them"
                    >
                      <span className="closet-card-idx" style={{ fontSize: '16px' }}>
                        Unassigned
                      </span>
                      <span className="closet-card-count">{unassignedCount} items</span>
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
                    <input
                      type="text"
                      className="film-selector-search"
                      placeholder="New drive name (e.g. HDD-13)…"
                      value={newDriveInput}
                      onChange={(e) => setNewDriveInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addDrive()}
                      style={{ maxWidth: '260px' }}
                    />
                    <button type="button" className="btn btn-primary btn-sm" onClick={addDrive} disabled={!newDriveInput.trim()}>
                      + Add Drive
                    </button>
                  </div>
                )}
              </div>
            )}

            {drive && (
              <div className="shelf-view">
                {driveFilms.length === 0 ? (
                  <div className="status empty-state">
                    <span className="empty-icon">
                      <IconHardDrive width={22} height={22} />
                    </span>
                    <p>Nothing on this drive yet. Move available items from inventory below.</p>
                  </div>
                ) : (
                  <>
                    <div className="shelf-toolbar">
                      <input
                        className="film-selector-search"
                        type="text"
                        placeholder={`Search on ${driveLabel(drive)}…`}
                        value={driveItemQuery}
                        onChange={(e) => setDriveItemQuery(e.target.value)}
                      />
                      <div className="shelf-type-filter">
                        <button type="button" className={'btn btn-ghost btn-sm' + (driveTypeFilter === 'all' ? ' active' : '')} onClick={() => setDriveTypeFilter('all')}>All</button>
                        <button type="button" className={'btn btn-ghost btn-sm' + (driveTypeFilter === 'movie' ? ' active' : '')} onClick={() => setDriveTypeFilter('movie')}>Movies</button>
                        <button type="button" className={'btn btn-ghost btn-sm' + (driveTypeFilter === 'series' ? ' active' : '')} onClick={() => setDriveTypeFilter('series')}>Series</button>
                      </div>
                      {canEdit && (
                        <div className="shelf-move-bar">
                          <span className="film-selector-count">{driveSelectedCount} selected</span>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllDriveFiltered} disabled={!driveFilmsFiltered.length}>
                            Select all ({driveFilmsFiltered.length})
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={clearDriveSelection} disabled={!driveSelectedCount}>
                            Clear
                          </button>
                          <select
                            className="film-selector-search"
                            value={moveTarget}
                            onChange={(e) => setMoveTarget(e.target.value)}
                            disabled={!driveSelectedCount}
                          >
                            <option value="">Move to drive…</option>
                            {drives.filter((d) => d !== drive).map((d) => (
                              <option key={d} value={d}>{driveLabel(d)}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={moveDriveSelected}
                            disabled={!driveSelectedCount || !moveTarget || movingOut}
                          >
                            {movingOut ? 'Moving…' : 'Move'}
                          </button>
                        </div>
                      )}
                    </div>
                    {driveFilmsFiltered.length === 0 ? (
                      <div className="status empty-state">
                        <p>No items match.</p>
                      </div>
                    ) : (
                  <div className="shelf-columns">
                    {driveMovies.length > 0 && (
                      <div className="shelf-column">
                        <h4 className="shelf-group-heading">Movies ({driveMovies.length})</h4>
                        <ul className="shelf-film-list">
                          {driveMovies.map((f) => (
                            <li key={f.id} className="shelf-film-item">
                              {canEdit && (
                                <input
                                  type="checkbox"
                                  className="film-selector-check"
                                  checked={driveSelectedIds.has(f.id)}
                                  onChange={() => toggleDriveSelect(f.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                              <button className="location-title-row" onClick={() => onSelectFilm(f)}>
                                <span className="location-title-icon">
                                  <IconFilm width={13} height={13} />
                                </span>
                                <span className="location-title-main">
                                  <span className="location-title-line1">
                                    <span className="location-title-text">{f.title}</span>
                                    {f.year && <span className="location-title-year">{f.year}</span>}
                                  </span>
                                  {f.director && <span className="location-title-director">{f.director}</span>}
                                </span>
                                <span className="location-title-loc">
                                  {parseDriveNumbers(f.driveNumber).includes(drive)
                                    ? f.driveNumber && f.driveNumber !== drive
                                      ? driveLabel(f.driveNumber)
                                      : driveLabel(drive)
                                    : 'Season split across drives'}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {driveSeries.length > 0 && (
                      <div className="shelf-column">
                        <h4 className="shelf-group-heading">Series ({driveSeries.length})</h4>
                        <ul className="shelf-film-list">
                          {driveSeries.map((f) => (
                            <li key={f.id} className="shelf-film-item">
                              {canEdit && (
                                <input
                                  type="checkbox"
                                  className="film-selector-check"
                                  checked={driveSelectedIds.has(f.id)}
                                  onChange={() => toggleDriveSelect(f.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                              <button className="location-title-row" onClick={() => onSelectFilm(f)}>
                                <span className="location-title-icon">
                                  <IconBookshelf width={13} height={13} />
                                </span>
                                <span className="location-title-main">
                                  <span className="location-title-line1">
                                    <span className="location-title-text">{f.title}</span>
                                    {f.year && <span className="location-title-year">{f.year}</span>}
                                  </span>
                                  {f.director && <span className="location-title-director">{f.director}</span>}
                                </span>
                                <span className="location-title-loc">
                                  {parseDriveNumbers(f.driveNumber).includes(drive)
                                    ? f.driveNumber && f.driveNumber !== drive
                                      ? driveLabel(f.driveNumber)
                                      : driveLabel(drive)
                                    : 'Season split across drives'}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {canEdit && (
            <div className="film-selector">
              <div className="film-selector-head">
                <div className="film-selector-title">
                  <h3>Available Digital Items ({filteredAvailable.length})</h3>
                  <span className="film-selector-sub">
                    {drive
                      ? `Select items to move onto ${driveLabel(drive)}.`
                      : 'Pick a drive above (or add a new one), then select items below to move onto it.'}
                  </span>
                </div>
                <div className="film-selector-controls">
                  <label className="film-selector-toggle">
                    <input type="checkbox" checked={hideAssigned} onChange={(e) => { setHideAssigned(e.target.checked); setSelectedIds(new Set()) }} />
                    <span>Only show unassigned ({unassignedCount})</span>
                  </label>
                  <input
                    className="film-selector-search"
                    type="text"
                    placeholder="Search digital items…"
                    value={filmQuery}
                    onChange={(e) => setFilmQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="film-selector-actions">
                <span className="film-selector-count">{selectedCount} selected</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllFiltered} disabled={!filteredAvailable.length}>
                  Select all ({filteredAvailable.length})
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearSelection} disabled={!selectedCount}>
                  Clear
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm film-selector-move"
                  onClick={moveSelected}
                  disabled={!selectedCount || !drive || moving}
                >
                  {moving ? 'Moving…' : `Move ${selectedCount} selected → ${drive || '…'}`}
                </button>
              </div>

              <div className="film-selector-list">
                {filteredAvailable.length === 0 ? (
                  <div className="status empty-state">
                    <p>No digital items match.</p>
                  </div>
                ) : (
                  filteredAvailable.map((f) => {
                    const isSel = selectedIds.has(f.id)
                    return (
                      <label key={f.id} className={'film-selector-row' + (isSel ? ' film-selector-row-selected' : '')}>
                        <input type="checkbox" className="film-selector-check" checked={isSel} onChange={() => toggleSelect(f.id)} />
                        <span className="film-selector-title">
                          <span className="film-selector-title-text">{f.title}</span>
                          {f.year && <span className="film-selector-year">{f.year}</span>}
                        </span>
                        <span className="film-selector-loc">{f.driveNumber ? driveLabel(f.driveNumber) : 'Unassigned'}</span>
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
