import { useEffect, useMemo, useState } from 'react'
import { IconClose, IconPin, IconFilm, IconBookshelf, IconPrinter, IconDownload } from './icons.jsx'

const CLOSET_COUNT = 8
const ROW_COUNT = 10
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

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

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

  const locationLabel = closet || row || shelf ? `${closet ? `C${closet}` : ''}${row ? `R${row}` : ''}${shelf ? `S${shelf}` : ''}` : 'all-locations'

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

    const rows = visibleFilms
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
        <td class="cell-nowrap">${f.criterion ? `Criterion${f.copies > 1 ? ` ×${f.copies}` : ''}` : '—'}</td>
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
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="catalog-header">
            <img class="catalog-header-logo" src="${window.location.origin}/logo.png" alt="Cinefilm Archive" />
            <div class="catalog-header-text">
              <h1>🎬 Location Catalog — ${locationLabel}</h1>
              <p>Total Items: ${visibleFilms.length} · Generated on ${new Date().toLocaleString()}</p>
            </div>
          </div>
          <button onclick="window.print()" style="padding:10px 18px; margin-bottom:15px; font-weight:bold; cursor:pointer;">🖨️ Print / Save as PDF</button>
          <table>
            <colgroup>
              <col style="width:4%">
              <col style="width:26%">
              <col style="width:7%">
              <col style="width:14%">
              <col style="width:6%">
              <col style="width:13%">
              <col style="width:9%">
              <col style="width:11%">
              <col style="width:7%">
            </colgroup>
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Year</th>
                <th>Director</th>
                <th>IMDb</th>
                <th>Location</th>
                <th>Format</th>
                <th>Criterion</th>
                <th>Copies</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

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
          <div className="location-result-bar">
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
            {visibleFilms.length > 0 && (
              <div className="location-export-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={handlePrintPDF} title="Print / Save as PDF">
                  <IconPrinter width={13} height={13} /> PDF
                </button>
                <a href={excelExportUrl()} download className="btn btn-ghost btn-sm" title="Download Excel">
                  <IconDownload width={13} height={13} /> Excel
                </a>
              </div>
            )}
          </div>

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
                    onClick={() => onSelectFilm(f)}
                  >
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
                    <span className="location-title-loc">
                      C{f.closet || '–'} R{f.row || '–'} S{f.shelf || '–'}
                    </span>
                    {f.criterion && <span className="criterion-badge criterion-badge-list">CRITERION</span>}
                    {f.copies > 1 && <span className="copies-badge">×{f.copies}</span>}
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
