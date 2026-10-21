import { useEffect, useMemo, useRef, useState } from 'react'
import { getSpineColor } from '../utils/shelfDisplay.js'
import { proxyImg } from '../utils/proxyImg.js'
import { alphabetRange } from '../utils/shelfRange.js'
import { useShelfZoom, useShelfTheme, MIN_SHELF_ZOOM, MAX_SHELF_ZOOM } from '../hooks/useShelfZoom.js'

// زوم پایه: تو این زوم یه ردیف قفسه دقیقاً SLOTS_PER_ROW_AT_BASE جلد جا می‌گیره
const BASE_ZOOM = 0.8
const SLOTS_PER_ROW_AT_BASE = 65
const SPINE_GAP = 2

function sortKey(title) {
  return String(title || '')
    .replace(/^the\s+/i, '')
    .toLowerCase()
}

// صف پیش‌بارگذاری با هم‌زمانی محدود -- قبلاً یه بخش قفسه با هزاران عنوان
// (مثل «Unassigned Shelf») باعث می‌شد صدها/هزاران new Image() هم‌زمان شلیک
// بشه و شبکه (و حتی خودِ Worker پشت image-proxy) رو خفه کنه -- همون چیزی که
// کل اپ رو یه‌مدت کند/گیر می‌نداخت. حالا حداکثر ۴ تا هم‌زمان لود می‌شه و بقیه
// تو صف می‌مونن.
const PREFETCH_CONCURRENCY = 4
const prefetchQueue = []
let prefetchActive = 0
function runNextPrefetch() {
  if (prefetchActive >= PREFETCH_CONCURRENCY) return
  const url = prefetchQueue.shift()
  if (!url) return
  prefetchActive++
  const img = new Image()
  img.decoding = 'async'
  const done = () => {
    prefetchActive--
    runNextPrefetch()
  }
  img.onload = done
  img.onerror = done
  img.src = url
}
function queuePrefetch(url) {
  prefetchQueue.push(url)
  runNextPrefetch()
}

