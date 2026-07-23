import { useEffect, useState } from 'react'
import { IconClose, IconSave, IconSearch } from './icons.jsx'
import StarRating from './StarRating.jsx'

function toForm(film) {
  return {
    title: film.title || '',
    shelf: film.shelf || '',
    row: film.row || '',
    year: film.year ?? '',
    director: film.director || '',
    cast: Array.isArray(film.cast)
      ? film.cast.map((x) => (typeof x === 'object' ? x.name : x)).join(', ')
      : film.cast || '',
    genre: (film.genre || []).join(', '),
    rating: film.rating ?? '',
    runtime: film.runtime || '',
    country: film.country || '',
    studio: film.studio || '',
    rated: film.rated || film.mpaa || '',
    poster: film.poster || '',
    synopsis: film.synopsis || '',
    watched: film.watched === true,
    myRating: film.myRating || 0,
    criterion: film.criterion === true,
  }
}

export default function EditModal({ film, onClose, onSave, onAutofill }) {
  const isNew = !film.id
  const [form, setForm] = useState(() => toForm(film))
  const [autofilling, setAutofilling] = useState(false)
  const [lookupError, setLookupError] = useState('')

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
      shelf: form.shelf,
      row: form.row,
      year: form.year !== '' ? parseInt(form.year, 10) : undefined,
      director: form.director || undefined,
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
      poster: form.poster || undefined,
      synopsis: form.synopsis || undefined,
      watched: form.watched,
      myRating: form.myRating,
      criterion: form.criterion,
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
          <label className="edit-field full">
            <span>Title</span>
            <input value={form.title} onChange={set('title')} />
          </label>

          <label className="edit-field">
            <span>Shelf</span>
            <input value={form.shelf} onChange={set('shelf')} />
          </label>
          <label className="edit-field">
            <span>Row</span>
            <input value={form.row} onChange={set('row')} />
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
            <span>MPA Rating</span>
            <input value={form.rated} onChange={set('rated')} placeholder="e.g. PG-13, R, PG" />
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
              value={form.watched ? 'yes' : 'no'}
              onChange={(event) => {
                setForm((previous) => ({ ...previous, watched: event.target.value === 'yes' }))
              }}
            >
              <option value="no">Unwatched</option>
              <option value="yes">Watched</option>
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
