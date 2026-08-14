import { useMemo, useState } from 'react'
import { IconDocument, IconPrinter, IconBarChart, IconDownload, IconSave } from './icons.jsx'
import { escapeHtml } from '../utils/escapeHtml.js'

const SCOPES = [
  { key: 'all', label: 'All Archive', mediaType: null, itemType: null },
  { key: 'physical', label: 'Physical Collection', mediaType: 'physical', itemType: null },
  { key: 'digital', label: 'Digital Library', mediaType: 'digital', itemType: null },
  { key: 'movies', label: 'Movies Only', mediaType: null, itemType: 'movie' },
  { key: 'series', label: 'Series Only', mediaType: null, itemType: 'series' },
  { key: 'physical-movies', label: 'Physical Movies Only', mediaType: 'physical', itemType: 'movie' },
  { key: 'physical-series', label: 'Physical Series Only', mediaType: 'physical', itemType: 'series' },
  { key: 'digital-movies', label: 'Digital Movies Only', mediaType: 'digital', itemType: 'movie' },
  { key: 'digital-series', label: 'Digital Series Only', mediaType: 'digital', itemType: 'series' },
]

const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]

// حرف اول عنوان رو برای فیلتر الفبایی می‌گیره، با نادیده گرفتن "The "/"A "
// اول عنوان (هماهنگ با همون قاعده‌ای که بقیه‌ی آرشیو برای مرتب‌سازی داره).
function sortableTitle(title) {
  const t = title || ''
  if (/^the\s+/i.test(t)) return t.slice(4)
  return t
}
function titleStartsWithLetter(title, letter) {
  const first = (sortableTitle(title).trim()[0] || '').toUpperCase()
  if (letter === '#') return !/^[A-Z]$/.test(first)
  return first === letter
}

function filterByScope(films, scope) {
  return films.filter((f) => {
    if (scope.mediaType && f.mediaType !== scope.mediaType) return false
    if (scope.itemType && f.itemType !== scope.itemType) return false
    return true
  })
}

