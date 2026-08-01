// Lightweight CSV parsing + matching for importing ratings/watched status
// from Letterboxd or IMDb export files. No external dependency — these
// files are simple enough that a small hand-rolled parser is enough and
// keeps bundle size down.

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''))
}

function toObjects(rows) {
  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).map((r) => {
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] || '').trim()
    })
    return obj
  })
}

// Detects the export format based on the header row.
export function detectCsvFormat(text) {
  const firstLine = text.split(/\r?\n/)[0] || ''
  if (firstLine.includes('Your Rating') && firstLine.includes('Const')) return 'imdb'
  if (firstLine.includes('Letterboxd URI')) return 'letterboxd'
  return 'unknown'
}

// Normalizes each row from either format into: { title, year, myRating, watched }
export function parseImportCsv(text) {
  const format = detectCsvFormat(text)
  const rows = toObjects(parseCsv(text))

  if (format === 'letterboxd') {
    return {
      format,
      entries: rows
        .map((r) => {
          const stars = parseFloat(r['Rating'])
          return {
            title: r['Name'] || '',
            year: r['Year'] ? parseInt(r['Year'], 10) : null,
            myRating: isNaN(stars) ? null : Math.max(1, Math.min(5, Math.round(stars))),
            watched: true,
          }
        })
        .filter((e) => e.title),
    }
  }

  if (format === 'imdb') {
    return {
      format,
      entries: rows
        .map((r) => {
          const tenScale = parseFloat(r['Your Rating'])
          return {
            title: r['Title'] || '',
            year: r['Year'] ? parseInt(r['Year'], 10) : null,
            myRating: isNaN(tenScale) ? null : Math.max(1, Math.min(5, Math.round(tenScale / 2))),
            watched: true,
          }
        })
        .filter((e) => e.title),
    }
  }

  return { format: 'unknown', entries: [] }
}

// Parses a Letterboxd watchlist.csv, list export, or reviews.csv (columns
// include at least "Name", usually "Year", and for reviews.csv also "Rating"
// and "Review") into {title, year, myRating, reviewText} entries — used by
// the Dashboard Watchlists tab.
export function parseWatchlistCsv(text) {
  const rows = toObjects(parseCsv(text))
  return rows
    .map((r) => {
      const ratingRaw = r['Rating']
      const rating = ratingRaw ? parseFloat(ratingRaw) : null
      return {
        title: r['Name'] || r['Title'] || '',
        year: r['Year'] ? parseInt(r['Year'], 10) : null,
        myRating: rating && !isNaN(rating) ? rating : null,
        reviewText: r['Review'] ? r['Review'].slice(0, 500) : null,
      }
    })
    .filter((e) => e.title)
}

function normalizeTitle(t) {
  return (t || '').trim().toLowerCase().replace(/^the\s+/, '')
}

// Matches parsed entries against the archive's films by title (+ year when
// both sides have one, to disambiguate remakes/franchises sharing a title).
export function matchEntriesToFilms(entries, films) {
  const byKey = new Map()
  films.forEach((f) => {
    const key = normalizeTitle(f.title)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(f)
  })

  const matched = []
  const unmatched = []

  entries.forEach((entry) => {
    const candidates = byKey.get(normalizeTitle(entry.title)) || []
    let film = null
    if (candidates.length === 1) {
      film = candidates[0]
    } else if (candidates.length > 1 && entry.year) {
      film = candidates.find((f) => f.year === entry.year) || null
    } else if (candidates.length > 1) {
      film = candidates[0]
    }
    if (film) matched.push({ entry, film })
    else unmatched.push(entry)
  })

  return { matched, unmatched }
}
