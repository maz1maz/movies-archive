import { useEffect } from 'react'
import { IconClose } from './icons.jsx'

export default function ExportModal({ films, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const rows = films
      .map(
        (f) => `
      <tr>
        <td><strong>${f.title}</strong><br><small style="color:#666">${f.originalTitle || ''}</small></td>
        <td>Shelf ${f.shelf || '—'} / Row ${f.row || '—'}</td>
        <td>${f.format || 'Blu-ray'}</td>
        <td>${f.year || '—'}</td>
        <td>${f.director || '—'}</td>
        <td>★ ${f.rating ? f.rating.toFixed(1) : '—'}</td>
        <td>${f.studio || '—'}</td>
        <td>${f.borrowedTo ? `Loaned to ${f.borrowedTo}` : 'In Archive'}</td>
      </tr>
    `
      )
      .join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Physical Film Archive Catalog - ${new Date().toLocaleDateString()}</title>
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
          <h1>🎬 Physical Film Archive Catalog</h1>
          <p>Total Items: ${films.length} movies · Generated on ${new Date().toLocaleString()}</p>
          <button onclick="window.print()" style="padding:10px 18px; margin-bottom:15px; font-weight:bold; cursor:pointer;">🖨️ Print Catalog / Save as PDF</button>
          <table>
            <thead>
              <tr>
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
          <h2>📑 Export Archive & Backups</h2>
          <p className="export-sub">Download your physical movie collection in multiple formats</p>
        </div>

        <div className="export-options-grid">
          {/* Printable PDF Catalog */}
          <div className="export-card">
            <span className="export-icon">📄</span>
            <h3>Printable PDF Catalog</h3>
            <p>Generate a complete formatted physical inventory list suitable for printing or saving as PDF.</p>
            <button className="btn btn-primary" onClick={handlePrintPDF}>
              🖨️ Generate PDF Catalog
            </button>
          </div>

          {/* Excel Export */}
          <div className="export-card">
            <span className="export-icon">📊</span>
            <h3>Excel Spreadsheet (.xlsx)</h3>
            <p>Export all 467 films into an Excel spreadsheet with all columns and shelf details.</p>
            <a href="/api/export/excel" download className="btn btn-ghost">
              ⬇️ Download Excel Export
            </a>
          </div>

          {/* JSON Backup */}
          <div className="export-card">
            <span className="export-icon">💾</span>
            <h3>JSON Data Backup</h3>
            <p>Download raw database file (`films-backup.json`) for complete backup and restoration.</p>
            <a href="/api/export/json" download className="btn btn-ghost">
              💾 Download JSON Backup
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
