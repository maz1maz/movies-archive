import { useMemo, useState } from 'react'
import { IconClose, IconPin, IconFilm, IconDisc, IconBookshelf } from './icons.jsx'

const CLOSET_COUNT = 8
const ROW_COUNT = 5
const SHELF_COUNT = 3

function sortKey(title) {
  return String(title || '')
    .replace(/^the\s+/i, '')
    .toLowerCase()
}

export default function LocationBrowserModal({ films, onSelectFilm, onClose }) {
  const [closet, setCloset] = useState(null)
  const [row, setRow] = useState(null)
  const [shelf, setShelf] = useState(null)

  const physical = useMemo(
    () => films.filter((f) => f.mediaType !== 'digital' && (f.closet || f.row || f.shelf)),
    [films]
  )

  const closets = useMemo(() => Array.from({ length: CLOSET_COUNT }, (_, i) => String(i + 1)), [])
  const rows = useMemo(() => Array.from({ length: ROW_COUNT }, (_, i) => String(i + 1)), [])
  const shelves = useMemo(() => Array.from({ length: SHELF_COUNT }, (_, i) => String(i + 1)), [])

  const countFor = (c, r, s) =>
    physical.filter(
      (f) =>
        (!c || String(f.closet || '–') === c) &&
        (!r || String(f.row || '–') === r) &&
        (!s || String(f.shelf || '–') === s)
    ).length

  const visibleFilms = useMemo(() => {
    let list = physical
    if (closet) list = list.filter((f) => String(f.closet || '–') === closet)
    if (closet && row) list = list.filter((f) => String(f.row || '–') === row)
    if (closet && row && shelf) list = list.filter((f) => String(f.shelf || '–') === shelf)
    return [...list].sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title)))
  }, [physical, closet, row, shelf])

  const pickCloset = (c) => {
    setCloset(c === closet ? null : c)
    setRow(null)
    setShelf(null)
  }
  const pickRow = (r) => {
    setRow(r === row ? null : r)
    setShelf(null)
  }
  const pickShelf = (s) => setShelf(s === shelf ? null : s)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-location" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close cine-close" onClick={onClose} aria-label="Close">
          <IconClose width={16} height={16} />
        </button>

        <div className="location-header">
          <h2>
            <IconPin width={18} height={18} /> Browse by Location
          </h2>
          <p className="export-sub">Pick a closet, row, and section to see what's shelved there</p>
        </div>

        <div className="location-tree">
          <div className="location-tree-col">
            <p className="location-tree-label">Closet</p>
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
                    onClick={() => pickCloset(c)}
                  >
                    C{c} <span className="location-chip-count">{n}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {closet && (
            <div className="location-tree-col">
              <p className="location-tree-label">Row</p>
              <div className="location-chip-list">
                {rows.map((r) => {
                  const n = countFor(closet, r, null)
                  return (
                    <button
                      key={r}
                      className={
                        (r === row ? 'location-chip location-chip-active' : 'location-chip') +
                        (n === 0 ? ' location-chip-empty' : '')
                      }
                      onClick={() => pickRow(r)}
                    >
                      R{r} <span className="location-chip-count">{n}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {closet && row && (
            <div className="location-tree-col">
              <p className="location-tree-label">Section</p>
              <div className="location-chip-list">
                {shelves.map((s) => {
                  const n = countFor(closet, row, s)
                  return (
                    <button
                      key={s}
                      className={
                        (s === shelf ? 'location-chip location-chip-active' : 'location-chip') +
                        (n === 0 ? ' location-chip-empty' : '')
                      }
                      onClick={() => pickShelf(s)}
                    >
                      S{s} <span className="location-chip-count">{n}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="location-result">
          <p className="location-result-label">
            {closet || row || shelf ? (
              <>
                {closet && `C${closet}`} {row && `R${row}`} {shelf && `S${shelf}`} — {visibleFilms.length} title
                {visibleFilms.length === 1 ? '' : 's'}
              </>
            ) : (
              `All physical titles — ${visibleFilms.length} total`
            )}
          </p>

          {visibleFilms.length === 0 ? (
            <div className="status empty-state">
              <p>Nothing shelved here yet.</p>
            </div>
          ) : (
            <ul className="location-title-list">
              {visibleFilms.map((f) => (
                <li key={f.id}>
                  <button
                    className="location-title-row"
                    onClick={() => {
                      onSelectFilm(f)
                      onClose()
                    }}
                  >
                    <span className="location-title-icon">
                      {f.itemType === 'series' ? <IconBookshelf width={13} height={13} /> : <IconFilm width={13} height={13} />}
                    </span>
                    <span className="location-title-text">{f.title}</span>
                    {f.year && <span className="location-title-year">{f.year}</span>}
                    <span className="location-title-loc">
                      C{f.closet || '–'} R{f.row || '–'} S{f.shelf || '–'}
                    </span>
                    {String(f.format || '').toLowerCase().includes('blu-ray') && (
                      <span className="bluray-badge bluray-badge-list">
                        <IconDisc width={9} height={9} /> BLU-RAY
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
