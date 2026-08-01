import { useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import DashboardPosterCard from './DashboardPosterCard.jsx'
import { parseWatchlistCsv } from '../utils/csvImport.js'

function findInArchive(films, title) {
  const t = (title || '').trim().toLowerCase()
  if (!t) return null
  return films.find((f) => (f.title || '').trim().toLowerCase() === t) || null
}

export default function DashboardWatchlistsPanel({ films, onOpenFilm }) {
  const [lists, setLists] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [newName, setNewName] = useState('')
  const [manualTitle, setManualTitle] = useState('')
  const [status, setStatus] = useState('')
  const fileRef = useRef(null)

  const loadLists = () => {
    fetch('/api/watchlists')
      .then((r) => r.json())
      .then((data) => {
        setLists(data)
        if (!activeId && data.length) setActiveId(data[0].id)
      })
      .catch(() => setLists([]))
  }

  useEffect(() => {
    loadLists()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeList = lists?.find((l) => l.id === activeId) || null

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    const res = await fetch('/api/watchlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, items: [] }),
    })
    const created = await res.json()
    setNewName('')
    setLists((prev) => [created, ...(prev || [])])
    setActiveId(created.id)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this watchlist?')) return
    await fetch(`/api/watchlists/${id}`, { method: 'DELETE' })
    setLists((prev) => prev.filter((l) => l.id !== id))
    if (activeId === id) setActiveId(null)
  }

  const saveItems = async (id, items) => {
    await fetch(`/api/watchlists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, items } : l)))
  }

  const handleAddManual = async () => {
    const title = manualTitle.trim()
    if (!title || !activeList) return
    const nextItems = [...activeList.items, { title, year: null }]
    await saveItems(activeList.id, nextItems)
    setManualTitle('')
  }

  const handleRemoveItem = async (idx) => {
    if (!activeList) return
    const nextItems = activeList.items.filter((_, i) => i !== idx)
    await saveItems(activeList.id, nextItems)
  }

  const handleImportFromLetterboxd = async () => {
    if (!activeList) return
    const input = window.prompt('Letterboxd username, watchlist/list/reviews URL:', 'https://letterboxd.com/USERNAME/watchlist/')
    if (!input || !input.trim()) return
    setStatus('Fetching from Letterboxd…')
    try {
      const res = await fetch('/api/letterboxd-watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: input.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      const existingKeys = new Set(activeList.items.map((i) => `${i.title}|${i.year || ''}`))
      const merged = [...activeList.items]
      data.entries.forEach((e) => {
        const key = `${e.title}|${e.year || ''}`
        if (!existingKeys.has(key)) {
          existingKeys.add(key)
          merged.push(e)
        }
      })
      await saveItems(activeList.id, merged)
      setStatus(`Imported ${data.entries.length} films from ${data.source} (${merged.length - activeList.items.length} new)`)
    } catch (err) {
      setStatus(err.message)
    }
    setTimeout(() => setStatus(''), 6000)
  }

  const handleImportCsv = async (file) => {
    if (!activeList) return
    const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip'
    setStatus(isZip ? 'Opening export file…' : 'Reading file…')
    try {
      let combined = []

      if (isZip) {
        const zip = await JSZip.loadAsync(file)
        // ترتیب مهمه: reviews.csv بیشترین اطلاعات رو داره (ریتینگ + متن نقد)،
        // بعدش ratings/diary (فقط ریتینگ)، در آخر watchlist (فقط عنوان/سال) —
        // اگه یه فیلم تو چندتاشون باشه، نسخه‌ی کامل‌تر رو نگه می‌داریم.
        const filesToCheck = ['reviews.csv', 'ratings.csv', 'diary.csv', 'watchlist.csv']
        const byKey = new Map()
        for (const name of filesToCheck) {
          const entry = zip.file(name)
          if (!entry) continue
          const text = await entry.async('string')
          const parsed = parseWatchlistCsv(text)
          parsed.forEach((e) => {
            const key = `${e.title}|${e.year || ''}`
            const existing = byKey.get(key)
            if (!existing) {
              byKey.set(key, e)
            } else {
              // اطلاعات جدید رو فقط اگه چیزی که نداشتیم اضافه کنه، ادغام می‌کنیم
              byKey.set(key, {
                title: existing.title,
                year: existing.year ?? e.year,
                myRating: existing.myRating ?? e.myRating,
                reviewText: existing.reviewText ?? e.reviewText,
              })
            }
          })
        }
        combined = Array.from(byKey.values())
        if (combined.length === 0) {
          setStatus("Couldn't find watchlist.csv, ratings.csv, diary.csv, or reviews.csv inside that export")
          setTimeout(() => setStatus(''), 5000)
          return
        }
      } else {
        const text = await file.text()
        combined = parseWatchlistCsv(text)
      }

      if (!combined.length) {
        setStatus("Couldn't find any films in that file")
        setTimeout(() => setStatus(''), 4000)
        return
      }
      const existingKeys = new Set(activeList.items.map((i) => `${i.title}|${i.year || ''}`))
      const merged = [...activeList.items]
      combined.forEach((e) => {
        const key = `${e.title}|${e.year || ''}`
        if (!existingKeys.has(key)) {
          existingKeys.add(key)
          merged.push(e)
        }
      })
      await saveItems(activeList.id, merged)
      setStatus(`Imported ${combined.length} entries (${merged.length - activeList.items.length} new)`)
    } catch {
      setStatus('Import failed — is this a Letterboxd export (.zip) or watchlist/list/reviews CSV?')
    }
    setTimeout(() => setStatus(''), 5000)
  }

  const itemsWithMatch = useMemo(() => {
    if (!activeList) return []
    return activeList.items.map((item) => ({ item, archiveMovie: findInArchive(films, item.title) }))
  }, [activeList, films])

  if (lists === null) {
    return (
      <div className="oscars-panel">
        <div className="empty">Loading watchlists…</div>
      </div>
    )
  }

  return (
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro">
          Keep multiple named watchlists — paste a Letterboxd watchlist, list, or reviews URL to import it directly,
          or upload your full Letterboxd export (.zip from Settings → Import & Export → Export Your Data — reviews,
          ratings, diary and watchlist are all picked up automatically), or add films one by one. Owned films show
          their poster and open right in your archive.
        </p>
        <div className="row row-wrap oscars-filters">
          <div className="oscars-field oscars-field-search">
            <label>New watchlist name</label>
            <input
              className="input"
              placeholder="e.g. Oscar Winners To See"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="oscars-field" style={{ justifyContent: 'flex-end', display: 'flex', flexDirection: 'column' }}>
            <label>&nbsp;</label>
            <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim()}>
              + New Watchlist
            </button>
          </div>
        </div>
      </div>

      {lists.length === 0 ? (
        <div className="empty" style={{ marginTop: 20 }}>
          No watchlists yet — create one above.
        </div>
      ) : (
        <>
          <div className="dashboard-subnav" style={{ marginTop: 20 }}>
            {lists.map((l) => (
              <button key={l.id} className={activeId === l.id ? 'active' : ''} onClick={() => setActiveId(l.id)}>
                {l.name} <span style={{ opacity: 0.6 }}>({l.items.length})</span>
              </button>
            ))}
          </div>

          {activeList && (
            <section>
              <div className="row row-wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>{activeList.name}</h2>
                <div className="row" style={{ gap: 8 }}>
                  <input
                    className="input"
                    style={{ width: 220 }}
                    placeholder="Add a film title…"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddManual()}
                  />
                  <button className="btn" onClick={handleAddManual} disabled={!manualTitle.trim()}>
                    Add
                  </button>
                  <button className="btn" onClick={handleImportFromLetterboxd}>
                    Import from Letterboxd (watchlist/list/reviews)
                  </button>
                  <button className="btn" onClick={() => fileRef.current?.click()}>
                    Import CSV / Export ZIP
                  </button>
                  <button className="btn btn-ghost" onClick={() => handleDelete(activeList.id)}>
                    Delete list
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.zip"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleImportCsv(file)
                      e.target.value = ''
                    }}
                  />
                </div>
              </div>

              {status && <p className="oscars-intro">{status}</p>}

              {itemsWithMatch.length === 0 ? (
                <div className="empty">This watchlist is empty — import a CSV or add a film above.</div>
              ) : (
                <div className="grid">
                  {itemsWithMatch.map(({ item, archiveMovie }, idx) => {
                    const inArchive = !!archiveMovie
                    const subtitle = [
                      item.year || '',
                      item.myRating ? `★ ${item.myRating}` : '',
                    ]
                      .filter(Boolean)
                      .join(' — ')
                    return (
                      <div key={idx} style={{ position: 'relative' }}>
                        <DashboardPosterCard
                          title={item.title}
                          subtitle={subtitle}
                          poster={inArchive ? archiveMovie.poster : null}
                          inArchive={inArchive}
                          clickable={inArchive}
                          showMissingBadge={!inArchive}
                          onClick={() => onOpenFilm(archiveMovie)}
                        />
                        {item.reviewText && (
                          <p style={{ fontSize: 11, color: 'var(--muted)', margin: '6px 2px 0', lineHeight: 1.5 }} title={item.reviewText}>
                            {item.reviewText.slice(0, 120)}
                            {item.reviewText.length > 120 ? '…' : ''}
                          </p>
                        )}
                        <button
                          className="btn btn-sm watchlist-remove-btn"
                          onClick={() => handleRemoveItem(idx)}
                          title="Remove from this watchlist"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
