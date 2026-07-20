import { useEffect, useState } from 'react'
import { IconClose, IconSave } from './icons.jsx'

export default function EditModal({ film, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    title: film.title || '',
    shelf: film.shelf || '',
    row: film.row || '',
    year: film.year ?? '',
    director: film.director || '',
    cast: (film.cast || []).join(', '),
    genre: (film.genre || []).join(', '),
    rating: film.rating ?? '',
    runtime: film.runtime || '',
    country: film.country || '',
    poster: film.poster || '',
    synopsis: film.synopsis || '',
  }))

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const save = () => {
    const patch = {
      title: form.title,
      shelf: form.shelf,
      row: form.row,
      year: form.year !== '' ? parseInt(form.year, 10) : undefined,
      director: form.director || undefined,
      cast: form.cast
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      genre: form.genre
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      rating: form.rating !== '' ? parseFloat(form.rating) : undefined,
      runtime: form.runtime !== '' ? parseInt(form.runtime, 10) : undefined,
      country: form.country || undefined,
      poster: form.poster || undefined,
      synopsis: form.synopsis || undefined,
    }
    onSave(patch)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal edit-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <IconClose width={15} height={15} />
        </button>
        <h2 className="edit-title">Edit film</h2>

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
            <input
              type="number"
              value={form.year}
              onChange={set('year')}
            />
          </label>
          <label className="edit-field">
            <span>Rating</span>
            <input
              type="number"
              step="0.1"
              value={form.rating}
              onChange={set('rating')}
            />
          </label>
          <label className="edit-field">
            <span>Runtime (min)</span>
            <input
              type="number"
              value={form.runtime}
              onChange={set('runtime')}
            />
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
          <label className="edit-field full">
            <span>Synopsis</span>
            <textarea
              rows="3"
              value={form.synopsis}
              onChange={set('synopsis')}
            />
          </label>
        </div>

        <div className="edit-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            <IconSave width={14} height={14} /> Save
          </button>
        </div>
      </div>
    </div>
  )
}
