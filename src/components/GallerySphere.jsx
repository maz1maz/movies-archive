import { useEffect, useRef, useState } from 'react'
import { Renderer, Camera, Transform, Program, Mesh, Geometry, Texture, Vec3 } from 'ogl'

// گالری کروی سه‌بعدی — پوسترها دور یه کره چیده می‌شن، کره خودش می‌چرخه،
// با درگ هم می‌شه چرخوندش، با اسکرول زوم می‌کنه. کاملاً مستقل از موتور
// voroforce قبلی (بدون مشکل سازگاری DXT1/iOS، چون از تکسچر خام استفاده می‌کنه).

const vertex = /* glsl */ `
  attribute vec3 center;
  attribute vec2 corner;
  attribute vec2 uv;
  varying vec2 vUv;
  varying float vWorldY;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uRotationY;
  uniform vec2 uBillboardSize;

  void main() {
    vUv = uv;
    float c = cos(uRotationY);
    float s = sin(uRotationY);
    vec3 rotated = vec3(
      center.x * c - center.z * s,
      center.y,
      center.x * s + center.z * c
    );
    vWorldY = center.y; // قبل از چرخش کافیه، چون فقط دور Y می‌چرخیم و y عوض نمی‌شه
    vec4 mvPosition = modelViewMatrix * vec4(rotated, 1.0);
    // بعد از تبدیل model-view، آفست رو اضافه می‌کنیم؛ این باعث می‌شه
    // پوستر همیشه رو به دوربین باشه (billboard) بدون محاسبه‌ی جداگانه.
    mvPosition.xy += corner * uBillboardSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying float vWorldY;
  uniform sampler2D uAtlas;
  uniform float uTime;
  uniform float uRadius;

  void main() {
    vec4 color = texture2D(uAtlas, vUv);
    // نوار نوری طلایی که به‌آرومی از بالا به پایین کره رد می‌شه
    float wave = sin(vWorldY * 0.9 - uTime * 0.6);
    float band = smoothstep(0.94, 1.0, wave); // فقط نزدیک قله‌ی موج روشن بشه (نواری نازک)
    vec3 gold = vec3(0.95, 0.75, 0.25);
    color.rgb = mix(color.rgb, color.rgb + gold * 0.55, band);
    gl_FragColor = color;
  }
`;

// اطلس ساده رو (که از قبل با scripts/build-sphere-atlas.mjs ساخته شده)
// می‌خونه. یه فایل JPG ثابته، بدون هیچ درخواست زنده‌ای به Amazon/Wikimedia
// (که قبلاً باعث بلاک‌شدن/CORS می‌شدن).
async function loadStaticAtlas(onProgress) {
  onProgress?.(10, 100)
  const configRes = await fetch('/sphere-media/atlas-config.json')
  if (!configRes.ok) throw new Error('atlas-config.json پیدا نشد')
  const config = await configRes.json()
  onProgress?.(30, 100)

  const img = await new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('atlas.jpg لود نشد'))
    image.src = '/sphere-media/atlas.jpg?v=' + config.count // کش‌باستینگ ساده
  })
  onProgress?.(100, 100)

  const { cols, rows } = config
  const uvRects = new Array(config.count)
  for (let i = 0; i < config.count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    uvRects[i] = {
      u0: col / cols,
      v0: row / rows,
      u1: (col + 1) / cols,
      v1: (row + 1) / rows,
    }
  }
  return { image: img, uvRects, count: config.count, ids: config.ids || [] }
}

// چیدمان یکنواخت نقاط روی سطح کره (الگوریتم Fibonacci sphere)
function fibonacciSphere(n, radius) {
  const points = []
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2 // از ۱ تا -۱
    const r = Math.sqrt(1 - y * y)
    const theta = goldenAngle * i
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    points.push([x * radius, y * radius, z * radius])
  }
  return points
}

