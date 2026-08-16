import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import Header from './components/Header.jsx'
import FilmGrid from './components/FilmGrid.jsx'
import FilmList from './components/FilmList.jsx'
import FilmModal from './components/FilmModal.jsx'
import EditModal from './components/EditModal.jsx'
import PersonModal from './components/PersonModal.jsx'
import FolderNav from './components/FolderNav.jsx'
import DashboardPanel from './components/DashboardPanel.jsx'
import PosterCollage from './components/PosterCollage.jsx'
import LocationBrowserModal from './components/LocationBrowserModal.jsx'
import BookshelfView from './components/BookshelfView.jsx'
import CinemaNewsPage from './components/CinemaNewsPage.jsx'
import { parseImportCsv, matchEntriesToFilms } from './utils/csvImport.js'
import LoanModal from './components/LoanModal.jsx'
import { IconArchive } from './components/icons.jsx'
import { useAuth } from './context/AuthContext.jsx'

// Lazy: pulls in the ogl WebGL library, only needed by the rarely-visited
// 3D gallery view — code-splitting it keeps it out of everyone else's
// initial page load.
const GallerySphere = lazy(() => import('./components/GallerySphere.jsx'))

export default function App() {
  const { isGuest, isAdmin, openLogin } = useAuth()
  const [films, setFilms] = useState([])
  // نسخه‌ی فیلترنشده و کامل آرشیو - فقط برای جستجوی «این بازیگر/کارگردان
  // چندتا فیلم داره» توی PersonModal، چون films (بالا) بسته به فیلترهای
  // فعلی کاربر (دهه، حرف الفبا، ژانر و...) محدود می‌شه و فیلموگرافی ناقص
  // نشون می‌ده.
  const [allFilmsUnfiltered, setAllFilmsUnfiltered] = useState([])
  const [genres, setGenres] = useState([])
  const [decades, setDecades] = useState([])
  const drives = [...new Set(allFilmsUnfiltered.filter((f) => f.mediaType === 'digital' && f.driveNumber).map((f) => String(f.driveNumber)))].sort(
    (a, b) => a.localeCompare(b, undefined, { numeric: true })
  )
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('')
  const [loanedOnly, setLoanedOnly] = useState(false)
  const [watched, setWatched] = useState('')
  const [minRating, setMinRating] = useState('')
  const [decade, setDecade] = useState('')
  const [drive, setDrive] = useState('')
  const [sort, setSort] = useState('random')
  const [alpha, setAlpha] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])
  const PAGE_SIZE = 48
  // فعلاً دکمه‌ی تعویض نما (Thumbnails/List) از هدر برداشته شده و فقط
  // Thumbnails نشون داده می‌شه؛ مقدار قبلی توی localStorage هم نادیده
  // گرفته می‌شه تا اگه قبلاً روی List بوده، حالا گرید بیاد.
  const [view, setView] = useState('grid')
  const [theme, setTheme] = useState(
    () => localStorage.getItem('fa_theme') || (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  )
  const [selected, setSelected] = useState(null)
  const [section, setSection] = useState(() => localStorage.getItem('fa_section') || null)

  // موقع رفتن از یه بخش (مثلاً سریال‌های دیجیتال) به بخش دیگه (مثلاً فیلم‌های
  // دیجیتال/فیزیکی/داشبورد)، جستجو/فیلترهای بخش قبلی نباید باقی بمونن و رو
  // نتایج بخش جدید هم اعمال بشن.
  const changeSection = (next) => {
    setQuery('')
    setGenre('')
    setDecade('')
    setDrive('')
    setAlpha('')
    setWatched('')
    setMinRating('')
    setLoanedOnly(false)
    setSort('random')
    setPage(1)
    // اگه موقع رفتن به بخش دیگه (یا داشبورد)، صفحه‌ی جزئیات یه فیلم هنوز باز
    // بود، بسته می‌شد ولی state=selected پاک نمی‌شد؛ برای همین همون فیلم
    // قبلی رو نگه می‌داشت و انگار صفحه عوض نشده بود.
    setSelected(null)
    setForceFilmOverlay(false)
    setSection(next)
  }

  useEffect(() => {
    if (section) localStorage.setItem('fa_section', section)
    else localStorage.removeItem('fa_section')
  }, [section])
  const [isWide, setIsWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches
  )
  const [selectedPerson, setSelectedPerson] = useState(null)
  // وقتی از صفحه‌ی یه هنرمند رو یه فیلم کلیک می‌کنیم، اسم اون هنرمند رو اینجا
  // نگه می‌داریم تا با بستن FilmModal (ضربدر یا کلیک بیرون)، به‌جای اینکه کلاً
  // ببنده، برگردیم به همون صفحه‌ی هنرمند که ازش اومده بودیم.
  const [personBeforeFilm, setPersonBeforeFilm] = useState(null)
  const openFilmFromPerson = (film) => {
    setPersonBeforeFilm(selectedPerson)
    setSelectedPerson(null)
    setSelected(film)
  }
  const closeFilmModal = () => {
    setSelected(null)
    setForceFilmOverlay(false)
    if (personBeforeFilm) {
      setSelectedPerson(personBeforeFilm)
      setPersonBeforeFilm(null)
    }
  }
  const [showLocationBrowser, setShowLocationBrowser] = useState(false)
  const [showBookshelf, setShowBookshelf] = useState(false)
  const [forceFilmOverlay, setForceFilmOverlay] = useState(false)
  const [loanFilm, setLoanFilm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enrichingCatalog, setEnrichingCatalog] = useState(false)
  const [enrichRemaining, setEnrichRemaining] = useState(null)

  // section (physical/physical-series/digital-movie/digital-series) رو به
  // ?mediaType=&itemType= برای اندپوینت‌های enrich تبدیل می‌کنه، تا دکمه‌ی
  // «Fill missing details» فقط رو همون قسمتی که کاربر بازش کرده کار کنه.
  // سکشن‌های بدون فیلم مشخص (dashboard, special-collections, ...) => کل آرشیو.
  const enrichScopeLabel = (sec) => {
    if (sec === 'physical') return 'physical movies'
    if (sec === 'physical-series') return 'physical series'
    if (sec === 'digital-movie') return 'digital movies'
    if (sec === 'digital-series') return 'digital series'
    return null
  }

  const enrichScopeParams = (sec) => {
    const params = new URLSearchParams()
    if (sec === 'physical' || sec === 'digital-movie') params.set('itemType', 'movie')
    else if (sec === 'physical-series' || sec === 'digital-series') params.set('itemType', 'series')
    if (sec === 'physical' || sec === 'physical-series') params.set('mediaType', 'physical')
    else if (sec === 'digital-movie' || sec === 'digital-series') params.set('mediaType', 'digital')
    return params.toString()
  }

  const refreshEnrichRemaining = () => {
    const qs = enrichScopeParams(section)
    fetch(`/api/films/enrich-status${qs ? `?${qs}` : ''}`)
      .then((r) => r.json())
      .then((data) => setEnrichRemaining(data.remaining))
      .catch(() => {})
  }

  useEffect(() => {
    refreshEnrichRemaining()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])
  const [toast, setToast] = useState('')
  const toastTimeoutRef = useRef(null)

  const showToast = (m, duration = 4000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToast(m)
    toastTimeoutRef.current = setTimeout(() => setToast(''), duration)
  }

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const handler = (e) => setIsWide(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // پنل جزئیات (سمت راست توی نمای split) با position:sticky همیشه زیر هدر
  // چسبیده می‌مونه، حتی وقتی گرید سمت چپ رو اسکرول کنی — چون ارتفاع هدر با
  // تغییر عرض صفحه عوض می‌شه، این ارتفاع رو اندازه می‌گیریم و به‌عنوان یه
  // CSS variable می‌ذاریم تا استایل بتونه ازش برای offset استفاده کنه.
  useEffect(() => {
    const headerEl = document.querySelector('.header')
    if (!headerEl) return
    const update = () => {
      document.documentElement.style.setProperty('--header-h', `${headerEl.offsetHeight}px`)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(headerEl)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('fa_view', view)
  }, [view])

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light')
    localStorage.setItem('fa_theme', theme)
  }, [theme])

  // هر تایپ توی سرچ یه fetch جدید می‌فرسته؛ بدون این محافظت، رو موبایل که
  // تأخیر شبکه نامنظم‌تره، ممکنه جواب یه حرفِ قبلی (query عمومی‌تر، با نتایج
  // بیشتر و نامرتبط) دیرتر از جواب query نهایی برسه و نتیجه‌ی درست رو با یه
  // نتیجه‌ی قدیمی‌تر و پرت بازنویسی کنه. requestIdRef فقط جواب آخرین
  // درخواست رو قبول می‌کنه.
  const requestIdRef = useRef(0)

  const loadFilms = () => {
    setLoading(true)
    const requestId = ++requestIdRef.current
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (genre) params.set('genre', genre)
    if (loanedOnly) params.set('loaned', '1')
    if (watched) params.set('watched', watched)
    if (minRating) params.set('minRating', minRating)
    if (decade) params.set('decade', decade)
    if (drive) params.set('drive', drive)
    if (sort) params.set('sort', sort)
    if (alpha) params.set('alpha', alpha)
    fetch('/api/films?' + params.toString())
      .then((r) => r.json())
      .then((data) => {
        if (requestId !== requestIdRef.current) return // یه درخواست جدیدتر در راهه، این جواب دیررسیده رو نادیده بگیر
        if (!Array.isArray(data)) {
          // پاسخ خطا (مثل مشکل موقت دیتابیس زیر بار سنگین یه ایمپورت بزرگ)
          // — قبلاً اینجا films رو خالی می‌کردیم که باعث می‌شد کاربر فکر کنه
          // همه‌ی آرشیوش پاک شده، در حالی که فقط یه fetch لحظه‌ای fail شده
          // بود و خود دیتابیس دست‌نخورده مونده بود. الان لیست قبلی رو نگه
          // می‌داریم و فقط خطا رو نشون می‌دیم.
          console.error('Unexpected /api/films response:', data)
          setLoading(false)
          showToast((data && data.error) || 'Failed to load films — previous list kept')
          return
        }
        setFilms(data)
        setLoading(false)
      })
      .catch(() => {
        if (requestId === requestIdRef.current) setLoading(false)
      })
  }

  // برای query یه تأخیر کوچیک (debounce) می‌ذاریم تا هر کاراکتر تایپ‌شده
  // یه fetch جدا نفرسته — هم تعداد درخواست‌ها رو (به‌خصوص روی موبایل) کم
  // می‌کنه، هم خودش یکی از راه‌های کاهش race condition بین جواب‌هاست.
  // فیلترهای دیگه (genre, drive, ...) فوری اعمال می‌شن.
  useEffect(() => {
    setPage(1)
    const t = setTimeout(loadFilms, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, genre, loanedOnly, watched, minRating, decade, drive, sort, alpha])

  useEffect(() => {
    fetch('/api/genres')
      .then((r) => r.json())
      .then((data) => setGenres(Array.isArray(data) ? data : []))
      .catch(() => {})
    fetch('/api/decades')
      .then((r) => r.json())
      .then((data) => setDecades(Array.isArray(data) ? data : []))
      .catch(() => {})
    loadAllFilmsUnfiltered()
  }, [])

  const refreshMeta = () => {
    fetch('/api/decades')
      .then((r) => r.json())
      .then((data) => setDecades(Array.isArray(data) ? data : []))
      .catch(() => {})
    fetch('/api/genres')
      .then((r) => r.json())
      .then((data) => setGenres(Array.isArray(data) ? data : []))
      .catch(() => {})
  }

  const loadAllFilmsUnfiltered = () => {
    fetch('/api/films')
      .then((r) => r.json())
      .then((data) => {
        // همون مشکل loadFilms: اگه بجای آرایه، پاسخ خطا برگرده (مثلاً زیر بار
        // یه ایمپورت بزرگ)، نباید کل شمارش/آمار آرشیو صفر بشه.
        if (Array.isArray(data)) setAllFilmsUnfiltered(data)
      })
      .catch(() => {})
  }

  // لینک‌دهی مستقیم به یه فیلم خاص: وقتی یه فیلم بازه، آدرس صفحه رو به‌روز
  // می‌کنیم (?film=id&section=...) تا بشه اون لینک رو به اشتراک گذاشت و با
  // بازکردنش مستقیم همون صفحه‌ی فیلم باز بشه (برای دکمه‌ی Share).
  // نکته‌ی مهم: اول لود صفحه، selected هنوز null هست (تا فیلم‌ها لود بشن و
  // بازیابی انجام بشه) — اگه همین effect زودتر از بازیابی اجرا بشه، پارامتر
  // film=... رو از آدرس پاک می‌کنه قبل از این‌که فرصت خوندنش باشه. برای همین
  // تا وقتی بازیابی تموم نشده (deepLinkReady)، این effect کاری نمی‌کنه.
  const [deepLinkReady, setDeepLinkReady] = useState(() => !new URLSearchParams(window.location.search).get('film'))

  useEffect(() => {
    if (!deepLinkReady) return
    const params = new URLSearchParams(window.location.search)
    if (selected) {
      params.set('film', selected.id)
      if (section) params.set('section', section)
    } else {
      params.delete('film')
    }
    const next = params.toString()
    const url = next ? `${window.location.pathname}?${next}` : window.location.pathname
    window.history.replaceState(null, '', url)
  }, [selected, section, deepLinkReady])

  const deepLinkRestoredRef = useRef(false)
  useEffect(() => {
    if (deepLinkRestoredRef.current) return
    if (!allFilmsUnfiltered.length) return
    deepLinkRestoredRef.current = true
    const params = new URLSearchParams(window.location.search)
    const filmId = params.get('film')
    if (filmId) {
      const film = allFilmsUnfiltered.find((f) => String(f.id) === filmId)
      if (film) {
        const restoredSection =
          params.get('section') ||
          (film.mediaType === 'digital'
            ? film.itemType === 'series'
              ? 'digital-series'
              : 'digital-movie'
            : film.itemType === 'series'
            ? 'physical-series'
            : 'physical')
        setSection(restoredSection)
        setSelected(film)
      }
    }
    setDeepLinkReady(true)
  }, [allFilmsUnfiltered])

  const handleImport = async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    showToast('Importing Excel file…')
    try {
      const res = await fetch('/api/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'import failed')

      // بعد از ایمپورت، تعداد کل فیلم‌های آرشیو رو تازه می‌گیریم تا پیام
      // نهایی هم فیلم‌های جدید و هم مجموع فعلی آرشیو رو نشون بده
      let total = null
      try {
        const allRes = await fetch('/api/films')
        const all = await allRes.json()
        if (Array.isArray(all)) total = all.length
      } catch {
        // اگه تعداد کل رو نشد گرفت، پیام رو بدون اون نشون می‌دیم
      }

      showToast(
        `Imported: ${data.added} new, ${data.updated} updated` +
          (data.enriched ? `, ${data.enriched} auto-enriched from OMDb` : '') +
          (total != null ? ` — ${total} films total` : ''),
        7000
      )
      setQuery('')
      setGenre('')
      setDecade('')
      setAlpha('')
      loadFilms()
      refreshMeta()
      loadAllFilmsUnfiltered()
    } catch (e) {
      showToast(e.message)
    }
  }

  const handleImportRatings = async (file) => {
    const text = await file.text()
    const { format, entries } = parseImportCsv(text)
    if (format === 'unknown') {
      showToast('Unrecognized file — export a ratings/diary CSV from Letterboxd or IMDb and try again')
      return
    }
    const { matched, unmatched } = matchEntriesToFilms(entries, allFilmsUnfiltered)
    if (matched.length === 0) {
      showToast(`No matches found in your archive (checked ${entries.length} ${format === 'imdb' ? 'IMDb' : 'Letterboxd'} entries)`, 7000)
      return
    }
    showToast(`Matching ${matched.length} films from ${format === 'imdb' ? 'IMDb' : 'Letterboxd'}…`)

    // به‌روزرسانی رو تکه‌تکه (به‌جای همه‌ی درخواست‌ها یهو) می‌فرستیم تا فشار
    // زیادی روی ورکر/دی‌وان نیاد
    const chunkSize = 8
    let updated = 0
    for (let i = 0; i < matched.length; i += chunkSize) {
      const chunk = matched.slice(i, i + chunkSize)
      await Promise.all(
        chunk.map(async ({ entry, film }) => {
          try {
            const patch = { watched: true }
            if (entry.myRating) patch.myRating = entry.myRating
            const res = await fetch(`/api/films/${film.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(patch),
            })
            if (res.ok) updated++
          } catch {
            // یه فیلم شکست بخوره، بقیه ادامه پیدا می‌کنن
          }
        })
      )
    }

    showToast(
      `${format === 'imdb' ? 'IMDb' : 'Letterboxd'} import: ${updated} films updated, ${unmatched.length} not in your archive (of ${entries.length} entries)`,
      8000
    )
    loadFilms()
    loadAllFilmsUnfiltered()
  }

  const handleAddFilm = async (patch) => {
    try {
      const res = await fetch('/api/films', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'add failed')
      setAdding(false)
      const filledFields = data._enrichment?.fields || []
      if (filledFields.length) {
        showToast(`Film added · auto-filled ${filledFields.length} missing detail${filledFields.length === 1 ? '' : 's'}`)
      } else if (data._enrichment?.enabled === false) {
        showToast('Film added · set OMDB_API_KEY to enable automatic metadata')
      } else {
        showToast('Film added')
      }
      loadFilms()
      refreshMeta()
      loadAllFilmsUnfiltered()
    } catch (e) {
      showToast(e.message)
    }
  }

  const handleSaveFilm = async (id, patch) => {
    try {
      const res = await fetch('/api/films/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'save failed')
      }
      const saved = await res.json()
      setFilms((prev) => prev.map((f) => (f.id === id ? saved : f)))
      if (selected && selected.id === id) setSelected(saved)
      showToast('Saved')
      setEditing(null)
      setLoanFilm(null)
    } catch (e) {
      showToast(e.message)
    }
  }

  // مهمان‌ها نمی‌تونن ویرایش/امانت/امتیازدهی کنن — به‌جای تلاش ناموفق برای
  // ذخیره (که بک‌اند با 401 رد می‌کنه)، مستقیم مدال ورود باز می‌شه.
  const guardedEdit = (film) => (isGuest ? openLogin() : setEditing(film))
  const guardedLoan = (film) => (isGuest ? openLogin() : setLoanFilm(film))
  const guardedRate = (film, rating) => (isGuest ? openLogin() : handleSaveFilm(film.id, { myRating: rating }))
  const guardedSeasonDrive = (film, seasonDrives) => (isGuest ? openLogin() : handleSaveFilm(film.id, { seasonDrives }))

  const handleDeleteFilm = async (film) => {
    try {
      const res = await fetch('/api/films/' + film.id, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setFilms((prev) => prev.filter((f) => f.id !== film.id))
      setAllFilmsUnfiltered((prev) => prev.filter((f) => f.id !== film.id))
      if (selected && selected.id === film.id) setSelected(null)
      showToast(`Deleted "${film.title}"`)
      refreshMeta()
    } catch (e) {
      showToast(e.message)
    }
    setEditing(null)
  }

  const handleAutofillFilm = async (id) => {
    try {
      const res = await fetch(`/api/films/${id}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'auto-fill failed')

      const { _enrichment, ...preview } = data
      // این فقط یه پیش‌نمایشه — چیزی هنوز ذخیره نشده. فرم ویرایش با این مقادیر
      // پر می‌شه تا کاربر ببینتشون، و فقط با زدن دکمه‌ی Save واقعاً ذخیره می‌شه.
      if (_enrichment?.fields?.length) {
        showToast(`Found ${_enrichment.fields.length} new detail${_enrichment.fields.length === 1 ? '' : 's'} — review and click Save to apply`)
      } else if (_enrichment?.enabled === false) {
        showToast('Set OMDB_API_KEY to enable automatic metadata')
      } else {
        const debugBits = [_enrichment?.verifiedDebug, _enrichment?.tmdbDebug].filter(Boolean).join(' | ')
        showToast(debugBits ? `No additional metadata found (${debugBits})` : 'No additional metadata found')
      }
      return preview
    } catch (e) {
      showToast(e.message)
      return null
    }
  }

  const handleEnrichCatalog = async () => {
    setEnrichingCatalog(true)
    let processed = 0
    let updated = 0

    const scopeQs = enrichScopeParams(section)
    const enrichUrl = `/api/films/enrich?limit=5${scopeQs ? `&${scopeQs}` : ''}`

    const fetchBatchWithRetry = async (attempts = 2) => {
      for (let i = 0; i <= attempts; i++) {
        try {
          const res = await fetch(enrichUrl, { method: 'POST' })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'metadata enrichment failed')
          return data
        } catch (err) {
          if (i === attempts) throw err
          // یه دفعه شکست خورد (مثلاً OMDb موقتاً کند بود) — یه لحظه صبر و دوباره امتحان،
          // به‌جای این‌که کل عملیات رو بندازیم دور
          await new Promise((r) => setTimeout(r, 800))
        }
      }
    }

    try {
      let remaining = null
      let hitQuota = false
      for (let batch = 0; batch < 300; batch++) {
        const data = await fetchBatchWithRetry()
        processed += data.processed
        updated += data.updated
        remaining = data.remaining
        if (data.quotaExceeded) {
          hitQuota = true
          break
        }
        if (data.remaining === 0 || data.processed === 0) break
      }
      if (hitQuota) {
        showToast(
          `Updated ${updated} of ${processed} films — hit OMDb's daily free-tier limit (1000 requests/day). ` +
            `${remaining} films still need enrichment; a daily auto-retry is scheduled, or try again tomorrow.`,
          9000
        )
      } else {
        showToast(`Metadata complete · updated ${updated} of ${processed} films`)
      }
      loadFilms()
      refreshMeta()
      loadAllFilmsUnfiltered()
      refreshEnrichRemaining()
    } catch (e) {
      showToast(`Stopped after ${processed} films — ${e.message}. Click "Fill missing details" again to resume.`, 7000)
      loadFilms()
      refreshMeta()
      loadAllFilmsUnfiltered()
      refreshEnrichRemaining()
    } finally {
      setEnrichingCatalog(false)
    }
  }

  // نظرات/امتیازهای شخصیِ کاربر رو از فید RSS عمومیِ لترباکسش می‌گیره و روی
  // فیلم‌های همنام آرشیو (با تطبیق عنوان+سال) می‌ذاره. یوزرنیم قبلی رو
  // توی localStorage نگه می‌داریم که هر بار مجبور به تایپ دوباره‌ش نباشه.
  const handleSyncLetterboxd = async () => {
    const savedUsername = localStorage.getItem('fa_letterboxd_username') || ''
    const username = window.prompt('Letterboxd username:', savedUsername)
    if (!username || !username.trim()) return
    localStorage.setItem('fa_letterboxd_username', username.trim())

    showToast('Syncing Letterboxd reviews…')
    try {
      const res = await fetch('/api/letterboxd-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Letterboxd sync failed')
      showToast(`Letterboxd sync: ${data.matched} matched, ${data.unmatched} not in archive (of ${data.processed} recent diary entries)`, 7000)
      loadFilms()
      loadAllFilmsUnfiltered()
    } catch (e) {
      showToast(e.message)
    }
  }

  // «چند فصل از این سریال تا الان ساخته شده» رو از TVMaze می‌گیره (نه اینکه
  // چند فصلش رو داریم؛ همون totalSeasonsProduced که توی صفحه‌ی فیلم کنار
  // فصل‌های موجود نشون داده می‌شه). فقط سریال‌هایی که این عدد رو ندارن.
  const [fetchingSeasonCounts, setFetchingSeasonCounts] = useState(false)
  const handleFetchSeasonCounts = async () => {
    setFetchingSeasonCounts(true)
    let processed = 0
    let updated = 0
    try {
      for (let batch = 0; batch < 100; batch++) {
        const res = await fetch('/api/films/season-counts?limit=10', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'season count fetch failed')
        processed += data.processed
        updated += data.updated
        if (data.remaining === 0 || data.processed === 0) break
      }
      showToast(`Season counts: found for ${updated} of ${processed} series checked`, 7000)
      loadFilms()
      loadAllFilmsUnfiltered()
    } catch (e) {
      showToast(e.message)
    } finally {
      setFetchingSeasonCounts(false)
    }
  }

  // فیلم‌های همین صفحه بسته به این‌که کدوم بخش (فیزیکی/دیجیتال-فیلم/
  // دیجیتال-سریال) رو انتخاب کرده باشیم، محدود می‌شن
  const sectionFilms = films.filter((f) => {
    if (section === 'physical') return f.mediaType !== 'digital' && f.itemType !== 'series'
    if (section === 'physical-series') return f.mediaType !== 'digital' && f.itemType === 'series'
    if (section === 'digital-movie') return f.mediaType === 'digital' && f.itemType !== 'series'
    if (section === 'digital-series') return f.mediaType === 'digital' && f.itemType === 'series'
    return true
  })
  const pageCount = Math.max(1, Math.ceil(sectionFilms.length / PAGE_SIZE))
  const visibleFilms = sectionFilms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // کلیدهای فیلم‌هایی که نسخه‌ی فیزیکی بلوری‌شون توی آرشیو موجوده؛ برای
  // نشون‌دادن نشان «بلوری هم داره» روی کارت‌های دیجیتال همون فیلم
  const blurayKeys = new Set(
    allFilmsUnfiltered
      .filter((f) => f.mediaType !== 'digital' && (f.format || '').toLowerCase().includes('blu-ray'))
      .map((f) => `${(f.title || '').trim().toLowerCase()}::${f.year || ''}`)
  )
  const hasBlurayCopy = (f) =>
    f.mediaType === 'digital' && blurayKeys.has(`${(f.title || '').trim().toLowerCase()}::${f.year || ''}`)
  // برعکسش: کلیدهای فیلم‌هایی که نسخه‌ی دیجیتال هم دارن، برای نشون‌دادن نشان
  // «دیجیتال هم داره» روی کارت‌های بلوری همون فیلم/سریال
  const digitalKeys = new Set(
    allFilmsUnfiltered
      .filter((f) => f.mediaType === 'digital')
      .map((f) => `${(f.title || '').trim().toLowerCase()}::${f.year || ''}`)
  )
  const hasDigitalCopy = (f) =>
    f.mediaType !== 'digital' && digitalKeys.has(`${(f.title || '').trim().toLowerCase()}::${f.year || ''}`)

  // نسخه‌ی مقابل (فیزیکی/دیجیتال) همون فیلم رو برمی‌گردونه — برای نشون‌دادن
  // لوکیشن نسخه‌ی دیگه (قفسه یا هارد) کنار بج «هم داره»، نه فقط خود بولین.
  const physicalByKey = {}
  const digitalByKey = {}
  for (const f of allFilmsUnfiltered) {
    const key = `${(f.title || '').trim().toLowerCase()}::${f.year || ''}`
    if (f.mediaType === 'digital') digitalByKey[key] = f
    else physicalByKey[key] = f
  }
  const findSiblingFilm = (f) => {
    if (!f) return null
    const key = `${(f.title || '').trim().toLowerCase()}::${f.year || ''}`
    return f.mediaType === 'digital' ? physicalByKey[key] || null : digitalByKey[key] || null
  }
  // نمای تقسیم‌شده (پنل جزئیات + گرید) فقط توی حالت Thumbnails و روی صفحه‌ی
  // عریض (دسکتاپ/تبلت)؛ توی موبایل و حالت List همون مودال قبلی می‌مونه.
  // نمای «split» (پنل جزئیات نصفه‌صفحه کنار گرید) به درخواست کاربر غیرفعال شد؛
  // حالا همیشه از همون مودال کامل و وسط‌چین استفاده می‌شه، مثل جاهای دیگه‌ی اپ.
  const useSplitView = false

  const folderCounts = {
    physical: allFilmsUnfiltered.filter((f) => f.mediaType !== 'digital' && f.itemType !== 'series').length,
    physicalSeries: allFilmsUnfiltered.filter((f) => f.mediaType !== 'digital' && f.itemType === 'series').length,
    digital: allFilmsUnfiltered.filter((f) => f.mediaType === 'digital').length,
    digitalMovies: allFilmsUnfiltered.filter((f) => f.mediaType === 'digital' && f.itemType !== 'series').length,
    digitalSeries: allFilmsUnfiltered.filter((f) => f.mediaType === 'digital' && f.itemType === 'series').length,
  }
  // برای کلاژ پس‌زمینه‌ی صفحات پوشه‌ای: صفحه‌ی اصلی از کل آرشیو، صفحه‌ی
  // دیجیتال فقط از پوسترهای آیتم‌های دیجیتال
  const homePosters = allFilmsUnfiltered.map((f) => f.poster).filter(Boolean)
  const digitalPosters = allFilmsUnfiltered
    .filter((f) => f.mediaType === 'digital')
    .map((f) => f.poster)
    .filter(Boolean)
  // برای پس‌زمینه‌ی صفحات محتوا (بعد از انتخاب بخش)، فقط از پوسترهای همون بخش
  const physicalPosters = allFilmsUnfiltered
    .filter((f) => f.mediaType !== 'digital' && f.itemType !== 'series')
    .map((f) => f.poster)
    .filter(Boolean)
  const physicalSeriesPosters = allFilmsUnfiltered
    .filter((f) => f.mediaType !== 'digital' && f.itemType === 'series')
    .map((f) => f.poster)
    .filter(Boolean)
  const digitalMoviePosters = allFilmsUnfiltered
    .filter((f) => f.mediaType === 'digital' && f.itemType !== 'series')
    .map((f) => f.poster)
    .filter(Boolean)
  const digitalSeriesPosters = allFilmsUnfiltered
    .filter((f) => f.mediaType === 'digital' && f.itemType === 'series')
    .map((f) => f.poster)
    .filter(Boolean)
  const sectionPosters =
    section === 'physical'
      ? physicalPosters
      : section === 'physical-series'
      ? physicalSeriesPosters
      : section === 'digital-movie'
      ? digitalMoviePosters
      : digitalSeriesPosters

  const gridHeading =
    section === 'physical'
      ? 'Blu-ray Movies'
      : section === 'physical-series'
      ? 'Blu-ray Series'
      : section === 'digital-movie'
      ? 'Digital Movies'
      : section === 'digital-series'
      ? 'Digital Series'
      : null

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}

      {!section ? (
        <>
          <FolderNav
            counts={folderCounts}
            posters={homePosters}
            allFilms={allFilmsUnfiltered}
            onOpenFilm={(film) => setSelected(film)}
            onSelectPhysical={() => changeSection('physical')}
            onSelectPhysicalSeries={() => changeSection('physical-series')}
            onSelectDigitalType={(type) => changeSection(type === 'series' ? 'digital-series' : 'digital-movie')}
            onSelectSpecialCollections={() => changeSection('special-collections')}
            onOpenBookshelf={() => setShowBookshelf(true)}
            onSelectDashboard={() => changeSection('dashboard')}
            onSelectGallery={() => changeSection('gallery')}
            onSelectCinemaNews={() => changeSection('cinema-news')}
          />
          {selected && (
            <FilmModal
              film={selected}
              films={allFilmsUnfiltered}
              hasBluray={hasBlurayCopy(selected)}
              siblingFilm={findSiblingFilm(selected)}
              hasDigital={hasDigitalCopy(selected)}
              onNavigate={(film) => setSelected(film)}
              onSelectPerson={(name) => {
                setSelected(null)
                setPersonBeforeFilm(null)
                setSelectedPerson(name)
              }}
              onManageLoan={guardedLoan}
              onRateFilm={guardedRate}
              onSaveSeasonDrive={guardedSeasonDrive}
              onEdit={guardedEdit}
              onClose={closeFilmModal}
            />
          )}
          {selectedPerson && (
            <PersonModal
              personName={selectedPerson}
              allFilms={allFilmsUnfiltered}
              hasBluray={hasBlurayCopy}
              hasDigital={hasDigitalCopy}
              onSelectFilm={openFilmFromPerson}
              onSelectPerson={(name) => setSelectedPerson(name)}
              onClose={() => setSelectedPerson(null)}
            />
          )}
          {editing && (
            <EditModal
              film={editing}
              onClose={() => setEditing(null)}
              onSave={(patch) => handleSaveFilm(editing.id, patch)}
              onAutofill={() => handleAutofillFilm(editing.id)}
              onDelete={handleDeleteFilm}
            />
          )}
        </>
      ) : section === 'special-collections' ? (
        <div className="folder-nav">
          <PosterCollage posters={homePosters} />
          <div className="folder-nav-content">
            <button className="btn btn-ghost folder-back" onClick={() => changeSection(null)}>
              ← Back
            </button>
            <div className="marquee-band">
              <p className="marquee-eyebrow">Coming soon</p>
              <h1 className="folder-nav-title">Special Collections</h1>
              <p style={{ color: 'var(--marquee-muted, #8a8375)', fontSize: 14, maxWidth: 420, margin: '0 auto' }}>
                This section is set up and ready — just waiting on the collection data.
              </p>
            </div>
          </div>
        </div>
      ) : section === 'gallery' ? (
        <>
          <Suspense fallback={<div className="status" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c', color: '#eee', zIndex: 10 }}>Loading gallery…</div>}>
            <GallerySphere
              films={allFilmsUnfiltered}
              onBack={() => changeSection(null)}
              onOpenFilm={(film) => setSelected(film)}
            />
          </Suspense>
          {selected && (
            <FilmModal
              film={selected}
              films={allFilmsUnfiltered}
              hasBluray={hasBlurayCopy(selected)}
              siblingFilm={findSiblingFilm(selected)}
              hasDigital={hasDigitalCopy(selected)}
              onNavigate={(film) => setSelected(film)}
              onSelectPerson={(name) => {
                setSelected(null)
                setPersonBeforeFilm(null)
                setSelectedPerson(name)
              }}
              onManageLoan={guardedLoan}
              onRateFilm={guardedRate}
              onSaveSeasonDrive={guardedSeasonDrive}
              onEdit={guardedEdit}
              onClose={closeFilmModal}
            />
          )}
        </>
      ) : section === 'cinema-news' ? (
        <>
          <CinemaNewsPage
            onBack={() => changeSection(null)}
            onSelectPerson={(name) => setSelectedPerson(name)}
            theme={theme}
            setTheme={setTheme}
            films={allFilmsUnfiltered}
          />
          {selected && (
            <FilmModal
              film={selected}
              films={allFilmsUnfiltered}
              hasBluray={hasBlurayCopy(selected)}
              siblingFilm={findSiblingFilm(selected)}
              hasDigital={hasDigitalCopy(selected)}
              onNavigate={(film) => setSelected(film)}
              onSelectPerson={(name) => {
                setSelected(null)
                setPersonBeforeFilm(null)
                setSelectedPerson(name)
              }}
              onManageLoan={guardedLoan}
              onRateFilm={guardedRate}
              onSaveSeasonDrive={guardedSeasonDrive}
              onEdit={guardedEdit}
              onClose={closeFilmModal}
            />
          )}
          {selectedPerson && (
            <PersonModal
              personName={selectedPerson}
              allFilms={allFilmsUnfiltered}
              hasBluray={hasBlurayCopy}
              hasDigital={hasDigitalCopy}
              onSelectFilm={openFilmFromPerson}
              onSelectPerson={(name) => setSelectedPerson(name)}
              onClose={() => setSelectedPerson(null)}
            />
          )}
        </>
      ) : section === 'dashboard' ? (
        <>
          <DashboardPanel
            films={allFilmsUnfiltered}
            onBack={() => changeSection(null)}
            onOpenFilm={(film) => setSelected(film)}
            onOpenPerson={(name) => setSelectedPerson(name)}
            theme={theme}
            setTheme={setTheme}
            isAdmin={isAdmin}
            onFilmsChanged={() => {
              loadFilms()
              loadAllFilmsUnfiltered()
            }}
          />
          {selected && (
            <FilmModal
              film={selected}
              films={allFilmsUnfiltered}
              hasBluray={hasBlurayCopy(selected)}
              siblingFilm={findSiblingFilm(selected)}
              hasDigital={hasDigitalCopy(selected)}
              onNavigate={(film) => setSelected(film)}
              onSelectPerson={(name) => {
                setSelected(null)
                setPersonBeforeFilm(null)
                setSelectedPerson(name)
              }}
              onManageLoan={guardedLoan}
              onRateFilm={guardedRate}
              onSaveSeasonDrive={guardedSeasonDrive}
              onEdit={guardedEdit}
              onClose={closeFilmModal}
            />
          )}
          {selectedPerson && (
            <PersonModal
              personName={selectedPerson}
              allFilms={allFilmsUnfiltered}
              hasBluray={hasBlurayCopy}
              hasDigital={hasDigitalCopy}
              onSelectFilm={openFilmFromPerson}
              onSelectPerson={(name) => setSelectedPerson(name)}
              onClose={() => setSelectedPerson(null)}
            />
          )}
        </>
      ) : (
        <>
      <PosterCollage posters={sectionPosters} count={16} fixed />


      <Header
        query={query}
        setQuery={setQuery}
        genre={genre}
        setGenre={setGenre}
        loanedOnly={loanedOnly}
        setLoanedOnly={setLoanedOnly}
        watched={watched}
        setWatched={setWatched}
        minRating={minRating}
        setMinRating={setMinRating}
        genres={genres}
        decade={decade}
        setDecade={setDecade}
        decades={decades}
        drive={drive}
        setDrive={setDrive}
        drives={drives}
        sort={sort}
        setSort={setSort}
        total={sectionFilms.length}
        section={section}
        onImport={handleImport}
        onImportRatings={handleImportRatings}
        onAddFilm={() => setAdding('blank')}
        onEnrichCatalog={handleEnrichCatalog}
        enrichScopeLabel={enrichScopeLabel(section)}
        enrichingCatalog={enrichingCatalog}
        enrichRemaining={enrichRemaining}
        onSyncLetterboxd={handleSyncLetterboxd}
        onFetchSeasonCounts={handleFetchSeasonCounts}
        fetchingSeasonCounts={fetchingSeasonCounts}
        onOpenExport={() => {
          // به‌جای مودال جدای Export که تکراری بود، مستقیم می‌بره به تب
          // «Export & Backup» توی داشبورد — تنها جایی که خروجی‌ها ازونجا گرفته می‌شن.
          try {
            window.localStorage.setItem('cinefilm-dashboard-last-tab', 'export')
          } catch {}
          changeSection('dashboard')
        }}
        onOpenLocationBrowser={() => setShowLocationBrowser(true)}
        onOpenBookshelf={() => setShowBookshelf(true)}
        view={view}
        setView={setView}
        alpha={alpha}
        setAlpha={setAlpha}
        theme={theme}
        setTheme={setTheme}
        onGoToLibrary={() => changeSection(null)}
        page={page}
        pageCount={pageCount}
        setPage={setPage}
        showPagination={pageCount > 1 && !loading && sectionFilms.length > 0}
      />

      <main className="container">
        {loading ? (
          <div className="status">Loading films…</div>
        ) : sectionFilms.length === 0 ? (
          <div className="status empty-state">
            <span className="empty-icon">
              <IconArchive width={22} height={22} />
            </span>
            <p>
              {section === 'physical'
                ? 'No physical films match here yet.'
                : section === 'physical-series'
                ? 'No physical (Blu-ray) series added yet.'
                : section === 'digital-movie'
                ? 'No digital movies added yet.'
                : 'No digital series added yet.'}
            </p>
            <p className="empty-hint">
              {section === 'physical' || section === 'physical-series'
                ? 'Use "Import Excel" or "+ Add Film" above to add titles.'
                : 'Use "+ Add Film" above — it will be pre-filled for this section.'}
            </p>
          </div>
        ) : view === 'list' ? (
          <FilmList films={visibleFilms} onSelect={setSelected} onEdit={guardedEdit} hasBluray={hasBlurayCopy} hasDigital={hasDigitalCopy} />
        ) : useSplitView && selected ? (
          <div className="grid-split">
            <div className="grid-split-grid">
              {gridHeading && (
                <div className="grid-section-heading">
                  <span>{gridHeading}</span>
                </div>
              )}
              <FilmGrid films={visibleFilms} onSelect={setSelected} onToggleWatch={(film, patch) => handleSaveFilm(film.id, patch)} hasBluray={hasBlurayCopy} hasDigital={hasDigitalCopy} />
            </div>
            <div className="grid-split-detail">
              <FilmModal
                panel
                film={selected}
                films={sectionFilms}
                hasBluray={hasBlurayCopy(selected)}
              siblingFilm={findSiblingFilm(selected)}
                hasDigital={hasDigitalCopy(selected)}
                onNavigate={(film) => setSelected(film)}
                onSelectPerson={(name) => {
                  setSelected(null)
                  setPersonBeforeFilm(null)
                  setSelectedPerson(name)
                }}
                onManageLoan={guardedLoan}
                onRateFilm={guardedRate}
                onSaveSeasonDrive={guardedSeasonDrive}
                onEdit={guardedEdit}
                onClose={closeFilmModal}
              />
            </div>
          </div>
        ) : (
          <>
            {gridHeading && (
              <div className="grid-section-heading">
                <span>{gridHeading}</span>
              </div>
            )}
            <FilmGrid films={visibleFilms} onSelect={setSelected} onToggleWatch={(film, patch) => handleSaveFilm(film.id, patch)} hasBluray={hasBlurayCopy} hasDigital={hasDigitalCopy} />
          </>
        )}
        {pageCount > 1 && !loading && (
          <div className="pagination">
            <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Previous</button>
            <span>Page {page} of {pageCount}</span>
            <button type="button" disabled={page === pageCount} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        )}
      </main>

      <footer className="footer">
        Cinefilm Archive · © {new Date().getFullYear()} · @1hamid
      </footer>

      {selected && (!useSplitView || forceFilmOverlay) && (
        <FilmModal
          film={selected}
          films={sectionFilms}
          hasBluray={hasBlurayCopy(selected)}
              siblingFilm={findSiblingFilm(selected)}
          hasDigital={hasDigitalCopy(selected)}
          onNavigate={(film) => setSelected(film)}
          onSelectPerson={(name) => {
            setSelected(null)
            setForceFilmOverlay(false)
            setPersonBeforeFilm(null)
            setSelectedPerson(name)
          }}
          onManageLoan={guardedLoan}
          onRateFilm={guardedRate}
          onSaveSeasonDrive={guardedSeasonDrive}
          onEdit={guardedEdit}
          onClose={closeFilmModal}
        />
      )}

      {selectedPerson && (
        <PersonModal
          personName={selectedPerson}
          allFilms={allFilmsUnfiltered}
          hasBluray={hasBlurayCopy}
          hasDigital={hasDigitalCopy}
          onSelectFilm={openFilmFromPerson}
          onSelectPerson={(name) => setSelectedPerson(name)}
          onClose={() => setSelectedPerson(null)}
        />
      )}

      {loanFilm && (
        <LoanModal
          film={loanFilm}
          onClose={() => setLoanFilm(null)}
          onSaveLoan={(id, patch) => handleSaveFilm(id, patch)}
        />
      )}

      {adding && (
        <EditModal
          film={{
            mediaType: section === 'digital-movie' || section === 'digital-series' ? 'digital' : 'physical',
            itemType: section === 'digital-series' || section === 'physical-series' ? 'series' : 'movie',
          }}
          startWithLink={adding === 'link'}
          existingFilms={allFilmsUnfiltered}
          onOpenExisting={(existingFilm) => {
            setAdding(false)
            setForceFilmOverlay(true)
            setSelected(existingFilm)
          }}
          onClose={() => setAdding(false)}
          onSave={handleAddFilm}
        />
      )}

      {editing && (
        <EditModal
          film={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => handleSaveFilm(editing.id, patch)}
          onAutofill={() => handleAutofillFilm(editing.id)}
          onDelete={handleDeleteFilm}
        />
      )}
        </>
      )}

      {showLocationBrowser && (
        <LocationBrowserModal
          films={allFilmsUnfiltered}
          canEdit={!isGuest}
          onSelectFilm={(film) => {
            setForceFilmOverlay(true)
            setSelected(film)
          }}
          onFilmsChanged={loadAllFilmsUnfiltered}
          onClose={() => setShowLocationBrowser(false)}
        />
      )}

      {showBookshelf && (
        <BookshelfView
          films={allFilmsUnfiltered}
          onSelectFilm={(film) => {
            setForceFilmOverlay(true)
            setSelected(film)
          }}
          onClose={() => setShowBookshelf(false)}
        />
      )}
    </div>
  )
}
