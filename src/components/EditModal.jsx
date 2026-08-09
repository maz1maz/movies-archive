import { useEffect, useRef, useState } from 'react'
import { IconClose, IconSave, IconSearch, IconLink } from './icons.jsx'
import StarRating from './StarRating.jsx'

function toForm(film) {
  return {
    title: film.title || '',
    originalTitle: film.originalTitle || '',
    closet: film.closet || '',
    shelf: film.shelf || '',
    row: film.row || '',
    year: film.year ?? '',
    director: film.director || '',
    producer: film.producer || '',
    cast: Array.isArray(film.cast)
      ? film.cast.map((x) => (typeof x === 'object' ? x.name : x)).join(', ')
      : film.cast || '',
    genre: Array.isArray(film.genre) ? film.genre.join(', ') : film.genre || '',
    rating: film.rating ?? '',
    runtime: film.runtime || '',
    country: film.country || '',
    studio: film.studio || '',
    rated: film.rated || film.mpaa || '',
    letterboxdRating: film.letterboxdRating ?? '',
    poster: film.poster || '',
    synopsis: film.synopsis || '',
    watched: film.watched === true,
    watchlisted: film.watchlisted === true,
    myRating: film.myRating || 0,
    criterion: film.criterion === true,
    copies: film.copies || 1,
    mediaType: film.mediaType === 'digital' ? 'digital' : 'physical',
    driveNumber: film.driveNumber || '',
    itemType: film.itemType === 'series' ? 'series' : 'movie',
    seasonsEpisodes: film.seasonsEpisodes || '',
    seasonDrives:
      Array.isArray(film.seasonDrives) && film.seasonDrives.length > 0
        ? film.seasonDrives
        : [{ seasons: '', drive: '' }],
    imdbId: film.imdbId || '',
    imdbVotes: film.imdbVotes || '',
  }
}

