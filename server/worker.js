// Cloudflare Workers API — replaces the old Express/Netlify server.
// Handles all /api/* routes using D1 for persistent storage.
import { json, rowToFilm, normalizeTitle, EDITABLE, ENRICHABLE_FIELDS, isEmptyMetadata, countSeasonsFromText, decodeHtmlEntities } from './helpers.js'
import { enrichFilm } from './omdb.js'
import * as XLSX from 'xlsx'

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
      // ---- GET /api/image-proxy?url=... (same-origin passthrough for external
      // poster images, so <canvas> can draw them without a CORS-tainted canvas —
      // used by the Share-to-Instagram feature) ----
      if (method === 'GET' && pathname === '/api/image-proxy') {
        const target = url.searchParams.get('url') || ''
        if (!/^https?:\/\//i.test(target)) {
          return new Response('Invalid url', { status: 400, headers: corsHeaders })
        }
        try {
          const upstream = await fetch(target, { headers: { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' } })
          if (!upstream.ok) return new Response('Upstream error', { status: 502, headers: corsHeaders })
          const contentType = upstream.headers.get('content-type') || 'image/jpeg'
          return new Response(upstream.body, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' },
          })
        } catch {
          return new Response('Fetch failed', { status: 502, headers: corsHeaders })
        }
      }

      // ---- Watchlists (custom named lists, e.g. imported from Letterboxd) ----
      if (method === 'GET' && pathname === '/api/watchlists') {
        const result = await db.prepare('SELECT * FROM watchlists ORDER BY createdAt DESC').all()
        const lists = (result.results || []).map((r) => ({ ...r, items: JSON.parse(r.items || '[]') }))
        return json(lists, 200, corsHeaders)
      }

      if (method === 'POST' && pathname === '/api/watchlists') {
        const body = await request.json()
        const name = (body.name || '').trim()
        if (!name) return json({ error: 'name is required' }, 400, corsHeaders)
        const id = crypto.randomUUID()
        const createdAt = new Date().toISOString()
        await db
          .prepare('INSERT INTO watchlists (id, name, items, createdAt) VALUES (?, ?, ?, ?)')
          .bind(id, name, JSON.stringify(body.items || []), createdAt)
          .run()
        return json({ id, name, items: body.items || [], createdAt }, 201, corsHeaders)
      }

      const watchlistMatch = pathname.match(/^\/api\/watchlists\/([^/]+)$/)
      if (watchlistMatch) {
        const id = watchlistMatch[1]

        if (method === 'PATCH') {
          const body = await request.json()
          const existing = await db.prepare('SELECT * FROM watchlists WHERE id = ?').bind(id).first()
          if (!existing) return json({ error: 'not found' }, 404, corsHeaders)
          const nextName = body.name !== undefined ? body.name : existing.name
          const nextItems = body.items !== undefined ? body.items : JSON.parse(existing.items || '[]')
          await db
            .prepare('UPDATE watchlists SET name = ?, items = ? WHERE id = ?')
            .bind(nextName, JSON.stringify(nextItems), id)
            .run()
          return json({ id, name: nextName, items: nextItems }, 200, corsHeaders)
        }

        if (method === 'DELETE') {
          await db.prepare('DELETE FROM watchlists WHERE id = ?').bind(id).run()
          return json({ ok: true }, 200, corsHeaders)
        }
      }

      // ---- POST /api/letterboxd-watchlist (scrape a public Letterboxd watchlist,
      // list, OR reviews page by URL/username — Letterboxd doesn't offer an
      // RSS/API for these, only a CSV export, so this reads the public HTML
      // pages directly) ----
      if (method === 'POST' && pathname === '/api/letterboxd-watchlist') {
        const body = await request.json()
        let input = (body.username || '').trim().replace(/^@/, '')
        const isReviews = /\/reviews\/?/i.test(input)

        // ورودی می‌تونه لینک کامل واچ‌لیست/لیست/نقدها باشه، یا فقط یوزرنیم
        // (که پیش‌فرض واچ‌لیست خودش رو برمی‌داریم).
        let basePath
        const fullUrlMatch = input.match(/letterboxd\.com\/([^?#]+?)\/?(?:page\/\d+\/?)?\/?$/i)
        if (fullUrlMatch) {
          basePath = fullUrlMatch[1].replace(/\/page$/, '')
        } else if (input) {
          basePath = `${input}/watchlist`
        }
        if (!basePath) return json({ error: 'username or a watchlist/list/reviews URL is required' }, 400, corsHeaders)

        // صفحه‌ی اول «نقدها» همون آدرس ساده‌ی .../reviews/ هست (بدون films یا
        // شماره صفحه)؛ فقط از صفحه‌ی دوم به بعد مسیر به .../reviews/films/page/N/
        // تغییر می‌کنه — این یه رفتار خاص لتربوکسه. اگه کاربر خودش یه لینک
        // عمیق‌تر (با /films/page/N/ از قبل توش) پیست کرده باشه، این رو به
        // شکل ساده‌ی username/reviews برمی‌گردونیم.
        const reviewsUserMatch = basePath.match(/^(.+?)\/reviews\b/i)
        const reviewsBase = isReviews ? (reviewsUserMatch ? `${reviewsUserMatch[1]}/reviews` : basePath) : null

        const entries = []
        const seen = new Set()
        const MAX_PAGES = 40
        let previousPageUrl = null
        for (let page = 1; page <= MAX_PAGES; page++) {
          const pageUrl = isReviews
            ? page === 1
              ? `https://letterboxd.com/${reviewsBase}/`
              : `https://letterboxd.com/${reviewsBase}/films/page/${page}/`
            : `https://letterboxd.com/${basePath}/page/${page}/`

          // بعد از صفحه‌ی اول کمی صبر می‌کنیم و رفرر رو هم می‌فرستیم — شبیه‌تر
          // به یه کاربر واقعی که رو دکمه‌ی «صفحه‌ی بعد» کلیک می‌کنه، تا کمتر
          // به‌عنوان بات تشخیص داده بشه.
          if (page > 1) await new Promise((r) => setTimeout(r, 500))

          const fetchHeaders = {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          }
          if (previousPageUrl) fetchHeaders.Referer = previousPageUrl

          let res = await fetch(pageUrl, { headers: fetchHeaders })
          if (res.status === 403 && page > 1) {
            // یه بار دیگه با یه مکث بیشتر امتحان می‌کنیم؛ شاید موقتی
            // (rate limit) بوده، نه یه مسدودسازی قطعی
            await new Promise((r) => setTimeout(r, 1500))
            res = await fetch(pageUrl, { headers: fetchHeaders })
          }
          previousPageUrl = pageUrl
          if (!res.ok) {
            if (page === 1) return json({ error: `Couldn't reach that page (${res.status}). Check the username/URL.` }, 400, corsHeaders)
            break
          }
          const html = await res.text()
          let foundOnPage = 0

          if (isReviews) {
            // به‌جای تکیه به یه اسم کلاس حدسی، رو الگوی href لینک عنوان فیلم
            // تکیه می‌کنیم (/username/film/slug/) که مطمئناً همیشه هست.
            const chunks = html.split(/href="\/[^/"]+\/film\/[^"]+\/?"/).slice(1)
            for (const chunk of chunks) {
              const titleMatch = chunk.match(/^[^<]*>([^<]{1,150})<\/a>/)
              if (!titleMatch) continue
              const title = decodeHtmlEntities(titleMatch[1]).trim()
              if (!title || /^(re)?watched$/i.test(title)) continue
              const chunkWindow = chunk.slice(0, 2000)
              const yearMatch = chunkWindow.match(/\/films\/year\/(\d{4})\//)
              const starMatch = chunkWindow.match(/(★{1,5}½?|½)/)
              const myRating = starMatch
                ? starMatch[1].split('★').length - 1 + (starMatch[1].includes('½') ? 0.5 : 0)
                : null
              const bodyMatch = chunkWindow.match(/class="[^"]*body-text[^"]*"[^>]*>([\s\S]*?)<\/div>/)
              const reviewText = bodyMatch
                ? decodeHtmlEntities(bodyMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim().slice(0, 500)
                : null
              const key = `${title}|${yearMatch ? yearMatch[1] : ''}`
              if (seen.has(key)) continue
              seen.add(key)
              entries.push({
                title,
                year: yearMatch ? parseInt(yearMatch[1], 10) : null,
                myRating: myRating || null,
                reviewText,
              })
              foundOnPage++
            }
          } else {
            // شبکه‌ی پوسترها معمولاً تو یه <ul class="poster-list ...">...</ul>
            // هست؛ هر پوستر یه alt متنی با اسم فیلم داره — این قابل‌اعتمادترین
            // چیزیه که همیشه هست (برخلاف اسم دقیق data-attributeها که ممکنه
            // عوض بشه). سال معمولاً تو همین شبکه نیست، فقط تو صفحه‌ی خودِ فیلم.
            const listMatch = html.match(/<ul class="poster-list[\s\S]*?<\/ul>/)
            const scope = listMatch ? listMatch[0] : html
            const altRe = /alt="([^"]{2,200})"/g
            let match
            while ((match = altRe.exec(scope))) {
              const name = decodeHtmlEntities(match[1]).trim()
              if (!name || seen.has(name)) continue
              seen.add(name)
              entries.push({ title: name, year: null })
              foundOnPage++
            }
          }
          if (foundOnPage === 0) break
        }

        if (entries.length === 0) {
          return json({ error: 'Nothing found — that page may be private, empty, or the URL is wrong.' }, 400, corsHeaders)
        }
        return json({ source: basePath, entries }, 200, corsHeaders)
      }

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
          sql += ' AND (LOWER(title) LIKE ? OR LOWER(originalTitle) LIKE ? OR LOWER(director) LIKE ? OR LOWER("cast") LIKE ?)'
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
        else if (sort === 'random') sql += ' ORDER BY RANDOM()'
        else if (sort === 'title_az') {
          // مرتب‌سازی الفبایی، نادیده گرفتن «The» ابتدای عنوان (مثلاً
          // "The Godfather" باید زیر G بره نه T)
          sql += ` ORDER BY (CASE WHEN LOWER(title) LIKE 'the %' THEN SUBSTR(title, 5) ELSE title END) COLLATE NOCASE ASC`
        } else sql += ' ORDER BY title ASC'

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
        try {
          film = await enrichFilm(film, key)
        } catch {}
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
            if ((k === 'cast' || k === 'genre' || k === 'seasonDrives') && Array.isArray(body[k])) {
              updated[k] = JSON.stringify(body[k])
            } else if (k === 'watched' || k === 'watchlisted') {
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

      // ---- DELETE /api/films/:id (permanently remove a film) ----
      const deleteMatch = pathname.match(/^\/api\/films\/([^/]+)$/)
      if (method === 'DELETE' && deleteMatch) {
        const existing = await db.prepare('SELECT id FROM films WHERE id = ?').bind(deleteMatch[1]).first()
        if (!existing) return json({ error: 'not found' }, 404, corsHeaders)
        await db.prepare('DELETE FROM films WHERE id = ?').bind(deleteMatch[1]).run()
        return json({ deleted: true, id: deleteMatch[1] }, 200, corsHeaders)
      }

      // ---- POST /api/films/:id ("Auto-fill missing details" on one existing film) ----
      // این مسیر توی فرانت‌اند (handleAutofillFilm) استفاده می‌شه ولی قبلاً
      // اصلاً روی این Worker وجود نداشت — برای همین دکمه‌ی Auto-fill عملاً
      // هیچی پر نمی‌کرد (فقط تو سرور لوکال کار می‌کرد).
      const enrichOneMatch = pathname.match(/^\/api\/films\/([^/]+)$/)
      if (method === 'POST' && enrichOneMatch && enrichOneMatch[1] !== 'enrich') {
        const existing = await db.prepare('SELECT * FROM films WHERE id = ?').bind(enrichOneMatch[1]).first()
        if (!existing) return json({ error: 'not found' }, 404, corsHeaders)
        const parsed = parseFilmRow(existing)
        const key = env.OMDB_API_KEY
        let fields = []
        let enriched = parsed
        try {
          enriched = await enrichFilm(parsed, key)
          fields = ENRICHABLE_FIELDS.filter(
            (f) => isEmptyMetadata(parsed[f]) && !isEmptyMetadata(enriched[f])
          )
          enriched.metadataEnrichmentAttemptedAt = new Date().toISOString()
          await updateFilm(db, enriched)
        } catch {
          return json({ ...parsed, _enrichment: { enabled: Boolean(key), fields: [] } }, 200, corsHeaders)
        }
        return json({ ...parseFilmRow(enriched), _enrichment: { enabled: true, fields } }, 200, corsHeaders)
      }

      // ---- POST /api/films/enrich ----
      if (method === 'POST' && pathname === '/api/films/enrich') {
        const requestedLimit = parseInt(url.searchParams.get('limit') || '10', 10)
        const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 15) : 10

        // باگ قبلی: بدون ORDER BY، هر بار همون چند فیلم اولِ بی‌پوستر (که OMDb
        // اصلاً پوستری براشون نداره یا اسمشون قابل‌تشخیص نیست) انتخاب می‌شدن؛
        // دکمه هیچ‌وقت به فیلم‌های واقعاً بررسی‌نشده نمی‌رسید و «Fill missing
        // details» عملاً روی همون‌ها گیر می‌کرد. الان اول فیلم‌های
        // بررسی‌نشده رو تموم می‌کنه، بعد بی‌پوسترها رو به ترتیب قدیمی‌ترین
        // تلاش می‌ره سراغشون (نه همیشه همون چندتای اول).
        const all = await db
          .prepare(
            `SELECT * FROM films
             WHERE metadataEnrichmentAttemptedAt IS NULL OR poster IS NULL OR poster = ''
             ORDER BY (metadataEnrichmentAttemptedAt IS NULL) DESC, metadataEnrichmentAttemptedAt ASC
             LIMIT ?`
          )
          .bind(limit)
          .all()
        const candidates = all.results || []

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

        const remaining = await db
          .prepare(
            "SELECT COUNT(*) as count FROM films WHERE metadataEnrichmentAttemptedAt IS NULL OR poster IS NULL OR poster = ''"
          )
          .first()
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

      // ---- GET /api/omdb-lookup (single-title search for the "Add Film" autofill) ----
      if (method === 'GET' && pathname === '/api/omdb-lookup') {
        const key = env.OMDB_API_KEY
        if (!key) return json({ error: 'OMDB_API_KEY تنظیم نشده — امکان جستجوی خودکار از IMDb وجود نداره' }, 400, corsHeaders)
        const title = (url.searchParams.get('title') || '').trim()
        if (!title) return json({ error: 'عنوان فیلم رو وارد کن' }, 400, corsHeaders)
        const yearParam = url.searchParams.get('year')
        const before = { title, year: yearParam ? parseInt(yearParam, 10) : undefined }
        try {
          const found = await enrichFilm(before, key)
          const gotNewData = Object.keys(found).some((k) => !(k in before) || found[k] !== before[k])
          if (!gotNewData) return json({ error: 'فیلمی با این عنوان توی IMDb پیدا نشد' }, 404, corsHeaders)
          return json(found, 200, corsHeaders)
        } catch (e) {
          return json({ error: 'خطا در ارتباط با OMDb' }, 502, corsHeaders)
        }
      }

      // ---- GET /api/actor-photo (photo + bio + age/height/spouse/children, cached in D1) ----
      if (method === 'GET' && pathname === '/api/actor-photo') {
        const name = (url.searchParams.get('name') || '').trim()
        if (!name) return json(emptyPersonInfo(), 200, corsHeaders)
        const cacheKey = name.toLowerCase()

        try {
          const cached = await db
            .prepare('SELECT photo, bio, birthDate, deathDate, height, spouse, children FROM people_photos WHERE name = ?')
            .bind(cacheKey)
            .first()
          if (cached) {
            return json(
              { ...cached, age: cached.deathDate ? null : ageFromBirthDate(cached.birthDate) },
              200,
              corsHeaders
            )
          }

          const info = emptyPersonInfo()
          try {
            const wikiRes = await fetch(
              `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages%7Cextracts%7Cpageprops&piprop=thumbnail&pithumbsize=200&exintro=1&explaintext=1&exsentences=3&titles=${encodeURIComponent(name)}`,
              { headers: { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' } }
            )
            if (wikiRes.ok) {
              const data = await wikiRes.json()
              const pages = data?.query?.pages || {}
              const page = Object.values(pages)[0]
              if (page && page.thumbnail?.source) info.photo = page.thumbnail.source
              if (page && page.extract) info.bio = page.extract.trim()

              const wikidataId = page?.pageprops?.wikibase_item
              if (wikidataId) {
                const wd = await fetchWikidataFacts(wikidataId)
                info.birthDate = wd.birthDate
                info.deathDate = wd.deathDate
                info.height = wd.height
                const idsToResolve = [...wd.spouseIds, ...wd.childrenIds]
                const labels = idsToResolve.length ? await resolveWikidataLabels(idsToResolve) : {}
                if (wd.spouseIds.length) {
                  info.spouse = wd.spouseIds.map((id) => labels[id]).filter(Boolean).join(', ') || null
                }
                if (wd.childrenIds.length) {
                  info.children = wd.childrenIds.map((id) => labels[id]).filter(Boolean).join(', ') || null
                }
              }
            }
          } catch {
            // شبکه/ویکی‌پدیا در دسترس نبود؛ چیزی رو کش نمی‌کنیم
            return json(emptyPersonInfo(), 200, corsHeaders)
          }

          await db
            .prepare(
              'INSERT OR REPLACE INTO people_photos (name, photo, bio, birthDate, deathDate, height, spouse, children) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .bind(cacheKey, info.photo, info.bio, info.birthDate, info.deathDate, info.height, info.spouse, info.children)
            .run()
          return json(
            { ...info, age: info.deathDate ? null : ageFromBirthDate(info.birthDate) },
            200,
            corsHeaders
          )
        } catch (e) {
          return json(emptyPersonInfo(), 200, corsHeaders)
        }
      }

      // ---- GET /api/letterboxd-rating (fetch Letterboxd average rating + votes, cached on the film row) ----
      if (method === 'GET' && pathname === '/api/letterboxd-rating') {
        const filmId = (url.searchParams.get('filmId') || '').trim()
        if (!filmId) return json({ letterboxdRating: null, letterboxdVotes: null }, 200, corsHeaders)

        try {
          const row = await db.prepare('SELECT id, title, year, letterboxdRating, letterboxdVotes FROM films WHERE id = ?').bind(filmId).first()
          if (!row) return json({ letterboxdRating: null, letterboxdVotes: null }, 200, corsHeaders)
          if (row.letterboxdRating != null) {
            return json({ letterboxdRating: row.letterboxdRating, letterboxdVotes: row.letterboxdVotes }, 200, corsHeaders)
          }

          const result = await fetchLetterboxdRating(row.title, row.year)
          if (result != null) {
            await db.prepare('UPDATE films SET letterboxdRating = ?, letterboxdVotes = ? WHERE id = ?')
              .bind(result.rating, result.count, filmId).run()
          }
          return json(
            { letterboxdRating: result?.rating ?? null, letterboxdVotes: result?.count ?? null },
            200,
            corsHeaders
          )
        } catch (e) {
          return json({ letterboxdRating: null, letterboxdVotes: null }, 200, corsHeaders)
        }
      }

      // ---- POST /api/letterboxd-sync (pull the user's own diary entries/reviews
      // from their public Letterboxd RSS feed and attach them to matching films) ----
      // محدودیت مهم: فید RSS لترباکس فقط ~۵۰ ورودی آخر دیاری رو می‌ده، نه کل
      // تاریخچه؛ هر بار sync فقط همین اواخر رو چک می‌کنه.
      if (method === 'POST' && pathname === '/api/letterboxd-sync') {
        let body = {}
        try {
          body = await request.json()
        } catch {
          return json({ error: 'بدنه‌ی درخواست نامعتبره' }, 400, corsHeaders)
        }
        const username = (body.username || '').trim().replace(/^@/, '')
        if (!username) return json({ error: 'یوزرنیم لترباکس لازمه' }, 400, corsHeaders)

        let xml
        try {
          const res = await fetch(`https://letterboxd.com/${encodeURIComponent(username)}/rss/`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CinefilioArchive/1.0)' },
          })
          if (!res.ok) return json({ error: `یوزرنیم لترباکس پیدا نشد یا فید در دسترس نیست (${res.status})` }, 400, corsHeaders)
          xml = await res.text()
        } catch {
          return json({ error: 'اتصال به لترباکس ناموفق بود' }, 502, corsHeaders)
        }

        const entries = parseLetterboxdRss(xml)
        let matched = 0
        let unmatched = 0
        for (const entry of entries) {
          if (!entry.filmTitle) continue
          const row = await db
            .prepare(
              `SELECT id, myRating, personalReview FROM films
               WHERE mediaType != 'digital' AND itemType != 'series' AND LOWER(title) = ?
               AND (year IS ? OR year = ?)`
            )
            .bind(entry.filmTitle.trim().toLowerCase(), entry.filmYear ?? null, entry.filmYear ?? null)
            .first()
          if (!row) {
            unmatched++
            continue
          }
          matched++
          const updates = []
          const values = []
          if (entry.reviewText) {
            updates.push('personalReview = ?')
            values.push(entry.reviewText)
          }
          if (entry.link) {
            updates.push('personalReviewUrl = ?')
            values.push(entry.link)
          }
          if (entry.watchedDate) {
            updates.push('personalReviewDate = ?')
            values.push(entry.watchedDate)
          }
          if (entry.memberRating != null && (row.myRating == null || row.myRating === 0)) {
            updates.push('myRating = ?')
            values.push(Math.round(entry.memberRating))
          }
          if (!updates.length) continue
          values.push(row.id)
          await db.prepare(`UPDATE films SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
        }

        return json({ processed: entries.length, matched, unmatched }, 200, corsHeaders)
      }

      // ---- GET /api/template (downloadable Excel template) ----
      if (method === 'GET' && pathname === '/api/template') {
        const ws = XLSX.utils.aoa_to_sheet([
          ['Title', 'Shelf', 'Row', 'Director', 'Cast', 'Year', 'Genre', 'Rating', 'Runtime', 'Country', 'Synopsis', 'Poster URL', 'Original Title'],
          ['Example: The Godfather', 'A', '3', 'Francis Ford Coppola', 'Marlon Brando, Al Pacino', '1972', 'Crime, Drama', '9.2', '175', 'USA', 'Story of the Corleone crime family', 'https://example.com/poster.jpg', 'The Godfather'],
        ])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Films')
        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: false })
        return new Response(buf, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="film-archive-template.xlsx"',
          },
        })
      }

      // ---- POST /api/import (Excel import) ----
      if (method === 'POST' && pathname === '/api/import') {
        const form = await request.formData()
        const file = form.get('file')
        if (!file || typeof file.arrayBuffer !== 'function') {
          return json({ error: 'فایل ارسال نشد' }, 400, corsHeaders)
        }
        const buffer = await file.arrayBuffer()
        if (!buffer || buffer.byteLength === 0) {
          return json({ error: 'فایل ارسال نشد' }, 400, corsHeaders)
        }

        const wb = XLSX.read(buffer, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (!rows.length) return json({ error: 'فایل خالیه' }, 400, corsHeaders)

        let imported = rows.map((r, i) => rowToFilm(r, i))

        const key = env.OMDB_API_KEY
        imported = await Promise.all(
          imported.map(async (f) => {
            try {
              return await enrichFilm(f, key)
            } catch {
              return f
            }
          })
        )

        let added = 0
        let updated = 0
        for (const f of imported) {
          // تطبیق فقط با عنوان کافی نیست: باعث می‌شد فیلم دیجیتال هم‌نامِ یه
          // فیلم فیزیکی (یا نسخه‌ی دیگه) به‌جای اضافه‌شدن، رکورد اون یکی رو
          // overwrite کنه. سال و mediaType هم باید مچ بشن.
          const existing = await db
            .prepare(
              'SELECT * FROM films WHERE LOWER(title) = ? AND (year IS ? OR year = ?) AND mediaType = ?'
            )
            .bind(
              normalizeTitle(f.title),
              f.year ?? null,
              f.year ?? null,
              f.mediaType || 'physical'
            )
            .first()
          if (existing) {
            // فقط فیلدهایی که توی رکورد موجود خالی هستن از اکسل پر می‌شن؛
            // چیزی که از قبل مقدار داره (مثلاً بازیگر یا زمان فیلم) دست‌نخورده
            // می‌مونه، حتی اگه اکسل مقدار متفاوتی براش داشته باشه.
            const parsedExisting = parseFilmRow(existing)
            const merged = { ...parsedExisting, id: existing.id }
            for (const [key, value] of Object.entries(f)) {
              if (key === 'id') continue
              // seasonDrives استثناست: باید فصل‌های جدید به همون سریال (مثلاً
              // موقع اضافه‌شدن فصل بعدی روی یه هارد جدید) به آرایه‌ی موجود
              // اضافه بشن، نه اینکه چون آرایه از قبل خالی نیست کلاً نادیده گرفته بشه.
              if (key === 'seasonDrives' && Array.isArray(value) && value.length) {
                const existingList = Array.isArray(parsedExisting.seasonDrives) ? parsedExisting.seasonDrives : []
                const combined = [...existingList]
                for (const item of value) {
                  const alreadyThere = combined.some(
                    (e) => e.drive === item.drive && e.seasons === item.seasons
                  )
                  if (!alreadyThere) combined.push(item)
                }
                merged.seasonDrives = combined
                continue
              }
              if (isEmptyMetadata(parsedExisting[key])) merged[key] = value
            }
            await updateFilm(db, merged)
            updated++
          } else {
            await insertFilm(db, f)
            added++
          }
        }

        return json({ count: imported.length, added, updated }, 200, corsHeaders)
      }

      // ---- GET /api/export/json (optional ?mediaType=&itemType= to scope the backup) ----
      if (method === 'GET' && pathname === '/api/export/json') {
        const mediaType = url.searchParams.get('mediaType')
        const itemType = url.searchParams.get('itemType')
        let sql = 'SELECT * FROM films'
        const conditions = []
        const params = []
        if (mediaType) { conditions.push('mediaType = ?'); params.push(mediaType) }
        if (itemType) { conditions.push('itemType = ?'); params.push(itemType) }
        if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
        sql += ' ORDER BY title'
        const result = await db.prepare(sql).bind(...params).all()
        const films = (result.results || []).map(parseFilmRow)
        const filenameScope = itemType === 'series' ? 'series-' : mediaType ? `${mediaType}-` : ''
        return json(films, 200, {
          ...corsHeaders,
          'Content-Disposition': `attachment; filename="${filenameScope}films-backup.json"`,
        })
      }

      // ---- GET /api/export/excel (optional ?mediaType=&itemType= to scope the backup) ----
      if (method === 'GET' && pathname === '/api/export/excel') {
        const mediaType = url.searchParams.get('mediaType')
        const itemType = url.searchParams.get('itemType')
        let sql = 'SELECT * FROM films'
        const conditions = []
        const params = []
        if (mediaType) { conditions.push('mediaType = ?'); params.push(mediaType) }
        if (itemType) { conditions.push('itemType = ?'); params.push(itemType) }
        if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
        sql += ' ORDER BY title'
        const result = await db.prepare(sql).bind(...params).all()
        const films = (result.results || []).map(parseFilmRow)
        const isSeriesExport = itemType === 'series'
        const rows = films.map((f, idx) =>
          isSeriesExport
            ? {
                '#': idx + 1,
                Title: f.title || '',
                Format: f.format || '',
                Watched: f.watched === true ? 'Yes' : 'No',
                Producer: f.producer || '',
                Director: f.director || '',
                Cast: Array.isArray(f.cast) ? f.cast.map((x) => (typeof x === 'object' ? x.name : x)).join(', ') : f.cast || '',
                Year: f.year || '',
                Genre: Array.isArray(f.genre) ? f.genre.join(', ') : f.genre || '',
                Rating: f.rating || '',
                Runtime: f.runtime || '',
                Country: f.country || '',
                Studio: f.studio || '',
                Synopsis: f.synopsis || '',
                'Poster URL': f.poster || '',
                'Media Type': f.mediaType || '',
                'Content Type': f.itemType || '',
                'Drive Number': f.driveNumber || '',
                Seasons: countSeasonsFromText(f.seasonsEpisodes) ?? (Array.isArray(f.seasonDrives) ? f.seasonDrives.length : ''),
                'Seasons on Drive': Array.isArray(f.seasonDrives)
                  ? f.seasonDrives.map((sd) => `${sd.seasons} → ${sd.drive}`).join(' | ')
                  : '',
              }
            : {
                '#': idx + 1,
                Title: f.title || '',
                'Original Title': f.originalTitle || '',
                Shelf: f.shelf || '',
                Row: f.row || '',
                Format: f.format || '',
                Watched: f.watched === true ? 'Yes' : 'No',
                'Borrowed To': f.borrowedTo || '',
                'Borrowed Date': f.borrowedDate || '',
                Director: f.director || '',
                Cast: Array.isArray(f.cast) ? f.cast.map((x) => (typeof x === 'object' ? x.name : x)).join(', ') : f.cast || '',
                Year: f.year || '',
                Genre: Array.isArray(f.genre) ? f.genre.join(', ') : f.genre || '',
                Rating: f.rating || '',
                Runtime: f.runtime || '',
                Country: f.country || '',
                Studio: f.studio || '',
                'MPA Rating': f.rated || '',
                Synopsis: f.synopsis || '',
                'Poster URL': f.poster || '',
                'Media Type': f.mediaType || '',
                'Content Type': f.itemType || '',
                'Drive Number': f.driveNumber || '',
                Seasons: f.seasonsEpisodes || '',
                'Seasons on Drive': Array.isArray(f.seasonDrives)
                  ? f.seasonDrives.map((sd) => `${sd.seasons} → ${sd.drive}`).join(' | ')
                  : '',
              }
        )
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'آرشیو فیلم‌ها')
        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: false })
        const excelFilenameScope = itemType === 'series' ? 'series-' : mediaType ? `${mediaType}-` : ''
        return new Response(buf, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${excelFilenameScope}movies-archive-export.xlsx"`,
          },
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

function emptyPersonInfo() {
  return {
    photo: null,
    bio: null,
    birthDate: null,
    deathDate: null,
    height: null,
    spouse: null,
    children: null,
  }
}

// فید RSS شخصیِ لترباکس (letterboxd.com/USERNAME/rss/) رو پارس می‌کنه و از هر
// آیتم دیاری، عنوان/سال فیلم، امتیاز شخصی (۰ تا ۵)، متن نظر (اگه نوشته باشه)
// و لینک و تاریخ تماشا رو در میاره. فید فقط ~۵۰ ورودی آخر رو می‌ده.
function parseLetterboxdRss(xml) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []
  return items.map((raw) => {
    const grab = (tag) => {
      const m = raw.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))
      if (!m) return null
      return m[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1').trim()
    }
    const filmTitle = grab('letterboxd:filmTitle')
    const filmYearRaw = grab('letterboxd:filmYear')
    const memberRatingRaw = grab('letterboxd:memberRating')
    const watchedDate = grab('letterboxd:watchedDate')
    const link = grab('link')
    let descriptionHtml = grab('description') || ''
    // توضیحات هر آیتم معمولاً یه <img> پوستر و بعدش متن نظر (اگه نوشته باشه)
    // هست؛ عکس و تگ‌های HTML رو حذف می‌کنیم تا فقط متن نظر بمونه.
    let reviewText = descriptionHtml
      .replace(/<img[^>]*>/gi, '')
      .replace(/<p>\s*Watched on[^<]*<\/p>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
    if (!reviewText) reviewText = null
    return {
      filmTitle,
      filmYear: filmYearRaw ? parseInt(filmYearRaw, 10) : null,
      memberRating: memberRatingRaw ? parseFloat(memberRatingRaw) : null,
      watchedDate,
      link,
      reviewText,
    }
  })
}

// جستجوی فیلم توی Letterboxd و استخراج امتیاز میانگین از تگ متای صفحه‌ش.
// صفحه‌ی سرچ Letterboxd با جاوااسکریپت رندر می‌شه (توی HTML خام چیزی نیست)،
// برای همین به‌جاش مستقیم از روی عنوان، اسلاگ صفحه‌ی فیلم رو می‌سازیم — که
// خودِ صفحه‌ی فیلم (بر خلاف صفحه‌ی سرچ) سمت سرور رندر می‌شه و تگ متا داره.
function titleToLetterboxdSlug(title) {
  return (title || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function fetchLetterboxdRating(title, year) {
  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; CinefilioArchive/1.0; personal film archive app)' }
  const baseSlug = titleToLetterboxdSlug(title)
  if (!baseSlug) return null
  const candidates = year ? [baseSlug, `${baseSlug}-${year}`] : [baseSlug]

  for (const slug of candidates) {
    try {
      const filmRes = await fetch(`https://letterboxd.com/film/${slug}/`, { headers })
      if (!filmRes.ok) continue
      const filmHtml = await filmRes.text()
      const ratingMatch = filmHtml.match(/name="twitter:data2"\s+content="([\d.]+)\s+out of 5"/)
      if (!ratingMatch) continue
      const rating = parseFloat(ratingMatch[1])
      if (isNaN(rating)) continue

      let count = null
      try {
        // فرگمنت هیستوگرام امتیازها؛ عدد دقیق هر ستاره داخل title هر لینکه
        // (چون متن قابل‌مشاهده‌ش مخفف مثل «13.9K» هست، نه عدد کامل)،
        // مثلاً: title="13,875 ★★ ratings (6%)". همه رو جمع می‌زنیم.
        const histRes = await fetch(`https://letterboxd.com/csi/film/${slug}/rating-histogram/`, {
          headers: { ...headers, Referer: `https://letterboxd.com/film/${slug}/` },
        })
        if (histRes.ok) {
          const histHtml = await histRes.text()
          const matches = [...histHtml.matchAll(/title="([\d,]+)\s+[^"]*ratings[^"]*"/gi)]
          if (matches.length) {
            count = matches.reduce((sum, m) => sum + parseInt(m[1].replace(/,/g, ''), 10), 0)
          }
        }
      } catch {
        // اگه هیستوگرام در دسترس نبود، فقط امتیاز میانگین رو نشون می‌دیم
      }

      return { rating, count }
    } catch {
      // این اسلاگ جواب نداد، اسلاگ بعدی رو امتحان کن
    }
  }
  return null
}

function ageFromBirthDate(birthDate) {
  if (!birthDate) return null
  const m = String(birthDate).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const [, y, mo, d] = m
  const birth = new Date(Date.UTC(+y, +mo - 1, +d))
  const now = new Date()
  let age = now.getUTCFullYear() - birth.getUTCFullYear()
  const hadBirthdayThisYear =
    now.getUTCMonth() > birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() >= birth.getUTCDate())
  if (!hadBirthdayThisYear) age--
  return age >= 0 && age < 130 ? age : null
}

// اطلاعات ساختاریافته (تاریخ تولد، قد، همسر، فرزندان) رو از Wikidata
// می‌گیره — چون ویکی‌پدیای معمولی این‌ها رو به‌شکل فیلد جدا نمی‌ده،
// فقط متن آزاد. همسر/فرزندان اینجا هنوز فقط شناسه (Q-id) هستن، اسم واقعی‌شون
// رو resolveWikidataLabels جداگانه می‌گیره.
async function fetchWikidataFacts(qid) {
  const empty = { birthDate: null, deathDate: null, height: null, spouseIds: [], childrenIds: [] }
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json`,
      { headers: { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' } }
    )
    if (!res.ok) return empty
    const data = await res.json()
    const claims = data?.entities?.[qid]?.claims || {}

    let birthDate = null
    const birthTime = claims.P569?.[0]?.mainsnak?.datavalue?.value?.time
    const bm = birthTime && birthTime.match(/^\+(\d{4})-(\d{2})-(\d{2})/)
    if (bm) birthDate = `${bm[1]}-${bm[2]}-${bm[3]}`

    let deathDate = null
    const deathTime = claims.P570?.[0]?.mainsnak?.datavalue?.value?.time
    const dm = deathTime && deathTime.match(/^\+(\d{4})-(\d{2})-(\d{2})/)
    if (dm) deathDate = `${dm[1]}-${dm[2]}-${dm[3]}`

    // قد روی Wikidata گاهی به متر ذخیره می‌شه (Q11573) و گاهی مستقیم به
    // سانتی‌متر (Q174728) — قبلاً همیشه فرض می‌شد متره و ضربدر ۱۰۰ می‌شد،
    // که برای مقادیری که از قبل سانتی‌متر بودن یه عدد مسخره مثل ۱۷۰۰۰ می‌داد.
    let height = null
    const heightVal = claims.P2048?.[0]?.mainsnak?.datavalue?.value
    if (heightVal?.amount) {
      const num = parseFloat(heightVal.amount)
      const unit = String(heightVal.unit || '')
      if (!isNaN(num)) {
        let cm
        if (unit.endsWith('Q174728')) cm = num // واحد صراحتاً سانتی‌متره
        else if (unit.endsWith('Q11573')) cm = num * 100 // واحد صراحتاً متره
        // واحد نامشخص/غیرمنتظره: بر اساس مقدار حدس بزن (قد آدم‌ها معمولاً
        // بین ۰.۵ تا ۲.۵ متر یا ۵۰ تا ۲۵۰ سانتی‌متره)، نه اینکه همیشه متر
        // فرض بشه (که باعث اعداد مسخره‌ای مثل ۶۴۰۰ سانتی‌متر می‌شد).
        else cm = num < 10 ? num * 100 : num
        // اگه بعد از این حدس هم عدد منطقی نبود (قد آدم نیست)، نادیده بگیر.
        if (cm >= 50 && cm <= 250) height = `${Math.round(cm)} cm`
      }
    }

    const spouseIds = (claims.P26 || [])
      .map((c) => c.mainsnak?.datavalue?.value?.id)
      .filter(Boolean)
      .slice(0, 2)
    const childrenIds = (claims.P40 || [])
      .map((c) => c.mainsnak?.datavalue?.value?.id)
      .filter(Boolean)
      .slice(0, 6)

    return { birthDate, deathDate, height, spouseIds, childrenIds }
  } catch {
    return empty
  }
}

async function resolveWikidataLabels(ids) {
  if (!ids.length) return {}
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=labels&languages=en&format=json`,
      { headers: { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' } }
    )
    if (!res.ok) return {}
    const data = await res.json()
    const out = {}
    for (const id of ids) {
      out[id] = data?.entities?.[id]?.labels?.en?.value || null
    }
    return out
  } catch {
    return {}
  }
}

function parseFilmRow(row) {
  if (!row) return null
  const film = { ...row }
  if (typeof film.cast === 'string') {
    try { film.cast = JSON.parse(film.cast) } catch { film.cast = [] }
  }
  if (typeof film.genre === 'string') {
    try { film.genre = JSON.parse(film.genre) } catch { film.genre = [] }
  }
  if (typeof film.seasonDrives === 'string' && film.seasonDrives) {
    try { film.seasonDrives = JSON.parse(film.seasonDrives) } catch { film.seasonDrives = [] }
  }
  if (film.watched != null) film.watched = Boolean(film.watched)
  if (film.watchlisted != null) film.watchlisted = Boolean(film.watchlisted)
  if (film.criterion != null) film.criterion = Boolean(film.criterion)
  if (!film.mediaType) film.mediaType = 'physical'
  if (!film.itemType) film.itemType = 'movie'
  if (!film.copies) film.copies = 1
  return film
}

async function insertFilm(db, film) {
  const { id, title, originalTitle, shelf, row, director, producer, cast, year, genre, rating, runtime, country, synopsis, poster, studio, rated, format, borrowedTo, borrowedDate, watched, imdbId, imdbVotes, metadataEnrichmentAttemptedAt, myRating, criterion, copies, mediaType, driveNumber, itemType, seasonsEpisodes, letterboxdRating, watchlisted, seasonDrives } = film
  await db.prepare(
    `INSERT INTO films (id, title, originalTitle, shelf, row, director, producer, cast, year, genre, rating, runtime, country, synopsis, poster, studio, rated, format, borrowedTo, borrowedDate, watched, imdbId, imdbVotes, metadataEnrichmentAttemptedAt, myRating, criterion, copies, mediaType, driveNumber, itemType, seasonsEpisodes, letterboxdRating, watchlisted, seasonDrives)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, title || null, originalTitle || null, shelf || null, row || null,
    director || null, producer || null, cast ? JSON.stringify(cast) : null,
    year || null, genre ? JSON.stringify(genre) : null,
    rating || null, runtime || null, country || null,
    synopsis || null, poster || null, studio || null, rated || null,
    format || null, borrowedTo || null, borrowedDate || null,
    watched ? 1 : 0, imdbId || null, imdbVotes || null,
    metadataEnrichmentAttemptedAt || null, myRating || 0, criterion ? 1 : 0,
    copies || 1, mediaType || 'physical', driveNumber || null,
    itemType || 'movie', seasonsEpisodes || null, letterboxdRating || null, watchlisted ? 1 : 0,
    seasonDrives ? (Array.isArray(seasonDrives) ? JSON.stringify(seasonDrives) : seasonDrives) : null
  ).run()
}

async function updateFilm(db, film) {
  const { id, title, originalTitle, shelf, row, director, producer, cast, year, genre, rating, runtime, country, synopsis, poster, studio, rated, format, borrowedTo, borrowedDate, watched, imdbId, imdbVotes, metadataEnrichmentAttemptedAt, myRating, criterion, copies, mediaType, driveNumber, itemType, seasonsEpisodes, letterboxdRating, watchlisted, seasonDrives } = film
  await db.prepare(
    `UPDATE films SET title=?, originalTitle=?, shelf=?, row=?, director=?, producer=?, cast=?, year=?, genre=?, rating=?, runtime=?, country=?, synopsis=?, poster=?, studio=?, rated=?, format=?, borrowedTo=?, borrowedDate=?, watched=?, imdbId=?, imdbVotes=?, metadataEnrichmentAttemptedAt=?, myRating=?, criterion=?, copies=?, mediaType=?, driveNumber=?, itemType=?, seasonsEpisodes=?, letterboxdRating=?, watchlisted=?, seasonDrives=? WHERE id=?`
  ).bind(
    title || null, originalTitle || null, shelf || null, row || null,
    director || null, producer || null, cast && Array.isArray(cast) ? JSON.stringify(cast) : cast || null,
    year || null, genre && Array.isArray(genre) ? JSON.stringify(genre) : genre || null,
    rating || null, runtime || null, country || null,
    synopsis || null, poster || null, studio || null, rated || null,
    format || null, borrowedTo || null, borrowedDate || null,
    watched ? 1 : 0, imdbId || null, imdbVotes || null,
    metadataEnrichmentAttemptedAt || null, myRating || 0, criterion ? 1 : 0,
    copies || 1, mediaType || 'physical', driveNumber || null,
    itemType || 'movie', seasonsEpisodes || null, letterboxdRating || null, watchlisted ? 1 : 0,
    seasonDrives ? (Array.isArray(seasonDrives) ? JSON.stringify(seasonDrives) : seasonDrives) : null, id
  ).run()
}
