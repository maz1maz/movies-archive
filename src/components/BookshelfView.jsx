import { IconBookshelf } from './icons.jsx'

export default function BookshelfView({ films, onSelect }) {
  // Group films by Shelf -> Row
  const shelvesMap = {}

  films.forEach((f) => {
    const shelfKey = f.shelf ? `Shelf ${f.shelf}` : 'Unassigned Shelf'
    const rowKey = f.row ? `Row ${f.row}` : 'Row General'

    if (!shelvesMap[shelfKey]) shelvesMap[shelfKey] = {}
    if (!shelvesMap[shelfKey][rowKey]) shelvesMap[shelfKey][rowKey] = []

    shelvesMap[shelfKey][rowKey].push(f)
  })

  const sortedShelfKeys = Object.keys(shelvesMap).sort((a, b) =>
    a.localeCompare(b)
  )

  if (films.length === 0) {
    return <div className="status">No films found for bookshelf display.</div>
  }

  return (
    <div className="bookshelf-container">
      {sortedShelfKeys.map((shelfName) => (
        <div key={shelfName} className="shelf-group">
          <div className="shelf-group-header">
            <span className="shelf-header-icon">
              <IconBookshelf width={16} height={16} />
            </span>
            <h2 className="shelf-header-title">{shelfName}</h2>
          </div>

          {Object.keys(shelvesMap[shelfName])
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
            .map((rowName) => {
              const rowFilms = shelvesMap[shelfName][rowName]
              return (
                <div key={rowName} className="rack-row-wrapper">
                  <div className="rack-row-label">
                    <span>{rowName}</span>
                    <span className="rack-row-count">({rowFilms.length} items)</span>
                  </div>

                  {/* Physical Wooden/Metallic Rack Shelf */}
                  <div className="physical-shelf-rack">
                    <div className="shelf-items-list">
                      {rowFilms.map((film) => (
                        <button
                          key={film.id}
                          className="spine-item"
                          onClick={() => onSelect(film)}
                          title={`${film.title} (${film.year || '—'}) - Shelf ${
                            film.shelf
                          } / Row ${film.row}`}
                        >
                          <div className="spine-case">
                            <img
                              src={film.poster}
                              alt={film.title}
                              className="spine-poster-img"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                            {film.format && (
                              <span className={`format-badge-mini ${film.format.toLowerCase().replace(/[^a-z0-9]/g, '')}`}>
                                {film.format}
                              </span>
                            )}
                            {film.borrowedTo && (
                              <span className="borrowed-tag-mini">LOANED</span>
                            )}
                          </div>
                          <span className="spine-film-title">{film.title}</span>
                        </button>
                      ))}
                    </div>
                    {/* Shelf Wood Floor */}
                    <div className="shelf-plank-wood" />
                  </div>
                </div>
              )
            })}
        </div>
      ))}
    </div>
  )
}