// نمای «Wall» داخل صفحه‌ی Shelves (LocationBrowserModal): همه‌ی بخش‌های قفسه‌دار
// پشت سر هم، فقط برای دیدن. پر/خالی کردن بخش‌ها تو نمای Section انجام می‌شه.
// closet خالی یعنی همه‌ی کمدها؛ کلیک روی تیتر هر بخش onPickSection رو صدا می‌زنه.
export default function BookshelfView({ films, onSelectFilm, onFilmsChanged, closet: closetFilter = '', onPickSection, onPickCloset, capacityFor }) {
  const [shelfTheme, setShelfTheme] = useShelfTheme()
  // «spines» = قفسه‌ها با جلدها، «cards» = هر بخش یه کارت کوچیک (بازه‌ی الفبا + پر بودن)
  const [wallMode, setWallMode] = useState(() => {
    try {
      return window.localStorage.getItem('cinefilm:wall-mode') === 'cards' ? 'cards' : 'spines'
    } catch {
      return 'spines'
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem('cinefilm:wall-mode', wallMode)
    } catch {}
  }, [wallMode])
  const [shelfScale, setShelfScale] = useShelfZoom(BASE_ZOOM)
  const [spineWidth, setSpineWidth] = useState(null)
  const shelfBodyRef = useRef(null)
  const [searchQuery, setSearchQuery] = useState('')

  // چند تا جلد تو هر ردیف جا می‌شه — برای تقسیم قفسه به ردیف‌های ثابت (نه
  // flex-wrap خودکار). این‌جوری وقتی یه جلد رو هاور می‌کنی و پهن می‌شه، فقط
  // جلدهای همون ردیف جمع می‌شن که جا باز کنن؛ به ردیف بعد سرریز نمی‌شه و
  // ردیف‌های دیگه اصلاً تکون نمی‌خورن.
  const [itemsPerRow, setItemsPerRow] = useState(24)
  // این رو به .cinema-wood-shelf بخش اول وصل می‌کنیم (نه به خودِ ردیف) --
  // چون عرض .cinema-wood-shelf فقط به عرض مودال و shelfScale بستگی داره، نه
  // به این‌که خودِ محتواش (ردیف‌ها) چند تا جلد دارن؛ اگه به ردیف وصل می‌شد،
  // یه حلقه‌ی خود-وابسته می‌شد (عرض ردیف به itemsPerRow بستگی داره، ولی
  // itemsPerRow هم از عرض همون ردیف اندازه‌گیری می‌شه) که باعث می‌شد
  // اندازه‌گیری اولیه هیچ‌وقت واقعاً به‌روز نشه.
  const shelfWidthRef = useRef(null)
  // هاورکردن یه جلد فقط چند تا همسایه‌ی نزدیکش (نه کل ردیف) رو کمی جمع
  // می‌کنه تا جا باز کنه؛ بقیه‌ی ردیف کاملاً ثابت می‌مونه. قبلاً همه‌ی جلدهای
  // ردیف به‌طور یکسان کمی جمع می‌شدن، که با هر هاور کل ردیف رو محسوس تکون
  // می‌داد (حس «رفت‌وآمد» زیاد) -- حالا فقط یه خوشه‌ی کوچیک نزدیک موس.
  const NEAR_RADIUS = 9
  const [hoverInfo, setHoverInfo] = useState(null) // { rowKey, itemIdx }
  useEffect(() => {
    const el = shelfWidthRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = () => {
      // .cinema-wood-shelf خودش 28px*2 padding افقی داره (پایین‌تر تو استایل
      // inline ست شده)؛ عرض قابل‌استفاده‌ی واقعی برای ردیف جلدها همینه.
      const w = el.clientWidth - 56
      if (w <= 0) return
      // تو زوم ۸۰٪ دقیقاً ۶۵ جلد (ظرفیت یه بخش) یه ردیف کامل رو پر می‌کنن؛
      // زوم‌های دیگه به همون نسبت پهن‌تر/باریک‌ترن
      const spineW = (w / SLOTS_PER_ROW_AT_BASE - SPINE_GAP) * (shelfScale / BASE_ZOOM)
      setSpineWidth(spineW)
      setItemsPerRow(Math.max(6, Math.floor((w + 0.5) / (spineW + SPINE_GAP))))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
    // closetFilter/searchQuery/films هم تو dependency هستن چون تا وقتی هیچ
    // بخشی از قفسه رندر نشده (مثلاً فیلتر رو یه کلوزتِ خالی بود)، shelfWidthRef
    // هنوز به هیچی وصل نیست؛ با تغییر این‌ها، وقتی بالاخره محتوا ظاهر شد،
    // این افکت دوباره تلاش می‌کنه وصل بشه.
  }, [shelfScale, closetFilter, searchQuery, films])

  const [shelfMessage, setShelfMessage] = useState(null)
  const [colorAnalysisRunning, setColorAnalysisRunning] = useState(false)
  const [colorAnalysisProgress, setColorAnalysisProgress] = useState(0)
  const [colorAnalysisStop, setColorAnalysisStop] = useState(false)

  // یه پوستر رو تو یه canvas کوچیک می‌کشه و رنگ میانگین پیکسل‌هاش رو
  // برمی‌گردونه. پوسترهایی که CORS اجازه‌ی خوندن pixel data رو نمی‌ده
  // (مثلاً بعضی از هاست‌های آمازون) canvas رو «tainted» می‌کنن — این حالت
  // رو می‌گیریم و به‌جاش رشته‌ی خالی برمی‌گردونیم تا دیگه دوباره امتحان نشه.
  const extractPosterColor = (url) =>
    new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      const done = (v) => resolve(v)
      img.onload = () => {
        try {
          const size = 8
          const canvas = document.createElement('canvas')
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, size, size)
          const { data } = ctx.getImageData(0, 0, size, size)
          let r = 0, g = 0, b = 0, n = 0
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 10) continue // پیکسل تقریباً شفاف رو حساب نکن
            r += data[i]
            g += data[i + 1]
            b += data[i + 2]
            n++
          }
          if (!n) return done('')
          r = Math.round(r / n)
          g = Math.round(g / n)
          b = Math.round(b / n)
          done(`#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`)
        } catch {
          done('') // canvas tainted (CORS) — بی‌خیال این یکی
        }
      }
      img.onerror = () => done('')
      img.src = url
      // یه سقف زمانی برای هر عکس، وگرنه یه لینک مرده کل حلقه رو معطل می‌کنه
      setTimeout(() => done(''), 8000)
    })

  const runColorAnalysis = async () => {
    setColorAnalysisRunning(true)
    setColorAnalysisStop(false)
    setColorAnalysisProgress(0)
    let total = 0
    try {
      while (true) {
        if (colorAnalysisStop) break
        const res = await fetch('/api/films/poster-color-batch?limit=40')
        const batch = await res.json()
        if (!Array.isArray(batch) || !batch.length) break
        const colors = []
        for (const f of batch) {
          const color = await extractPosterColor(f.poster)
          colors.push({ id: f.id, color })
        }
        await fetch('/api/films/poster-color-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ colors }),
        })
        total += batch.length
        setColorAnalysisProgress(total)
      }
      setShelfMessage({ type: 'ok', text: `Poster color analysis done — processed ${total} film(s).` })
      if (onFilmsChanged) onFilmsChanged()
    } catch (e) {
      setShelfMessage({ type: 'error', text: `Poster color analysis stopped: ${e.message}` })
    } finally {
      setColorAnalysisRunning(false)
    }
  }

  const physicalFilms = useMemo(() => {
    return films
      .filter((f) => f.mediaType !== 'digital')
      .slice()
      .sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title), undefined, { numeric: true }))
  }, [films])

  const filteredFilms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    // فیلم‌های بی‌آدرس تو لیست موجودیِ نمای Section هستن، نه روی دیوار
    let base = physicalFilms.filter((f) => f.closet)
    if (closetFilter) {
      base = base.filter((f) => String(f.closet || '') === closetFilter)
    }
    if (!q) return base
    return base.filter(
      (f) =>
        String(f.title || '').toLowerCase().includes(q) ||
        String(f.director || '').toLowerCase().includes(q) ||
        String(f.year || '').includes(q)
    )
  }, [physicalFilms, closetFilter, searchQuery])

  const shelfSections = useMemo(() => {
    const map = {}
    for (const f of filteredFilms) {
      const c = String(f.closet || 'Unassigned')
      const r = c === 'Unassigned' ? '1' : String(f.row || '1')
      const s = c === 'Unassigned' ? '1' : String(f.shelf || '1')
      const key = c === 'Unassigned' ? 'Unassigned' : `${c}|${r}|${s}`
      if (!map[key]) {
        map[key] = {
          closet: c,
          row: r,
          shelf: s,
          label: c === 'Unassigned' ? 'Unassigned Shelf' : `Closet ${c} · Row ${r} · Section ${s}`,
          films: [],
        }
      }
      map[key].films.push(f)
    }
    const n = (v) => Number(v) || 0
    return Object.values(map).sort((a, b) => n(a.closet) - n(b.closet) || n(a.row) - n(b.row) || n(a.shelf) - n(b.shelf))
  }, [filteredFilms])

  // هر بخش قفسه فقط وقتی تازه داره وارد نمای صفحه می‌شه (با یه فاصله‌ی جلوتر
  // -- rootMargin) پوسترهاش رو پیش‌بارگذاری می‌کنه؛ تا وقتی کاربر واقعاً به
  // اون قفسه برسه و روی یه جلد هاور کنه، عکسش از قبل تو کش مرورگره و آنی
  // نشون داده می‌شه -- به‌جای این‌که هر هاور یه دانلود تازه شروع کنه.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const prefetched = new Set()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const urls = (entry.target.dataset.posters || '').split('|')
          for (const url of urls) {
            if (!url || prefetched.has(url)) continue
            prefetched.add(url)
            queuePrefetch(url)
          }
          observer.unobserve(entry.target)
        }
      },
      // نمای Wall داخل اسکرولِ صفحه‌ی Shelves هست، پس root همون viewport ـه
      { root: null, rootMargin: '800px 0px' }
    )
    const sections = shelfBodyRef.current?.querySelectorAll('[data-shelf-section]') || []
    sections.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [shelfSections])

  const totalCopies = useMemo(
    () => filteredFilms.reduce((sum, f) => sum + (Number(f.copies) || 1), 0),
    [filteredFilms]
  )

  return (
    <div className="shelf-wall">
      <div className="shelf-wall-toolbar">
        {closetFilter && onPickCloset && (
          <button type="button" className="shelf-back-btn" onClick={() => onPickCloset('')}>
            ← All closets
          </button>
        )}
        <span className="shelf-wall-count">
          {filteredFilms.length} titles · {totalCopies} copies{closetFilter ? ` in Closet ${closetFilter}` : ' on shelves'}
        </span>
        {colorAnalysisRunning ? (
          <span className="shelf-wall-colors">
            Analyzing poster colors… {colorAnalysisProgress} done
            <button type="button" className="shelf-back-btn" onClick={() => setColorAnalysisStop(true)}>
              Stop
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="shelf-back-btn"
            onClick={runColorAnalysis}
            title="Reads each poster's average color (once per film, in this browser) so spines can use it. Safe to stop and resume."
          >
            Analyze poster colors
          </button>
        )}
        {shelfMessage && (
          <span style={{ fontSize: '12.5px', color: shelfMessage.type === 'error' ? '#d97066' : '#4caf50' }}>{shelfMessage.text}</span>
        )}
        <div className="shelves-view-switch shelf-wall-mode">
          <button type="button" className={wallMode === 'cards' ? 'active' : ''} onClick={() => setWallMode('cards')}>
            Cards
          </button>
          <button type="button" className={wallMode === 'spines' ? 'active' : ''} onClick={() => setWallMode('spines')}>
            Spines
          </button>
        </div>
            <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="film-selector-search"
                placeholder="Search shelves…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ minWidth: '180px', height: '34px' }}
              />

              {wallMode === 'spines' && (
              <div className="shelf-zoom-control" style={{ margin: 0 }}>
                <button
                  type="button"
                  className="shelf-zoom-btn"
                  onClick={() => setShelfScale((s) => Math.max(MIN_SHELF_ZOOM, Number((s - 0.1).toFixed(2))))}
                  title="Zoom Out shelf cases"
                >
                  −
                </button>
                <span className="shelf-zoom-label">{Math.round(shelfScale * 100)}%</span>
                <button
                  type="button"
                  className="shelf-zoom-btn"
                  onClick={() => setShelfScale((s) => Math.min(MAX_SHELF_ZOOM, Number((s + 0.1).toFixed(2))))}
                  title="Zoom In shelf cases"
                >
                  +
                </button>
              </div>

              )}
              {wallMode === 'spines' && (
              <div className="shelf-theme-picker" style={{ margin: 0 }}>
                <button
                  type="button"
                  className={`shelf-theme-btn ${shelfTheme === 'wood' ? 'active' : ''}`}
                  onClick={() => setShelfTheme('wood')}
                >
                  🪵 Wood
                </button>
                <button
                  type="button"
                  className={`shelf-theme-btn ${shelfTheme === 'slate' ? 'active' : ''}`}
                  onClick={() => setShelfTheme('slate')}
                >
                  ⚙️ Slate
                </button>
                <button
                  type="button"
                  className={`shelf-theme-btn ${shelfTheme === 'cinema' ? 'active' : ''}`}
                  onClick={() => setShelfTheme('cinema')}
                >
                  🎬 Cinema
                </button>
              </div>
              )}
            </div>
      </div>

        <div className="shelf-wall-body" ref={shelfBodyRef}>
          {films.length === 0 ? (
            // لیست کامل آرشیو هنوز داره دانلود می‌شه (چند ثانیه برای ۱۸هزار+ فیلم)
            <div className="status empty-state" role="status">
              <p>Loading shelves…</p>
            </div>
          ) : shelfSections.length === 0 ? (
            <div className="status empty-state">
              <p>No films found on this bookshelf.</p>
            </div>
          ) : wallMode === 'cards' ? (
            // نمای فشرده: هر بخش یه کارت، گروه‌بندی‌شده بر اساس کمد. هر خط یه ردیف
            // واقعیِ کمده (S1، S2، S3 کنار هم)؛ جای بخش‌های خالیِ همون ردیف کم‌رنگه.
            <div className="shelf-card-closets">
              {Object.entries(
                shelfSections.reduce((acc, sec) => {
                  ;(acc[sec.closet] = acc[sec.closet] || []).push(sec)
                  return acc
                }, {})
              ).map(([closetId, secs]) => {
                const capOf = (sh) => (capacityFor ? capacityFor(sh) : 65)
                const copiesOf = (sec) => sec.films.reduce((n, f) => n + Math.max(1, Number(f.copies) || 1), 0)
                const closetCopies = secs.reduce((n, sec) => n + copiesOf(sec), 0)
                // ظرفیت کل کمد: ۱۰ ردیف × ۳ بخش
                const closetCap = Array.from({ length: 10 }).reduce((n) => n + capOf('1') + capOf('2') + capOf('3'), 0)
                const firstFilm = secs[0].films[0]
                const lastSec = secs[secs.length - 1]
                const lastFilm = lastSec.films[lastSec.films.length - 1]
                const rowsUsed = [...new Set(secs.map((sec) => sec.row))].sort((a, b) => Number(a) - Number(b))
                const secAt = (r, sh) => secs.find((sec) => sec.row === r && sec.shelf === sh)
                return (
                  <section className="shelf-card-closet" key={closetId}>
                    <h3 className="shelf-card-closet-head">
                      {onPickCloset && !closetFilter ? (
                        <button
                          type="button"
                          className="shelf-wall-section-link"
                          onClick={() => onPickCloset(closetId)}
                          title={`Show only Closet ${closetId}`}
                        >
                          Closet {closetId} →
                        </button>
                      ) : (
                        <span>Closet {closetId}</span>
                      )}
                      <span className="shelf-card-closet-meta">
                        {secs.length} sections · {closetCopies} / {closetCap} copies · {alphabetRange(firstFilm.title, lastFilm.title)}
                      </span>
                      {/* نوار پر بودن کل کمد */}
                      <span className="shelf-card-closet-meter" title={`${Math.round((closetCopies / closetCap) * 100)}% full`}>
                        <span className="shelf-card-fill" style={{ width: `${Math.min(100, (closetCopies / closetCap) * 100)}%` }} />
                      </span>
                    </h3>
                    <div className="shelf-card-rows">
                      {rowsUsed.map((r) => (
                        <div className="shelf-card-row" key={r}>
                          <span className="shelf-card-row-label">R{r}</span>
                          {['1', '2', '3'].map((sh) => {
                            const sec = secAt(r, sh)
                            if (!sec) {
                              // موقع جست‌وجو، بخش بدون نتیجه خالی نیست — فقط جاش رو نگه می‌داریم
                              if (searchQuery.trim()) return <span key={sh} />
                              return (
                                <button
                                  type="button"
                                  key={sh}
                                  className={`shelf-card shelf-card-empty shelf-card-s${sh}`}
                                  onClick={() => onPickSection && onPickSection(closetId, r, sh)}
                                  title={`C${closetId} · R${r} · S${sh} is empty — open it to fill`}
                                >
                                  <span className="shelf-card-loc">C{closetId} · R{r} · S{sh}</span>
                                  <span className="shelf-card-count">Empty · 0 / {capOf(sh)}</span>
                                </button>
                              )
                            }
                            const copies = copiesOf(sec)
                            const cap = capOf(sh)
                            const pct = Math.min(100, Math.round((copies / cap) * 100))
                            const first = sec.films[0]
                            const last = sec.films[sec.films.length - 1]
                            return (
                              <button
                                type="button"
                                key={sh}
                                className={`shelf-card shelf-card-s${sh}`}
                                onClick={() => onPickSection && onPickSection(sec.closet, sec.row, sec.shelf)}
                                title={`${sec.label} — ${first.title} → ${last.title}`}
                              >
                                <span className="shelf-card-loc">C{sec.closet} · R{sec.row} · S{sec.shelf}</span>
                                <span className="shelf-card-range">{alphabetRange(first.title, last.title)}</span>
                                <span className="shelf-card-titles">
                                  {first.title} → {last.title}
                                </span>
                                <span className="shelf-card-meter">
                                  <span className="shelf-card-fill" style={{ width: `${pct}%` }} />
                                </span>
                                <span className="shelf-card-count">
                                  {copies} / {cap} copies · {sec.films.length} titles
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            shelfSections.map((sec, secIdx) => {
              // همه‌ی جلدها (با احتساب کپی‌ها) رو یه‌بار مسطح می‌کنیم، بعد به
              // ردیف‌های ثابت (itemsPerRow تایی) تقسیم‌شون می‌کنیم -- هر ردیف
              // یه flex-container جدا و nowrap هست، تا هاورکردن یه جلد فقط
              // همون ردیف رو جمع‌وجور کنه و به ردیف‌های دیگه سرایت نکنه.
              const caseEntries = sec.films.flatMap((f, idx) => {
                const style = getSpineColor(f, idx)
                const isCriterion = f.criterion || style.type === 'criterion'
                const is4k = style.type === '4k'
                const isSteelbook = style.type === 'steelbook'
                // نسخه‌های اضافه (copies > 1) واقعاً کنار هم به‌عنوان جلدهای
                // جدا رو قفسه می‌ذاریم — نه یه جلد با بج «×N»، چون تو یه قفسه‌ی
                // واقعی هم چند نسخه از یه فیلم واقعاً چندتا جلد جدا هستن.
                const copyCount = Math.max(1, Number(f.copies) || 1)
                return Array.from({ length: copyCount }, (_, copyIdx) => ({ f, style, isCriterion, is4k, isSteelbook, copyIdx, copyCount }))
              })
              const rows = []
              for (let i = 0; i < caseEntries.length; i += itemsPerRow) {
                rows.push(caseEntries.slice(i, i + itemsPerRow))
              }

              return (
              <div key={`${sec.closet}-${sec.row}-${sec.shelf}`} style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>
                    {onPickSection ? (
                      <button
                        type="button"
                        className="shelf-wall-section-link"
                        onClick={() => onPickSection(sec.closet, sec.row, sec.shelf)}
                        title="Open this section (fill, empty, move)"
                      >
                        {sec.label} →
                      </button>
                    ) : (
                      sec.label
                    )}
                  </h3>
                  <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>
                    {sec.films.length} titles ({sec.films.reduce((s, f) => s + (Number(f.copies) || 1), 0)} copies)
                  </span>
                </div>

                <div
                  className={`cinema-wood-shelf-wrapper shelf-theme-${shelfTheme}`}
                  data-shelf-section
                  data-posters={sec.films.map((f) => proxyImg(f.poster)).filter(Boolean).join('|')}
                >
                  <div className="shelf-overhead-light" />
                  <div
                    className="cinema-wood-shelf"
                    style={{ '--spine-scale': shelfScale, ...(spineWidth ? { '--spine-w': `${spineWidth}px` } : {}) }}
                    ref={secIdx === 0 ? shelfWidthRef : undefined}
                  >
                    <div className="shelf-inner-shadow" />
                    <div className="bluray-shelf">
                      {rows.map((row, rowIdx) => {
                        const rowKey = `${sec.closet}-${sec.row}-${sec.shelf}-${rowIdx}`
                        return (
                        <div className="bluray-shelf-row" key={rowIdx}>
                          {row.map(({ f, style, isCriterion, is4k, isSteelbook, copyIdx, copyCount }, itemIdx) => {
                            const isNear =
                              hoverInfo &&
                              hoverInfo.rowKey === rowKey &&
                              hoverInfo.itemIdx !== itemIdx &&
                              Math.abs(hoverInfo.itemIdx - itemIdx) <= NEAR_RADIUS
                            return (
                            <div
                              key={`${f.id}-${copyIdx}`}
                              className={`bluray-case ${isCriterion ? 'criterion' : is4k ? 'four-k' : isSteelbook ? 'steelbook' : ''} ${isNear ? 'bluray-case-near' : ''}`}
                              style={{
                                backgroundColor: style.bg,
                                background: style.bg,
                                '--spine-text': style.text,
                              }}
                              onMouseEnter={() => setHoverInfo({ rowKey, itemIdx })}
                              onMouseLeave={() => setHoverInfo(null)}
                              onClick={() => onSelectFilm(f)}
                              title={`${f.title} (${f.year || 'N/A'}) — Dir: ${f.director || 'Unknown'}${copyCount > 1 ? ` — copy ${copyIdx + 1}/${copyCount}` : ''}`}
                            >
                              <div className="case-glare" />

                              <div className="case-spine-view">
                                <div className="case-spine">
                                  <span className="spine-title" style={{ color: style.text || '#fff' }}>
                                    {f.title}
                                  </span>
                                </div>
                              </div>

                              <div className="case-expand-view">
                                <div className="case-expand-poster">
                                  {f.poster ? (
                                    <img src={proxyImg(f.poster)} alt="" loading="lazy" decoding="async" />
                                  ) : (
                                    <div className="case-expand-poster-fallback">🎬</div>
                                  )}
                                </div>
                                <div className="case-expand-info">
                                  <div className="case-expand-title-row">
                                    <span className="case-expand-title">{f.title}</span>
                                    {f.year && <span className="case-expand-year">{f.year}</span>}
                                  </div>
                                  <div className="case-expand-meta-row">
                                    {f.director && <span className="case-expand-director">Dir: {f.director}</span>}
                                    {(f.rating || f.copies > 1) && (
                                      <span className="case-expand-badges">
                                        {f.rating && <span>★ {f.rating.toFixed(1)}</span>}
                                        {f.copies > 1 && <span>×{f.copies}</span>}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            )
                          })}
                        </div>
                        )
                      })}
                    </div>

                    <div className="shelf-props-layer">
                      <div className="shelf-prop prop-ticket-stub" title="Vintage Cinema Ticket" />
                      <div className="shelf-prop prop-notebook" title="Aide-Mémoire">
                        <span>Aide-Mémoire</span>
                      </div>
                      <div className="shelf-prop prop-clapperboard" title="Scene 2 Clapperboard">
                        <div className="clapper-top" />
                        <div className="clapper-number">2</div>
                      </div>
                      <div className="shelf-prop prop-receipts" title="Movie Receipt Stubs" />
                    </div>
                  </div>
                  <div className="cinema-wood-ledge" />
                </div>
              </div>
              )
            })
          )}
        </div>
    </div>
  )
}
