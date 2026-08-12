import { useEffect, useState } from 'react'
import { IconClose, IconDocument, IconPrinter, IconBarChart, IconDownload, IconSave } from './icons.jsx'
import { escapeHtml } from '../utils/escapeHtml.js'

const LETTERS = ['#', ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))]

function sortableTitle(title) {
  const t = String(title || '')
  if (/^the\s+/i.test(t)) return t.slice(4)
  if (/^a\s+/i.test(t)) return t.slice(2)
  return t
}

function firstLetterOf(title) {
  const t = sortableTitle(title).trim()
  const ch = (t[0] || '').toUpperCase()
  return ch >= 'A' && ch <= 'Z' ? ch : '#'
}

export default function ExportModal({ films, section, onClose }) {
  const [letter, setLetter] = useState(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const scopedFilms = (letter ? films.filter((f) => firstLetterOf(f.title) === letter) : films)
    .slice()
    .sort((a, b) => sortableTitle(a.title).localeCompare(sortableTitle(b.title)))

  // فیلترهای بکاپ دیجیتال/سریال، بر اساس بخشی که کاربر الان توش هست
  const scopeParams = new URLSearchParams()
  let scopeLabel = 'archive'
  if (section === 'digital-series') {
    scopeParams.set('mediaType', 'digital')
    scopeParams.set('itemType', 'series')
    scopeLabel = 'series'
  } else if (section === 'digital-movie') {
    scopeParams.set('mediaType', 'digital')
    scopeParams.set('itemType', 'movie')
    scopeLabel = 'digital movies'
  } else if (section === 'physical') {
    scopeParams.set('mediaType', 'physical')
    scopeLabel = 'physical collection'
  }
  if (letter) scopeParams.set('letter', letter)
  const excelScopeQuery = scopeParams.toString() ? `?${scopeParams.toString()}` : ''
  scopeParams.delete('letter')
  const scopeQuery = scopeParams.toString() ? `?${scopeParams.toString()}` : ''
  const letterLabel = letter ? ` (letter ${letter})` : ''

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
    const csv = [header, ...rows].map((row) => row.map(esc).join(',')).join('\\r\\n')
    const blob = new Blob([`\\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = letter ? `letterboxd-film-archive-${letter}.csv` : 'letterboxd-film-archive.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const rows = scopedFilms
      .map(
        (f, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${escapeHtml(f.title)}</strong><br><small style="color:#666">${escapeHtml(f.originalTitle)}</small></td>
        <td>Closet ${escapeHtml(f.closet) || '—'} / Row ${escapeHtml(f.row) || '—'} / Section ${escapeHtml(f.shelf) || '—'}</td>
        <td>${escapeHtml(f.format) || 'Blu-ray'}</td>
        <td>${f.year || '—'}</td>
        <td>${escapeHtml(f.director) || '—'}</td>
        <td>★ ${f.rating ? f.rating.toFixed(1) : '—'}</td>
        <td>${escapeHtml(f.studio) || '—'}</td>
        <td>${f.borrowedTo ? `Loaned to ${escapeHtml(f.borrowedTo)}` : 'In Archive'}</td>
      </tr>
    `
      )
      .join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Physical Film Archive Catalog${letterLabel} - ${new Date().toLocaleDateString()}</title>
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
          <h1>🎬 Physical Film Archive Catalog${letterLabel}</h1>
          <p>Total Items: ${scopedFilms.length} movies · Generated on ${new Date().toLocaleString()}</p>
          <button onclick="window.print()" style="padding:10px 18px; margin-bottom:15px; font-weight:bold; cursor:pointer;">🖨️ Print Catalog / Save as PDF</button>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Physical Storage</th>
                <th>Format</th>
                <th>Year</th>
                <th>Director</th>
                <th>IMDb</th>
                <th>Studio</th>
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-export" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close cine-close" onClick={onClose} aria-label="Close">
          <IconClose width={14} height={14} />
        </button>

        <div className="export-header">
          <h2>
            <IconDocument width={18} height={18} /> Export Archive &amp; Backups
          </h2>
          <p className="export-sub">Download your physical movie collection in multiple formats</p>
        </div>

        <div className="export-letter-filter">
          <span className="export-letter-label">Letter:</span>
          <div className="export-letter-chips">
            <button
              type="button"
              className={!letter ? 'export-letter-chip export-letter-chip-active' : 'export-letter-chip'}
              onClick={() => setLetter(null)}
            >
              All
            </button>
            {LETTERS.map((l) => (
              <button
                key={l}
                type="button"
                className={letter === l ? 'export-letter-chip export-letter-chip-active' : 'export-letter-chip'}
                onClick={() => setLetter(l)}
              >
                {l}
              </button>
            ))}
          </div>
          {letter && (
            <span className="export-letter-count">{scopedFilms.length} title{scopedFilms.length === 1 ? '' : 's'}</span>
          )}
        </div>

        <div className="export-options-grid">
          {/* Printable PDF Catalog */}
          <div className="export-card">
            <span className="export-icon">
              <IconDocument width={22} height={22} />
            </span>
            <h3>Printable PDF Catalog</h3>
            <p>Generate a complete formatted physical inventory list{letterLabel} suitable for printing or saving as PDF.</p>
            <button className="btn btn-primary" onClick={handlePrintPDF}>
              <IconPrinter width={14} height={14} /> Generate PDF Catalog
            </button>
          </div>

          {/* Excel Export */}
          <div className="export-card">
            <span className="export-icon">
              <IconBarChart width={22} height={22} />
            </span>
            <h3>Excel Spreadsheet (.xlsx)</h3>
            <p>Export {section ? `your ${scopeLabel}` : `all ${films.length} films`}{letterLabel} into an Excel spreadsheet with all columns and shelf/drive details.</p>
            <a href={`/api/export/excel${excelScopeQuery}`} download className="btn btn-ghost">
              <IconDownload width={14} height={14} /> Download Excel Export
            </a>
          </div>

          <div className="export-card">
            <span className="export-icon">🎞️</span>
            <h3>Letterboxd CSV</h3>
            <p>Download a CSV with titles, years, directors, ratings, watched status and genre tags{letterLabel}.</p>
            <button className="btn btn-primary" onClick={handleLetterboxdExport}>
              ⬇️ Download Letterboxd CSV
            </button>
          </div>

          {/* JSON Backup */}
          <div className="export-card">
            <span className="export-icon">
              <IconSave width={22} height={22} />
            </span>
            <h3>JSON Data Backup</h3>
            <p>Download the raw database backup ({section ? `your ${scopeLabel}` : 'full archive'}) for complete backup and restoration.</p>
            <a href={`/api/export/json${scopeQuery}`} download className="btn btn-ghost">
              <IconSave width={14} height={14} /> Download JSON Backup
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
