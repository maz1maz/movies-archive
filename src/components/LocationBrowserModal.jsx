import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { IconClose, IconPin, IconFilm, IconBookshelf, IconPrinter, IconDownload } from './icons.jsx'

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

  const locationLabel = closet || row || shelf ? `${closet ? `C${closet}` : ''}${row ? `R${row}` : ''}${shelf ? `S${shelf}` : ''}` : 'all-locations'

  const handleExcelExport = () => {
    const rows = visibleFilms.map((f, idx) => ({
      '#': idx + 1,
      Title: f.title || '',
      'Original Title': f.originalTitle || '',
      Closet: f.closet || '',
      Row: f.row || '',
      Section: f.shelf || '',
      Format: f.format || '',
      Criterion: f.criterion ? 'Yes' : 'No',
      Copies: f.copies || 1,
      Watched: f.watched === true ? 'Yes' : 'No',
      Director: f.director || '',
      Year: f.year || '',
      Genre: Array.isArray(f.genre) ? f.genre.join(', ') : f.genre || '',
      Rating: f.rating || '',
      Studio: f.studio || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Location')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: false })
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${locationLabel}-films.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const rows = visibleFilms
      .map(
        (f) => `
      <tr>
        <td><strong>${f.title}</strong><br><small style="color:#666">${f.originalTitle || ''}</small></td>
        <td>Closet ${f.closet || '—'} / Row ${f.row || '—'} / Section ${f.shelf || '—'}</td>
        <td>${f.format || 'Blu-ray'}</td>
        <td>${f.criterion ? 'Criterion' : '—'}</td>
        <td>${f.copies > 1 ? f.copies : 1}</td>
        <td>${f.year || '—'}</td>
        <td>${f.director || '—'}</td>
        <td>★ ${f.rating ? f.rating.toFixed(1) : '—'}</td>
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
            h1 { font-size: 22px; margin-bottom: 4px; }
            p { font-size: 13px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
            th { background: #f0f0f0; font-weight: bold; }
            tr:nth-child(even) { background: #f9f9f9; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>🎬 Location Catalog — ${locationLabel}</h1>
          <p>Total Items: ${visibleFilms.length} · Generated on ${new Date().toLocaleString()}</p>
          <button onclick="window.print()" style="padding:10px 18px; margin-bottom:15px; font-weight:bold; cursor:pointer;">🖨️ Print / Save as PDF</button>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Physical Storage</th>
                <th>Format</th>
                <th>Criterion</th>
                <th>Copies</th>
                <th>Year</th>
                <th>Director</th>
                <th>IMDb</th>
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
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleExcelExport} title="Download Excel">
                  <IconDownload width={13} height={13} /> Excel
                </button>
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
                    {f.criterion && <span className="criterion-badge">CRITERION</span>}
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
