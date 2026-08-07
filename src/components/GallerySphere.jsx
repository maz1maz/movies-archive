import { useEffect, useRef, useState } from 'react'
import { Renderer, Camera, Transform, Program, Mesh, Geometry, Texture } from 'ogl'

// گالری کروی سه‌بعدی — پوسترها دور یه کره چیده می‌شن، کره خودش می‌چرخه،
// با درگ هم می‌شه چرخوندش، با اسکرول زوم می‌کنه. کاملاً مستقل از موتور
// voroforce قبلی (بدون مشکل سازگاری DXT1/iOS، چون از تکسچر خام استفاده می‌کنه).

const vertex = /* glsl */ `
  attribute vec3 center;
  attribute vec2 corner;
  attribute vec2 uv;
  varying vec2 vUv;

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
  uniform sampler2D uAtlas;
  void main() {
    gl_FragColor = texture2D(uAtlas, vUv);
  }
`;

function loadImage(src, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('timeout: ' + src))
    }, timeoutMs)
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error('load failed: ' + src))
    }
    img.src = src
  })
}

// همه‌ی پوسترها رو توی یه تکسچر بزرگ (اطلس) می‌چینه — یه بار در شروع،
// کاملاً در مرورگر، بدون نیاز به build step یا فرمت فشرده‌ی خاص.
async function buildAtlas(items, tileSize, onProgress, concurrency = 32) {
  const cols = Math.ceil(Math.sqrt(items.length))
  const size = cols * tileSize
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, 0, size, size)

  const uvRects = new Array(items.length)
  items.forEach((_, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    uvRects[i] = {
      u0: col / cols,
      v0: row / cols,
      u1: (col + 1) / cols,
      v1: (row + 1) / cols,
    }
  })

  let loaded = 0
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      const col = i % cols
      const row = Math.floor(i / cols)
      try {
        // به‌جای گرفتن مستقیم از media-amazon.com (که CORS نمی‌ده)، از
        // پراکسی خود Worker رد می‌شیم — همون origin، بدون مشکل CORS.
        const proxiedUrl = '/api/image-proxy?url=' + encodeURIComponent(items[i].poster)
        const img = await loadImage(proxiedUrl, 8000)
        ctx.drawImage(img, col * tileSize, row * tileSize, tileSize, tileSize)
      } catch {
        // خالی می‌مونه (خاکستری تیره) — لینک شکسته، CORS، یا timeout
      }
      loaded++
      if (onProgress) onProgress(loaded, items.length)
    }
  }

  // سقف زمانی کلی: اگه به هر دلیلی (خیلی لینک کند/شکسته) کل فرایند خیلی
  // طول کشید، به‌جای گیرکردن ابدی روی صفحه‌ی لودینگ، با هرچی تا الان
  // آماده شده ادامه می‌دیم.
  const workersPromise = Promise.all(Array.from({ length: concurrency }, worker))
  const overallTimeout = new Promise((resolve) => setTimeout(resolve, 60000))
  await Promise.race([workersPromise, overallTimeout])

  return { canvas, uvRects }
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

  useEffect(() => {
    if (!containerRef.current || postersOnly.length === 0) return
    let disposed = false
    let cleanupFns = []

    async function init() {
      const container = containerRef.current
      const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 2), alpha: false })
      const gl = renderer.gl
      gl.clearColor(0.04, 0.04, 0.05, 1)
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

      const atlas = await buildAtlas(postersOnly, 48, (loaded, total) => setProgress({ loaded, total }))
      if (disposed) return
      setReady(true)

      const texture = new Texture(gl, { generateMipmaps: false })
      texture.image = atlas.canvas
      texture.needsUpdate = true

      const positions = fibonacciSphere(postersOnly.length, RADIUS)
      const n = postersOnly.length
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

      const billboardSize = (RADIUS * 2 * Math.PI) / Math.sqrt(n) / 2.2 // اندازه‌ی تخمینی هر پوستر بر اساس چگالی کره

      const program = new Program(gl, {
        vertex,
        fragment,
        uniforms: {
          uAtlas: { value: texture },
          uRotationY: { value: 0 },
          uBillboardSize: { value: [billboardSize * 0.66, billboardSize] },
        },
        transparent: false,
      })

      const mesh = new Mesh(gl, { geometry, program })
      mesh.setParent(scene)

      // --- تعامل: چرخش خودکار + درگ برای چرخش دستی + اسکرول برای زوم ---
      let autoRotation = 0
      let dragRotation = 0
      let isDragging = false
      let lastX = 0
      let dragVelocity = 0
      let camDistance = RADIUS * 2.4
      const minDist = RADIUS * 1.3
      const maxDist = RADIUS * 5

      function onPointerDown(e) {
        isDragging = true
        lastX = e.clientX
        dragVelocity = 0
      }
      function onPointerMove(e) {
        if (!isDragging) return
        const dx = e.clientX - lastX
        lastX = e.clientX
        dragVelocity = dx * 0.005
        dragRotation += dragVelocity
      }
      function onPointerUp() {
        isDragging = false
      }
      function onWheel(e) {
        e.preventDefault()
        camDistance = Math.min(maxDist, Math.max(minDist, camDistance * Math.exp(e.deltaY * 0.001)))
      }
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
        let best = -1
        let bestDist = Infinity
        for (let i = 0; i < n; i++) {
          const [x, y, z] = positions[i]
          const rx = x * c - z * s
          const rz = x * s + z * c
          // پروجکشن ساده به فضای دوربین (دوربین روی +Z نگاه می‌کنه به سمت مرکز)
          const viewZ = camDistance - rz
          if (viewZ <= 0.1) continue
          const screenX = rx / viewZ
          const screenY = y / viewZ
          const dx = screenX - ndcX * viewZ * Math.tan((45 * Math.PI) / 360) * camera.aspect
          const dy = screenY - ndcY * viewZ * Math.tan((45 * Math.PI) / 360)
          const d = dx * dx + dy * dy
          if (d < bestDist) {
            bestDist = d
            best = i
          }
        }
        if (best >= 0) onOpenFilm(postersOnly[best])
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
      const AUTO_SPEED = 0.00012
      function loop(t) {
        raf = requestAnimationFrame(loop)
        autoRotation = t * AUTO_SPEED
        program.uniforms.uRotationY.value = autoRotation + dragRotation
        camera.position.set(0, 0, camDistance)
        camera.lookAt([0, 0, 0])
        renderer.render({ scene, camera })
      }
      raf = requestAnimationFrame(loop)
      cleanupFns.push(() => cancelAnimationFrame(raf))
    }

    init()

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
      {!ready && (
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
          <div>در حال ساخت گالری کروی… {pct}%</div>
          <div style={{ width: 240, height: 6, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#c0392b', transition: 'width 0.15s linear' }} />
          </div>
        </div>
      )}
      <div ref={containerRef} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }} />
    </div>
  )
}
