import { useEffect, useState } from 'react'
import Header from './components/Header.jsx'
import FilmGrid from './components/FilmGrid.jsx'
import FilmList from './components/FilmList.jsx'
import BookshelfView from './components/BookshelfView.jsx'
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
  const [view, setView] = useState(
    () => localStorage.getItem('fa_view') || 'grid'
  )
  const [theme, setTheme] = useState(
    () => localStorage.getItem('fa_theme') || (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  )
  const [selected, setSelected] = useState(null)
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [loanFilm, setLoanFilm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const showToast = (m) => {
    setToast(m)
    setTimeout(() => setToast(''), 4000)
  }

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
        setFilms(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadFilms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, genre, loanedOnly, watched, minRating, decade, sort, alpha])

  useEffect(() => {
    fetch('/api/genres')
      .then((r) => r.json())
      .then(setGenres)
      .catch(() => {})
    fetch('/api/decades')
      .then((r) => r.json())
      .then(setDecades)
      .catch(() => {})
  }, [])

  const refreshMeta = () => {
    fetch('/api/decades')
      .then((r) => r.json())
      .then(setDecades)
      .catch(() => {})
    fetch('/api/genres')
      .then((r) => r.json())
      .then(setGenres)
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
      showToast('Film added')
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
          <FilmList films={films} onSelect={setSelected} onEdit={setEditing} />
        ) : view === 'bookshelf' ? (
          <BookshelfView films={films} onSelect={setSelected} />
        ) : (
          <FilmGrid films={films} onSelect={setSelected} />
        )}
      </main>

      <footer className="footer">
        Physical film archive · Built with React and Node.js
      </footer>

      {selected && (
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
        />
      )}
    </div>
  )
}
