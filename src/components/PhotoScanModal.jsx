import { useRef, useState } from 'react'
import { IconClose, IconCamera, IconCheck } from './icons.jsx'

// حداکثر ابعاد قبل از فرستادن به Claude — عکس‌های موبایل معمولاً چند مگابایت
// هستن؛ قبل از ارسال کوچیک‌شون می‌کنیم تا هم سریع‌تر آپلود بشه هم داخل
// محدودیت درخواست Worker جا بشه.
const MAX_DIM = 1280

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
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.75), previewUrl: reader.result })
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default function PhotoScanModal({ onClose, onAddFilm, defaultMediaType = 'physical', existingFilms = [] }) {
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [pendingDataUrl, setPendingDataUrl] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [results, setResults] = useState(null) // [{title, year, selected, itemType, isDuplicate}]
  const [error, setError] = useState('')
  const [mediaType, setMediaType] = useState(defaultMediaType)
  const [adding, setAdding] = useState(false)
  const [addedCount, setAddedCount] = useState(0)

  // نرمال‌سازی برای مقایسه: کوچیک، بدون فاصله‌ی اضافه — چون OCR ممکنه
  // حروف بزرگ/کوچیک یا فاصله رو کمی فرق بذاره
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')

  const findDuplicate = (title, mt) =>
    existingFilms.find((f) => f.mediaType === mt && norm(f.title) === norm(title))

  const applyDuplicateFlags = (list, mt) =>
    list.map((r) => {
      const dup = findDuplicate(r.title, mt)
      return { ...r, duplicateOf: dup || null, selected: dup ? false : r.selected }
    })

  const [step, setStep] = useState(-1) // -1 = list view, 0..n-1 = reviewing one-by-one, n = final summary

  const pickFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setResults(null)
    setStep(-1)
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
        const withMeta = data.films.map((f) => ({ title: f.title, year: f.year || '', selected: true, itemType: 'movie' }))
        setResults(applyDuplicateFlags(withMeta, mediaType))
        setStep(0)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setScanning(false)
    }
  }

  const updateResult = (i, patch) => {
    setResults((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r
        const next = { ...r, ...patch }
        if (patch.title !== undefined) {
          next.duplicateOf = findDuplicate(next.title, mediaType) || null
        }
        return next
      })
    )
  }

  const changeMediaType = (mt) => {
    setMediaType(mt)
    setResults((prev) => (prev ? applyDuplicateFlags(prev, mt) : prev))
  }

  const selectedCount = (results || []).filter((r) => r.selected).length
  const duplicateCount = (results || []).filter((r) => r.duplicateOf).length

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

          {results && step >= 0 && step < results.length && (() => {
            const r = results[step]
            return (
              <>
                <div className="photo-scan-step-head">
                  <span className="film-selector-count">
                    Title {step + 1} of {results.length}
                    {duplicateCount > 0 && ` — ${duplicateCount} already in archive`}
                  </span>
                  <select className="film-selector-search" value={mediaType} onChange={(e) => changeMediaType(e.target.value)} style={{ width: 'auto' }}>
                    <option value="physical">Physical (Blu-ray)</option>
                    <option value="digital">Digital</option>
                  </select>
                </div>

                {error && <p className="status" style={{ color: 'var(--danger, #e05252)' }}>{error}</p>}

                <div className="photo-scan-step-card">
                  <label className="photo-scan-step-toggle">
                    <input
                      type="checkbox"
                      checked={r.selected}
                      onChange={(e) => updateResult(step, { selected: e.target.checked })}
                    />
                    <span>Add this one</span>
                  </label>

                  <div className="photo-scan-step-fields">
                    <input
                      type="text"
                      className="film-selector-search"
                      value={r.title}
                      onChange={(e) => updateResult(step, { title: e.target.value })}
                    />
                    <input
                      type="number"
                      className="film-selector-search"
                      placeholder="Year"
                      value={r.year}
                      onChange={(e) => updateResult(step, { year: e.target.value })}
                    />
                    <select
                      className="film-selector-search"
                      value={r.itemType}
                      onChange={(e) => updateResult(step, { itemType: e.target.value })}
                    >
                      <option value="movie">Movie</option>
                      <option value="series">Series</option>
                    </select>
                  </div>

                  {r.duplicateOf && (
                    <div className="photo-scan-dup-card">
                      {r.duplicateOf.poster ? (
                        <img src={r.duplicateOf.poster} alt="" className="photo-scan-dup-poster" />
                      ) : (
                        <div className="photo-scan-dup-poster photo-scan-dup-poster-empty" />
                      )}
                      <div>
                        <div className="photo-scan-dup-badge">Already in your archive</div>
                        <div className="photo-scan-dup-title">
                          {r.duplicateOf.title} {r.duplicateOf.year ? `(${r.duplicateOf.year})` : ''}
                        </div>
                        <div className="export-sub" style={{ margin: '2px 0 0' }}>
                          Unchecked by default — check "Add this one" if you still want a duplicate.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '14px', justifyContent: 'space-between' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setResults(null); setStep(-1); setError('') }}>
                    ← Scan a different photo
                  </button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                      ← Back
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setStep((s) => s + 1)}>
                      {step === results.length - 1 ? 'Review & Add →' : 'Next →'}
                    </button>
                  </div>
                </div>
              </>
            )
          })()}

          {results && step === results.length && (
            <>
              <div style={{ marginBottom: '10px' }}>
                <span className="film-selector-count">
                  {selectedCount} of {results.length} selected to add
                  {duplicateCount > 0 && ` — ${duplicateCount} flagged as already in archive`}
                </span>
              </div>

              {error && <p className="status" style={{ color: 'var(--danger, #e05252)' }}>{error}</p>}

              <div className="film-selector-list">
                {results.map((r, i) => (
                  <button
                    type="button"
                    key={i}
                    className={'photo-scan-summary-row' + (r.selected ? ' photo-scan-row-selected' : '')}
                    onClick={() => setStep(i)}
                  >
                    <span className={r.selected ? 'photo-scan-summary-check on' : 'photo-scan-summary-check'}>
                      {r.selected ? <IconCheck width={12} height={12} /> : null}
                    </span>
                    <span className="photo-scan-summary-title">
                      {r.title} {r.year && `(${r.year})`}
                    </span>
                    {r.duplicateOf && <span className="photo-scan-dup-badge">already have</span>}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '14px', justifyContent: 'space-between' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(results.length - 1)} disabled={adding}>
                  ← Back to review
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={addSelected} disabled={!selectedCount || adding}>
                  {adding ? `Adding… (${addedCount}/${selectedCount})` : (
                    <>
                      <IconCheck width={14} height={14} /> Confirm — Add {selectedCount} film{selectedCount === 1 ? '' : 's'}
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
