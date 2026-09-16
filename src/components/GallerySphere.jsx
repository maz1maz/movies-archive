import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// گالری سه‌بعدیِ پوسترها — نسخه‌ی دوم، جایگزینِ نسخه‌ی قبلی (رندر WebGL/ogl
// روی یه اطلس تکسچر از پیش‌ساخته‌شده با scripts/build-sphere-atlas.mjs).
// اون نسخه هم نیاز به یه مرحله‌ی build جدا داشت (اگه اطلس ساخته نشده بود
// صفحه خطا می‌داد) هم روی Safari/iOS به‌خاطر فشرده‌سازی DXT1/S3TC مشکل
// داشت. این نسخه به‌جای GPU instancing، هر پوستر رو یه <img> ساده می‌ذاره
// و موقعیت سه‌بعدیش رو با یه پروجکشن دستی (بدون WebGL) هر فریم حساب
// می‌کنه — دقیقاً همون <img src={f.poster}> ایه که همه‌جای بقیه‌ی اپ
// استفاده می‌شه، پس نه build جدا لازمه نه مشکل سازگاری مرورگر.
// چون این‌جا هر پوستر یه DOM node واقعیه (نه یه سلول GPU)، با هزاران‌تا
// روی موبایل کند می‌شه — برای همین (بر خلاف نسخه‌ی قبلی که کل آرشیو رو
// می‌ذاشت) اینجا به MAX_POSTERS محدود می‌کنیم، با یه نمونه‌برداریِ یکنواخت
// از کل آرشیو (نه فقط چندصدتای اول) تا تنوع واقعی حفظ بشه.
const MAX_POSTERS = 260

const LAYOUTS = [
  { key: 'sphere', label: 'Sphere' },
  { key: 'galaxy', label: 'Galaxy' },
  { key: 'grid', label: 'Wall' },
  { key: 'helix', label: 'Helix' },
  { key: 'wave', label: 'Wave' },
  { key: 'ring', label: 'Rings' },
]

const TILT_ANGLES = [-7, 4, -3, 6, -5, 3, -8, 5, -4, 7, -6, 2, -2, 8]

// شبه‌تصادفی deterministic (بدون کتابخونه‌ی اضافه) — برای jitter هر چیدمان
function rnd(i, salt) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

// موقعیتِ x/y/z (پیکسل) هر پوستر رو برای هر چیدمان حساب می‌کنه.
function computeLayout(key, n, R) {
  const p = new Float32Array(n * 3)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    let x = 0
    let y = 0
    let z = 0
    switch (key) {
      case 'sphere': {
        const yy = n > 1 ? 1 - (i / (n - 1)) * 2 : 0
        const rad = Math.sqrt(Math.max(0, 1 - yy * yy))
        const th = golden * i
        const jitter = 0.94 + rnd(i, 3) * 0.12
        x = Math.cos(th) * rad * R * jitter
        y = yy * R * jitter
        z = Math.sin(th) * rad * R * jitter
        break
      }
      case 'galaxy': {
        const t = i / n
        const arm = i % 3
        const ang = t * Math.PI * 3.2 + (arm * Math.PI * 2) / 3
        const rr = R * (0.16 + t * 1.22) * (0.9 + rnd(i, 1) * 0.2)
        x = Math.cos(ang) * rr
        z = Math.sin(ang) * rr
        y = (rnd(i, 2) - 0.5) * R * 0.22 + Math.sin(t * 9) * R * 0.05
        break
      }
      case 'grid': {
        const cols = Math.ceil(Math.sqrt(n * 1.9))
        const rows = Math.ceil(n / cols)
        const c = i % cols
        const rw = Math.floor(i / cols)
        const sx = (R * 2.35) / cols
        const sy = sx * 1.52
        x = (c - (cols - 1) / 2) * sx
        y = (rw - (rows - 1) / 2) * sy
        z = Math.sin(c * 0.55) * Math.cos(rw * 0.6) * R * 0.14
        break
      }
      case 'helix': {
        const ang = i * 0.36
        const rr = R * 0.82
        x = Math.cos(ang) * rr
        z = Math.sin(ang) * rr
        y = (i - (n - 1) / 2) * ((R * 2.5) / n)
        break
      }
      case 'wave': {
        const cols = Math.ceil(Math.sqrt(n * 2.4))
        const rows = Math.ceil(n / cols)
        const c = i % cols
        const rw = Math.floor(i / cols)
        const sx = (R * 2.6) / cols
        x = (c - (cols - 1) / 2) * sx
        z = (rw - (rows - 1) / 2) * sx * 1.5
        y = Math.sin(c * 0.45 + rw * 0.35) * R * 0.34
        break
      }
      case 'ring': {
        const bands = 5
        const per = Math.ceil(n / bands)
        const band = Math.floor(i / per)
        const idx = i % per
        const ang = (idx / per) * Math.PI * 2 + band * 0.4
        const rr = R * (0.42 + band * 0.19)
        x = Math.cos(ang) * rr
        z = Math.sin(ang) * rr
        y = (band - (bands - 1) / 2) * R * 0.1 + (rnd(i, 4) - 0.5) * R * 0.04
        break
      }
      default:
        break
    }
    p[i * 3] = x
    p[i * 3 + 1] = y
    p[i * 3 + 2] = z
  }
  return p
}

