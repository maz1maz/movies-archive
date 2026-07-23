import { useEffect, useState } from 'react'
import Header from './components/Header.jsx'
import FilmGrid from './components/FilmGrid.jsx'
import FilmList from './components/FilmList.jsx'
import FilmModal from './components/FilmModal.jsx'
import EditModal from './components/EditModal.jsx'
import PersonModal from './components/PersonModal.jsx'
import StatsModal from './components/StatsModal.jsx'
import ExportModal from './components/ExportModal.jsx'
import LoanModal from './components/LoanModal.jsx'
import { IconArchive } from './components/icons.jsx'

export default function App() {
  const [films, setFilms] = useState([])
  const [genres, setGenres] = useState([])
  const [decades, setDecades] = useState([])
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('')
  const [loanedOnly, setLoanedOnly] = useState(false)
  const [watched, setWatched] = useState('')
  const [minRating, setMinRating] = useState('')
  const [decade, setDecade] = useState('')
  const [sort, setSort] = useState('shelf')
  const [alpha, setAlpha] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 48
  const [view, setView] = useState(() => {
    const storedView = localStorage.getItem('fa_view')
    return storedView === 'grid' || storedView === 'list' ? storedView : 'list'
  })
  const [theme, setTheme] = useState(
    () => localStorage.getItem('fa_theme') || (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  )
  const [selected, setSelected] = useState(null)
  const [isWide, setIsWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches
  )
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [loanFilm, setLoanFilm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enrichingCatalog, setEnrichingCatalog] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (m) => {
    setToast(m)
    setTimeout(() => setToast(''), 4000)
  }

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const handler = (e) => setIsWide(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    localStorage.setItem('fa_view', view)
  }, [view])

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light')
    localStorage.setItem('fa_theme', theme)
  }, [theme])

  const loadFilms = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (genre) params.set('genre', genre)
    if (loanedOnly) params.set('loaned', '1')
    if (watched) params.set('watched', watched)
    if (minRating) params.set('minRating', minRating)
    if (decade) params.set('decade', decade)
    if (sort) params.set('sort', sort)
    if (alpha) params.set('alpha', alpha)
    fetch('/api/films?' + params.toString())
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          // پاسخ خطا (مثل مشکل دیتابیس) به‌جای آرایه‌ی فیلم‌ها — اگه اینجا
          // بدون این چک films رو ست کنیم، films.length/films.slice بعداً
          // throw می‌کنه و کل صفحه‌ی React سیاه/خالی می‌شه.
          console.error('Unexpected /api/films response:', data)
          setFilms([])
          setLoading(false)
          showToast((data && data.error) || 'خطا در بارگذاری فیلم‌ها')
          return
        }
        setFilms(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    setPage(1)
    loadFilms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, genre, loanedOnly, watched, minRating, decade, sort, alpha])

  useEffect(() => {
    fetch('/api/genres')
      .then((r) => r.json())
      .then((data) => setGenres(Array.isArray(data) ? data : []))
      .catch(() => {})
    fetch('/api/decades')
      .then((r) => r.json())
      .then((data) => setDecades(Array.isArray(data) ? data : []))
      .catch(() => {})
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

  const handleImport = async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    showToast('Importing Excel file…')
    try {
      const res = await fetch('/api/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'import failed')
      showToast(
        `${data.count} film(s) processed (${data.added} new, ${data.updated} updated)`
      )
      setQuery('')
      setGenre('')
      setDecade('')
      setAlpha('')
      loadFilms()
      refreshMeta()
    } catch (e) {
      showToast(e.message)
    }
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
      if (!res.ok) throw new Error('save failed')
      const saved = await res.json()
      setFilms((prev) => prev.map((f) => (f.id === id ? saved : f)))
      if (selected && selected.id === id) setSelected(saved)
      showToast('Saved')
    } catch (e) {
      showToast(e.message)
    }
    setEditing(null)
    setLoanFilm(null)
  }

  const handleAutofillFilm = async (id) => {
    try {
      const res = await fetch(`/api/films/${id}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'auto-fill failed')

      const { _enrichment, ...saved } = data
      setFilms((prev) => prev.map((film) => (film.id === id ? saved : film)))
      if (selected?.id === id) setSelected(saved)
      setEditing(saved)
      refreshMeta()

      if (_enrichment?.fields?.length) {
        showToast(`Auto-filled ${_enrichment.fields.length} missing detail${_enrichment.fields.length === 1 ? '' : 's'}`)
      } else if (_enrichment?.enabled === false) {
        showToast('Set OMDB_API_KEY to enable automatic metadata')
      } else {
        showToast('No additional metadata found')
      }
      return saved
    } catch (e) {
      showToast(e.message)
      return null
    }
  }

  const handleEnrichCatalog = async () => {
    setEnrichingCatalog(true)
    let processed = 0
    let updated = 0

    try {
      for (let batch = 0; batch < 100; batch++) {
        const res = await fetch('/api/films/enrich?limit=10', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'metadata enrichment failed')

        processed += data.processed
        updated += data.updated
        if (data.remaining === 0 || data.processed === 0) break
      }
      showToast(`Metadata complete · updated ${updated} of ${processed} films`)
      loadFilms()
      refreshMeta()
    } catch (e) {
      showToast(e.message)
    } finally {
      setEnrichingCatalog(false)
    }
  }

  const pageCount = Math.max(1, Math.ceil(films.length / PAGE_SIZE))
  const visibleFilms = films.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  // نمای تقسیم‌شده (پنل جزئیات + گرید) فقط توی حالت Thumbnails و روی صفحه‌ی
  // عریض (دسکتاپ/تبلت)؛ توی موبایل و حالت List همون مودال قبلی می‌مونه.
  const useSplitView = view === 'grid' && isWide

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}

      <Header
        query={query}
        setQuery={setQuery}
        genre={genre}
        setGenre={setGenre}
        loanedOnly={loanedOnly}
        setLoanedOnly={setLoanedOnly}
        onRandomFilm={() => films.length && setSelected(films[Math.floor(Math.random() * films.length)])}
        watched={watched}
        setWatched={setWatched}
        minRating={minRating}
        setMinRating={setMinRating}
        genres={genres}
        decade={decade}
        setDecade={setDecade}
        decades={decades}
        sort={sort}
        setSort={setSort}
        total={films.length}
        onImport={handleImport}
        onAddFilm={() => setAdding(true)}
        onEnrichCatalog={handleEnrichCatalog}
        enrichingCatalog={enrichingCatalog}
        onOpenStats={() => setShowStats(true)}
        onOpenExport={() => setShowExport(true)}
        view={view}
        setView={setView}
        alpha={alpha}
        setAlpha={setAlpha}
        theme={theme}
        setTheme={setTheme}
      />

      <main className="container">
        {loading ? (
          <div className="status">Loading films…</div>
        ) : films.length === 0 ? (
          <div className="status empty-state">
            <span className="empty-icon">
              <IconArchive width={22} height={22} />
            </span>
            <p>No films in your archive yet.</p>
            <p className="empty-hint">
              Use the “Import Excel” button above to add your films.
            </p>
          </div>
        ) : view === 'list' ? (
          <FilmList films={visibleFilms} onSelect={setSelected} onEdit={setEditing} />
        ) : useSplitView && selected ? (
          <div className="grid-split">
            <div className="grid-split-detail">
              <FilmModal
                panel
                film={selected}
                films={visibleFilms}
                onNavigate={(film) => setSelected(film)}
                onSelectPerson={(name) => {
                  setSelected(null)
                  setSelectedPerson(name)
                }}
                onManageLoan={(film) => setLoanFilm(film)}
                onClose={() => setSelected(null)}
              />
            </div>
            <div className="grid-split-grid">
              <FilmGrid films={visibleFilms} onSelect={setSelected} />
            </div>
          </div>
        ) : (
          <FilmGrid films={visibleFilms} onSelect={setSelected} />
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
        Physical film archive · Built with React and Node.js
      </footer>

      {selected && !useSplitView && (
        <FilmModal
          film={selected}
          films={films}
          onNavigate={(film) => setSelected(film)}
          onSelectPerson={(name) => {
            setSelected(null)
            setSelectedPerson(name)
          }}
          onManageLoan={(film) => {
            setLoanFilm(film)
          }}
          onClose={() => setSelected(null)}
        />
      )}

      {selectedPerson && (
        <PersonModal
          personName={selectedPerson}
          allFilms={films}
          onSelectFilm={(film) => {
            setSelectedPerson(null)
            setSelected(film)
          }}
          onClose={() => setSelectedPerson(null)}
        />
      )}

      {showStats && (
        <StatsModal films={films} onClose={() => setShowStats(false)} />
      )}

      {showExport && (
        <ExportModal films={films} onClose={() => setShowExport(false)} />
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
          film={{}}
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
        />
      )}
    </div>
  )
}
