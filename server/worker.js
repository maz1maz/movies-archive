// Cloudflare Workers API — replaces the old Express/Netlify server.
// Handles all /api/* routes using D1 for persistent storage.
import { json, rowToFilm, normalizeTitle, EDITABLE, ENRICHABLE_FIELDS, isEmptyMetadata } from './helpers.js'
import { enrichFilm } from './omdb.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const { pathname } = url
    const method = request.method

    // CORS headers for the frontend
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    const db = env.DB // D1 binding

    try {
      // ---- GET /api/films ----
      if (method === 'GET' && pathname === '/api/films') {
        const { q, genre, shelf, sort, alpha, decade, loaned, watched, minRating } = Object.fromEntries(url.searchParams)
        let sql = 'SELECT * FROM films WHERE 1=1'
        const params = []

        if (loaned === '1') { sql += ' AND borrowedTo IS NOT NULL AND borrowedTo != \'\'' }
        if (watched === '1') { sql += ' AND watched = 1' }
        if (watched === '0') { sql += ' AND (watched IS NULL OR watched = 0)' }
        if (minRating) { sql += ' AND rating >= ?'; params.push(Number(minRating)) }
        if (shelf) { sql += ' AND shelf = ?'; params.push(shelf) }
        if (genre) { sql += ' AND genre LIKE ?'; params.push(`%"${genre}"%`) }
        if (q) {
          const s = `%${q.toLowerCase()}%`
          sql += ' AND (LOWER(title) LIKE ? OR LOWER(originalTitle) LIKE ? OR LOWER(director) LIKE ? OR LOWER(cast) LIKE ?)'
          params.push(s, s, s, s)
        }
        if (alpha) {
          if (alpha === '0-9') { sql += ' AND title GLOB \'[0-9]*\'' }
          else { sql += ' AND LOWER(title) LIKE ?'; params.push(`${alpha.toLowerCase()}%`) }
        }
        if (decade) {
          const d = parseInt(decade, 10)
          if (!isNaN(d)) { sql += ' AND year >= ? AND year < ?'; params.push(d, d + 10) }
        }

        // Sorting
        if (sort === 'year_desc') sql += ' ORDER BY year DESC'
        else if (sort === 'year_asc') sql += ' ORDER BY year ASC'
        else if (sort === 'rating') sql += ' ORDER BY rating DESC'
        else if (sort === 'shelf') sql += ' ORDER BY shelf ASC'
        else sql += ' ORDER BY title ASC'

        const result = await db.prepare(sql).bind(...params).all()
        // Parse JSON string fields
        const films = (result.results || []).map(parseFilmRow)
        return json(films, 200, corsHeaders)
      }

      // ---- GET /api/films/:id ----
      const detailMatch = pathname.match(/^\/api\/films\/([^/]+)$/)
      if (method === 'GET' && detailMatch) {
        const film = await db.prepare('SELECT * FROM films WHERE id = ?').bind(detailMatch[1]).first()
        if (!film) return json({ error: 'یافت نشد' }, 404, corsHeaders)
        return json(parseFilmRow(film), 200, corsHeaders)
      }

      // ---- POST /api/films (create) ----
      if (method === 'POST' && pathname === '/api/films') {
        const body = await request.json()
        if (!String(body.title || '').trim()) {
          return json({ error: 'title is required' }, 400, corsHeaders)
        }
        const key = env.OMDB_API_KEY
        let film = {
          ...body,
          id: `f${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: String(body.title).trim(),
          shelf: body.shelf || '',
          row: body.row || '',
          cast: Array.isArray(body.cast) ? JSON.stringify(body.cast) : (body.cast || ''),
          genre: Array.isArray(body.genre) ? JSON.stringify(body.genre) : (body.genre || ''),
          watched: body.watched ? 1 : 0,
          rating: body.rating ? parseFloat(body.rating) : null,
          year: body.year ? parseInt(body.year, 10) : null,
          runtime: body.runtime ? parseInt(body.runtime, 10) : null,
        }
        if (key) {
          try {
            film = await enrichFilm(film, key)
          } catch {}
        }
        await insertFilm(db, film)
        return json(film, 201, corsHeaders)
      }

      // ---- PATCH /api/films/:id (update) ----
      const patchMatch = pathname.match(/^\/api\/films\/([^/]+)$/)
      if (method === 'PATCH' && patchMatch) {
        const existing = await db.prepare('SELECT * FROM films WHERE id = ?').bind(patchMatch[1]).first()
        if (!existing) return json({ error: 'not found' }, 404, corsHeaders)
        const body = await request.json()
        const updated = { ...parseFilmRow(existing) }
        for (const k of EDITABLE) {
          if (k in body) {
            if ((k === 'cast' || k === 'genre') && Array.isArray(body[k])) {
              updated[k] = JSON.stringify(body[k])
            } else if (k === 'watched') {
              updated[k] = body[k] ? 1 : 0
            } else if (k === 'rating') {
              updated[k] = body[k] != null ? parseFloat(body[k]) : null
            } else if (k === 'year' || k === 'runtime') {
              updated[k] = body[k] != null ? parseInt(body[k], 10) : null
            } else {
              updated[k] = body[k]
            }
          }
        }
        await updateFilm(db, updated)
        return json(parseFilmRow(updated), 200, corsHeaders)
      }

      // ---- POST /api/films/enrich ----
      if (method === 'POST' && pathname === '/api/films/enrich') {
        if (!env.OMDB_API_KEY) {
          return json({ error: 'OMDB_API_KEY is not configured' }, 400, corsHeaders)
        }
        const requestedLimit = parseInt(url.searchParams.get('limit') || '10', 10)
        const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 15) : 10

        const all = await db.prepare('SELECT * FROM films WHERE metadataEnrichmentAttemptedAt IS NULL').all()
        const candidates = (all.results || []).slice(0, limit)

        let updated = 0
        for (const film of candidates) {
          const parsed = parseFilmRow(film)
          const enriched = await enrichFilm(parsed, env.OMDB_API_KEY)
          const fields = ENRICHABLE_FIELDS.filter(
            (f) => isEmptyMetadata(parsed[f]) && !isEmptyMetadata(enriched[f])
          )
          if (fields.length) updated++
          enriched.metadataEnrichmentAttemptedAt = new Date().toISOString()
          await updateFilm(db, enriched)
        }

        const remaining = await db.prepare('SELECT COUNT(*) as count FROM films WHERE metadataEnrichmentAttemptedAt IS NULL').first()
        return json({ processed: candidates.length, updated, remaining: remaining?.count || 0 }, 200, corsHeaders)
      }

      // ---- GET /api/genres ----
      if (method === 'GET' && pathname === '/api/genres') {
        const result = await db.prepare('SELECT genre FROM films').all()
        const set = new Set()
        for (const row of result.results || []) {
          if (row.genre) {
            try { JSON.parse(row.genre).forEach((g) => set.add(g)) } catch {}
          }
        }
        return json([...set].sort(), 200, corsHeaders)
      }

      // ---- GET /api/shelves ----
      if (method === 'GET' && pathname === '/api/shelves') {
        const result = await db.prepare('SELECT DISTINCT shelf FROM films WHERE shelf IS NOT NULL AND shelf != \'\' ORDER BY shelf').all()
        return json((result.results || []).map((r) => r.shelf), 200, corsHeaders)
      }

      // ---- GET /api/decades ----
      if (method === 'GET' && pathname === '/api/decades') {
        const result = await db.prepare('SELECT DISTINCT CAST(ROUND(year / 10) * 10 AS INTEGER) as decade FROM films WHERE year IS NOT NULL ORDER BY decade').all()
        return json((result.results || []).map((r) => r.decade), 200, corsHeaders)
      }

      // ---- POST /api/import (Excel import) ----
      if (method === 'POST' && pathname === '/api/import') {
        // Note: For large Excel parsing in Workers, consider offloading to a
        // separate service or using a WebAssembly-based XLSX parser.
        return json({ error: 'Excel import requires a binding or external service; use the Express server for now' }, 501, corsHeaders)
      }

      // ---- GET /api/export/json ----
      if (method === 'GET' && pathname === '/api/export/json') {
        const result = await db.prepare('SELECT * FROM films ORDER BY title').all()
        const films = (result.results || []).map(parseFilmRow)
        return json(films, 200, {
          ...corsHeaders,
          'Content-Disposition': 'attachment; filename="films-backup.json"',
        })
      }

      // ---- SPA fallback ----
      // Static assets are handled by wrangler's asset system; this Worker only
      // deals with /api/* routes. Return 404 for anything else.
      return new Response('Not Found', { status: 404, headers: corsHeaders })

    } catch (err) {
      return json({ error: err.message }, 500, corsHeaders)
    }
  },
}

// ---------- Helpers ----------

function parseFilmRow(row) {
  if (!row) return null
  const film = { ...row }
  if (typeof film.cast === 'string') {
    try { film.cast = JSON.parse(film.cast) } catch { film.cast = [] }
  }
  if (typeof film.genre === 'string') {
    try { film.genre = JSON.parse(film.genre) } catch { film.genre = [] }
  }
  if (film.watched != null) film.watched = Boolean(film.watched)
  return film
}

async function insertFilm(db, film) {
  const { id, title, originalTitle, shelf, row, director, cast, year, genre, rating, runtime, country, synopsis, poster, studio, rated, format, borrowedTo, borrowedDate, watched, imdbId, imdbVotes, metadataEnrichmentAttemptedAt } = film
  await db.prepare(
    `INSERT INTO films (id, title, originalTitle, shelf, row, director, cast, year, genre, rating, runtime, country, synopsis, poster, studio, rated, format, borrowedTo, borrowedDate, watched, imdbId, imdbVotes, metadataEnrichmentAttemptedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, title || null, originalTitle || null, shelf || null, row || null,
    director || null, cast ? JSON.stringify(cast) : null,
    year || null, genre ? JSON.stringify(genre) : null,
    rating || null, runtime || null, country || null,
    synopsis || null, poster || null, studio || null, rated || null,
    format || null, borrowedTo || null, borrowedDate || null,
    watched ? 1 : 0, imdbId || null, imdbVotes || null,
    metadataEnrichmentAttemptedAt || null
  ).run()
}

async function updateFilm(db, film) {
  const { id, title, originalTitle, shelf, row, director, cast, year, genre, rating, runtime, country, synopsis, poster, studio, rated, format, borrowedTo, borrowedDate, watched, imdbId, imdbVotes, metadataEnrichmentAttemptedAt } = film
  await db.prepare(
    `UPDATE films SET title=?, originalTitle=?, shelf=?, row=?, director=?, cast=?, year=?, genre=?, rating=?, runtime=?, country=?, synopsis=?, poster=?, studio=?, rated=?, format=?, borrowedTo=?, borrowedDate=?, watched=?, imdbId=?, imdbVotes=?, metadataEnrichmentAttemptedAt=? WHERE id=?`
  ).bind(
    title || null, originalTitle || null, shelf || null, row || null,
    director || null, cast && Array.isArray(cast) ? JSON.stringify(cast) : cast || null,
    year || null, genre && Array.isArray(genre) ? JSON.stringify(genre) : genre || null,
    rating || null, runtime || null, country || null,
    synopsis || null, poster || null, studio || null, rated || null,
    format || null, borrowedTo || null, borrowedDate || null,
    watched ? 1 : 0, imdbId || null, imdbVotes || null,
    metadataEnrichmentAttemptedAt || null, id
  ).run()
}