export default function GallerySphere({ films, onBack, onOpenFilm }) {
  // همون منطق قبلی: هر فیلم بدون پوستر رو کنار می‌ذاریم، و چون یه فیلم
  // می‌تونه هم نسخه‌ی فیزیکی هم دیجیتال داشته باشه (دو ردیف، یه پوستر)،
  // بر اساس آدرس پوستر یکتاسازی می‌کنیم تا تکراری توی گالری نیاد.
  // بعد، چون این‌جا هر پوستر یه DOM node واقعیه، به MAX_POSTERS با
  // نمونه‌برداریِ یکنواخت (نه فقط N تای اول) محدود می‌کنیم.
  const postersOnly = useMemo(() => {
    const seen = new Set()
    const deduped = films
      .filter((f) => f.poster)
      .slice()
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .filter((f) => {
        if (seen.has(f.poster)) return false
        seen.add(f.poster)
        return true
      })
    if (deduped.length <= MAX_POSTERS) return deduped
    // شافل Fisher-Yates بعد slice — هر بار که این صفحه باز می‌شه یه
    // نمونه‌ی رندوم تازه از کل آرشیو (نه همیشه همون ۲۶۰ تا)
    const shuffled = deduped.slice()
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.slice(0, MAX_POSTERS)
  }, [films])

  const n = postersOnly.length

  const [layout, setLayout] = useState('sphere')
  const wrapRef = useRef(null)
  const stageRef = useRef(null)
  const tipRef = useRef(null)
  const tipTitleRef = useRef(null)
  const tipSubRef = useRef(null)
  const tiles = useRef([])
  const [tileW, setTileW] = useState(52)

  const cur = useRef(new Float32Array(n * 3))
  const tgt = useRef(computeLayout(layout, n, 320))
  const dims = useRef({ R: 320, w: 1000, h: 700 })
  const hoverIdx = useRef(null)
  const inited = useRef(false)

  const S = useRef({
    yaw: 0.4,
    pitch: -0.18,
    vYaw: 0,
    vPitch: 0,
    zoom: 1,
    zoomT: 1,
    drag: false,
    px: 0,
    py: 0,
    moved: 0,
    intro: 0,
    pinchDist: null,
    pinchZoomT: 1,
  })

  // موقع عوض‌شدن چیدمان، فقط هدف حرکت (tgt) عوض می‌شه — حلقه‌ی انیمیشن
  // خودش با ease به سمت موقعیت جدید می‌ره، پس جابه‌جایی بین چیدمان‌ها
  // نرمه، نه پرش ناگهانی.
  useEffect(() => {
    tgt.current = computeLayout(layout, n, dims.current.R)
  }, [layout, n])

  const relayout = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const w = el.clientWidth
    const h = el.clientHeight
    const R = Math.max(170, Math.min(Math.min(w, h) * 0.46, 480))
    dims.current = { R, w, h }
    tgt.current = computeLayout(layout, n, R)
    setTileW(Math.round(Math.max(30, Math.min(R * 0.172, 74))))
    if (!inited.current) {
      inited.current = true
      // شروع از حالت «منفجرشده» بیرون از دید، تا آرشیو موقع لود انگار
      // جمع می‌شه توی شکل نهایی (همون حس ورود قبلی)
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const b = Math.acos(2 * Math.random() - 1)
        const rr = R * (2.6 + Math.random() * 2.4)
        cur.current[i * 3] = Math.sin(b) * Math.cos(a) * rr
        cur.current[i * 3 + 1] = Math.cos(b) * rr
        cur.current[i * 3 + 2] = Math.sin(b) * Math.sin(a) * rr
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n])

  useEffect(() => {
    relayout()
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(relayout)
    ro.observe(el)
    return () => ro.disconnect()
  }, [relayout])

  // --- حلقه‌ی رندر: هر فریم موقعیت سه‌بعدی رو به ۲بعدی پروجکت می‌کنه و
  // مستقیم روی استایل هر تایل می‌نویسه (بدون state/re-render) ---
  useEffect(() => {
    let raf
    let last = performance.now()

    const frame = (t) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      const s = S.current
      const { R } = dims.current

      s.intro = Math.min(1, s.intro + dt * 0.75)
      if (!s.drag) {
        s.vYaw *= 0.94
        s.vPitch *= 0.9
      }
      // چرخش خودکار هیچ‌وقت متوقف نمی‌شه (طبق تجربه‌ی نسخه‌ی قبلی، کاربر
      // ترجیح داد همیشه بچرخه، نه فقط موقع بی‌کاری)
      const AUTO = 0.17
      s.yaw += (s.vYaw + AUTO) * dt
      s.pitch += s.vPitch * dt
      s.pitch = Math.max(-1.15, Math.min(1.15, s.pitch))
      s.zoom += (s.zoomT - s.zoom) * Math.min(1, dt * 7)

      const cy = Math.cos(s.yaw)
      const sy = Math.sin(s.yaw)
      const cp = Math.cos(s.pitch)
      const sp = Math.sin(s.pitch)
      const D = R * 3.3
      const ease = Math.min(1, dt * 4.2)
      const breathe = Math.sin(t * 0.0005) * 0.02 + 1
      let hx = 0
      let hy = 0
      let hs = 1
      let hFound = false

      for (let i = 0; i < n; i++) {
        const el = tiles.current[i]
        if (!el) continue
        const k = i * 3
        cur.current[k] += (tgt.current[k] - cur.current[k]) * ease
        cur.current[k + 1] += (tgt.current[k + 1] - cur.current[k + 1]) * ease
        cur.current[k + 2] += (tgt.current[k + 2] - cur.current[k + 2]) * ease

        const x = cur.current[k]
        const y = cur.current[k + 1]
        const z = cur.current[k + 2]
        const x1 = x * cy - z * sy
        const z1 = x * sy + z * cy
        const y2 = y * cp - z1 * sp
        const z2 = y * sp + z1 * cp

        const persp = Math.min(2.6, D / Math.max(40, D - z2))
        const sc = persp * s.zoom * breathe
        const x2 = x1 * persp * s.zoom
        const yy2 = y2 * persp * s.zoom

        let op = Math.max(0.06, Math.min(1, (persp - 0.66) / 0.55)) * s.intro
        const pulse = 1

        el.style.transform = `translate3d(${x2.toFixed(2)}px,${yy2.toFixed(2)}px,0) scale(${(sc * pulse).toFixed(3)})`
        el.style.opacity = op.toFixed(3)
        // زوم و چرخش مدام، persp رو پیوسته عوض می‌کنن؛ ضریب قبلی (400) خیلی
        // کم‌دقت بود، پس دو پوستر نزدیک به هم راحت روی یه z-index رند
        // می‌شدن و لبه‌شون موقع رد شدن از هم می‌پرید (ترتیب استک ناگهانی
        // عوض می‌شد به‌جای این‌که واقعاً همدیگه رو رد کرده باشن). ضریب خیلی
        // بزرگ‌تر یعنی z-index فقط دقیقاً سرِ تقاطع واقعی عوض می‌شه.
        el.style.zIndex = String(Math.round(persp * 100000))
        const clickable = op > 0.3 ? 'auto' : 'none'
        if (el.style.pointerEvents !== clickable) el.style.pointerEvents = clickable

        if (hoverIdx.current === i) {
          hx = x2
          hy = yy2
          hs = sc
          hFound = true
        }
      }

      if (tipRef.current) {
        if (hFound && !s.drag) {
          tipRef.current.style.transform = `translate3d(${hx.toFixed(1)}px, ${(hy - (tileW * 1.5 * hs) / 2 - 14).toFixed(1)}px, 0) translate(-50%,-100%)`
          tipRef.current.style.opacity = '1'
        } else {
          tipRef.current.style.opacity = '0'
        }
      }
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [n, tileW])

  // --- تعامل: درگ برای چرخش، اسکرول/پینچ برای زوم، فلش‌ها برای چرخش ---
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const onWheel = (e) => {
      e.preventDefault()
      const s = S.current
      s.zoomT = Math.max(0.45, Math.min(2.4, s.zoomT * (e.deltaY > 0 ? 0.92 : 1.08)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })

    const onKey = (e) => {
      const s = S.current
      if (e.key === 'ArrowLeft') s.vYaw -= 0.35
      if (e.key === 'ArrowRight') s.vYaw += 0.35
      if (e.key === 'ArrowUp') s.vPitch -= 0.25
      if (e.key === 'ArrowDown') s.vPitch += 0.25
    }
    window.addEventListener('keydown', onKey)

    const onMove = (e) => {
      const s = S.current
      if (!s.drag) return
      const dx = e.clientX - s.px
      const dy = e.clientY - s.py
      s.px = e.clientX
      s.py = e.clientY
      s.moved += Math.abs(dx) + Math.abs(dy)
      const k = 0.0052
      s.yaw += dx * k
      s.pitch = Math.max(-1.15, Math.min(1.15, s.pitch - dy * k))
      s.vYaw = dx * k * 26
      s.vPitch = -dy * k * 22
      if (s.moved > 8 && tipRef.current) tipRef.current.style.opacity = '0'
    }
    const onUp = () => {
      S.current.drag = false
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    // پینچ دو انگشتی برای زوم روی موبایل (wheel روی تاچ وجود نداره)
    const touchDist = (touches) => {
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      return Math.hypot(dx, dy)
    }
    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        S.current.drag = false
        S.current.pinchDist = touchDist(e.touches)
        S.current.pinchZoomT = S.current.zoomT
      }
    }
    const onTouchMove = (e) => {
      if (e.touches.length === 2 && S.current.pinchDist) {
        e.preventDefault()
        const dist = touchDist(e.touches)
        const scale = dist / S.current.pinchDist
        S.current.zoomT = Math.max(0.45, Math.min(2.4, S.current.pinchZoomT * scale))
      }
    }
    const onTouchEnd = (e) => {
      if (e.touches.length < 2) S.current.pinchDist = null
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  const down = (e) => {
    const s = S.current
    s.drag = true
    s.moved = 0
    s.px = e.clientX
    s.py = e.clientY
  }
  const up = () => {
    S.current.drag = false
  }

  const setTip = (f) => {
    if (tipTitleRef.current) tipTitleRef.current.textContent = f ? f.title : ''
    if (tipSubRef.current) {
      tipSubRef.current.textContent = f ? [f.year, f.rating ? `★ ${Number(f.rating).toFixed(1)}` : null].filter(Boolean).join(' · ') : ''
    }
  }

  const zoomBy = (f) => {
    const s = S.current
    s.zoomT = Math.max(0.45, Math.min(2.4, s.zoomT * f))
  }
  const resetView = () => {
    const s = S.current
    s.zoomT = 1
    s.yaw = 0.4
    s.pitch = -0.18
    s.vYaw = 0
    s.vPitch = 0
  }

  const tileH = tileW * 1.5

  return (
    <div className="folder-nav sphere-page" style={{ overflow: 'hidden' }}>
      <button className="btn btn-ghost sphere-back" onClick={onBack}>
        ← Back
      </button>

      <div className="sphere-layout-switch">
        {LAYOUTS.map((l) => (
          <button
            key={l.key}
            type="button"
            className={layout === l.key ? 'sphere-layout-btn sphere-layout-btn-active' : 'sphere-layout-btn'}
            onClick={() => setLayout(l.key)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="sphere-zoom-controls">
        <button type="button" onClick={() => zoomBy(1.18)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoomBy(0.85)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={resetView} aria-label="Reset view">
          ⟳
        </button>
      </div>

      <div
        ref={wrapRef}
        className="sphere-stage"
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={() => {
          hoverIdx.current = null
          setTip(null)
        }}
      >
        <div ref={stageRef} className="sphere-inner">
          {postersOnly.map((f, i) => (
            <div
              key={f.id}
              ref={(el) => {
                tiles.current[i] = el
              }}
              className="sphere-tile"
              style={{ width: tileW, height: tileH, marginLeft: -tileW / 2, marginTop: -tileH / 2 }}
              onPointerEnter={() => {
                hoverIdx.current = i
                setTip(f)
              }}
              onPointerLeave={() => {
                if (hoverIdx.current === i) {
                  hoverIdx.current = null
                  setTip(null)
                }
              }}
              onClick={() => {
                if (S.current.moved < 7) onOpenFilm(f)
              }}
            >
              <div className="sphere-tile-inner" style={{ '--tilt': `${TILT_ANGLES[i % TILT_ANGLES.length]}deg` }}>
                <img src={f.poster} alt="" loading={i < 24 ? 'eager' : 'lazy'} />
              </div>
            </div>
          ))}

          <div ref={tipRef} className="sphere-tooltip">
            <div ref={tipTitleRef} className="sphere-tooltip-title" />
            <div ref={tipSubRef} className="sphere-tooltip-sub" />
          </div>
        </div>
      </div>
    </div>
  )
}
