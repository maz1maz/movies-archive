import { useRef, useState } from 'react'
import { IconClose, IconCamera, IconCheck } from './icons.jsx'

// حداکثر ابعاد قبل از فرستادن به Claude — عکس‌های موبایل معمولاً چند مگابایت
// هستن؛ قبل از ارسال کوچیک‌شون می‌کنیم تا هم سریع‌تر آپلود بشه هم داخل
// محدودیت درخواست Worker جا بشه.
const MAX_DIM = 1600

function fileToResizedBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the file'))
    reader.onload = () => {
      img.onerror = () => reject(new Error('Could not decode the image'))
      img.onload = () => {
        let { width, height } = img
        if (width > MAX_DIM || height > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), previewUrl: reader.result })
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default function PhotoScanModal({ onClose, onAddFilm, defaultMediaType = 'physical' }) {
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [pendingDataUrl, setPendingDataUrl] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [results, setResults] = useState(null) // [{title, year, selected, itemType}]
  const [error, setError] = useState('')
  const [mediaType, setMediaType] = useState(defaultMediaType)
  const [adding, setAdding] = useState(false)
  const [addedCount, setAddedCount] = useState(0)

  const pickFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setResults(null)
    try {
      const { dataUrl, previewUrl } = await fileToResizedBase64(file)
      setPreview(previewUrl)
      setPendingDataUrl(dataUrl)
    } catch (err) {
      setError(err.message)
    }
  }

  const scan = async () => {
    if (!pendingDataUrl || scanning) return
    setScanning(true)
    setError('')
    try {
      const res = await fetch('/api/films/scan-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: pendingDataUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      if (!data.films || data.films.length === 0) {
        setError('No titles could be recognized in this photo — try a closer, better-lit shot.')
        setResults([])
      } else {
        setResults(
          data.films.map((f) => ({ title: f.title, year: f.year || '', selected: true, itemType: 'movie' }))
        )
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setScanning(false)
    }
  }

  const updateResult = (i, patch) => {
    setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  const selectedCount = (results || []).filter((r) => r.selected).length

  const addSelected = async () => {
    if (!results || !selectedCount || adding) return
    setAdding(true)
    setAddedCount(0)
    let ok = 0
    for (const r of results) {
      if (!r.selected || !r.title.trim()) continue
      try {
        await onAddFilm({
          title: r.title.trim(),
          year: r.year || undefined,
          mediaType,
          itemType: r.itemType,
        })
        ok++
        setAddedCount(ok)
      } catch {
        // یکی fail بشه، بقیه ادامه پیدا می‌کنن
      }
    }
    setAdding(false)
    if (ok > 0) onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal edit-modal photo-scan-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <IconClose width={15} height={15} />
        </button>
        <h2 className="edit-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconCamera width={18} height={18} /> Add via Photo
        </h2>

        <div className="photo-scan-body">
          {!results && (
            <>
              <p className="export-sub" style={{ marginTop: 0 }}>
                Take or upload a photo of your Blu-ray/DVD spines or covers — Claude will read the titles for you to review before adding.
              </p>

              <div className="photo-scan-dropzone" onClick={() => fileRef.current?.click()}>
                {preview ? (
                  <img src={preview} alt="" className="photo-scan-preview" />
                ) : (
                  <div className="photo-scan-placeholder">
                    <IconCamera width={28} height={28} />
                    <span>Tap to take a photo or choose one</span>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={pickFile}
              />

              {error && <p className="status" style={{ color: 'var(--danger, #e05252)' }}>{error}</p>}

              <div style={{ display: 'flex', gap: '8px', marginTop: '14px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                  {preview ? 'Choose different photo' : 'Choose photo'}
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={scan} disabled={!pendingDataUrl || scanning}>
                  {scanning ? 'Reading titles…' : 'Scan photo'}
                </button>
              </div>
            </>
          )}

          {results && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                <span className="film-selector-count">
                  {results.length} title{results.length === 1 ? '' : 's'} found — {selectedCount} selected
                </span>
                <label className="film-selector-toggle" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Add as:</span>
                  <select className="film-selector-search" value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
                    <option value="physical">Physical (Blu-ray)</option>
                    <option value="digital">Digital</option>
                  </select>
                </label>
              </div>

              {error && <p className="status" style={{ color: 'var(--danger, #e05252)' }}>{error}</p>}

              <div className="film-selector-list">
                {results.map((r, i) => (
                  <label key={i} className={'film-selector-row' + (r.selected ? ' film-selector-row-selected' : '')}>
                    <input
                      type="checkbox"
                      className="film-selector-check"
                      checked={r.selected}
                      onChange={(e) => updateResult(i, { selected: e.target.checked })}
                    />
                    <input
                      type="text"
                      className="film-selector-search"
                      style={{ flex: 1 }}
                      value={r.title}
                      onChange={(e) => updateResult(i, { title: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <input
                      type="number"
                      className="film-selector-search"
                      style={{ width: '80px' }}
                      placeholder="Year"
                      value={r.year}
                      onChange={(e) => updateResult(i, { year: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <select
                      className="film-selector-search"
                      style={{ width: '90px' }}
                      value={r.itemType}
                      onChange={(e) => updateResult(i, { itemType: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="movie">Movie</option>
                      <option value="series">Series</option>
                    </select>
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '14px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setResults(null); setError('') }} disabled={adding}>
                  ← Scan a different photo
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={addSelected} disabled={!selectedCount || adding}>
                  {adding ? `Adding… (${addedCount}/${selectedCount})` : (
                    <>
                      <IconCheck width={14} height={14} /> Add {selectedCount} film{selectedCount === 1 ? '' : 's'}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
