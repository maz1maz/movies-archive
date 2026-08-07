import { useEffect, useRef, useState } from 'react'
import { Voroforce } from '../voroforce/index'
import mainFrag from '../voroforce-shaders/main.frag'

// پنل «گالری» — نمای بصری voronoi از پوسترها با موتور واقعی Voroforce.
// از همون allFilmsUnfiltered که بقیه‌ی اپ استفاده می‌کنه تغذیه می‌شه،
// یعنی نیازی به دیتای جدا یا هماهنگ‌سازی دستی نیست.
export default function GalleryPanel({ films, onBack, onOpenFilm }) {
  const containerRef = useRef(null)
  const vfRef = useRef(null)
  const [mediaConfig, setMediaConfig] = useState(undefined)
  const [mediaStatus, setMediaStatus] = useState('loading') // 'loading' | 'ready' | 'missing'
  const [engineError, setEngineError] = useState(null)

  // خروجی scripts/build-gallery-media.mjs را می‌خواند.
  // اگر هنوز اجرا نشده، بدون تکسچر (فقط سلول‌های رنگی voronoi) نشون می‌ده.
  useEffect(() => {
    fetch('/gallery-media/vf-media-config.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        setMediaConfig(cfg || undefined)
        setMediaStatus(cfg ? 'ready' : 'missing')
      })
      .catch(() => setMediaStatus('missing'))
  }, [])

  // مهم: باید دقیقاً همون ترتیبی باشه که scripts/build-gallery-media.mjs
  // موقع ساخت اطلس استفاده کرده (sort بر اساس id) — وگرنه index هر سلول
  // به پوستر اشتباهی اشاره می‌کنه.
  const postersOnly = films
    .filter((f) => f.poster)
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))

  useEffect(() => {
    if (!containerRef.current || postersOnly.length === 0 || mediaStatus === 'loading') return

    let vf
    let cancelled = false

    const init = () => {
      if (cancelled || !containerRef.current) return
      const { clientWidth, clientHeight } = containerRef.current
      if (clientWidth === 0 || clientHeight === 0) {
        // هنوز layout مرورگر کامل نشده (کانتینر اندازه‌ی صفر داره) — یه فریم
        // دیگه صبر کن. اگه بدون این چک بریم جلو، calculateOptimalLattice
        // موتور یه گرید ۱x۱ می‌سازه و برای هزاران سلول خطای «Invalid index»
        // پرت می‌کنه.
        requestAnimationFrame(init)
        return
      }
      try {
        vf = new Voroforce(containerRef.current, {
          cells: postersOnly.length,
          media: mediaConfig ?? { enabled: false },
          multiThreading: { enabled: false },
          ticker: { mode: 'auto' },
          // بدون این، calculateOptimalLattice داخل موتور به NaN می‌رسه
          // (cellWidth / cellAspect با cellAspect==undefined) و همیشه به یه
          // گرید ۱×۱ سقوط می‌کنه — دقیقاً همون چیزی که باعث خطای
          // "Invalid index" / "out of grid bounds (1x1)" می‌شد.
          lattice: { aspect: 2 / 3 }, // نسبت استاندارد پوستر فیلم (عرض/ارتفاع)
          simulation: {
            steps: {
              force: {
                forces: {
                  type: 'origin',
                  enabled: true,
                  strength: 0.8,
                  xFactor: 0, // X رو کاملاً به موج دستی زیر می‌سپاریم (تداخل نکنه)
                },
              },
            },
          },
          display: {
            scene: {
              main: {
                // شیدر واقعی رندر voronoi از پروژه‌ی nothing-to-watch (منبع باز،
                // CC-BY-NC-SA — برای آرشیو شخصی/غیرتجاری مشکلی نداره).
                // مقادیر uniform پایین، نسخه‌ی ساده‌شده‌ی (بدون سیستم
                // mode/theme پیچیده‌ی پروژه‌ی اصلی) تنظیمات پیش‌فرض «حالت عادی»شونه.
                fragmentShader: mainFrag,
                uniforms: {
                  iForcedMaxNeighborLevel: { value: 0 },
                  fPixelSearchRadiusMod: { value: 1 },
                  bMediaDistortion: { value: false },
                  fBaseColor: { value: [0, 0, 0] },
                  fBorderRoundnessMod: { value: 0.4 },
                  fBorderThicknessMod: { value: 0.15 },
                  fBorderSmoothnessMod: { value: 1 },
                  fMediaBboxScale: { value: 1.15 },
                  fCenterForceBulgeStrength: { value: 0.25 },
                  fCenterForceBulgeRadius: { value: 0.25 },
                  fWeightOffsetScaleMod: { value: 0.25 },
                  fWeightOffsetScaleMediaMod: { value: 1 },
                  fUnweightedEffectMod: { value: 0 },
                  fBaseXDistScale: { value: 1.5 },
                  fWeightedXDistScale: { value: 1.5 },
                  fRippleMod: { value: 1 },
                  fNoiseOctaveMod: { value: 1 },
                  fNoiseCenterOffsetMod: { value: 1 },
                  // pan/zoom دستی (اضافه‌شده برای گالری، توی main.frog اصلی نبود)
                  uCameraZoom: { value: 1 },
                  uCameraOffset: { value: [0, 0] },
                },
              },
            },
          },
          controls: {
            // پیش‌فرض موتور zoom رو بین ۱ تا ۱.۵ محدود می‌کنه (طراحی‌شده برای
            // سیستم چندسطحی کیفیت پروژه‌ی اصلی). برای ما که فقط یک سطح
            // داریم، این محدوده اونقدر کمه که اصلاً حس نمی‌شه. بازش می‌کنیم.
            zoom: { enabled: true, min: 1, max: 6 },
          },
        })
        vfRef.current = vf
      } catch (err) {
        // اگه موتور (مثلاً به‌خاطر نبود WebGL2 روی این مرورگر/GPU) کرش کرد،
        // به‌جای صفحه‌ی مشکی بی‌توضیح، پیام خطا نشون بده و دکمه‌ی برگشت رو نگه دار
        console.error('Voroforce init failed:', err)
        setEngineError(err.message || String(err))
        return
      }

      const onCellSelected = (e) => {
        const cell = e.cell
        if (cell && postersOnly[cell.index]) onOpenFilm(postersOnly[cell.index])
      }
      vf.controls.listen('selected', onCellSelected)
      vf._onCellSelected = onCellSelected

      // --- Pan/Zoom دستی (اسکرول = زوم، درگ = پن) ---
      // شیدر اصلی pan/zoom camera نداشت (فقط بولج موضعی سلول هاورشده).
      // این uniformهای uCameraZoom/uCameraOffset رو مستقیم توی pCoords()
      // شیدر تزریق کردیم که کل صحنه رو تحت تأثیر بذاره.
      let zoom = 6.6
      let offsetX = 0
      let offsetY = 0
      const minZoom = 0.5
      const maxZoom = 10

      const applyCamera = () => {
        const uniforms = vf.display?.scene?.mainProgram?.uniforms
        if (!uniforms) return
        if (uniforms.uCameraZoom) uniforms.uCameraZoom.value = zoom
        if (uniforms.uCameraOffset) uniforms.uCameraOffset.value = [offsetX, offsetY]
      }

      const onWheel = (e) => {
        e.preventDefault()
        const factor = Math.exp(-e.deltaY * 0.001)
        zoom = Math.min(maxZoom, Math.max(minZoom, zoom * factor))
        applyCamera()
      }

      let isDragging = false
      let lastX = 0
      let lastY = 0
      const onPointerDown = (e) => {
        isDragging = true
        lastX = e.clientX
        lastY = e.clientY
      }
      const onPointerMove = (e) => {
        if (!isDragging || !containerRef.current) return
        const dx = e.clientX - lastX
        const dy = e.clientY - lastY
        lastX = e.clientX
        lastY = e.clientY
        const { clientWidth, clientHeight } = containerRef.current
        // مختصات شیدر بین ۰ و نسبت‌دار به iResolution است؛ حرکت پیکسلی رو
        // با همون مقیاس (تقسیم بر zoom) به offset دنیای شیدر تبدیل می‌کنیم.
        offsetX -= (dx / clientWidth) * (clientWidth / clientHeight) / zoom
        offsetY += (dy / clientHeight) / zoom
        applyCamera()
      }
      const onPointerUp = () => {
        isDragging = false
      }

      const canvasEl = containerRef.current.querySelector('canvas')
      applyCamera() // مقدار اولیه‌ی زوم (۲.۲) رو همون اول اعمال کن
      canvasEl?.addEventListener('wheel', onWheel, { passive: false })
      canvasEl?.addEventListener('pointerdown', onPointerDown)
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)

      // --- موج افقی ردیف‌به‌ردیف (اضافه‌شده برای گالری Cinefilio) ---
      // به‌جای فیزیک پیچیده‌ی omni-force (که کنترل دقیقش سخته)، مستقیم
      // موقعیت x هر سلول رو حول ix (موقعیت اصلی‌اش توی گرید) نوسان می‌دیم.
      // ردیف‌های زوج و فرد در جهت مخالف حرکت می‌کنن.
      let waveRunning = true
      const WAVE_AMPLITUDE = 0.4 // نسبت به فاصله‌ی سلول‌ها (spacing ≈ 1 واحد) — قبلاً ۰.۱۵ بود، خیلی کم‌اثر بود
      const WAVE_SPEED = 0.0011 // رادیان بر میلی‌ثانیه
      const waveLoop = (t) => {
        if (!waveRunning) return
        const cells = vf.cells || vf.simulation?.sharedCellData?.cells
        if (cells) {
          for (let i = 0; i < cells.length; i++) {
            const cell = cells[i]
            const dir = cell.row % 2 === 0 ? 1 : -1
            cell.x = cell.ix + dir * WAVE_AMPLITUDE * Math.sin(t * WAVE_SPEED + cell.row * 0.3)
          }
        }
        requestAnimationFrame(waveLoop)
      }
      requestAnimationFrame(waveLoop)
      vf._cameraCleanup = () => {
        waveRunning = false
        canvasEl?.removeEventListener('wheel', onWheel)
        canvasEl?.removeEventListener('pointerdown', onPointerDown)
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
      }
    }

    init()

    return () => {
      cancelled = true
      if (vf) {
        try {
          vf.controls.unlisten('selected', vf._onCellSelected)
          vf._cameraCleanup?.()
          vf.dispose?.()
        } catch (err) {
          // نباید کل اپ رو با یه خطای cleanup بکشونیم (مثلاً موقع زدن Back)
          console.error('Voroforce cleanup error (non-fatal):', err)
        }
      }
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postersOnly.length, mediaStatus])

  return (
    <div className="folder-nav" style={{ overflow: 'hidden' }}>
      {/* position: fixed تا مستقل از هر مشکل stacking/overflow توی این صفحه، همیشه بالا و کلیک‌پذیر بمونه */}
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

      {mediaStatus === 'missing' && !engineError && (
        <div style={badgeStyle}>
          Poster texture not built yet — run <code>node scripts/build-gallery-media.mjs</code>
        </div>
      )}

      {engineError && (
        <div style={{ ...badgeStyle, top: 64, maxWidth: 420, right: 16, left: 'auto' }}>
          Gallery engine failed to start: {engineError}
          <br />
          (Check the browser console for details — F12)
        </div>
      )}

      <div ref={containerRef} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }} />
    </div>
  )
}

const badgeStyle = {
  position: 'fixed',
  top: 16,
  right: 16,
  zIndex: 9999,
  background: 'rgba(0,0,0,0.6)',
  color: '#eee',
  padding: '8px 14px',
  borderRadius: 8,
  fontSize: 13,
}
