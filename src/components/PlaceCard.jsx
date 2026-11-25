import { useEffect, useRef, useState } from 'react'

// کارت مکانِ انتخاب‌شده روی نقشه: عکس، اسم انگلیسی و فارسی، نوع و کشور،
// توضیح، جمعیت، لینک ویکی‌پدیا/نقشه. داده از /api/place (Wikidata، کش ۳۰ روزه).
const cache = new Map()

function formatPopulation(n) {
  if (!n) return null
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`
  return String(n)
}

export default function PlaceCard({ pin, setCount, filmedCount }) {
  const key = `${pin.label}|${pin.lat}|${pin.lon}`
  const [info, setInfo] = useState(cache.get(key) || null)
  const [imgOk, setImgOk] = useState(true)
  const ref = useRef(null)

  // کارت زیر نقشه‌ست؛ با کلیک روی نقطه خودش جلوی چشم بیاد
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [key])

  useEffect(() => {
    setImgOk(true)
    if (cache.has(key)) {
      setInfo(cache.get(key))
      return
    }
    setInfo(null)
    let cancelled = false
    const params = new URLSearchParams({ label: pin.label, lat: String(pin.lat), lon: String(pin.lon) })
    fetch(`/api/place?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const value = data && !data.error ? data : {}
        cache.set(key, value)
        setInfo(value)
      })
      .catch(() => !cancelled && setInfo({}))
    return () => {
      cancelled = true
    }
  }, [key, pin.label, pin.lat, pin.lon])

  const meta = [info?.types?.[0], info?.country && info.country !== pin.label ? info.country : null].filter(Boolean).join(' · ')
  const pop = formatPopulation(info?.population)
  const mapUrl = `https://www.openstreetmap.org/?mlat=${pin.lat}&mlon=${pin.lon}#map=${info?.types?.some((t) => /country/i.test(t)) ? 5 : 12}/${pin.lat}/${pin.lon}`

  return (
    <div className="place-card" ref={ref}>
      {info?.image && imgOk ? (
        <img className="place-card-img" src={info.image} alt={pin.label} loading="lazy" onError={() => setImgOk(false)} />
      ) : (
        <div className="place-card-img place-card-img-empty">{info ? '📍' : ''}</div>
      )}
      <div className="place-card-body">
        <div className="place-card-titles">
          <h2 className="place-card-name">{pin.label}</h2>
          {info?.faLabel && (
            <span className="place-card-fa" dir="rtl">
              {info.faLabel}
            </span>
          )}
        </div>
        {meta && <div className="place-card-meta">{meta}</div>}
        {info === null ? (
          <div className="place-card-desc place-card-loading">Loading…</div>
        ) : (
          <>
            {info.description && <p className="place-card-desc">{info.description}</p>}
            {info.faDescription && (
              <p className="place-card-desc" dir="rtl">
                {info.faDescription}
              </p>
            )}
          </>
        )}
        <div className="place-card-stats">
          <span><strong>{setCount}</strong> set here</span>
          <span><strong>{filmedCount}</strong> filmed here</span>
          {pop && <span><strong>{pop}</strong> population</span>}
        </div>
        <div className="place-card-links">
          {info?.enwiki && <a href={info.enwiki} target="_blank" rel="noopener noreferrer">Wikipedia</a>}
          {info?.fawiki && <a href={info.fawiki} target="_blank" rel="noopener noreferrer">ویکی‌پدیای فارسی</a>}
          <a href={mapUrl} target="_blank" rel="noopener noreferrer">Map</a>
          {info?.wikidataUrl && <a href={info.wikidataUrl.replace(/^http:/, 'https:')} target="_blank" rel="noopener noreferrer">Wikidata</a>}
        </div>
      </div>
    </div>
  )
}
