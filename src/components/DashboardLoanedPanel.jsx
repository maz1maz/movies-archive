import { IconHandshake } from './icons.jsx'

// تب مستقلِ «Loaned Out» توی داشبورد — قبلاً بخشی از Overview بود، حالا
// آیتم جدا شده که راحت‌تر پیدا بشه.
export default function DashboardLoanedPanel({ films, onOpenFilm }) {
  const loanedFilms = films.filter((f) => f.borrowedTo)
  const openFilm = (film) => onOpenFilm && onOpenFilm(film)

  return (
    <div className="dashboard-loaned-tab">
      <p className="dashboard-eyebrow" style={{ marginTop: 18 }}>
        {loanedFilms.length} title{loanedFilms.length === 1 ? '' : 's'}
      </p>

      {loanedFilms.length > 0 ? (
        <div className="stats-box stats-box-loaned">
          <div className="stats-box-head" style={{ marginBottom: '4px' }}>
            <h3>
              <IconHandshake width={16} height={16} /> Currently Loaned Out ({loanedFilms.length})
            </h3>
            <span className="stats-box-sub">Films currently borrowed from your physical collection</span>
          </div>
          <div className="loaned-cards-grid">
            {loanedFilms.map((f) => {
              const daysAgo = f.borrowedDate
                ? Math.floor((Date.now() - new Date(f.borrowedDate).getTime()) / (1000 * 60 * 60 * 24))
                : null
              return (
                <button key={f.id} type="button" className="loaned-card-item" onClick={() => openFilm(f)}>
                  <div className="loaned-card-poster">
                    {f.poster ? <img src={f.poster} alt={f.title} /> : <span className="loaned-card-poster-empty">🎬</span>}
                  </div>
                  <div className="loaned-card-info">
                    <div className="loaned-card-title">
                      {f.title} {f.year && `(${f.year})`}
                    </div>
                    <div className="loaned-card-borrower">
                      <span className="borrower-badge">🤝 {f.borrowedTo}</span>
                    </div>
                    {f.borrowedDate && (
                      <div className="loaned-card-date">
                        {daysAgo !== null && !isNaN(daysAgo)
                          ? daysAgo === 0
                            ? 'Loaned today'
                            : `Loaned ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago (${new Date(f.borrowedDate).toLocaleDateString()})`
                          : new Date(f.borrowedDate).toLocaleDateString()}
                      </div>
                    )}
                    <div className="loaned-card-loc">
                      C{f.closet || '–'} R{f.row || '–'} S{f.shelf || '–'} · {f.format || 'Blu-ray'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="stats-box stats-box-loaned-empty">
          <div className="stats-box-head" style={{ marginBottom: 0 }}>
            <h3>
              <IconHandshake width={16} height={16} /> Currently Loaned Out (0 items)
            </h3>
            <span className="stats-box-sub">All your physical films are safely on your shelves right now.</span>
          </div>
        </div>
      )}
    </div>
  )
}
