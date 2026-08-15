import { useEffect, useState } from 'react'

export default function DashboardCollectionsPanel({ films = [], onOpenFilm }) {
  const [collections, setCollections] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    fetch('/api/collections')
      .then((r) => r.json())
      .then((data) => setCollections(Array.isArray(data) ? data : []))
      .catch(() => setCollections([]))
  }, [])

  const toggleOpen = (col) => {
    if (openId === col.collectionId) {
      setOpenId(null)
      setDetail(null)
      return
    }
    setOpenId(col.collectionId)
    setDetail(null)
    // برای گرفتن جزئیات کامل (لیست همه‌ی اعضا)، از همون endpoint فیلم استفاده
    // می‌کنیم — کافیه یکی از فیلم‌های همین مجموعه که تو آرشیو داریم رو پیدا کنیم.
    const anyFilm = films.find((f) => f.collectionId === col.collectionId)
    if (!anyFilm) return
    setDetailLoading(true)
    fetch(`/api/films/${anyFilm.id}/collection`)
      .then((r) => r.json())
      .then((data) => setDetail(data.collection || null))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }

  return (
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro">
          مجموعه‌های TMDB (سکوئل/پیش‌درآمد رسمی) که حداقل یه فیلمشون تو آرشیوته. موقع باز کردن هر فیلم، خودکار چک می‌شه.
        </p>
      </div>

      {collections === null ? (
        <div className="empty">در حال بارگذاری…</div>
      ) : collections.length === 0 ? (
        <div className="empty">هنوز هیچ مجموعه‌ای شناسایی نشده — با باز کردن فیلم‌ها (تو MovieModal) خودکار پر می‌شه.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {collections.map((col) => (
            <div key={col.collectionId} className="card" style={{ padding: 14 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => toggleOpen(col)}
              >
                <div style={{ width: 46, height: 66, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2)' }}>
                  {col.collectionPoster && <img src={col.collectionPoster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{col.collectionName}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                    {col.ownedCount} عنوان تو آرشیو
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{openId === col.collectionId ? '▲' : '▼'}</span>
              </div>

              {openId === col.collectionId && (
                <div style={{ marginTop: 12, display: 'flex', gap: 10, overflowX: 'auto', paddingTop: 4 }}>
                  {detailLoading ? (
                    <div className="empty">در حال بارگذاری…</div>
                  ) : (
                    (detail?.parts || []).map((p) => (
                      <div key={p.tmdbId} style={{ flex: '0 0 80px', textAlign: 'center' }}>
                        <button
                          type="button"
                          disabled={!p.inArchive}
                          onClick={() => {
                            if (p.inArchive && p.archiveFilmId) {
                              const f = films.find((x) => x.id === p.archiveFilmId)
                              if (f && onOpenFilm) onOpenFilm(f)
                            }
                          }}
                          style={{
                            width: 80,
                            height: 116,
                            borderRadius: 6,
                            overflow: 'hidden',
                            border: 'none',
                            padding: 0,
                            cursor: p.inArchive ? 'pointer' : 'default',
                            opacity: p.inArchive ? 1 : 0.5,
                            background: 'var(--surface-2)',
                          }}
                          title={p.title}
                        >
                          {p.poster && <img src={p.poster} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </button>
                        <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>
                          {p.title} {p.year ? `(${p.year})` : ''}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