export default function DashboardExportPanel({ films }) {
  const [scopeKey, setScopeKey] = useState('all')
  const [letter, setLetter] = useState(null)
  const [drive, setDrive] = useState('')
  const scope = SCOPES.find((s) => s.key === scopeKey)

  const scopedFilms = useMemo(() => {
    let list = filterByScope(films, scope)
    if (letter) list = list.filter((f) => titleStartsWithLetter(f.title, letter))
    if (drive && scope.mediaType === 'digital') list = list.filter((f) => String(f.driveNumber || '') === drive)
    return list
  }, [films, scope, letter, drive])

  // درایوهای موجود، فقط برای وقتی که اسکوپ روی «دیجیتال» هست
  const availableDrives = useMemo(() => {
    if (scope.mediaType !== 'digital') return []
    const base = filterByScope(films, scope)
    return [...new Set(base.map((f) => String(f.driveNumber || '').trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    )
  }, [films, scope])

  const scopeParams = new URLSearchParams()
  if (scope.mediaType) scopeParams.set('mediaType', scope.mediaType)
  if (scope.itemType) scopeParams.set('itemType', scope.itemType)
  if (letter) scopeParams.set('letter', letter)
  if (drive && scope.mediaType === 'digital') scopeParams.set('drive', drive)
  const scopeQuery = scopeParams.toString() ? `?${scopeParams.toString()}` : ''

  const scopeLabel = [
    scope.label,
    letter ? `starting with "${letter}"` : null,
    drive && scope.mediaType === 'digital' ? `on Drive ${drive}` : null,
  ]
    .filter(Boolean)
    .join(' ')
  const scopeFileTag = [scope.key, letter, drive && scope.mediaType === 'digital' ? `drive${drive}` : null].filter(Boolean).join('-')

  const handleLetterboxdExport = () => {
    const esc = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const header = ['Name', 'Year', 'Directors', 'Rating10', 'Watched', 'Tags']
    const rows = scopedFilms.map((f) => [
      f.title,
      f.year || '',
      f.director || '',
      f.rating ?? '',
      f.watched ? 'Yes' : 'No',
      Array.isArray(f.genre) ? f.genre.join(', ') : f.genre || '',
    ])
    const csv = [header, ...rows].map((row) => row.map(esc).join(',')).join('\r\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${scopeFileTag}-letterboxd-export.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const criterionCount = scopedFilms.filter((f) => f.criterion).length

    const rows = scopedFilms
      .map(
        (f, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(f.title)}</strong><br><small style="color:#666">${escapeHtml(f.originalTitle)}</small></td>
        <td>${f.mediaType === 'digital' ? `Drive ${escapeHtml(f.driveNumber) || '—'}` : `Closet ${escapeHtml(f.closet) || '—'} / Row ${escapeHtml(f.row) || '—'} / Section ${escapeHtml(f.shelf) || '—'}`}</td>
        <td>${escapeHtml(f.format) || 'Blu-ray'}</td>
        <td>${f.year || '—'}</td>
        <td>${escapeHtml(f.director) || '—'}</td>
        <td>★ ${f.rating ? f.rating.toFixed(1) : '—'}</td>
        <td>${escapeHtml(f.studio) || '—'}</td>
        <td>${f.mediaType === 'digital' ? '—' : f.copies || 1}</td>
        <td>${f.criterion ? `✓${f.criterionCopies > 1 ? ` ×${f.criterionCopies}` : ''}` : '—'}</td>
        <td>${f.borrowedTo ? `Loaned to ${escapeHtml(f.borrowedTo)}` : 'In Archive'}</td>
      </tr>
    `
      )
      .join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${scopeLabel} Catalog - ${new Date().toLocaleDateString()}</title>
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
          <h1>🎬 ${scopeLabel} Catalog</h1>
          <p>Total Items: ${scopedFilms.length} · Criterion Collection: ${criterionCount} · Generated on ${new Date().toLocaleString()}</p>
          <button onclick="window.print()" style="padding:10px 18px; margin-bottom:15px; font-weight:bold; cursor:pointer;">🖨️ Print Catalog / Save as PDF</button>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Storage</th>
                <th>Format</th>
                <th>Year</th>
                <th>Director</th>
                <th>IMDb</th>
                <th>Studio</th>
                <th>Copies</th>
                <th>Criterion</th>
                <th>Status</th>
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
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro">
          Export, back up, or print your archive. Pick which part of the collection you want, then choose a format below.
        </p>
        <div className="row row-wrap oscars-filters">
          <div className="oscars-field">
            <label>Which archive?</label>
            <select className="input" value={scopeKey} onChange={(e) => setScopeKey(e.target.value)}>
              {SCOPES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {scope.mediaType === 'digital' && availableDrives.length > 0 && (
            <div className="oscars-field">
              <label>Which drive?</label>
              <select className="input" value={drive} onChange={(e) => setDrive(e.target.value)}>
                <option value="">All drives</option>
                {availableDrives.map((d) => (
                  <option key={d} value={d}>
                    Drive {d}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="export-letter-bar">
          <button type="button" className={letter === null ? 'active' : ''} onClick={() => setLetter(null)}>
            All
          </button>
          {LETTERS.map((l) => (
            <button key={l} type="button" className={letter === l ? 'active' : ''} onClick={() => setLetter(letter === l ? null : l)}>
              {l}
            </button>
          ))}
        </div>

        <p className="oscars-intro" style={{ marginTop: 8 }}>
          {scopedFilms.length} title{scopedFilms.length === 1 ? '' : 's'} in this scope.
        </p>
      </div>

      <section>
        <h2>Choose a format</h2>
        <div className="export-options-grid">
          <div className="export-card">
            <span className="export-icon">
              <IconDocument width={22} height={22} />
            </span>
            <h3>Printable PDF Catalog</h3>
            <p>Generate a formatted inventory list of {scopeLabel.toLowerCase()}, ready to print or save as PDF.</p>
            <button className="btn btn-primary" onClick={handlePrintPDF} disabled={!scopedFilms.length}>
              <IconPrinter width={14} height={14} /> Generate PDF Catalog
            </button>
          </div>

          <div className="export-card">
            <span className="export-icon">
              <IconBarChart width={22} height={22} />
            </span>
            <h3>Excel Spreadsheet (.xlsx)</h3>
            <p>Export {scopeLabel.toLowerCase()} into an Excel spreadsheet with all columns and shelf/drive details.</p>
            <a href={`/api/export/excel${scopeQuery}`} download className="btn btn-ghost">
              <IconDownload width={14} height={14} /> Download Excel Export
            </a>
          </div>

          <div className="export-card">
            <span className="export-icon">🎞️</span>
            <h3>Letterboxd CSV</h3>
            <p>Download a CSV of {scopeLabel.toLowerCase()} with titles, years, directors, ratings and watched status.</p>
            <button className="btn btn-primary" onClick={handleLetterboxdExport} disabled={!scopedFilms.length}>
              ⬇️ Download Letterboxd CSV
            </button>
          </div>

          <div className="export-card">
            <span className="export-icon">
              <IconSave width={22} height={22} />
            </span>
            <h3>JSON Data Backup</h3>
            <p>Download the raw database backup of {scopeLabel.toLowerCase()} for complete backup and restoration.</p>
            <a href={`/api/export/json${scopeQuery}`} download className="btn btn-ghost">
              <IconSave width={14} height={14} /> Download JSON Backup
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
