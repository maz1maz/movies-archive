// Cloudflare Workers API — replaces the old Express/Netlify server.
// Handles all /api/* routes using D1 for persistent storage.
import { json, rowToFilm, normalizeTitle, EDITABLE, ENRICHABLE_FIELDS, isEmptyMetadata, countSeasonsFromText, decodeHtmlEntities } from './helpers.js'
import { enrichFilm } from './omdb.js'
import { fetchTotalSeasons } from './tvmaze.js'
import * as XLSX from 'xlsx'
import { hashPassword, verifyPassword, getSessionUser, createSession, destroySession, sessionCookieHeader } from './auth.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const { pathname } = url
    const method = request.method

    // CORS headers for the frontend. Cookie-based auth requires the exact
    // origin (not '*') plus Allow-Credentials so the browser sends/accepts
    // the HttpOnly session cookie on cross-origin fetches (e.g. local dev).
    const origin = request.headers.get('Origin')
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    }
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    const db = env.DB // D1 binding

    // کاربر لاگین‌شده‌ی فعلی (از روی کوکی سشن) — مهمان‌ها null می‌گیرن.
    const currentUser = await getSessionUser(db, request)
    const requireAuth = () => (currentUser ? null : json({ error: 'برای این کار باید وارد شوید' }, 401, corsHeaders))
    const requireAdmin = () =>
      !currentUser
        ? json({ error: 'برای این کار باید وارد شوید' }, 401, corsHeaders)
        : currentUser.role !== 'admin'
        ? json({ error: 'این عملیات فقط برای ادمین مجاز است' }, 403, corsHeaders)
        : null

    try {
      // ---- Auth: login / logout / me ----
      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await request.json().catch(() => ({}))
        const username = (body.username || '').trim().toLowerCase()
        const password = body.password || ''
        if (!username || !password) return json({ error: 'نام کاربری و رمز عبور الزامی است' }, 400, corsHeaders)
        const user = await db.prepare('SELECT * FROM users WHERE lower(username) = ?').bind(username).first()
        if (!user) return json({ error: 'نام کاربری یا رمز عبور اشتباه است' }, 401, corsHeaders)
        const ok = await verifyPassword(password, user.passwordSalt, user.passwordHash)
        if (!ok) return json({ error: 'نام کاربری یا رمز عبور اشتباه است' }, 401, corsHeaders)
        const token = await createSession(db, user.id)
        return json(
          { id: user.id, username: user.username, role: user.role },
          200,
          { ...corsHeaders, 'Set-Cookie': sessionCookieHeader(token) }
        )
      }

      if (method === 'POST' && pathname === '/api/auth/logout') {
        const cookies = request.headers.get('Cookie') || ''
        const match = cookies.match(/cf_session=([^;]+)/)
        if (match) await destroySession(db, match[1])
        return json({ ok: true }, 200, { ...corsHeaders, 'Set-Cookie': sessionCookieHeader('', { clear: true }) })
      }

      if (method === 'GET' && pathname === '/api/auth/me') {
        return json({ user: currentUser }, 200, corsHeaders)
      }

      // ---- Admin: user management ----
      if (method === 'GET' && pathname === '/api/auth/users') {
        const denied = requireAdmin()
        if (denied) return denied
        const result = await db.prepare('SELECT id, username, role, createdAt FROM users ORDER BY createdAt ASC').all()
        return json(result.results || [], 200, corsHeaders)
      }

      if (method === 'POST' && pathname === '/api/auth/users') {
        const denied = requireAdmin()
        if (denied) return denied
        const body = await request.json().catch(() => ({}))
        const username = (body.username || '').trim()
        const password = body.password || ''
        const role = body.role === 'admin' ? 'admin' : 'user'
        if (!username || !password) return json({ error: 'نام کاربری و رمز عبور الزامی است' }, 400, corsHeaders)
        if (password.length < 6) return json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' }, 400, corsHeaders)
        const exists = await db.prepare('SELECT id FROM users WHERE lower(username) = ?').bind(username.toLowerCase()).first()
        if (exists) return json({ error: 'این نام کاربری قبلاً استفاده شده' }, 409, corsHeaders)
        const { hash, salt } = await hashPassword(password)
        const id = crypto.randomUUID()
        await db
          .prepare('INSERT INTO users (id, username, passwordHash, passwordSalt, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(id, username, hash, salt, role, new Date().toISOString())
          .run()
        return json({ id, username, role }, 201, corsHeaders)
      }

      const userMatch = pathname.match(/^\/api\/auth\/users\/([^/]+)$/)
      if (userMatch) {
        const denied = requireAdmin()
        if (denied) return denied
        const id = userMatch[1]
        if (method === 'DELETE') {
          if (id === currentUser.id) return json({ error: 'نمی‌توانید خودتان را حذف کنید' }, 400, corsHeaders)
          await db.prepare('DELETE FROM sessions WHERE userId = ?').bind(id).run()
          await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
          return json({ ok: true }, 200, corsHeaders)
        }
        if (method === 'PATCH') {
          const body = await request.json().catch(() => ({}))
          if (body.password) {
            if (body.password.length < 6) return json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' }, 400, corsHeaders)
            const { hash, salt } = await hashPassword(body.password)
            await db.prepare('UPDATE users SET passwordHash = ?, passwordSalt = ? WHERE id = ?').bind(hash, salt, id).run()
          }
          if (body.role === 'admin' || body.role === 'user') {
            await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(body.role, id).run()
          }
          return json({ ok: true }, 200, corsHeaders)
        }
      }

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
        const denied = requireAuth()
        if (denied) return denied
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
          const denied = requireAuth()
          if (denied) return denied
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
          const denied = requireAuth()
          if (denied) return denied
          await db.prepare('DELETE FROM watchlists WHERE id = ?').bind(id).run()
          return json({ ok: true }, 200, corsHeaders)
        }
      }

      // ---- POST /api/letterboxd-watchlist (scrape a public Letterboxd watchlist,
      // list, OR reviews page by URL/username — Letterboxd doesn't offer an
      // RSS/API for these, only a CSV export, so this reads the public HTML
      // pages directly) ----
      if (method === 'POST' && pathname === '/api/letterboxd-watchlist') {
        const denied = requireAuth()
        if (denied) return denied
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

      // ---- GET /api/duplicates (possible accidental duplicate entries — same
      // title+year within the same media type/item type, not intentional
      // multi-copy tracking which uses the "copies" counter instead) ----
      if (method === 'GET' && pathname === '/api/duplicates') {
        const scope = url.searchParams.get('scope') || 'all'
        let sql = 'SELECT id, title, year, mediaType, itemType, closet, shelf, row, driveNumber, poster, format, copies FROM films WHERE 1=1'
        if (scope === 'physical') sql += " AND mediaType != 'digital'"
        else if (scope === 'digital') sql += " AND mediaType = 'digital'"
        else if (scope === 'series') sql += " AND itemType = 'series'"
        else if (scope === 'movies') sql += " AND itemType != 'series'"

        const result = await db.prepare(sql).all()
        const rows = result.results || []
        const groups = new Map()
        rows.forEach((f) => {
          const key = `${normalizeTitle(f.title)}|${f.year || ''}|${f.mediaType}|${f.itemType}`
          if (!groups.has(key)) groups.set(key, [])
          groups.get(key).push(f)
        })
        const duplicates = Array.from(groups.values()).filter((g) => g.length > 1)
        return json(duplicates, 200, corsHeaders)
      }

      // ---- GET /api/films/by-person?name=... (search server-side instead of
      // relying on the client having the ENTIRE films table loaded — with the
      // archive at 9000+ rows, the full unfiltered fetch could silently fail
      // or be stale, making a person's own filmography wrongly show 0 films) ----
      if (method === 'GET' && pathname === '/api/films/by-person') {
        const name = (url.searchParams.get('name') || '').trim()
        if (!name) return json([], 200, corsHeaders)
        const s = `%${name.toLowerCase()}%`
        const result = await db
          .prepare(
            `SELECT * FROM films WHERE
             LOWER(director) LIKE ? OR LOWER(writer) LIKE ? OR LOWER(producer) LIKE ? OR
             LOWER(musician) LIKE ? OR LOWER(composer) LIKE ? OR LOWER("cast") LIKE ?
             ORDER BY (CASE WHEN LOWER(title) LIKE 'the %' THEN SUBSTR(title, 5) ELSE title END) COLLATE NOCASE ASC`
          )
          .bind(s, s, s, s, s, s)
          .all()
        const films = (result.results || []).map(parseFilmRow)
        return json(films, 200, corsHeaders)
      }

      // ---- GET /api/films ----
      if (method === 'GET' && pathname === '/api/films') {
        const { q, genre, shelf, closet, sort, alpha, decade, drive, loaned, watched, minRating } = Object.fromEntries(url.searchParams)
        let sql = 'SELECT * FROM films WHERE 1=1'
        const params = []

        if (loaned === '1') { sql += ' AND borrowedTo IS NOT NULL AND borrowedTo != \'\'' }
        if (watched === '1') { sql += ' AND watched = 1' }
        if (watched === '0') { sql += ' AND (watched IS NULL OR watched = 0)' }
        if (minRating) { sql += ' AND rating >= ?'; params.push(Number(minRating)) }
        if (shelf) { sql += ' AND shelf = ?'; params.push(shelf) }
        if (closet) { sql += ' AND closet = ?'; params.push(closet) }
        if (drive) {
          sql += ' AND (driveNumber = ? OR driveNumber LIKE ? OR driveNumber LIKE ? OR driveNumber LIKE ?)'
          params.push(drive, `${drive},%`, `%, ${drive}`, `%, ${drive},%`)
        }
        if (genre) { sql += ' AND genre LIKE ?'; params.push(`%"${genre}"%`) }
        if (q) {
          const ql = q.toLowerCase()
          const s = `%${ql}%`
          // برای director/cast فقط اگه q ابتدای یه اسم باشه match کنیم (نه هر
          // جای وسط اسم) — وگرنه یه سرچ کوتاه مثل "a fu" چون تصادفاً وسط اسم
          // بازیگرهای بی‌ربطی مثل "Amanda Fuller" یا "Tatsuya Fujiwara" پیدا
          // می‌شه، فیلم‌های کاملاً نامرتبط رو هم نشون می‌ده.
          const startsWord = `${ql}%`
          const afterSpace = `% ${ql}%`
          const afterQuote = `%"${ql}%`
          sql += ` AND (
            LOWER(title) LIKE ? OR LOWER(originalTitle) LIKE ? OR
            LOWER(director) LIKE ? OR LOWER(director) LIKE ? OR
            LOWER("cast") LIKE ? OR LOWER("cast") LIKE ? OR LOWER("cast") LIKE ?
          )`
          params.push(s, s, startsWord, afterSpace, startsWord, afterSpace, afterQuote)
        }
        if (alpha) {
          // نادیده گرفتن «The» ابتدای عنوان موقع تعیین حرف الفبا، مثل مرتب‌سازی
          // (مثلاً "The Apartment" باید زیر A بره نه T)
          const alphaExpr = `(CASE WHEN LOWER(title) LIKE 'the %' THEN SUBSTR(title, 5) ELSE title END)`
          if (alpha === '0-9') { sql += ` AND ${alphaExpr} GLOB '[0-9]*'` }
          else { sql += ` AND LOWER(${alphaExpr}) LIKE ?`; params.push(`${alpha.toLowerCase()}%`) }
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
        const denied = requireAuth()
        if (denied) return denied
        const body = await request.json()
        if (!String(body.title || '').trim()) {
          return json({ error: 'title is required' }, 400, corsHeaders)
        }
        const key = env.OMDB_API_KEY
        let film = {
          ...body,
          id: `f${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: String(body.title).trim(),
          closet: body.closet || '',
          shelf: body.shelf || '',
          row: body.row || '',
          cast: Array.isArray(body.cast) ? body.cast : (body.cast ? [body.cast] : []),
          genre: Array.isArray(body.genre) ? body.genre : (body.genre ? [body.genre] : []),
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
        const denied = requireAuth()
        if (denied) return denied
        const existing = await db.prepare('SELECT * FROM films WHERE id = ?').bind(patchMatch[1]).first()
        if (!existing) return json({ error: 'not found' }, 404, corsHeaders)
        const body = await request.json()
        const updated = { ...parseFilmRow(existing) }
        for (const k of EDITABLE) {
          if (k in body) {
            if ((k === 'cast' || k === 'genre' || k === 'seasonDrives' || k === 'reviews') && Array.isArray(body[k])) {
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
        const denied = requireAuth()
        if (denied) return denied
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
        const denied = requireAuth()
        if (denied) return denied
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

      // ---- GET /api/films/enrich-status (just the remaining count, no processing) ----
      if (method === 'GET' && pathname === '/api/films/enrich-status') {
        const remaining = await db
          .prepare(
            `SELECT COUNT(*) as count FROM films WHERE (metadataEnrichmentAttemptedAt IS NULL OR poster IS NULL OR poster = '')${enrichScopeClause(url.searchParams)}`
          )
          .first()
        return json({ remaining: remaining?.count || 0 }, 200, corsHeaders)
      }

      // ---- POST /api/films/enrich ----
      // Optional ?mediaType=physical|digital and ?itemType=movie|series scope
      // the batch to whichever section the user currently has open, so the
      // "Fill missing details" button only touches that section's films.
      if (method === 'POST' && pathname === '/api/films/enrich') {
        const denied = requireAuth()
        if (denied) return denied
        const requestedLimit = parseInt(url.searchParams.get('limit') || '10', 10)
        const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 15) : 10
        const result = await enrichBatch(db, env, limit, enrichScopeClause(url.searchParams))
        return json(result, 200, corsHeaders)
      }

      // ---- POST /api/films/season-counts (fetch "total seasons produced so
      // far" from TVMaze for series that don't have it yet) ----
      if (method === 'POST' && pathname === '/api/films/season-counts') {
        const denied = requireAuth()
        if (denied) return denied
        const requestedLimit = parseInt(url.searchParams.get('limit') || '10', 10)
        const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 15) : 10

        const all = await db
          .prepare(
            `SELECT * FROM films
             WHERE itemType = 'series' AND totalSeasonsProduced IS NULL
             ORDER BY totalSeasonsUpdatedAt IS NOT NULL, title
             LIMIT ?`
          )
          .bind(limit)
          .all()
        const candidates = all.results || []

        let updated = 0
        for (const film of candidates) {
          let total = null
          try {
            total = await fetchTotalSeasons(film.title)
          } catch {
            total = null
          }
          const now = new Date().toISOString()
          if (total != null) {
            await db
              .prepare('UPDATE films SET totalSeasonsProduced = ?, totalSeasonsUpdatedAt = ? WHERE id = ?')
              .bind(total, now, film.id)
              .run()
            updated++
          } else {
            // پیدا نشد؛ تاریخ رو می‌زنیم که این ردیف همیشه اولِ صف نمونه، ولی
            // خودِ عدد رو NULL نگه می‌داریم تا دفعه‌ی بعد دوباره امتحان بشه.
            await db
              .prepare('UPDATE films SET totalSeasonsUpdatedAt = ? WHERE id = ?')
              .bind(now, film.id)
              .run()
          }
        }

        const remaining = await db
          .prepare("SELECT COUNT(*) as count FROM films WHERE itemType = 'series' AND totalSeasonsProduced IS NULL")
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

      // ---- GET /api/closets ----
      if (method === 'GET' && pathname === '/api/closets') {
        const result = await db.prepare('SELECT DISTINCT closet FROM films WHERE closet IS NOT NULL AND closet != \'\' ORDER BY CAST(closet AS INTEGER)').all()
        return json((result.results || []).map((r) => r.closet), 200, corsHeaders)
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

      // ---- GET /api/link-lookup (paste an IMDb or Letterboxd URL for the "Add Film"
      // autofill — extracts the IMDb id (directly, or by scraping the Letterboxd page
      // for its IMDb link) and pulls full metadata from OMDb. For very new releases
      // OMDb often has no record yet, so for Letterboxd links we also scrape basic
      // metadata (title/year/director/cast/synopsis/poster) straight off the page as
      // a fallback/base, and let OMDb fill in whatever it can on top of that.) ----
      if (method === 'GET' && pathname === '/api/link-lookup') {
        const key = env.OMDB_API_KEY
        const link = (url.searchParams.get('url') || '').trim()
        if (!link) return json({ error: 'لینک IMDb یا Letterboxd رو بچسبون' }, 400, corsHeaders)

        let imdbId = null
        let base = {}
        const directMatch = link.match(/imdb\.com\/title\/(tt\d+)/i)
        if (directMatch) {
          imdbId = directMatch[1]
          base = { imdbId }
        } else if (/letterboxd\.com/i.test(link)) {
          // اسلاگ فیلم رو از هر شکلی از لینک Letterboxd می‌گیره — چه صفحه‌ی
          // مستقیم فیلم (letterboxd.com/film/slug/) چه لینک دایری/لاگ شخصی
          // یک کاربر (letterboxd.com/username/film/slug/) که پیشوند یوزرنیم داره
          // و گاهی هم یه عدد تعداد بازبینی در آخرش (.../film/slug/2/).
          const slugMatch = link.match(/\/film\/([^/?#]+)/i)
          if (!slugMatch) return json({ error: 'لینک Letterboxd باید صفحه‌ی یک فیلم باشه (شامل film/...)' }, 400, corsHeaders)
          try {
            const pageRes = await fetch(`https://letterboxd.com/film/${slugMatch[1]}/`, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CinefilioArchive/1.0; personal film archive app)' },
            })
            if (!pageRes.ok) return json({ error: 'صفحه‌ی Letterboxd پیدا نشد' }, 404, corsHeaders)
            const html = await pageRes.text()
            const imdbMatch = html.match(/imdb\.com\/title\/(tt\d+)/i)
            imdbId = imdbMatch ? imdbMatch[1] : null
            base = parseLetterboxdBasic(html)
            if (imdbId) base.imdbId = imdbId
            if (!base.title) return json({ error: 'اطلاعاتی از این صفحه‌ی Letterboxd استخراج نشد' }, 404, corsHeaders)
          } catch (e) {
            return json({ error: 'خطا در ارتباط با Letterboxd' }, 502, corsHeaders)
          }
        } else {
          return json({ error: 'لینک باید از IMDb یا Letterboxd باشه' }, 400, corsHeaders)
        }

        // پوستر Letterboxd (og:image) رو دیگه به‌عنوان جایگزین استفاده نمی‌کنیم — این
        // فقط یه بک‌دراپ/عکس تبلیغاتی برای اشتراک‌گذاریه (نه پوستر واقعی)، و پوستر
        // واقعی روی خودِ صفحه از طریق جاوااسکریپت لود می‌شه که با fetch ساده گرفته
        // نمی‌شه. اگه TMDB_API_KEY تنظیم شده باشه، ازش هم برای پوستر و هم به عنوان
        // یه منبع کامل جایگزین (وقتی OMDb اصلاً چیزی نداره) استفاده می‌کنیم.
        delete base._letterboxdImageFallback

        async function tmdbFind(imdbId) {
          if (!imdbId || !env.TMDB_API_KEY) return null
          const tmdbKey = env.TMDB_API_KEY
          // پشتیبانی از هر دو نوع کلید TMDB: کلید کلاسیک v3 (پارامتر api_key توی URL)
          // و توکن جدید v4 Read Access (هدر Authorization: Bearer) — از اونجا که
          // نمی‌دونیم کاربر کدومش رو گرفته، هر دو رو امتحان می‌کنیم.
          const attempts = [
            { url: `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${encodeURIComponent(tmdbKey)}`, headers: { accept: 'application/json' } },
            { url: `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`, headers: { Authorization: `Bearer ${tmdbKey}`, accept: 'application/json' } },
          ]
          for (const attempt of attempts) {
            try {
              const tmdbRes = await fetch(attempt.url, { headers: attempt.headers })
              if (tmdbRes.ok) {
                const tmdbData = await tmdbRes.json()
                const movieHit = (tmdbData.movie_results || [])[0]
                const tvHit = (tmdbData.tv_results || [])[0]
                if (movieHit) return { hit: movieHit, itemType: 'movie' }
                if (tvHit) return { hit: tvHit, itemType: 'series' }
              }
            } catch {
              // این روش جواب نداد؛ روش بعدی رو امتحان می‌کنیم
            }
          }
          return null
        }

        const addTmdbPosterFallback = async (film) => {
          if (film.poster || !film.imdbId) return film
          const result = await tmdbFind(film.imdbId)
          if (result?.hit?.poster_path) film.poster = `https://image.tmdb.org/t/p/w500${result.hit.poster_path}`
          return film
        }

        // وقتی OMDb هیچی برای این imdbId نداره (رایج برای فیلم‌های کوچیک/مستقل که
        // OMDb پوشش نمی‌ده)، از TMDB به عنوان منبع کامل جایگزین استفاده می‌کنیم —
        // عنوان، سال، خلاصه و پوستر رو از همونجا می‌گیریم تا فیلم اصلاً اضافه بشه.
        const tmdbAsFullFallback = async (imdbId) => {
          const result = await tmdbFind(imdbId)
          if (!result?.hit?.title && !result?.hit?.name) return null
          const hit = result.hit
          const releaseDate = hit.release_date || hit.first_air_date || ''
          return {
            imdbId,
            title: hit.title || hit.name,
            year: releaseDate ? parseInt(releaseDate.slice(0, 4), 10) : undefined,
            synopsis: hit.overview || undefined,
            poster: hit.poster_path ? `https://image.tmdb.org/t/p/w500${hit.poster_path}` : undefined,
            itemType: result.itemType,
          }
        }

        if (!key) {
          if (base.title) return json(await addTmdbPosterFallback(base), 200, corsHeaders)
          const tmdbFallback = await tmdbAsFullFallback(base.imdbId)
          if (tmdbFallback) return json(tmdbFallback, 200, corsHeaders)
          return json({ error: 'OMDB_API_KEY تنظیم نشده — امکان جستجوی خودکار از روی لینک IMDb وجود نداره' }, 400, corsHeaders)
        }

        try {
          const found = await enrichFilm(base, key)
          if (!found.title) {
            const tmdbFallback = await tmdbAsFullFallback(base.imdbId)
            if (tmdbFallback) return json(tmdbFallback, 200, corsHeaders)
            return json({ error: 'این فیلم هنوز توی دیتابیس OMDb نیست (معمولاً برای فیلم‌های خیلی جدید یا مستقل پیش میاد) — عنوان/سال رو دستی وارد کن' }, 404, corsHeaders)
          }
          return json(await addTmdbPosterFallback(found), 200, corsHeaders)
        } catch (e) {
          if (e.code === 'OMDB_QUOTA_EXCEEDED') {
            if (base.title) return json(await addTmdbPosterFallback(base), 200, corsHeaders)
            const tmdbFallback = await tmdbAsFullFallback(base.imdbId)
            if (tmdbFallback) return json(tmdbFallback, 200, corsHeaders)
            return json({ error: 'سهمیه‌ی روزانه‌ی OMDb تموم شده — فردا دوباره امتحان کن' }, 429, corsHeaders)
          }
          if (base.title) return json(await addTmdbPosterFallback(base), 200, corsHeaders)
          const tmdbFallback = await tmdbAsFullFallback(base.imdbId)
          if (tmdbFallback) return json(tmdbFallback, 200, corsHeaders)
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
        const denied = requireAuth()
        if (denied) return denied
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
        const denied = requireAuth()
        if (denied) return denied
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
        const denied = requireAuth()
        if (denied) return denied
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
        const denied = requireAuth()
        if (denied) return denied
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
                Closet: f.closet || '',
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

      // ---- GET /api/backups (list automatic daily backups stored in KV) ----
      if (method === 'GET' && pathname === '/api/backups') {
        const denied = requireAdmin()
        if (denied) return denied
        const list = await env.BACKUPS.list({ prefix: 'backup:' })
        const dates = list.keys
          .map((k) => k.name)
          .filter((name) => name !== 'backup:latest')
          .map((name) => name.replace('backup:', ''))
          .sort()
          .reverse()
        return json({ backups: dates }, 200, corsHeaders)
      }

      // ---- GET /api/backups/:date (download a specific daily backup, or "latest") ----
      if (method === 'GET' && pathname.startsWith('/api/backups/')) {
        const denied = requireAdmin()
        if (denied) return denied
        const dateParam = pathname.replace('/api/backups/', '')
        const key = dateParam === 'latest' ? 'backup:latest' : `backup:${dateParam}`
        const value = await env.BACKUPS.get(key)
        if (!value) return json({ error: 'Backup not found' }, 404, corsHeaders)
        return new Response(value, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="films-backup-${dateParam}.json"`,
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

  // هر روز خودکار (بدون این‌که کاربر دکمه رو بزنه) یه دسته از فیلم‌های
  // بی‌اطلاعات رو enrich می‌کنه — تا سهمیه‌ی روزانه‌ی رایگان OMDb (۱۰۰۰
  // درخواست) تموم بشه یا فیلمی برای enrich کردن نمونه، هرکدوم زودتر.
  async scheduled(event, env, ctx) {
    // این تابع با دو زمان‌بندی متفاوت صدا زده می‌شه (به wrangler.jsonc نگاه کن)؛
    // event.cron مشخص می‌کنه کدوم کرون بوده تا کار درست انجام بشه.
    if (event.cron === '0 4 * * *') {
      await runDailyBackup(env)
      return
    }

    const db = env.DB
    let totalProcessed = 0
    let totalUpdated = 0
    for (let i = 0; i < 65; i++) {
      const result = await enrichBatch(db, env, 15)
      totalProcessed += result.processed
      totalUpdated += result.updated
      if (result.quotaExceeded || result.processed === 0 || result.remaining === 0) break
    }
    console.log(`Daily enrichment: processed ${totalProcessed}, updated ${totalUpdated}`)
  },
}

// هر روز ساعت ۴ بامداد UTC (یه ساعت بعد از enrichment) کل جدول films رو به‌صورت
// JSON در KV ذخیره می‌کنه؛ کلید بر اساس تاریخ ساخته می‌شه (backup:YYYY-MM-DD) تا
// تاریخچه‌ی روزانه حفظ بشه. بکاپ‌های قدیمی‌تر از ۳۰ روز خودکار پاک می‌شن تا فضای
// KV پر نشه. یه کلید ثابت "backup:latest" هم برای دسترسی سریع نگه داشته می‌شه.
async function runDailyBackup(env) {
  const db = env.DB
  const result = await db.prepare('SELECT * FROM films ORDER BY title').all()
  const films = (result.results || []).map(parseFilmRow)
  const payload = JSON.stringify({ backedUpAt: new Date().toISOString(), count: films.length, films })

  const dateKey = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  await env.BACKUPS.put(`backup:${dateKey}`, payload)
  await env.BACKUPS.put('backup:latest', payload)

  // پاکسازی بکاپ‌های قدیمی‌تر از ۳۰ روز
  const list = await env.BACKUPS.list({ prefix: 'backup:' })
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  for (const key of list.keys) {
    const m = key.name.match(/^backup:(\d{4}-\d{2}-\d{2})$/)
    if (!m) continue
    const keyDate = new Date(m[1] + 'T00:00:00Z').getTime()
    if (keyDate < cutoff) {
      await env.BACKUPS.delete(key.name)
    }
  }

  console.log(`Daily backup: saved ${films.length} films as backup:${dateKey}`)
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
function metaContent(html, prop) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${prop}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return decodeHtmlEntities(m[1])
  }
  return null
}

// روی خودِ HTML صفحه‌ی فیلم Letterboxd (نه از طریق API) پارس می‌کنه تا یه پایه‌ی
// اولیه از عنوان/سال/کارگردان/بازیگرها/خلاصه/پوستر بسازه. برای فیلم‌های خیلی جدید
// که هنوز توی OMDb نیستن، این تنها منبعیه که داریم.
function parseLetterboxdBasic(html) {
  const out = {}
  const ogTitle = metaContent(html, 'og:title')
  if (ogTitle) {
    const yearMatch = ogTitle.match(/\((\d{4})\)\s*$/)
    if (yearMatch) out.year = parseInt(yearMatch[1], 10)
    out.title = ogTitle.replace(/\s*\(\d{4}\)\s*$/, '').trim()
  }
  const desc = metaContent(html, 'og:description') || metaContent(html, 'description')
  if (desc) out.synopsis = desc.trim()

  const directorMatch = html.match(/\/director\/[^"']+["'][^>]*>([^<]+)</i)
  if (directorMatch) out.director = decodeHtmlEntities(directorMatch[1].trim())

  const castMatches = [...html.matchAll(/\/actor\/[^"']+["'][^>]*>([^<]+)</gi)]
  if (castMatches.length) {
    const names = [...new Set(castMatches.map((m) => decodeHtmlEntities(m[1].trim())).filter(Boolean))]
    out.cast = names.slice(0, 10)
  }

  return out
}

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
  if (typeof film.reviews === 'string' && film.reviews) {
    try { film.reviews = JSON.parse(film.reviews) } catch { film.reviews = [] }
  } else if (!film.reviews) {
    film.reviews = []
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
  const { id, title, originalTitle, closet, shelf, row, director, producer, cast, year, genre, rating, runtime, country, synopsis, poster, studio, rated, format, borrowedTo, borrowedDate, watched, imdbId, imdbVotes, metadataEnrichmentAttemptedAt, myRating, criterion, copies, mediaType, driveNumber, itemType, seasonsEpisodes, letterboxdRating, watchlisted, seasonDrives } = film
  await db.prepare(
    `INSERT INTO films (id, title, originalTitle, closet, shelf, row, director, producer, cast, year, genre, rating, runtime, country, synopsis, poster, studio, rated, format, borrowedTo, borrowedDate, watched, imdbId, imdbVotes, metadataEnrichmentAttemptedAt, myRating, criterion, copies, mediaType, driveNumber, itemType, seasonsEpisodes, letterboxdRating, watchlisted, seasonDrives)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, title || null, originalTitle || null, closet || null, shelf || null, row || null,
    director || null, producer || null, cast ? (Array.isArray(cast) ? JSON.stringify(cast) : cast) : null,
    year || null, genre ? (Array.isArray(genre) ? JSON.stringify(genre) : genre) : null,
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

// بر اساس ?mediaType= و ?itemType= توی کوئری‌استرینگ، یه شرط AND اضافه
// می‌سازه تا enrichBatch/شمارش‌باقی‌مونده فقط رو همون قسمتی که کاربر بازش
// کرده (فیلم فیزیکی/سریال فیزیکی/فیلم دیجیتال/سریال دیجیتال) کار کنه.
// مقدار نامعتبر یا نبودن پارامتر = بدون فیلتر (کل آرشیو، رفتار قبلی).
function enrichScopeClause(searchParams) {
  const mediaType = searchParams.get('mediaType')
  const itemType = searchParams.get('itemType')
  let clause = ''
  if (mediaType === 'digital') clause += " AND mediaType = 'digital'"
  else if (mediaType === 'physical') clause += " AND (mediaType IS NULL OR mediaType != 'digital')"
  if (itemType === 'series') clause += " AND itemType = 'series'"
  else if (itemType === 'movie') clause += " AND (itemType IS NULL OR itemType != 'series')"
  return clause
}

// یه دسته از فیلم‌های بی‌اطلاعات رو enrich می‌کنه — هم دکمه‌ی «Fill missing
// details» تو اپ، هم کرون روزانه از همین استفاده می‌کنن.
// باگ قبلی: بدون ORDER BY، هر بار همون چند فیلم اولِ بی‌پوستر (که OMDb اصلاً
// پوستری براشون نداره یا اسمشون قابل‌تشخیص نیست) انتخاب می‌شدن؛ دکمه هیچ‌وقت
// به فیلم‌های واقعاً بررسی‌نشده نمی‌رسید. الان اول فیلم‌های بررسی‌نشده رو
// تموم می‌کنه، بعد بی‌پوسترها رو به ترتیب قدیمی‌ترین تلاش می‌ره سراغشون.
// scopeClause (اختیاری): خروجیِ enrichScopeClause، برای محدود کردن به یه بخش خاص.
async function enrichBatch(db, env, limit, scopeClause = '') {
  const all = await db
    .prepare(
      `SELECT * FROM films
       WHERE (metadataEnrichmentAttemptedAt IS NULL OR poster IS NULL OR poster = '')${scopeClause}
       ORDER BY (metadataEnrichmentAttemptedAt IS NULL) DESC, metadataEnrichmentAttemptedAt ASC
       LIMIT ?`
    )
    .bind(limit)
    .all()
  const candidates = all.results || []

  let updated = 0
  let quotaExceeded = false
  for (const film of candidates) {
    const parsed = parseFilmRow(film)
    let enriched
    try {
      enriched = await enrichFilm(parsed, env.OMDB_API_KEY)
    } catch (e) {
      if (e.code === 'OMDB_QUOTA_EXCEEDED') {
        quotaExceeded = true
        break
      }
      throw e
    }
    const fields = ENRICHABLE_FIELDS.filter((f) => isEmptyMetadata(parsed[f]) && !isEmptyMetadata(enriched[f]))
    if (fields.length) updated++
    enriched.metadataEnrichmentAttemptedAt = new Date().toISOString()
    await updateFilm(db, enriched)
  }

  const remaining = await db
    .prepare(
      `SELECT COUNT(*) as count FROM films WHERE (metadataEnrichmentAttemptedAt IS NULL OR poster IS NULL OR poster = '')${scopeClause}`
    )
    .first()

  return { processed: candidates.length, updated, remaining: remaining?.count || 0, quotaExceeded }
}

async function updateFilm(db, film) {
  const { id, title, originalTitle, closet, shelf, row, director, producer, cast, year, genre, rating, runtime, country, synopsis, poster, studio, rated, format, borrowedTo, borrowedDate, watched, imdbId, imdbVotes, metadataEnrichmentAttemptedAt, myRating, criterion, copies, mediaType, driveNumber, itemType, seasonsEpisodes, letterboxdRating, letterboxdVotes, watchlisted, seasonDrives, personalReview, personalReviewUrl, personalReviewDate, reviews } = film
  await db.prepare(
    `UPDATE films SET title=?, originalTitle=?, closet=?, shelf=?, row=?, director=?, producer=?, cast=?, year=?, genre=?, rating=?, runtime=?, country=?, synopsis=?, poster=?, studio=?, rated=?, format=?, borrowedTo=?, borrowedDate=?, watched=?, imdbId=?, imdbVotes=?, metadataEnrichmentAttemptedAt=?, myRating=?, criterion=?, copies=?, mediaType=?, driveNumber=?, itemType=?, seasonsEpisodes=?, letterboxdRating=?, letterboxdVotes=?, watchlisted=?, seasonDrives=?, personalReview=?, personalReviewUrl=?, personalReviewDate=?, reviews=? WHERE id=?`
  ).bind(
    title || null, originalTitle || null, closet || null, shelf || null, row || null,
    director || null, producer || null, cast && Array.isArray(cast) ? JSON.stringify(cast) : cast || null,
    year || null, genre && Array.isArray(genre) ? JSON.stringify(genre) : genre || null,
    rating || null, runtime || null, country || null,
    synopsis || null, poster || null, studio || null, rated || null,
    format || null, borrowedTo || null, borrowedDate || null,
    watched ? 1 : 0, imdbId || null, imdbVotes || null,
    metadataEnrichmentAttemptedAt || null, myRating || 0, criterion ? 1 : 0,
    copies || 1, mediaType || 'physical', driveNumber || null,
    itemType || 'movie', seasonsEpisodes || null, letterboxdRating || null, letterboxdVotes || null, watchlisted ? 1 : 0,
    seasonDrives ? (Array.isArray(seasonDrives) ? JSON.stringify(seasonDrives) : seasonDrives) : null,
    personalReview || null, personalReviewUrl || null, personalReviewDate || null,
    reviews ? (Array.isArray(reviews) ? JSON.stringify(reviews) : reviews) : null, id
  ).run()
}