export default function EditModal({ film, onClose, onSave, onAutofill, onDelete, startWithLink }) {
  const isNew = !film.id
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [form, setForm] = useState(() => toForm(film))
  const [autofilling, setAutofilling] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkConflicts, setLinkConflicts] = useState(null) // [{key, label, oldVal, newVal, checked}] | null
  const linkInputRef = useRef(null)

  const FIELD_LABELS = {
    title: 'عنوان', originalTitle: 'عنوان اصلی', year: 'سال', director: 'کارگردان',
    producer: 'تهیه‌کننده', cast: 'بازیگران', genre: 'ژانر', rating: 'امتیاز IMDb',
    runtime: 'مدت زمان', country: 'کشور', studio: 'استودیو', rated: 'رده‌بندی سنی',
    letterboxdRating: 'امتیاز Letterboxd', poster: 'پوستر', synopsis: 'خلاصه داستان',
    imdbId: 'IMDb ID', imdbVotes: 'تعداد رای IMDb',
  }
  const SKIP_KEYS = ['closet', 'shelf', 'row', 'mediaType', 'driveNumber', 'itemType', 'watched', 'watchlisted', 'myRating', 'criterion', 'copies', 'seasonsEpisodes', 'seasonDrives']

  const lookupNewFilmFromImdb = async () => {
    if (!form.title.trim()) {
      setLookupError('اول عنوان فیلم رو بنویس')
      return null
    }
    const qs = new URLSearchParams({ title: form.title.trim() })
    if (form.year) qs.set('year', form.year)
    const res = await fetch(`/api/omdb-lookup?${qs.toString()}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'یافت نشد')
    return data
  }

  const lookupFromLink = async () => {
    if (!linkUrl.trim()) {
      setLookupError('لینک IMDb یا Letterboxd رو بچسبون')
      return
    }
    setLookupError('')
    setLinkLoading(true)
    try {
      const qs = new URLSearchParams({ url: linkUrl.trim() })
      const res = await fetch(`/api/link-lookup?${qs.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'یافت نشد')
      const fetched = toForm(data)
      if (isNew) {
        // فیلم جدید، فرم خالیه — همه‌چیز رو از لینک پر می‌کنیم به‌جز محل فیزیکی/نوع رسانه
        setForm((prev) => ({
          ...fetched,
          closet: prev.closet,
          shelf: prev.shelf,
          row: prev.row,
          mediaType: prev.mediaType,
          driveNumber: prev.driveNumber,
        }))
        return
      }
      // فیلم موجود — دیتای لینک نسبت به دیتای قبلی ارجحیت داره، ولی هر جا با
      // چیزی که از قبل پر بوده فرق داشت، اول نشون می‌دیم و تایید می‌گیریم.
      const conflicts = []
      const autoFillOnly = {}
      for (const key of Object.keys(fetched)) {
        if (SKIP_KEYS.includes(key)) continue
        const current = form[key]
        const incoming = fetched[key]
        const isEmpty = current === '' || current === null || current === undefined || (Array.isArray(current) && current.length === 0)
        const isIncomingEmpty = incoming === '' || incoming === null || incoming === undefined
        if (isIncomingEmpty) continue
        if (isEmpty) {
          autoFillOnly[key] = incoming
        } else if (String(current) !== String(incoming)) {
          conflicts.push({ key, label: FIELD_LABELS[key] || key, oldVal: current, newVal: incoming, checked: true })
        }
      }
      if (Object.keys(autoFillOnly).length) {
        setForm((prev) => ({ ...prev, ...autoFillOnly }))
      }
      if (conflicts.length) {
        setLinkConflicts(conflicts)
      }
    } catch (e) {
      setLookupError(e.message)
    } finally {
      setLinkLoading(false)
    }
  }

  const toggleConflict = (key) => {
    setLinkConflicts((prev) => prev.map((c) => (c.key === key ? { ...c, checked: !c.checked } : c)))
  }

  const applyLinkConflicts = () => {
    setForm((prev) => {
      const next = { ...prev }
      for (const c of linkConflicts) {
        if (c.checked) next[c.key] = c.newVal
      }
      return next
    })
    setLinkConflicts(null)
  }

  const dismissLinkConflicts = () => setLinkConflicts(null)

  useEffect(() => {
    if (startWithLink && linkInputRef.current) linkInputRef.current.focus()
  }, [startWithLink])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const set = (key) => (event) => {
    setForm((previous) => ({ ...previous, [key]: event.target.value }))
  }

  const save = () => {
    const patch = {
      title: form.title,
      originalTitle: form.originalTitle || undefined,
      closet: form.closet,
      shelf: form.shelf,
      row: form.row,
      year: form.year !== '' ? parseInt(form.year, 10) : undefined,
      director: form.director || undefined,
      producer: form.producer || undefined,
      cast: form.cast
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
      genre: form.genre
        .split(',')
        .map((genre) => genre.trim())
        .filter(Boolean),
      rating: form.rating !== '' ? parseFloat(form.rating) : undefined,
      runtime: form.runtime !== '' ? parseInt(form.runtime, 10) : undefined,
      country: form.country || undefined,
      studio: form.studio || undefined,
      rated: form.rated || undefined,
      letterboxdRating: form.letterboxdRating !== '' ? parseFloat(form.letterboxdRating) : undefined,
      poster: form.poster || undefined,
      synopsis: form.synopsis || undefined,
      watched: form.watched,
      watchlisted: form.watchlisted,
      myRating: form.myRating,
      criterion: form.criterion,
      copies: form.copies ? parseInt(form.copies, 10) : 1,
      mediaType: form.mediaType,
      driveNumber: form.mediaType === 'digital' ? form.driveNumber || undefined : undefined,
      itemType: form.itemType,
      seasonsEpisodes: form.itemType === 'series' ? form.seasonsEpisodes || undefined : undefined,
      seasonDrives:
        form.mediaType === 'digital' && form.itemType === 'series'
          ? form.seasonDrives.filter((sd) => sd.seasons.trim() || sd.drive.trim())
          : undefined,
      imdbId: form.imdbId || undefined,
      imdbVotes: form.imdbVotes || undefined,
    }
    onSave(patch)
  }

  const autofill = async () => {
    setLookupError('')
    setAutofilling(true)
    try {
      if (isNew) {
        const data = await lookupNewFilmFromImdb()
        if (data) {
          setForm((prev) => ({
            ...toForm(data),
            closet: prev.closet,
            shelf: prev.shelf,
            row: prev.row,
            title: data.title || prev.title,
          }))
        }
      } else {
        if (!onAutofill) return
        const enriched = await onAutofill()
        if (enriched) setForm(toForm(enriched))
      }
    } catch (e) {
      setLookupError(e.message)
    } finally {
      setAutofilling(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal edit-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <IconClose width={15} height={15} />
        </button>
        <h2 className="edit-title">{isNew ? 'Add Film' : 'Edit Film'}</h2>

        <div className="edit-form">
          <label className="edit-field full edit-link-field">
            <span><IconLink width={13} height={13} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }} /> {isNew ? 'Fill from IMDb / Letterboxd link' : 'Update from IMDb / Letterboxd link'}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={linkInputRef}
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), lookupFromLink())}
                placeholder="https://www.imdb.com/title/tt.../ or https://letterboxd.com/film/.../"
              />
              <button type="button" className="btn btn-ghost" onClick={lookupFromLink} disabled={linkLoading}>
                {linkLoading ? '...' : 'Fetch'}
              </button>
            </div>
          </label>

          {linkConflicts && linkConflicts.length > 0 && (
            <div className="edit-field full link-conflicts-panel">
              <span>این فیلد‌ها از قبل مقدار داشتن — دیتای لینک باهاشون فرق داره. کدوم‌ها جایگزین بشن؟</span>
              <div className="link-conflicts-list">
                {linkConflicts.map((c) => (
                  <label key={c.key} className="link-conflict-row">
                    <input type="checkbox" checked={c.checked} onChange={() => toggleConflict(c.key)} />
                    <div className="link-conflict-body">
                      <div className="link-conflict-label">{c.label}</div>
                      <div className="link-conflict-values">
                        <span className="link-conflict-old">{String(c.oldVal)}</span>
                        <span className="link-conflict-arrow">→</span>
                        <span className="link-conflict-new">{String(c.newVal)}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-primary" onClick={applyLinkConflicts}>Apply selected</button>
                <button type="button" className="btn btn-ghost" onClick={dismissLinkConflicts}>Cancel</button>
              </div>
            </div>
          )}

          <label className="edit-field full">
            <span>Title</span>
            <input value={form.title} onChange={set('title')} />
          </label>

          <label className="edit-field full">
            <span>Original Title (if different — French, Italian, etc.)</span>
            <input value={form.originalTitle} onChange={set('originalTitle')} placeholder="e.g. Il buono, il brutto, il cattivo" />
          </label>

          <label className="edit-field">
            <span>Media Type</span>
            <select
              value={form.mediaType}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, mediaType: event.target.value }))
              }
            >
              <option value="physical">Physical</option>
              <option value="digital">Digital</option>
            </select>
          </label>
          <label className="edit-field">
            <span>Content Type</span>
            <select
              value={form.itemType}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, itemType: event.target.value }))
              }
            >
              <option value="movie">Movie</option>
              <option value="series">Series</option>
            </select>
          </label>

          {form.mediaType === 'digital' && form.itemType !== 'series' ? (
            <label className="edit-field">
              <span>Drive Number</span>
              <input
                value={form.driveNumber}
                onChange={set('driveNumber')}
                placeholder="e.g. Drive 1, Drive 2"
              />
            </label>
          ) : form.mediaType === 'physical' ? (
            <>
              <label className="edit-field">
                <span>Closet</span>
                <select className="select" value={form.closet} onChange={set('closet')}>
                  <option value="">—</option>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="edit-field">
                <span>Row</span>
                <select className="select" value={form.row} onChange={set('row')}>
                  <option value="">—</option>
                  {Array.from({ length: 13 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="edit-field">
                <span>Section</span>
                <select className="select" value={form.shelf} onChange={set('shelf')}>
                  <option value="">—</option>
                  {[1, 2, 3].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {form.itemType === 'series' && (
            <label className="edit-field">
              <span>Seasons (total count)</span>
              <input
                value={form.seasonsEpisodes}
                onChange={set('seasonsEpisodes')}
                placeholder="e.g. 5"
              />
            </label>
          )}

          {form.mediaType === 'digital' && form.itemType === 'series' && (
            <div className="edit-field full seasondrives-field">
              <span>Seasons on which drive</span>
              {form.seasonDrives.map((sd, idx) => (
                <div key={idx} className="seasondrive-row">
                  <input
                    value={sd.seasons}
                    placeholder="e.g. Seasons 1-3"
                    onChange={(e) =>
                      setForm((prev) => {
                        const next = [...prev.seasonDrives]
                        next[idx] = { ...next[idx], seasons: e.target.value }
                        return { ...prev, seasonDrives: next }
                      })
                    }
                  />
                  <input
                    value={sd.drive}
                    placeholder="e.g. Drive 1"
                    onChange={(e) =>
                      setForm((prev) => {
                        const next = [...prev.seasonDrives]
                        next[idx] = { ...next[idx], drive: e.target.value }
                        return { ...prev, seasonDrives: next }
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-ghost seasondrive-remove"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        seasonDrives: prev.seasonDrives.filter((_, i) => i !== idx),
                      }))
                    }
                    aria-label="Remove row"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-ghost seasondrive-add"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    seasonDrives: [...prev.seasonDrives, { seasons: '', drive: '' }],
                  }))
                }
              >
                + Add row
              </button>
            </div>
          )}
          <label className="edit-field">
            <span>Copies owned</span>
            <input
              type="number"
              min="1"
              value={form.copies}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, copies: event.target.value }))
              }
            />
          </label>

          <label className="edit-field">
            <span>Year</span>
            <input type="number" value={form.year} onChange={set('year')} />
          </label>
          <label className="edit-field">
            <span>Rating (IMDb)</span>
            <input type="number" step="0.1" value={form.rating} onChange={set('rating')} />
          </label>
          <label className="edit-field">
            <span>My Rating</span>
            <StarRating
              value={form.myRating}
              onChange={(n) => setForm((prev) => ({ ...prev, myRating: n }))}
              size={19}
            />
          </label>

          <label className="edit-field">
            <span>Studio / Distributor</span>
            <input value={form.studio} onChange={set('studio')} placeholder="e.g. Paramount Pictures" />
          </label>
          <label className="edit-field">
            <span>Letterboxd Rating (0–5)</span>
            <input type="number" step="0.5" min="0" max="5" value={form.letterboxdRating} onChange={set('letterboxdRating')} placeholder="e.g. 4.5" />
          </label>

          <label className="edit-field">
            <span>Runtime (min)</span>
            <input type="number" value={form.runtime} onChange={set('runtime')} />
          </label>
          <label className="edit-field">
            <span>Country</span>
            <input value={form.country} onChange={set('country')} />
          </label>

          <label className="edit-field full">
            <span>Director</span>
            <input value={form.director} onChange={set('director')} />
          </label>
          <label className="edit-field full">
            <span>Producer {form.itemType === 'series' ? '(for series, often more useful than Director since it varies per episode)' : ''}</span>
            <input value={form.producer} onChange={set('producer')} />
          </label>
          <label className="edit-field full">
            <span>Cast (comma separated)</span>
            <input value={form.cast} onChange={set('cast')} />
          </label>
          <label className="edit-field full">
            <span>Genre (comma separated)</span>
            <input value={form.genre} onChange={set('genre')} />
          </label>
          <label className="edit-field full">
            <span>Poster URL</span>
            <input value={form.poster} onChange={set('poster')} />
          </label>
          <label className="edit-field">
            <span>Watch status</span>
            <select
              value={form.watched ? 'watched' : form.watchlisted ? 'watchlisted' : 'unwatched'}
              onChange={(event) => {
                const v = event.target.value
                setForm((previous) => ({
                  ...previous,
                  watched: v === 'watched',
                  watchlisted: v === 'watchlisted',
                }))
              }}
            >
              <option value="unwatched">Unwatched</option>
              <option value="watchlisted">Watchlisted</option>
              <option value="watched">Watched</option>
            </select>
          </label>
          <label className="edit-field edit-checkbox-field">
            <span>Edition</span>
            <span className="edit-checkbox-row">
              <input
                type="checkbox"
                checked={form.criterion}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, criterion: event.target.checked }))
                }
              />
              Criterion Collection
            </span>
          </label>
          <label className="edit-field full">
            <span>Synopsis</span>
            <textarea rows="3" value={form.synopsis} onChange={set('synopsis')} />
          </label>
        </div>

        <div className="edit-actions">
          <div className="edit-actions-left">
            {isNew || onAutofill ? (
              <button className="btn btn-ghost" onClick={autofill} disabled={autofilling}>
                <IconSearch width={13} height={13} />{' '}
                {autofilling
                  ? 'Auto-filling…'
                  : isNew
                  ? 'Auto-fill from IMDb'
                  : 'Auto-fill missing details'}
              </button>
            ) : <span />}
            {lookupError && <span className="edit-lookup-error">{lookupError}</span>}
            {!isNew && onDelete && (
              confirmingDelete ? (
                <span className="edit-delete-confirm">
                  <span>Delete this film permanently?</span>
                  <button className="btn btn-danger" onClick={() => onDelete(film)}>
                    Yes, delete
                  </button>
                  <button className="btn btn-ghost" onClick={() => setConfirmingDelete(false)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button className="btn btn-ghost btn-danger-text" onClick={() => setConfirmingDelete(true)}>
                  Delete film
                </button>
              )
            )}
          </div>
          <div className="edit-primary-actions">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>
              <IconSave width={14} height={14} /> {isNew ? 'Add Film' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