export default function GallerySphere({ films, onBack, onOpenFilm }) {
  const containerRef = useRef(null)
  const [progress, setProgress] = useState({ loaded: 0, total: 0 })
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState(null)

  const seenPosters = new Set()
  const postersOnly = films
    .filter((f) => f.poster)
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .filter((f) => {
      if (seenPosters.has(f.poster)) return false
      seenPosters.add(f.poster)
      return true
    })

  // --- نوارهای مارکی پشت کره: چند ردیف پوستر که از چپ/راست میان و
  // پشت کره محو می‌شن. عکس‌ها مستقیم (بدون پراکسی) لود می‌شن چون فقط
  // <img> ساده‌ست، نه canvas — CORS اینجا مشکلی ایجاد نمی‌کنه.
  const MARQUEE_ROWS = 26
  const marqueeRows = []
  {
    // قبلاً فقط ۷۰ تا پوستر نمونه بود که بین ۲۶ ردیف تقسیم بشه (~۳ تا هر
    // ردیف) — عرض واقعیش خیلی کمتر از عرض صفحه بود، برای همون سمت راست
    // خالی می‌موند. این بار از کل پوسترها استفاده می‌کنیم.
    const sampleSize = Math.min(postersOnly.length, MARQUEE_ROWS * 40)
    const step = Math.max(1, Math.floor(postersOnly.length / sampleSize))
    const sample = []
    for (let i = 0; i < postersOnly.length && sample.length < sampleSize; i += step) {
      sample.push(postersOnly[i])
    }
    for (let r = 0; r < MARQUEE_ROWS; r++) {
      const rowItems = sample.filter((_, i) => i % MARQUEE_ROWS === r)
      marqueeRows.push([...rowItems, ...rowItems]) // دو نسخه، برای لوپ بی‌درز با translateX(-50%)
    }
  }

  useEffect(() => {
    if (!containerRef.current || postersOnly.length === 0) return
    let disposed = false
    let cleanupFns = []

    async function init() {
      const container = containerRef.current
      const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 2), alpha: true })
      const gl = renderer.gl
      gl.clearColor(0, 0, 0, 0) // شفاف — تا نوارهای پوستر پشت صحنه (مارکی) دیده بشن
      container.appendChild(gl.canvas)

      const camera = new Camera(gl, { fov: 45, near: 0.1, far: 100 })
      const RADIUS = 8
      camera.position.set(0, 0, RADIUS * 2.4)
      camera.lookAt([0, 0, 0])

      function resize() {
        const { clientWidth, clientHeight } = container
        if (!clientWidth || !clientHeight) return
        renderer.setSize(clientWidth, clientHeight)
        camera.perspective({ aspect: clientWidth / clientHeight })
      }
      resize()
      window.addEventListener('resize', resize)
      cleanupFns.push(() => window.removeEventListener('resize', resize))

      const scene = new Transform()

      const atlas = await loadStaticAtlas((loaded, total) => setProgress({ loaded, total }))
      if (disposed) return
      setReady(true)

      const texture = new Texture(gl, { generateMipmaps: false, flipY: false })
      texture.image = atlas.image
      texture.needsUpdate = true

      const n = atlas.count
      const positions = fibonacciSphere(n, RADIUS)
      // اطلس بر اساس films.json (یه snapshot ثابت) ساخته شده، ولی این
      // کامپوننت دیتای زنده (allFilmsUnfiltered) رو می‌گیره که ممکنه فرق
      // داشته باشه (فیلم جدید اضافه شده و...). به‌جای match با ایندکس آرایه
      // (که قبلاً باعث می‌شد کلیک روی یه پوستر، اطلاعات فیلم اشتباه رو نشون
      // بده)، از id واقعی هر فیلم استفاده می‌کنیم که همیشه درست باشه.
      const filmsById = new Map(films.map((f) => [String(f.id), f]))
      const centerArr = new Float32Array(n * 6 * 3)
      const cornerArr = new Float32Array(n * 6 * 2)
      const uvArr = new Float32Array(n * 6 * 2)

      const corners = [
        [-1, -1], [1, -1], [1, 1],
        [-1, -1], [1, 1], [-1, 1],
      ]
      const uvCorners = [
        [0, 1], [1, 1], [1, 0],
        [0, 1], [1, 0], [0, 0],
      ]

      let ci = 0, co = 0, ui = 0
      for (let i = 0; i < n; i++) {
        const [x, y, z] = positions[i]
        const rect = atlas.uvRects[i]
        for (let v = 0; v < 6; v++) {
          centerArr[ci++] = x
          centerArr[ci++] = y
          centerArr[ci++] = z
          cornerArr[co++] = corners[v][0]
          cornerArr[co++] = corners[v][1]
          const [uc, vc] = uvCorners[v]
          uvArr[ui++] = uc === 0 ? rect.u0 : rect.u1
          uvArr[ui++] = vc === 0 ? rect.v0 : rect.v1
        }
      }

      const geometry = new Geometry(gl, {
        center: { size: 3, data: centerArr },
        corner: { size: 2, data: cornerArr },
        uv: { size: 2, data: uvArr },
      })

      const billboardSize = ((RADIUS * 2 * Math.PI) / Math.sqrt(n) / 2.2) * 0.55 // قبلاً خیلی بزرگ بود، تقریباً نصفش کردیم

      const program = new Program(gl, {
        vertex,
        fragment,
        uniforms: {
          uAtlas: { value: texture },
          uRotationY: { value: 0 },
          uBillboardSize: { value: [billboardSize * 0.66, billboardSize] },
          uTime: { value: 0 },
          uRadius: { value: RADIUS },
        },
        transparent: false,
      })

      const mesh = new Mesh(gl, { geometry, program })
      mesh.setParent(scene)

      // --- تعامل: چرخش خودکار + درگ برای چرخش دستی + اسکرول برای زوم ---
      let autoRotation = 0
      let dragRotation = 0
      let camElevation = 0 // زاویه‌ی عمودی دوربین (بالا/پایین)
      let isDragging = false
      let lastX = 0
      let lastY = 0
      let dragVelocity = 0
      let camDistance = RADIUS * 2.4
      const minDist = RADIUS * 1.3
      const maxDist = RADIUS * 5
      const MAX_ELEVATION = 1.45 // کمی کمتر از ۹۰ درجه، تا کاملاً روی قطب گیر نکنه

      function onPointerDown(e) {
        isDragging = true
        lastX = e.clientX
        lastY = e.clientY
        dragVelocity = 0
      }
      function onPointerMove(e) {
        if (!isDragging) return
        const dx = e.clientX - lastX
        const dy = e.clientY - lastY
        lastX = e.clientX
        lastY = e.clientY
        dragVelocity = dx * 0.005
        dragRotation += dragVelocity
        camElevation = Math.min(MAX_ELEVATION, Math.max(-MAX_ELEVATION, camElevation + dy * 0.005))
      }
      function onPointerUp() {
        isDragging = false
      }
      function onWheel(e) {
        e.preventDefault()
        camDistance = Math.min(maxDist, Math.max(minDist, camDistance * Math.exp(e.deltaY * 0.001)))
      }

      // --- پینچ دو انگشتی برای زوم روی موبایل (wheel روی تاچ وجود نداره) ---
      let pinchStartDist = null
      let pinchStartCamDistance = camDistance
      function touchDist(touches) {
        const dx = touches[0].clientX - touches[1].clientX
        const dy = touches[0].clientY - touches[1].clientY
        return Math.hypot(dx, dy)
      }
      function onTouchStart(e) {
        if (e.touches.length === 2) {
          isDragging = false // موقع پینچ، چرخش با انگشت اول رو خاموش کن
          pinchStartDist = touchDist(e.touches)
          pinchStartCamDistance = camDistance
        }
      }
      function onTouchMove(e) {
        if (e.touches.length === 2 && pinchStartDist) {
          e.preventDefault()
          const dist = touchDist(e.touches)
          const scale = pinchStartDist / dist
          camDistance = Math.min(maxDist, Math.max(minDist, pinchStartCamDistance * scale))
        }
      }
      function onTouchEnd(e) {
        if (e.touches.length < 2) pinchStartDist = null
      }
      gl.canvas.addEventListener('touchstart', onTouchStart, { passive: true })
      gl.canvas.addEventListener('touchmove', onTouchMove, { passive: false })
      gl.canvas.addEventListener('touchend', onTouchEnd, { passive: true })
      cleanupFns.push(() => {
        gl.canvas.removeEventListener('touchstart', onTouchStart)
        gl.canvas.removeEventListener('touchmove', onTouchMove)
        gl.canvas.removeEventListener('touchend', onTouchEnd)
      })
      gl.canvas.addEventListener('pointerdown', onPointerDown)
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      gl.canvas.addEventListener('wheel', onWheel, { passive: false })
      cleanupFns.push(() => {
        gl.canvas.removeEventListener('pointerdown', onPointerDown)
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        gl.canvas.removeEventListener('wheel', onWheel)
      })

      // کلیک (بدون درگ) = پیدا کردن نزدیک‌ترین پوستر به نقطه‌ی کلیک
      let dragMoved = false
      function onPointerDownTrack() {
        dragMoved = false
      }
      function onPointerMoveTrack(e) {
        if (isDragging && Math.abs(e.movementX) > 2) dragMoved = true
      }
      function onClick(e) {
        if (dragMoved) return
        const rect = container.getBoundingClientRect()
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
        const totalRotation = autoRotation + dragRotation
        const c = Math.cos(totalRotation)
        const s = Math.sin(totalRotation)
        // پروجکشن دقیق با خود ماتریس دوربین (به‌جای فرمول دستی قبلی که
        // مطمئن نبودیم درست باشه) — camera.projectionViewMatrix بعد از هر
        // renderer.render() آپدیت می‌شه، پس همیشه با آخرین فریم هماهنگه.
        let best = -1
        let bestDist = Infinity
        const v = new Vec3()
        for (let i = 0; i < n; i++) {
          const [x, y, z] = positions[i]
          const rx = x * c - z * s
          const rz = x * s + z * c
          v.set(rx, y, rz)
          v.applyMatrix4(camera.projectionViewMatrix)
          // v.x/v.y الان توی فضای NDC هستن (بین -۱ و ۱ اگه جلوی دوربین باشه)
          if (v.z < -1 || v.z > 1) continue // پشت دوربین یا خارج از far/near
          const dx = v.x - ndcX
          const dy = v.y - ndcY
          const d = dx * dx + dy * dy
          if (d < bestDist) {
            bestDist = d
            best = i
          }
        }
        if (best >= 0) {
          console.log('[GallerySphere] click best index', best, 'dist', bestDist.toFixed(4))
        }
        if (best >= 0 && bestDist < 0.15) {
          const filmId = atlas.ids[best]
          const film = filmId != null ? filmsById.get(String(filmId)) : undefined
          if (film) {
            onOpenFilm(film)
          } else {
            console.warn('[GallerySphere] click matched index', best, 'id', filmId, 'but no matching film in live data')
          }
        }
      }
      gl.canvas.addEventListener('pointerdown', onPointerDownTrack)
      window.addEventListener('pointermove', onPointerMoveTrack)
      gl.canvas.addEventListener('click', onClick)
      cleanupFns.push(() => {
        gl.canvas.removeEventListener('pointerdown', onPointerDownTrack)
        window.removeEventListener('pointermove', onPointerMoveTrack)
        gl.canvas.removeEventListener('click', onClick)
      })

      let raf
      const AUTO_SPEED = 0.00002 // دوباره نصف شد
      function loop(t) {
        raf = requestAnimationFrame(loop)
        autoRotation = t * AUTO_SPEED
        program.uniforms.uRotationY.value = autoRotation + dragRotation
        program.uniforms.uTime.value = t / 1000
        camera.position.set(0, camDistance * Math.sin(camElevation), camDistance * Math.cos(camElevation))
        camera.lookAt([0, 0, 0])
        renderer.render({ scene, camera })
      }
      raf = requestAnimationFrame(loop)
      cleanupFns.push(() => cancelAnimationFrame(raf))
    }

    init().catch((err) => {
      console.error('GallerySphere init failed:', err)
      setLoadError(err.message || String(err))
    })

    return () => {
      disposed = true
      cleanupFns.forEach((fn) => fn())
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postersOnly.length])

  const pct = progress.total ? Math.round((progress.loaded / progress.total) * 100) : 0

  return (
    <div className="folder-nav" style={{ overflow: 'hidden' }}>
      <style>{`
        @keyframes marqueeLTR { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        @keyframes marqueeRTL { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>

      {/* نوارهای مارکی: پشت کره، یه ردیف تصویر که پیوسته از چپ/راست رد می‌شن
          و وسط صفحه (پشت کره) محو می‌شن — با mask-image شفاف در وسط */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          overflow: 'hidden',
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
          gap: 2,
        }}
      >
        {marqueeRows.map((rowItems, r) => {
          if (rowItems.length === 0) return null
          const reverse = r % 2 === 1
          const duration = 55 + r * 4
          return (
            <div
              key={r}
              style={{
                width: '100%',
                overflow: 'hidden',
                WebkitMaskImage:
                  'linear-gradient(to right, black 0%, black 30%, transparent 46%, transparent 54%, black 70%, black 100%)',
                maskImage:
                  'linear-gradient(to right, black 0%, black 30%, transparent 46%, transparent 54%, black 70%, black 100%)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  width: 'max-content',
                  gap: 4,
                  animation: `${reverse ? 'marqueeRTL' : 'marqueeLTR'} ${duration}s linear infinite`,
                  opacity: 0.55,
                }}
              >
                {rowItems.map((f, i) => (
                  <img
                    key={i}
                    src={f.poster}
                    alt=""
                    style={{ height: 26, width: 18, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }}
                    loading="lazy"
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <button
        className="btn btn-ghost"
        onClick={onBack}
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.55)',
          color: '#f4f3f0',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 8,
          padding: '8px 16px',
          cursor: 'pointer',
        }}
      >
        ← Back
      </button>
      {!ready && !loadError && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            color: '#eee',
            background: '#0a0a0c',
            zIndex: 10,
          }}
        >
          <div>در حال بارگذاری گالری کروی…</div>
          <div style={{ width: 240, height: 6, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#c0392b', transition: 'width 0.15s linear' }} />
          </div>
        </div>
      )}
      {loadError && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: '#eee',
            background: '#0a0a0c',
            zIndex: 10,
            textAlign: 'center',
            padding: 20,
          }}
        >
          <div>اطلس گالری هنوز ساخته نشده.</div>
          <code style={{ opacity: 0.7 }}>node scripts/build-sphere-atlas.mjs</code>
          <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>{loadError}</div>
        </div>
      )}
      <div ref={containerRef} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 2 }} />
    </div>
  )
}
