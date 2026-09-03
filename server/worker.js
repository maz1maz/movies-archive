// Cloudflare Workers API — replaces the old Express/Netlify server.
// Handles all /api/* routes using D1 for persistent storage.
import { json, rowToFilm, normalizeTitle, EDITABLE, ENRICHABLE_FIELDS, isEmptyMetadata, countSeasonsFromText, decodeHtmlEntities } from './helpers.js'
import { enrichFilm } from './omdb.js'
import { fetchTotalSeasons, enrichSeriesFromTVMazeById, fetchTvMazePersonUpcoming } from './tvmaze.js'
import * as XLSX from 'xlsx'
import { hashPassword, verifyPassword, getSessionUser, createSession, destroySession, sessionCookieHeader } from './auth.js'

// کش KV برای درخواست کاملاً بدون فیلتر GET /api/films — روی صفحه‌ی اول
// (allFilmsUnfiltered) هر بار کل آرشیو (۱۶هزار+ ردیف) از D1 خونده می‌شد که
// کند بود؛ حالا ۱۸۰ ثانیه کش می‌شه و با هر نوشتن روی films/import باطل می‌شه.
const FILMS_CACHE_KEY = 'filmscache:all'
const FILMS_CACHE_TTL = 180

// کش KV برای GET /api/decades — دهه‌ی فیلم‌ها تقریباً هیچ‌وقت عوض نمی‌شه،
// ولی قبلاً هر بار یه full table scan روی films می‌زد. حالا ۱ ساعت کش
// می‌شه و با هر نوشتن روی films باطل می‌شه (مثل filmscache).
const DECADES_CACHE_KEY = 'decadescache:all'
const DECADES_CACHE_TTL = 3600

async function invalidateFilmsCache(env) {
  if (!env.BACKUPS) return
  try {
    const list = await env.BACKUPS.list({ prefix: FILMS_CACHE_KEY })
    await Promise.all((list.keys || []).map((k) => env.BACKUPS.delete(k.name)))
    await env.BACKUPS.delete(DECADES_CACHE_KEY)
    await env.BACKUPS.delete('filmscounts:v1')
    await env.BACKUPS.delete('genrescache:v1')
    await env.BACKUPS.delete('shelvescache:v1')
    await env.BACKUPS.delete('closetscache:v1')
    await env.BACKUPS.delete('acclaimedcache:v1')
  } catch {}
}

export default {
  async fetch(request, env, ctx) {
    const response = await handleFetch(request, env, ctx)
    try {
      const { pathname } = new URL(request.url)
      if (
        request.method !== 'GET' &&
        env.BACKUPS &&
        response.status < 400 &&
        (pathname.startsWith('/api/films') || pathname === '/api/import')
      ) {
        ctx.waitUntil(invalidateFilmsCache(env))
      }
    } catch {}
    return response
  },

  // هر روز خودکار (بدون این‌که کاربر دکمه رو بزنه) یه دسته از فیلم‌های
  // بی‌اطلاعات رو enrich می‌کنه — تا سهمیه‌ی روزانه‌ی رایگان OMDb (۱۰۰۰
  // درخواست) تموم بشه یا فیلمی برای enrich کردن نمونه، هرکدوم زودتر.
  async scheduled(event, env, ctx) {
    // این تابع با دو زمان‌بندی متفاوت صدا زده می‌شه (به wrangler.jsonc نگاه کن)؛
    // event.cron مشخص می‌کنه کدوم کرون بوده تا کار درست انجام بشه.
    if (event.cron === '0 4 * * *') {
      try {
        await runDailyBackup(env)
      } catch (e) {
        await notifyServerError(env, `Daily backup (cron 0 4 * * *) failed: ${e.message}`).catch(() => {})
        throw e
      }
      return
    }

    if (event.cron === '*/1 * * * *') {
      // فقط وقتی poster-audit «running»ه کاری می‌کنه (خودِ تابع اول چک
      // می‌کنه)، وگرنه هر دقیقه بی‌خودی صدا زده می‌شه ولی سریع return می‌کنه.
      await runPosterAuditChunk(env.DB).catch(() => {})
      return
    }

    try {
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
    } catch (e) {
      // قبلاً throw می‌کرد و Cloudflare هر بار دوباره retry می‌کرد؛ وقتی
      // خطا از نوع quota (مثل D1 daily limit) بود، retry هم قطعاً همون خطا
      // رو می‌داد و فقط اسپم نوتیف تلگرام هر چند دقیقه تولید می‌کرد. الان
      // فقط لاگ/نوتیف می‌شه و retry نمی‌شه.
      await notifyServerError(env, `Daily enrichment (cron 0 3 * * *) failed: ${e.message}`).catch(() => {})
    }
  },
}

async function handleFetch(request, env, ctx) {
    const url = new URL(request.url)
    const { pathname } = url
    const method = request.method

    // CORS headers for the frontend. Cookie-based auth requires the exact
    // origin (not '*') plus Allow-Credentials so the browser sends/accepts
    // the HttpOnly session cookie on cross-origin fetches (e.g. local dev).
    // نکته‌ی امنیتی: قبلاً هر Origin دلخواه عیناً echo می‌شد — با
    // Allow-Credentials:true این یعنی هر سایت مخربی می‌تونست با کوکی
    // نشست کاربر لاگین‌شده به API درخواست بزنه و جوابش رو بخونه. الان فقط
    // دامنه‌ی خودِ اپ + پورت‌های dev محلی مجازن.
    const ALLOWED_ORIGINS = [
      'https://movies-archive.hamidreza-mazlaghani.workers.dev',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]
    const origin = request.headers.get('Origin')
    const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
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
    const requireAuth = () => (currentUser ? null : json({ error: 'You need to log in for this action' }, 401, corsHeaders))

    // ---- Audit Trail — ثبت اینکه کی چی رو تغییر داد، با مقدار قبل/بعد ----
    const logAudit = async ({ filmId, filmTitle, action, changes }) => {
      try {
        await db
          .prepare('INSERT INTO audit_log (id, filmId, filmTitle, action, changes, changedBy) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(
            crypto.randomUUID(),
            filmId || null,
            filmTitle || null,
            action,
            changes ? JSON.stringify(changes) : null,
            currentUser?.username || 'guest'
          )
          .run()
      } catch {
        // لاگ‌نشدن یه تغییر نباید کل عملیات رو خراب کنه
      }
    }

    // ---- API usage counter (برای هشدار نزدیک شدن به quota روزانه‌ی OMDb) ----
    const bumpApiUsage = async (service) => {
      try {
        const today = new Date().toISOString().slice(0, 10)
        await db
          .prepare(
            `INSERT INTO api_usage_daily (date, service, count) VALUES (?, ?, 1)
             ON CONFLICT(date, service) DO UPDATE SET count = count + 1`
          )
          .bind(today, service)
          .run()
      } catch {
        // شمارش نشدن یه درخواست نباید کل عملیات رو خراب کنه
      }
    }

    const requireAdmin = () =>
      !currentUser
        ? json({ error: 'You need to log in for this action' }, 401, corsHeaders)
        : currentUser.role !== 'admin'
        ? json({ error: 'This action is admin-only' }, 403, corsHeaders)
        : null

    // ---- Rate Limiting برای درخواست‌های مهمان (لاگین‌نشده) ----
    // فقط guestها محدود می‌شن؛ کاربر لاگین‌شده (owner) هیچ محدودیتی نداره.
    // شمارنده‌ی sliding-window یک‌دقیقه‌ای رو IP، تو یه KV جدا (RATE_LIMIT) نگه‌داری می‌شه.
    if (!currentUser && env.RATE_LIMIT && pathname.startsWith('/api/')) {
      const GUEST_LIMIT_PER_MINUTE = 60
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
      const minuteBucket = Math.floor(Date.now() / 60000)
      const rlKey = `rl:${ip}:${minuteBucket}`
      try {
        const current = parseInt((await env.RATE_LIMIT.get(rlKey)) || '0', 10)
        if (current >= GUEST_LIMIT_PER_MINUTE) {
          return json(
            { error: 'Too many requests — please slow down and try again in a moment.' },
            429,
            { ...corsHeaders, 'Retry-After': '60' }
          )
        }
        // نوشتن شمارنده منتظر نمی‌مونیم — این فقط برای درخواست بعدی لازمه، نه پاسخ فعلی.
        // await کردنش یه round-trip کامل به KV رو جلوی هر درخواست guest می‌ذاشت.
        // فقط ۱ از هر ۴ درخواست واقعاً می‌نویسیم (و هر بار ۴ تا اضافه می‌کنیم) —
        // شمارش تقریبیه ولی مصرف KV put رو ~۷۵٪ کم می‌کنه (سقف رایگان روزانه‌ی
        // Cloudflare ۱۰۰۰ تاست و با ترافیک تست/توسعه زود پر می‌شد).
        if (Math.random() < 0.25) {
          const putPromise = env.RATE_LIMIT.put(rlKey, String(current + 4), { expirationTtl: 70 }).catch(() => {})
          if (ctx?.waitUntil) ctx.waitUntil(putPromise)
        }
      } catch {
        // اگه خود KV مشکل داشت، درخواست رو بلاک نکن — فقط rate limiting رد می‌شه
      }
    }

    try {
      // ---- Auth: login / logout / me ----
      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await request.json().catch(() => ({}))
        const username = (body.username || '').trim().toLowerCase()
        const password = body.password || ''
        if (!username || !password) return json({ error: 'Username and password are required' }, 400, corsHeaders)

        // محدودیت تلاش لاگین (brute-force): بعد از ۵ تلاش ناموفق پشت‌سرهم
        // رو یه یوزرنیم، ۱۵ دقیقه قفل می‌شه.
        const loginKey = `login-fail:${username}`
        if (env.RATE_LIMIT) {
          try {
            const fails = parseInt((await env.RATE_LIMIT.get(loginKey)) || '0', 10)
            if (fails >= 5) {
              return json({ error: 'Too many failed attempts. Try again in a few minutes.' }, 429, corsHeaders)
            }
          } catch {}
        }

        const user = await db.prepare('SELECT * FROM users WHERE lower(username) = ?').bind(username).first()
        const ok = user ? await verifyPassword(password, user.passwordSalt, user.passwordHash) : false
        if (!user || !ok) {
          if (env.RATE_LIMIT) {
            try {
              const fails = parseInt((await env.RATE_LIMIT.get(loginKey)) || '0', 10)
              await env.RATE_LIMIT.put(loginKey, String(fails + 1), { expirationTtl: 900 })
            } catch {}
          }
          return json({ error: 'Incorrect username or password' }, 401, corsHeaders)
        }
        if (env.RATE_LIMIT) {
          try {
            await env.RATE_LIMIT.delete(loginKey)
          } catch {}
        }
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
        if (!username || !password) return json({ error: 'Username and password are required' }, 400, corsHeaders)
        if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400, corsHeaders)
        const exists = await db.prepare('SELECT id FROM users WHERE lower(username) = ?').bind(username.toLowerCase()).first()
        if (exists) return json({ error: 'This username is already taken' }, 409, corsHeaders)
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
          if (id === currentUser.id) return json({ error: 'You cannot delete yourself' }, 400, corsHeaders)
          await db.prepare('DELETE FROM sessions WHERE userId = ?').bind(id).run()
          await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
          return json({ ok: true }, 200, corsHeaders)
        }
        if (method === 'PATCH') {
          const body = await request.json().catch(() => ({}))
          if (body.password) {
            if (body.password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400, corsHeaders)
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
        let targetUrl
        try {
          targetUrl = new URL(target)
        } catch {
          return new Response('Invalid url', { status: 400, headers: corsHeaders })
        }
        // این proxy عمومیه (بدون auth)، برای همین فقط اجازه‌ی چند دامنه‌ی
        // شناخته‌شده‌ی عکس (TMDB/Wikimedia) رو می‌ده — قبلاً هیچ allowlist
        // نداشت و هرکسی می‌تونست از سرور به‌عنوان proxy باز برای هر URL
        // دلخواه استفاده کنه.
        const allowedHosts = ['image.tmdb.org', 'upload.wikimedia.org', 'upload.wikimedia.beta.wmflabs.org']
        if (!allowedHosts.includes(targetUrl.hostname)) {
          return new Response('Host not allowed', { status: 403, headers: corsHeaders })
        }
        try {
          // اول KV رو چک کن (ذخیره‌ی دائمی) — اگه قبلاً گرفته شده، مستقیم
          // از همونجا سرو می‌شه، بدون درخواست دوباره به TMDB. این برخلاف
          // Cache API واقعاً دائمیه (Cloudflare می‌تونه هر از گاهی edge
          // cache رو خودش خالی کنه، ولی KV تا وقتی حذف نشه می‌مونه).
          const kvKey = 'poster:' + targetUrl.toString()
          if (env.BACKUPS) {
            try {
              const cachedRecord = await env.BACKUPS.get(kvKey, 'json')
              if (cachedRecord) {
                const bytes = Uint8Array.from(atob(cachedRecord.data), (c) => c.charCodeAt(0))
                return new Response(bytes, {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': cachedRecord.contentType, 'Cache-Control': 'public, max-age=604800, immutable' },
                })
              }
            } catch {}
          }

          const upstream = await fetch(targetUrl.toString(), {
            headers: { 'User-Agent': 'CinefilmArchive/1.0 (personal film archive app)' },
          })
          if (!upstream.ok) return new Response('Upstream error', { status: 502, headers: corsHeaders })
          const contentType = upstream.headers.get('content-type') || 'image/jpeg'
          const bodyBuffer = await upstream.arrayBuffer()

          if (env.BACKUPS) {
            try {
              const bytes = new Uint8Array(bodyBuffer)
              let binary = ''
              const CHUNK = 8192
              for (let i = 0; i < bytes.length; i += CHUNK) {
                binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
              }
              const b64 = btoa(binary)
              // فقط عکس‌های معقول (زیر ۱ مگابایت) رو KV سیو کن، تا سهمیه‌ی
              // نوشتن روزانه‌ی KV هدر نره
              if (b64.length < 1_400_000) {
                ctx.waitUntil(env.BACKUPS.put(kvKey, JSON.stringify({ data: b64, contentType })))
              }
            } catch {}
          }

          return new Response(bodyBuffer, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': contentType, 'Cache-Control': 'public, max-age=604800, immutable' },
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
        // قبلاً هیچ auth ای نداشت (حتی مهمون هم می‌تونست صداش بزنه) و کل
        // جدول رو بدون کش می‌خوند. الان هم ادمین‌محرمانه‌ست، هم برای
        // جلوگیری از اجرای تصادفی (مثلاً فقط با باز کردن تب Duplicates)
        // رمز عبور رو دوباره می‌خواد.
        const denied = requireAdmin()
        if (denied) return denied
        const confirmPassword = request.headers.get('X-Confirm-Password') || ''
        const passOk = confirmPassword && (await verifyPassword(confirmPassword, currentUser.passwordSalt, currentUser.passwordHash))
        if (!passOk) return json({ error: 'Incorrect password' }, 403, corsHeaders)

        const scope = url.searchParams.get('scope') || 'all'

        // scope=both: نه دوبله‌ی اشتباهی، بلکه فیلم‌هایی که واقعاً هم نسخه‌ی
        // فیزیکال هم دیجیتال داری — یه‌جا نشونش می‌دیم (گروه‌بندی بدون در
        // نظر گرفتن mediaType، فقط گروه‌هایی که هر دو نوع توشونه نگه داشته می‌شن).
        if (scope === 'both') {
          const result = await db
            .prepare('SELECT id, title, year, mediaType, itemType, closet, shelf, row, driveNumber, poster, format, copies FROM films')
            .all()
          const rows = result.results || []
          const groups = new Map()
          rows.forEach((f) => {
            const key = `${normalizeTitle(f.title)}|${f.year || ''}|${f.itemType}`
            if (!groups.has(key)) groups.set(key, [])
            groups.get(key).push(f)
          })
          const both = Array.from(groups.values()).filter(
            (g) => g.some((f) => f.mediaType === 'digital') && g.some((f) => f.mediaType !== 'digital')
          )
          return json(both, 200, corsHeaders)
        }

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
        // بدون کش بود — کلیک روی هر اسم کارگردان/بازیگر یه full table scan
        // جداگونه بود، دقیقاً همون کلاس مشکلی که سهمیه‌ی D1 رو می‌ترکونه.
        const byPersonCacheKey = `${FILMS_CACHE_KEY}:by-person:${name.toLowerCase()}`
        if (env.BACKUPS) {
          try {
            const cached = await env.BACKUPS.get(byPersonCacheKey, 'json')
            if (cached) return json(cached, 200, corsHeaders)
          } catch {}
        }
        const s = `%${name.toLowerCase()}%`
        const result = await db
          .prepare(
            `SELECT * FROM films WHERE
             LOWER(director) LIKE ? OR LOWER(producer) LIKE ? OR LOWER("cast") LIKE ? OR LOWER(screenwriter) LIKE ?
             ORDER BY (CASE WHEN LOWER(title) LIKE 'the %' THEN SUBSTR(title, 5) ELSE title END) COLLATE NOCASE ASC
             LIMIT 500`
          )
          .bind(s, s, s, s)
          .all()
        const films = (result.results || []).map(parseFilmRow)
        if (env.BACKUPS) {
          ctx.waitUntil(env.BACKUPS.put(byPersonCacheKey, JSON.stringify(films), { expirationTtl: FILMS_CACHE_TTL }).catch(() => {}))
        }
        return json(films, 200, corsHeaders)
      }

      // ---- GET /api/films ----
      if (method === 'GET' && pathname === '/api/films') {
        const { q, genre, shelf, closet, sort, alpha, decade, drive, loaned, watched, minRating, mediaType, itemType, limit, offset } = Object.fromEntries(url.searchParams)
        // قبلاً فقط حالت «بدون هیچ فیلتری» (یا فقط mediaType/itemType/sort)
        // کش می‌شد — یعنی genre، decade، shelf/closet، alpha (A-Z)، minRating،
        // loaned/watched، q (سرچ) و pagination (limit/offset) هر کدوم روی هر
        // درخواست یه full table scan جداگونه (۱۷هزار+ ردیف) بودن. برای
        // آرشیوی به این بزرگی، همین مرور عادی (چند کلیک روی genre/decade/
        // pagination) به‌تنهایی سهمیه‌ی روزانه‌ی رایگان D1 (۵ میلیون ردیف) رو
        // تموم می‌کنه. حالا کل querystring (هر ترکیبی از فیلترها) کش می‌شه —
        // چون این یه آرشیو شخصیه (تک‌کاربره)، بازگرداندن نتیجه‌ی حداکثر
        // ۳ دقیقه‌ای قدیمی مشکلی نداره، و هر نوشتن (افزودن/ویرایش/حذف فیلم)
        // کل این پیشوند رو فوراً invalidate می‌کنه (پایین‌تر توی invalidateFilmsCache).
        const filmsCacheKey = `${FILMS_CACHE_KEY}:${url.search || '?'}`
        if (env.BACKUPS) {
          try {
            const cached = await env.BACKUPS.get(filmsCacheKey, 'json')
            if (cached) {
              const headers = cached.totalCount != null ? { ...corsHeaders, 'X-Total-Count': String(cached.totalCount) } : corsHeaders
              return json(cached.films, 200, headers)
            }
          } catch {}
        }
        let sql = 'SELECT * FROM films WHERE 1=1'
        const params = []

        if (mediaType) { sql += ' AND mediaType = ?'; params.push(mediaType) }
        if (itemType) { sql += ' AND itemType = ?'; params.push(itemType) }
        if (loaned === '1') { sql += ' AND borrowedTo IS NOT NULL AND borrowedTo != \'\'' }
        if (watched === '1') { sql += ' AND watched = 1' }
        if (watched === '0') { sql += ' AND (watched IS NULL OR watched = 0)' }
        if (minRating) { sql += ' AND rating >= ?'; params.push(Number(minRating)) }
        if (shelf) { sql += ' AND shelf = ?'; params.push(shelf) }
        if (closet) { sql += ' AND closet = ?'; params.push(closet) }
        if (drive) {
          // driveNumber ممکنه «7» یا «Drive 7» ذخیره شده باشه، comma-separated
          // هم باشه؛ برای سریال‌ها ممکنه فقط تو seasonDrives (فصل‌های
          // جداگونه) ثبت شده باشه، نه فیلد کلی driveNumber.
          // برای seasonDrives از json_each استفاده می‌کنیم (نه LIKE رو کل
          // رشته‌ی JSON) تا فقط فیلد drive چک بشه، نه seasons — وگرنه یه
          // سریال با seasons «9, 10» اشتباهی جزو drive=10 حساب می‌شد.
          sql += ` AND (
            driveNumber = ? OR driveNumber = ? OR
            driveNumber LIKE ? OR driveNumber LIKE ? OR
            driveNumber LIKE ? OR driveNumber LIKE ? OR
            driveNumber LIKE ? OR driveNumber LIKE ? OR
            (seasonDrives IS NOT NULL AND EXISTS (
              SELECT 1 FROM json_each(seasonDrives) je WHERE
                je.value ->> 'drive' LIKE ?
            ))
          )`
          params.push(
            drive, `Drive ${drive}`,
            `${drive},%`, `Drive ${drive},%`,
            `%, ${drive}`, `%, Drive ${drive}`,
            `%, ${drive},%`, `%, Drive ${drive},%`,
            `%${drive}%`
          )
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

        // Sorting — با pagination، sort=random رو نگه نمی‌داریم چون هر صفحه
        // ORDER BY RANDOM() جدا اجرا می‌شه و باعث تکرار/جاافتادن آیتم بین
        // صفحه‌ها می‌شه؛ به‌جاش می‌فته رو همون ترتیب الفبایی پیش‌فرض.
        const isPaginated = limit != null && limit !== ''
        const effectiveSort = isPaginated && sort === 'random' ? 'title_az' : sort
        if (effectiveSort === 'year_desc') sql += ' ORDER BY year DESC'
        else if (effectiveSort === 'year_asc') sql += ' ORDER BY year ASC'
        else if (effectiveSort === 'rating') sql += ' ORDER BY rating DESC'
        else if (effectiveSort === 'shelf') sql += ' ORDER BY shelf ASC'
        else if (effectiveSort === 'random') sql += ' ORDER BY RANDOM()'
        else if (effectiveSort === 'title_az') {
          // مرتب‌سازی الفبایی، نادیده گرفتن «The» ابتدای عنوان (مثلاً
          // "The Godfather" باید زیر G بره نه T)
          sql += ` ORDER BY (CASE WHEN LOWER(title) LIKE 'the %' THEN SUBSTR(title, 5) ELSE title END) COLLATE NOCASE ASC`
        } else sql += ` ORDER BY (CASE WHEN LOWER(title) LIKE 'the %' THEN SUBSTR(title, 5) ELSE title END) COLLATE NOCASE ASC`

        // برای pagination، شمارش کل (بدون LIMIT) رو با همون WHERE می‌گیریم تا
        // فرانت‌اند بدونه چند صفحه هست — قبل از اضافه‌کردن LIMIT/OFFSET به sql.
        let totalCount = null
        if (isPaginated) {
          const countSql = 'SELECT COUNT(*) as cnt FROM films WHERE 1=1' + sql.slice(sql.indexOf('WHERE 1=1') + 'WHERE 1=1'.length, sql.indexOf(' ORDER BY'))
          const countRow = await db.prepare(countSql).bind(...params).first()
          totalCount = countRow ? countRow.cnt : 0
          const limitNum = Math.min(Math.max(parseInt(limit, 10) || 48, 1), 500)
          const offsetNum = Math.max(parseInt(offset, 10) || 0, 0)
          sql += ' LIMIT ? OFFSET ?'
          params.push(limitNum, offsetNum)
        }

        const result = await db.prepare(sql).bind(...params).all()
        // Parse JSON string fields
        const films = (result.results || []).map(parseFilmRow)
        if (env.BACKUPS) {
          ctx.waitUntil(env.BACKUPS.put(filmsCacheKey, JSON.stringify({ films, totalCount }), { expirationTtl: FILMS_CACHE_TTL }).catch(() => {}))
        }
        const headers = totalCount != null ? { ...corsHeaders, 'X-Total-Count': String(totalCount) } : corsHeaders
        return json(films, 200, headers)
      }

      // ---- GET /api/films/counts ----
      // فقط شمارش هر دسته (فیزیکی/دیجیتال، فیلم/سریال) — برای صفحه‌ی اصلی
      // (کارت‌های Blu-ray Movies, Digital Series, ...). قبلاً این عددها از
      // روی کل آرشیو (allFilmsUnfiltered، فچ کامل ~۴۲ مگابایت با ۱۷٬۰۰۰+
      // ردیف) محاسبه می‌شد که هم کند بود هم گاهی fail می‌شد (سقف کش KV هم
      // ۲۵ مگابایته) و صفحه‌ی اصلی صفر نشون می‌داد. این endpoint فقط
      // COUNT(*) گروه‌بندی‌شده برمی‌گردونه — چند بایت به‌جای چند مگابایت.
      if (method === 'GET' && pathname === '/api/films/counts') {
        const COUNTS_CACHE_KEY = 'filmscounts:v1'
        if (env.BACKUPS) {
          try {
            const cached = await env.BACKUPS.get(COUNTS_CACHE_KEY, 'json')
            if (cached) return json(cached, 200, corsHeaders)
          } catch {}
        }
        const rows = await db
          .prepare('SELECT mediaType, itemType, COUNT(*) as cnt FROM films GROUP BY mediaType, itemType')
          .all()
        const counts = { physical: 0, physicalSeries: 0, digital: 0, digitalMovies: 0, digitalSeries: 0 }
        for (const r of rows.results || []) {
          const isDigital = r.mediaType === 'digital'
          const isSeries = r.itemType === 'series'
          if (isDigital) {
            counts.digital += r.cnt
            if (isSeries) counts.digitalSeries += r.cnt
            else counts.digitalMovies += r.cnt
          } else {
            if (isSeries) counts.physicalSeries += r.cnt
            else counts.physical += r.cnt
          }
        }
        const minYearRow = await db
          .prepare("SELECT MIN(year) as minYear FROM films WHERE year IS NOT NULL AND year > 1880")
          .first()
        counts.minYear = minYearRow && minYearRow.minYear ? minYearRow.minYear : null
        if (env.BACKUPS) {
          try { await env.BACKUPS.put(COUNTS_CACHE_KEY, JSON.stringify(counts), { expirationTtl: 900 }) } catch {}
        }
        return json(counts, 200, corsHeaders)
      }

      // ---- GET /api/films/:id ----
      const detailMatch = pathname.match(/^\/api\/films\/([^/]+)$/)
      if (method === 'GET' && detailMatch) {
        const film = await db.prepare('SELECT * FROM films WHERE id = ?').bind(detailMatch[1]).first()
        if (!film) return json({ error: 'Not found' }, 404, corsHeaders)
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
          film = await enrichFilm(film, key, () => bumpApiUsage('omdb'))
        } catch {}
        try {
          const { extras } = await fetchTmdbExtras(film.imdbId, film.itemType, env)
          applyTmdbExtras(film, extras)
        } catch {}
        if (film.closet && film.row && film.shelf && film.mediaType !== 'digital') {
          const resCap = await db
            .prepare(
              'SELECT SUM(CASE WHEN COALESCE(copies, 1) <= 0 THEN 1 ELSE COALESCE(copies, 1) END) as total FROM films WHERE closet = ? AND row = ? AND shelf = ?'
            )
            .bind(String(film.closet), String(film.row), String(film.shelf))
            .first()
          const existingCopies = Number(resCap?.total || 0)
          const newCopies = Number(film.copies || 1)
          if (existingCopies + newCopies > 60) {
            return json(
              {
                error: `Section capacity exceeded (max 60 copies). C${film.closet} R${film.row} S${film.shelf} already has ${existingCopies} copies; this film has ${newCopies} copies.`,
              },
              400,
              corsHeaders
            )
          }
        }
        await insertFilm(db, film)
        try {
          await syncSharedMetadataToSibling(db, film)
        } catch {}
        await logAudit({ filmId: film.id, filmTitle: film.title, action: 'create' })
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
            if ((k === 'cast' || k === 'genre' || k === 'seasonDrives' || k === 'reviews' || k === 'productionCompanies' || k === 'productionCountries' || k === 'spokenLanguages') && Array.isArray(body[k])) {
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
        if (updated.closet && updated.row && updated.shelf && updated.mediaType !== 'digital') {
          const resCap = await db
            .prepare(
              'SELECT SUM(CASE WHEN COALESCE(copies, 1) <= 0 THEN 1 ELSE COALESCE(copies, 1) END) as total FROM films WHERE closet = ? AND row = ? AND shelf = ? AND id != ?'
            )
            .bind(String(updated.closet), String(updated.row), String(updated.shelf), String(existing.id))
            .first()
          const existingCopies = Number(resCap?.total || 0)
          const newCopies = Number(updated.copies || 1)
          if (existingCopies + newCopies > 60) {
            return json(
              {
                error: `Section capacity exceeded (max 60 copies). C${updated.closet} R${updated.row} S${updated.shelf} already has ${existingCopies} copies; this film has ${newCopies} copies.`,
              },
              400,
              corsHeaders
            )
          }
        }
        await updateFilm(db, updated)
        try {
          await syncSharedMetadataToSibling(db, updated)
        } catch {}
        const changed = {}
        for (const k of EDITABLE) {
          const before = existing[k]
          const after = updated[k]
          if (String(before ?? '') !== String(after ?? '')) {
            changed[k] = [before ?? null, after ?? null]
          }
        }
        if (Object.keys(changed).length > 0) {
          await logAudit({ filmId: updated.id, filmTitle: updated.title, action: 'update', changes: changed })
        }
        // اگه imdbId یا پوستر عوض شد، کش پوسترهای جایگزین (که تا ۳۰ روز
        // معتبره) دیگه معتبر نیست — وگرنه بعد از فیکس یه match اشتباه،
        // همچنان پوستر فیلم قبلی/اشتباه چند هفته نشون داده می‌شه.
        if ('imdbId' in changed || 'poster' in changed) {
          try {
            await db.prepare("DELETE FROM cinema_news_cache WHERE key = ?").bind(`posters:${updated.id}`).run()
          } catch {}
        }
        return json(parseFilmRow(updated), 200, corsHeaders)
      }

      // ---- POST /api/films/reset-locations (admin) ----
      // محل (closet/row/shelf) همه فیلم‌های فیزیکی را خالی می‌کند.
      // قبل از ریست، یک بکاپ از کل جدول در KV ذخیره می‌شود (backup:reset-locations-<ts>)
      // تا بتوان در صورت لزوم بازگردانی کرد. برگشت‌ناپذیر — نیاز به تأیید دارد.
      if (method === 'POST' && pathname === '/api/films/reset-locations') {
        const denied = requireAdmin()
        if (denied) return denied

        const result = await db.prepare('SELECT * FROM films').all()
        const films = (result.results || []).map(parseFilmRow)
        const physical = films.filter((f) => f.mediaType !== 'digital')
        const hadLocation = physical.filter((f) => f.closet || f.row || f.shelf).length

        // بکاپ قبل از تغییر (برای بازگردانی احتمالی)
        if (env.BACKUPS) {
          const ts = new Date().toISOString().replace(/[:.]/g, '-')
          const payload = JSON.stringify({ backedUpAt: new Date().toISOString(), count: films.length, films })
          await env.BACKUPS.put(`backup:reset-locations-${ts}`, payload).catch(() => {})
        }

        // خالی کردن مکان فیلم‌های فیزیکی
        const updated = await db
          .prepare("UPDATE films SET closet = '', row = '', shelf = '', updatedAt = datetime('now') WHERE mediaType != 'digital'")
          .run()

        return json({ reset: updated?.meta?.changes ?? physical.length, physicalCount: physical.length, hadLocation }, 200, corsHeaders)
      }

      // ---- POST /api/films/bulk-move (assign the same location to many films) ----
      if (method === 'POST' && pathname === '/api/films/bulk-move') {
        const denied = requireAuth()
        if (denied) return denied
        const body = await request.json().catch(() => ({}))
        const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x)).filter(Boolean) : []
        if (!ids.length) return json({ error: 'ids are required' }, 400, corsHeaders)
        const closet = String(body.closet || '').trim()
        const row = String(body.row || '').trim()
        const shelf = String(body.shelf || '').trim()
        if (!closet || !row || !shelf) {
          return json({ error: 'closet, row and shelf are required' }, 400, corsHeaders)
        }
        const placeholders = ids.map(() => '?').join(',')
        const existingRes = await db
          .prepare(`SELECT SUM(CASE WHEN COALESCE(copies, 1) <= 0 THEN 1 ELSE COALESCE(copies, 1) END) as total FROM films WHERE closet = ? AND row = ? AND shelf = ? AND id NOT IN (${placeholders})`)
          .bind(closet, row, shelf, ...ids)
          .first()
        const existingCopies = Number(existingRes?.total || 0)
        const movingRes = await db
          .prepare(`SELECT SUM(CASE WHEN COALESCE(copies, 1) <= 0 THEN 1 ELSE COALESCE(copies, 1) END) as total FROM films WHERE id IN (${placeholders})`)
          .bind(...ids)
          .first()
        const movingCopies = Number(movingRes?.total || 0)
        if (existingCopies + movingCopies > 60) {
          return json(
            {
              error: `Section capacity exceeded (max 60 copies). C${closet} R${row} S${shelf} currently has ${existingCopies} copies; moving ${movingCopies} would exceed 60.`,
            },
            400,
            corsHeaders
          )
        }
        const stmt = db.prepare(
          "UPDATE films SET closet = ?, row = ?, shelf = ?, updatedAt = datetime('now') WHERE id = ?"
        )
        const batch = ids.map((id) => stmt.bind(closet, row, shelf, id))
        await db.batch(batch)
        return json({ moved: ids.length }, 200, corsHeaders)
      }

      // ---- POST /api/films/bulk-set-drive (assign the same hard drive to
      // many digital items at once) — برخلاف bulk-move (کمد فیزیکی)، محدودیت
      // ظرفیتی نداره چون حجم هاردها تو دیتابیس ثبت نمی‌شه ----
      if (method === 'POST' && pathname === '/api/films/bulk-set-drive') {
        const denied = requireAuth()
        if (denied) return denied
        const body = await request.json().catch(() => ({}))
        const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x)).filter(Boolean) : []
        if (!ids.length) return json({ error: 'ids are required' }, 400, corsHeaders)
        const driveNumber = String(body.driveNumber || '').trim()
        if (!driveNumber) return json({ error: 'driveNumber is required' }, 400, corsHeaders)
        const placeholders = ids.map(() => '?').join(',')
        const stmt = db.prepare("UPDATE films SET driveNumber = ?, updatedAt = datetime('now') WHERE id = ?")
        const batch = ids.map((id) => stmt.bind(driveNumber, id))
        await db.batch(batch)
        return json({ moved: ids.length }, 200, corsHeaders)
      }

      // ---- DELETE /api/films/:id (permanently remove a film) ----
      const deleteMatch = pathname.match(/^\/api\/films\/([^/]+)$/)
      if (method === 'DELETE' && deleteMatch) {
        const denied = requireAuth()
        if (denied) return denied
        const existing = await db.prepare('SELECT id, title FROM films WHERE id = ?').bind(deleteMatch[1]).first()
        if (!existing) return json({ error: 'not found' }, 404, corsHeaders)
        await db.prepare('DELETE FROM films WHERE id = ?').bind(deleteMatch[1]).run()
        await logAudit({ filmId: existing.id, filmTitle: existing.title, action: 'delete' })
        return json({ deleted: true, id: deleteMatch[1] }, 200, corsHeaders)
      }

      // ---- POST /api/films/:id ("Auto-fill missing details" preview on one existing film) ----
      // این دیگه خودش ذخیره نمی‌کنه — فقط پیش‌نمایش داده‌ی جدید رو برمی‌گردونه
      // تا تو فرم ویرایش نشون داده بشه و کاربر با زدن دکمه‌ی Save صریحاً تأییدش
      // کنه. ذخیره‌ی واقعی از همون مسیر همیشگی PATCH /api/films/:id انجام می‌شه.
      const enrichOneMatch = pathname.match(/^\/api\/films\/([^/]+)$/)
      if (method === 'POST' && enrichOneMatch && enrichOneMatch[1] !== 'enrich' && enrichOneMatch[1] !== 'scan-photo') {
        const denied = requireAuth()
        if (denied) return denied
        const existing = await db.prepare('SELECT * FROM films WHERE id = ?').bind(enrichOneMatch[1]).first()
        if (!existing) return json({ error: 'not found' }, 404, corsHeaders)
        const parsed = parseFilmRow(existing)
        const before = { ...parsed }
        const key = env.OMDB_API_KEY
        let fields = []
        let enriched = parsed
        let tmdbDebug = null
        let verifiedDebug = null
        try {
          // قبل از OMDb: اگه imdbId هنوز معلوم نیست ولی کارگردان معلومه، دقیقاً
          // مثل جستجوی دستی کاربر — با عنوان+سال رو TMDB جستجو می‌کنیم و بین
          // نتایج، اونی که کارگردانش با کارگردان شناخته‌شده یکی هست رو تأیید
          // می‌کنیم.
          if (!parsed.imdbId && parsed.title) {
            try {
              const verifiedImdbId = await findVerifiedImdbId(parsed.title, parsed.year, parsed.director, parsed.itemType, env)
              if (verifiedImdbId) { parsed.imdbId = verifiedImdbId; verifiedDebug = `verified imdbId=${verifiedImdbId}` }
              else verifiedDebug = 'no verified match'
            } catch (e) { verifiedDebug = 'error: ' + String(e) }
          }
          enriched = await enrichFilm(parsed, key, () => bumpApiUsage('omdb'))
          try {
            const { extras, debug } = await fetchTmdbExtras(enriched.imdbId, enriched.itemType, env)
            tmdbDebug = debug
            applyTmdbExtras(enriched, extras)
          } catch (e) {
            tmdbDebug = 'threw: ' + String(e)
          }
          fields = ENRICHABLE_FIELDS.filter(
            (f) => isEmptyMetadata(before[f]) && !isEmptyMetadata(enriched[f])
          )
          // توجه: اینجا دیگه updateFilm/syncSharedMetadataToSibling صدا زده نمی‌شه —
          // فقط پیش‌نمایش برمی‌گردونه، ذخیره‌ی واقعی با دکمه‌ی Save کاربره.
        } catch {
          return json({ ...parsed, _enrichment: { enabled: Boolean(key), fields: [] } }, 200, corsHeaders)
        }
        return json({ ...enriched, _enrichment: { enabled: true, fields, preview: true, tmdbDebug, verifiedDebug } }, 200, corsHeaders)
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
        const GENRES_CACHE_KEY = 'genrescache:v1'
        if (env.BACKUPS) {
          try {
            const cached = await env.BACKUPS.get(GENRES_CACHE_KEY, 'json')
            if (cached) return json(cached, 200, corsHeaders)
          } catch {}
        }
        const result = await db.prepare('SELECT genre FROM films').all()
        const set = new Set()
        for (const row of result.results || []) {
          if (row.genre) {
            try { JSON.parse(row.genre).forEach((g) => set.add(g)) } catch {}
          }
        }
        const genres = [...set].sort()
        if (env.BACKUPS) {
          try { await env.BACKUPS.put(GENRES_CACHE_KEY, JSON.stringify(genres), { expirationTtl: 3600 }) } catch {}
        }
        return json(genres, 200, corsHeaders)
      }

      // ---- GET /api/shelves ----
      if (method === 'GET' && pathname === '/api/shelves') {
        const SHELVES_CACHE_KEY = 'shelvescache:v1'
        if (env.BACKUPS) {
          try {
            const cached = await env.BACKUPS.get(SHELVES_CACHE_KEY, 'json')
            if (cached) return json(cached, 200, corsHeaders)
          } catch {}
        }
        const result = await db.prepare('SELECT DISTINCT shelf FROM films WHERE shelf IS NOT NULL AND shelf != \'\' ORDER BY shelf').all()
        const shelves = (result.results || []).map((r) => r.shelf)
        if (env.BACKUPS) {
          try { await env.BACKUPS.put(SHELVES_CACHE_KEY, JSON.stringify(shelves), { expirationTtl: 3600 }) } catch {}
        }
        return json(shelves, 200, corsHeaders)
      }

      // ---- GET /api/closets ----
      if (method === 'GET' && pathname === '/api/closets') {
        const CLOSETS_CACHE_KEY = 'closetscache:v1'
        if (env.BACKUPS) {
          try {
            const cached = await env.BACKUPS.get(CLOSETS_CACHE_KEY, 'json')
            if (cached) return json(cached, 200, corsHeaders)
          } catch {}
        }
        const result = await db.prepare('SELECT DISTINCT closet FROM films WHERE closet IS NOT NULL AND closet != \'\' ORDER BY CAST(closet AS INTEGER)').all()
        const closets = (result.results || []).map((r) => r.closet)
        if (env.BACKUPS) {
          try { await env.BACKUPS.put(CLOSETS_CACHE_KEY, JSON.stringify(closets), { expirationTtl: 3600 }) } catch {}
        }
        return json(closets, 200, corsHeaders)
      }

      // ---- GET /api/decades ----
      if (method === 'GET' && pathname === '/api/decades') {
        if (env.BACKUPS) {
          try {
            const cached = await env.BACKUPS.get(DECADES_CACHE_KEY, 'json')
            if (cached) return json(cached, 200, corsHeaders)
          } catch {}
        }
        const result = await db.prepare('SELECT DISTINCT CAST(ROUND(year / 10) * 10 AS INTEGER) as decade FROM films WHERE year IS NOT NULL ORDER BY decade').all()
        const decades = (result.results || []).map((r) => r.decade)
        if (env.BACKUPS) {
          try { await env.BACKUPS.put(DECADES_CACHE_KEY, JSON.stringify(decades), { expirationTtl: DECADES_CACHE_TTL }) } catch {}
        }
        return json(decades, 200, corsHeaders)
      }

      // ---- GET /api/omdb-lookup (single-title search for the "Add Film" autofill) ----
      if (method === 'GET' && pathname === '/api/omdb-lookup') {
        const key = env.OMDB_API_KEY
        if (!key) return json({ error: 'OMDB_API_KEY is not set — automatic IMDb lookup unavailable' }, 400, corsHeaders)
        const title = (url.searchParams.get('title') || '').trim()
        if (!title) return json({ error: 'Enter the film title' }, 400, corsHeaders)
        const yearParam = url.searchParams.get('year')
        const before = { title, year: yearParam ? parseInt(yearParam, 10) : undefined }
        try {
          const found = await enrichFilm(before, key, () => bumpApiUsage('omdb'))
          try {
            const { extras } = await fetchTmdbExtras(found.imdbId, found.itemType, env)
            applyTmdbExtras(found, extras)
          } catch {}
          const gotNewData = Object.keys(found).some((k) => !(k in before) || found[k] !== before[k])
          if (!gotNewData) return json({ error: 'No film with this title found on IMDb' }, 404, corsHeaders)
          return json(found, 200, corsHeaders)
        } catch (e) {
          return json({ error: 'Error connecting to OMDb' }, 502, corsHeaders)
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
        let link = (url.searchParams.get('url') || '').trim()
        if (!link) return json({ error: 'Paste an IMDb or Letterboxd link' }, 400, corsHeaders)

        // لینک‌های کوتاه‌شده‌ی موبایلِ Letterboxd (boxd.it/xxxx) رو باز می‌کنیم تا
        // به آدرس کامل letterboxd.com/film/slug/ برسیم.
        if (/boxd\.it\//i.test(link)) {
          try {
            const shortRes = await fetch(link, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CinefilioArchive/1.0; personal film archive app)' } })
            if (shortRes.url) link = shortRes.url
          } catch (e) {
            return json({ error: 'Short link could not be opened' }, 502, corsHeaders)
          }
        }

        // لینک مستقیم TVMaze (tvmaze.com/shows/{id}/...) — مخصوص سریال‌ها،
        // مسیر جدایی از IMDb/Letterboxd داره چون شناسه‌ی TVMaze نیازی به
        // OMDb/TMDB نداره؛ مستقیم از خودِ TVMaze همه‌چیز رو می‌گیریم.
        const tvmazeMatch = link.match(/tvmaze\.com\/shows\/(\d+)/i)
        if (tvmazeMatch) {
          const tvResult = await enrichSeriesFromTVMazeById(tvmazeMatch[1], {})
          if (!tvResult || !tvResult.title) {
            return json({ error: 'Could not find this show on TVMaze' }, 404, corsHeaders)
          }
          tvResult.itemType = 'series'
          return json(tvResult, 200, corsHeaders)
        }

        let imdbId = null
        let base = {}
        // اگه از همون اول لینک Letterboxd باشه، اسلاگش رو نگه می‌داریم تا لازم
        // نباشه بعداً دوباره از روی عنوان حدس بزنیم.
        let letterboxdSlug = null
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
          if (!slugMatch) return json({ error: 'Letterboxd link must be a film page (containing film/...)' }, 400, corsHeaders)
          letterboxdSlug = slugMatch[1]
          try {
            const pageRes = await fetch(`https://letterboxd.com/film/${letterboxdSlug}/`, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CinefilioArchive/1.0; personal film archive app)' },
            })
            if (!pageRes.ok) return json({ error: 'Letterboxd page not found' }, 404, corsHeaders)
            const html = await pageRes.text()
            const imdbMatch = html.match(/imdb\.com\/title\/(tt\d+)/i)
            imdbId = imdbMatch ? imdbMatch[1] : null
            base = parseLetterboxdBasic(html)
            if (imdbId) base.imdbId = imdbId
            if (!base.title) return json({ error: 'Could not extract data from this Letterboxd page' }, 404, corsHeaders)
          } catch (e) {
            return json({ error: 'Error connecting to Letterboxd' }, 502, corsHeaders)
          }
        } else {
          return json({ error: 'Link must be from IMDb or Letterboxd' }, 400, corsHeaders)
        }
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

        // آخرین مرحله، صرف‌نظر از اینکه اطلاعات از کدوم منبع اومده (OMDb یا TMDB):
        // اگه director/cast هنوز خالیه، همون کاری که برای امتیاز Letterboxd
        // می‌کنیم رو تکرار می‌کنیم — از روی عنوان+سال اسلاگ Letterboxd رو حدس
        // می‌زنیم (یا اگه از همون اول لینک Letterboxd بود، مستقیم همون صفحه رو)
        // و هر فیلد خالی رو از اونجا پر می‌کنیم. فقط جای‌خالی‌ها رو پر می‌کنه،
        // چیزی که از OMDb/TMDB اومده رو دست نمی‌زنه.
        const fillMissingFromLetterboxd = async (film) => {
          const needsMore = !film.director || !Array.isArray(film.cast) || film.cast.length === 0 || !film.synopsis
          if (!needsMore) return film
          const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; CinefilioArchive/1.0; personal film archive app)' }
          const slugCandidates = letterboxdSlug
            ? [letterboxdSlug]
            : (() => {
                const guessed = titleToLetterboxdSlug(film.title)
                if (!guessed) return []
                return film.year ? [guessed, `${guessed}-${film.year}`] : [guessed]
              })()
          for (const slug of slugCandidates) {
            try {
              const pageRes = await fetch(`https://letterboxd.com/film/${slug}/`, { headers })
              if (!pageRes.ok) continue
              const html = await pageRes.text()
              const scraped = parseLetterboxdBasic(html)
              if (!scraped.title) continue
              if (!film.director && scraped.director) film.director = scraped.director
              if ((!Array.isArray(film.cast) || film.cast.length === 0) && scraped.cast) film.cast = scraped.cast
              if (!film.synopsis && scraped.synopsis) film.synopsis = scraped.synopsis
              if (!film.year && scraped.year) film.year = scraped.year
              break
            } catch {
              // این اسلاگ جواب نداد؛ اسلاگ بعدی رو امتحان می‌کنیم
            }
          }
          return film
        }

        let result = null
        let errorResponse = null

        if (!key) {
          if (base.title) {
            result = base
          } else {
            const tmdbFallback = await tmdbAsFullFallback(base.imdbId)
            if (tmdbFallback) result = tmdbFallback
            else errorResponse = json({ error: 'OMDB_API_KEY is not set — automatic lookup from IMDb link unavailable' }, 400, corsHeaders)
          }
        } else {
          try {
            const found = await enrichFilm(base, key, () => bumpApiUsage('omdb'))
            if (found.title) {
              result = found
            } else {
              const tmdbFallback = await tmdbAsFullFallback(base.imdbId)
              if (tmdbFallback) result = tmdbFallback
              else errorResponse = json({ error: 'This film isn\'t in OMDb or TMDB yet — enter title/year manually' }, 404, corsHeaders)
            }
          } catch (e) {
            if (base.title) {
              result = base
            } else {
              const tmdbFallback = await tmdbAsFullFallback(base.imdbId)
              if (tmdbFallback) result = tmdbFallback
              else if (e.code === 'OMDB_QUOTA_EXCEEDED') errorResponse = json({ error: 'OMDb daily quota reached — try again tomorrow' }, 429, corsHeaders)
              else errorResponse = json({ error: 'Error connecting to OMDb' }, 502, corsHeaders)
            }
          }
        }

        if (errorResponse) return errorResponse
        // این دو مرحله مستقل از همدیگه‌ن (یکی پوستر رو از TMDB می‌گیره، اون یکی
        // director/cast/synopsis رو از Letterboxd) — موازی اجراشون می‌کنیم تا
        // زمان کل درخواست کمتر بشه و به سقف زمانی Worker نخوریم.
        await Promise.all([addTmdbPosterFallback(result), fillMissingFromLetterboxd(result)])
        return json(result, 200, corsHeaders)
      }

      // ---- GET /api/actor-photo (photo + bio + age/height/spouse/children, cached in D1) ----
      if (method === 'GET' && pathname === '/api/actor-photo') {
        const name = (url.searchParams.get('name') || '').trim()
        if (!name) return json(emptyPersonInfo(), 200, corsHeaders)
        const cacheKey = name.toLowerCase()

        try {
          const cached = await db
            .prepare('SELECT photo, bio, birthDate, deathDate, height, spouse, children, imdbId, letterboxdUrl, interviewLinks FROM people_photos WHERE name = ?')
            .bind(cacheKey)
            .first()
          // اگه ردیف وجود داره ولی هیچ دیتای واقعی‌ای نداره (مثلاً فقط از مسیر
          // ثبت لینک مصاحبه ساخته شده)، کش معتبر نیست — باید دوباره fetch بشه؛
          // وگرنه این آدم برای همیشه بدون عکس/بیو می‌مونه.
          const cacheHasData = cached && (cached.photo || cached.bio || cached.birthDate)
          if (cacheHasData) {
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
                info.imdbId = wd.imdbId
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

          info.letterboxdUrl = await resolveLetterboxdPersonUrl(name)

          // اگه ویکی‌پدیا هیچی برنگردوند (نه عکس نه بیو نه تاریخ تولد) احتمالاً
          // یه مشکل موقتی بوده (نه این‌که واقعاً صفحه‌ای نداره) — کش نکن، دفعه‌ی
          // بعد که PersonModal باز شد دوباره امتحان می‌کنیم به‌جای این‌که برای
          // همیشه یه نتیجه‌ی خالی رو نگه داریم.
          const gotAnyData = info.photo || info.bio || info.birthDate
          if (!gotAnyData) {
            return json({ ...info, age: null }, 200, corsHeaders)
          }

          await db
            .prepare(
              'INSERT OR REPLACE INTO people_photos (name, photo, bio, birthDate, deathDate, height, spouse, children, imdbId, letterboxdUrl, interviewLinks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .bind(
              cacheKey,
              info.photo,
              info.bio,
              info.birthDate,
              info.deathDate,
              info.height,
              info.spouse,
              info.children,
              info.imdbId,
              info.letterboxdUrl,
              cached?.interviewLinks ?? null // INSERT OR REPLACE کل ردیف رو عوض می‌کنه؛ اگه لینک مصاحبه‌ای قبلاً ثبت شده بود، اینجا حفظش می‌کنیم
            )
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

      // ---- GET /api/director-extras (awards + high-rated films missing from
      // the archive, for the director info panel). Cached 30 days in D1 —
      // both Wikidata (awards) and TMDB+OMDb+Letterboxd (recommendations)
      // lookups are heavy, so we don't want to redo them on every open. ----
      if (method === 'GET' && pathname === '/api/director-extras') {
        const name = (url.searchParams.get('name') || '').trim()
        if (!name) return json({ awards: [], recommendations: [] }, 200, corsHeaders)
        const cacheKey = name.toLowerCase()

        try {
          const cached = await db
            .prepare('SELECT awards, recommendations, fetchedAt FROM director_extras WHERE name = ?')
            .bind(cacheKey)
            .first()
          // اگه هم awards و هم recommendations خالی باشن، احتمالاً یه fetch
          // (مثلاً به‌خاطر quota تموم‌شده‌ی OMDb) شکست خورده — به‌جای TTL کامل
          // ۳۰ روزه، فقط ۱ روز نگهش می‌داریم تا خودش دوباره امتحان کنه.
          const isEmpty =
            (JSON.parse(cached?.awards || '[]').length === 0) && (JSON.parse(cached?.recommendations || '[]').length === 0)
          const ttl = isEmpty ? 1 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000
          const cacheFresh = cached?.fetchedAt && Date.now() - new Date(cached.fetchedAt).getTime() < ttl
          if (cacheFresh) {
            return json(
              { awards: JSON.parse(cached.awards || '[]'), recommendations: JSON.parse(cached.recommendations || '[]') },
              200,
              corsHeaders
            )
          }

          const [awards, recommendations] = await Promise.all([
            fetchDirectorAwards(name),
            fetchDirectorRecommendations(db, name, env),
          ])

          await db
            .prepare(
              "INSERT OR REPLACE INTO director_extras (name, awards, recommendations, fetchedAt) VALUES (?, ?, ?, datetime('now'))"
            )
            .bind(cacheKey, JSON.stringify(awards), JSON.stringify(recommendations))
            .run()

          return json({ awards, recommendations }, 200, corsHeaders)
        } catch (e) {
          return json({ awards: [], recommendations: [] }, 200, corsHeaders)
        }
      }

      // ---- GET /api/films/:id/collection — مجموعه‌ی TMDB این فیلم (اگه عضو یکی باشه) + کدوماشون تو آرشیو هست ----
      const collectionMatch = pathname.match(/^\/api\/films\/([^/]+)\/collection$/)
      if (method === 'GET' && collectionMatch) {
        try {
          const film = await db.prepare('SELECT * FROM films WHERE id = ?').bind(collectionMatch[1]).first()
          if (!film) return json({ collection: null }, 200, corsHeaders)

          const resolved = await resolveFilmCollection(db, env, film)
          if (!resolved) return json({ collection: null }, 200, corsHeaders)

          const details = await fetchCollectionDetails(db, env, resolved.collectionId)
          if (!details) return json({ collection: null }, 200, corsHeaders)

          // چک کن کدوم فیلم‌های مجموعه از قبل تو آرشیو هستن (بر اساس عنوان+سال،
          // نادیده گرفتن "The" مثل بقیه‌ی جاهای اپ؛ فاصله‌های تکراری/کوتیشن‌های
          // فرقی هم نادیده گرفته می‌شن تا یه ویرایش جزئی عنوان match رو خراب نکنه)
          const normTitle = (t) =>
            (t || '')
              .toLowerCase()
              .replace(/[\u2018\u2019]/g, "'")
              .replace(/[\u201c\u201d]/g, '"')
              .replace(/\s+/g, ' ')
              .replace(/^the\s+/, '')
              .trim()
          const allTitlesRes = await db.prepare('SELECT id, title, year FROM films').all()
          const archiveIndex = new Map()
          for (const f of allTitlesRes.results || []) {
            archiveIndex.set(`${normTitle(f.title)}::${f.year || ''}`, f.id)
          }
          const parts = details.parts.map((p) => {
            const archiveFilmId = archiveIndex.get(`${normTitle(p.title)}::${p.year || ''}`) || null
            return { ...p, inArchive: !!archiveFilmId, archiveFilmId }
          })

          return json({ collection: { ...details, parts } }, 200, corsHeaders)
        } catch (e) {
          return json({ collection: null, error: String(e) }, 200, corsHeaders)
        }
      }

      // ---- GET /api/films/:id/alt-posters — پوسترهای جایگزین از TMDB برای اسلایدشوی گرید ----
      const altPostersMatch = pathname.match(/^\/api\/films\/([^/]+)\/alt-posters$/)
      if (method === 'GET' && altPostersMatch) {
        try {
          const film = await db.prepare('SELECT id, imdbId, itemType FROM films WHERE id = ?').bind(altPostersMatch[1]).first()
          if (!film) return json({ posters: [] }, 200, corsHeaders)
          const posters = await fetchAltPosters(db, env, film)
          return json({ posters }, 200, corsHeaders)
        } catch (e) {
          return json({ posters: [], error: String(e) }, 200, corsHeaders)
        }
      }

      // ---- POST/GET /api/admin/poster-audit?start=1 — اسکن کل آرشیو برای
      // لینک پوستر خراب. Cloudflare Workers سقف subrequest به‌ازای هر
      // invocation داره — قبلاً کل ۱۷هزار+ فیلم تو یه invocation پیوسته چک
      // می‌شد و به محض رد شدن از سقف، همه‌ی بقیه‌ش با خطای «Too many
      // subrequests» به‌اشتباه «خراب» ثبت می‌شد. الان تکه‌تکه پیش می‌ره: این
      // فقط اولین تکه رو پردازش می‌کنه و وضعیت رو «running» می‌ذاره؛ یه
      // کرون هر-۱-دقیقه (wrangler.jsonc) بقیه‌ی تکه‌ها رو خودکار ادامه
      // می‌ده تا تموم بشه (هر تیک کرون = یه invocation جدید و مستقل).
      // بدون query param start، همون GET فقط وضعیت/نتیجه‌ی فعلی رو می‌ده.
      if (pathname === '/api/admin/poster-audit') {
        if (url.searchParams.get('start') === '1') {
          const authErr = requireAuth()
          if (authErr) return authErr
          await db
            .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES ('poster_audit', ?, datetime('now'))")
            .bind(JSON.stringify({ status: 'running', total: 0, checked: 0, broken: [], _offset: 0 }))
            .run()
          ctx.waitUntil(runPosterAuditChunk(db))
          return json({ started: true }, 200, corsHeaders)
        }
        try {
          const row = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('poster_audit').first()
          if (!row) return json({ status: 'not_started' }, 200, corsHeaders)
          const { _offset, ...publicData } = JSON.parse(row.data)
          return json({ ...publicData, updatedAt: row.fetchedAt }, 200, corsHeaders)
        } catch (e) {
          return json({ status: 'error', error: String(e) }, 200, corsHeaders)
        }
      }

      // ---- GET /api/films/:id/festival-awards — جوایز جشنواره‌ای، خودکار از Wikidata ----
      const awardsMatch = pathname.match(/^\/api\/films\/([^/]+)\/festival-awards$/)
      if (method === 'GET' && awardsMatch) {
        try {
          const film = await db.prepare('SELECT * FROM films WHERE id = ?').bind(awardsMatch[1]).first()
          if (!film) return json({ awards: [] }, 200, corsHeaders)
          const awards = await resolveFestivalAwards(db, env, film)
          return json({ awards }, 200, corsHeaders)
        } catch (e) {
          return json({ awards: [], error: String(e) }, 200, corsHeaders)
        }
      }

      // ---- GET /api/films/:id/shooting-location — لوکیشن فیلم‌برداری، خودکار از Wikidata ----
      const locationMatch = pathname.match(/^\/api\/films\/([^/]+)\/shooting-location$/)
      if (method === 'GET' && locationMatch) {
        try {
          const film = await db.prepare('SELECT * FROM films WHERE id = ?').bind(locationMatch[1]).first()
          if (!film) return json({ shootingLocation: null }, 200, corsHeaders)
          const shootingLocation = await resolveShootingLocation(db, env, film)
          return json({ shootingLocation }, 200, corsHeaders)
        } catch (e) {
          return json({ shootingLocation: null, error: String(e) }, 200, corsHeaders)
        }
      }

      // ---- GET /api/films/:id/book-adaptation — اقتباس از کتاب، خودکار از Wikidata ----
      const bookMatch = pathname.match(/^\/api\/films\/([^/]+)\/book-adaptation$/)
      if (method === 'GET' && bookMatch) {
        try {
          const film = await db.prepare('SELECT * FROM films WHERE id = ?').bind(bookMatch[1]).first()
          if (!film) return json({ basedOnBook: null, bookAuthor: null }, 200, corsHeaders)
          const resolved = await resolveBookAdaptation(db, env, film)
          return json(resolved || { basedOnBook: null, bookAuthor: null }, 200, corsHeaders)
        } catch (e) {
          return json({ basedOnBook: null, bookAuthor: null, error: String(e) }, 200, corsHeaders)
        }
      }

      // ---- GET /api/collections — همه‌ی مجموعه‌هایی که حداقل یه فیلمشون تو آرشیو هست ----
      if (method === 'GET' && pathname === '/api/collections') {
        try {
          const result = await db
            .prepare(
              `SELECT collectionId, collectionName, collectionPoster, COUNT(*) as ownedCount
               FROM films WHERE collectionId IS NOT NULL AND collectionId != ''
               GROUP BY collectionId ORDER BY ownedCount DESC, collectionName ASC`
            )
            .all()
          return json(result.results || [], 200, corsHeaders)
        } catch (e) {
          return json([], 200, corsHeaders)
        }
      }

      // ---- GET /api/cinema-news (بخش «اخبار سینما» توی صفحه‌ی اصلی: تولدهای
      // امروزِ اهالی کالکشن + فیلم/سریال‌های در راهِ اونا + تریلرهای تازه‌ی
      // هالیوود. سه بخش موازی fetch می‌شن، هرکدوم جدا کش می‌شن. ----
      // ---- GET /api/tmdb-director?id=X&type=movie|tv (فقط برای دکمه‌ی Order وقتی
      // خودِ آیتم کارگردان رو از قبل نداره — یه lookup سبک و لحظه‌ای) ----
      if (method === 'GET' && pathname === '/api/tmdb-director') {
        const tmdbId = url.searchParams.get('id')
        const mediaType = url.searchParams.get('type') === 'tv' ? 'tv' : 'movie'
        if (!tmdbId || !env.TMDB_API_KEY) return json({ director: null }, 200, corsHeaders)
        try {
          const tmdbKey = env.TMDB_API_KEY
          async function tmdbGet(path) {
            const attempts = [
              { url: `https://api.themoviedb.org/3${path}?api_key=${encodeURIComponent(tmdbKey)}`, headers: { accept: 'application/json' } },
              { url: `https://api.themoviedb.org/3${path}`, headers: { Authorization: `Bearer ${tmdbKey}`, accept: 'application/json' } },
            ]
            for (const a of attempts) {
              try {
                const res = await fetch(a.url, { headers: a.headers })
                if (res.ok) return await res.json()
              } catch {}
            }
            return null
          }
          const credits = await tmdbGet(`/${mediaType}/${tmdbId}/credits`)
          const crew = credits?.crew || []
          const director =
            crew.find((c) => c.job === 'Director')?.name ||
            (mediaType === 'tv' ? crew.find((c) => c.job === 'Series Director' || c.department === 'Directing')?.name : null) ||
            null
          return json({ director }, 200, corsHeaders)
        } catch (e) {
          return json({ director: null }, 200, corsHeaders)
        }
      }

      // ---- لیست سفارش (Order List) — عناوینی که از دکمه‌ی Order اضافه شدن ----
      // ---- GET /api/debug/checks — تست سریع سلامت هرکدوم از سرویس‌های بیرونی
      // (OMDb, TMDB, Letterboxd) که پیشنهادهای کارگردان بهشون وابسته‌ست. فقط
      // برای لاگین‌شده‌ها، صرفاً تشخیصیه و بعد از رفع مشکل قابل حذفه. ----
      // ---- GET /api/image-proxy?url=... — تصاویری که مستقیم رو مرورگر کاربر
      // بلوکه (مثلاً image.tmdb.org که از بعضی شبکه‌ها/ایران بدون VPN باز نمی‌شه)
      // رو از سمت Worker می‌گیره و برمی‌گردونه، چون خودِ Workers بهشون دسترسی داره.
      // فقط دامنه‌های شناخته‌شده و امن (TMDB, Wikipedia/Wikimedia) مجازن.
      // ---- GET /api/usage-stats (admin) — تاریخچه‌ی ۳۰ روز اخیر مصرف API ----
      if (method === 'GET' && pathname === '/api/usage-stats') {
        const denied = requireAdmin()
        if (denied) return denied
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const result = await db
          .prepare('SELECT date, service, count FROM api_usage_daily WHERE date >= ? ORDER BY date ASC')
          .bind(cutoff)
          .all()
        return json({ rows: result.results || [], omdbDailyLimit: 1000 }, 200, corsHeaders)
      }

      if (method === 'GET' && pathname === '/api/debug/checks') {
        const denied = requireAuth()
        if (denied) return denied

        const out = { omdb: null, tmdb: null, letterboxd: null, usage: null }

        try {
          const today = new Date().toISOString().slice(0, 10)
          const usageRes = await db.prepare('SELECT service, count FROM api_usage_daily WHERE date = ?').bind(today).all()
          const OMDB_DAILY_LIMIT = 1000
          const rows = usageRes.results || []
          const omdbCount = rows.find((r) => r.service === 'omdb')?.count || 0
          out.usage = {
            date: today,
            omdb: {
              count: omdbCount,
              limit: OMDB_DAILY_LIMIT,
              remaining: Math.max(0, OMDB_DAILY_LIMIT - omdbCount),
              warning: omdbCount >= OMDB_DAILY_LIMIT * 0.8,
            },
          }
        } catch (e) {
          out.usage = { error: String(e) }
        }

        try {
          const res = await fetch(`https://www.omdbapi.com/?apikey=${env.OMDB_API_KEY}&t=Mean%20Streets&y=1973&type=movie`, {
            signal: AbortSignal.timeout(8000),
          })
          const data = await res.json().catch(() => null)
          out.omdb = { httpStatus: res.status, keyPresent: !!env.OMDB_API_KEY, body: data }
        } catch (e) {
          out.omdb = { error: String(e), keyPresent: !!env.OMDB_API_KEY }
        }

        try {
          const tmdbKey = env.TMDB_API_KEY
          const res = await fetch(`https://api.themoviedb.org/3/search/person?query=Martin%20Scorsese&api_key=${encodeURIComponent(tmdbKey || '')}`, {
            headers: { accept: 'application/json' },
          })
          const data = await res.json().catch(() => null)
          out.tmdb = { httpStatus: res.status, keyPresent: !!tmdbKey, resultCount: data?.results?.length ?? null, error: data?.status_message || null }
        } catch (e) {
          out.tmdb = { error: String(e), keyPresent: !!env.TMDB_API_KEY }
        }

        try {
          const res = await fetch('https://letterboxd.com/film/mean-streets/', {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CinefilioArchive/1.0; personal film archive app)' },
          })
          const html = res.ok ? await res.text() : ''
          const match = html.match(/name="twitter:data2"\s+content="([\d.]+)\s+out of 5"/)
          out.letterboxd = { httpStatus: res.status, ratingFound: match ? parseFloat(match[1]) : null }
        } catch (e) {
          out.letterboxd = { error: String(e) }
        }

        return json(out, 200, corsHeaders)
      }

      // ---- GET /api/audit-log — تاریخچه‌ی تغییرات (کی چی رو کی تغییر داد) ----
      if (method === 'GET' && pathname === '/api/audit-log') {
        const denied = requireAuth()
        if (denied) return denied
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 500)
        const filmId = url.searchParams.get('filmId')
        let result
        if (filmId) {
          result = await db
            .prepare('SELECT * FROM audit_log WHERE filmId = ? ORDER BY changedAt DESC LIMIT ?')
            .bind(filmId, limit)
            .all()
        } else {
          result = await db.prepare('SELECT * FROM audit_log ORDER BY changedAt DESC LIMIT ?').bind(limit).all()
        }
        const rows = (result.results || []).map((r) => ({ ...r, changes: r.changes ? JSON.parse(r.changes) : null }))
        return json(rows, 200, corsHeaders)
      }

      if (method === 'GET' && pathname === '/api/order-list') {        try {
          const result = await db.prepare('SELECT * FROM order_list ORDER BY addedAt DESC').all()
          return json(result.results || [], 200, corsHeaders)
        } catch (e) {
          return json([], 200, corsHeaders)
        }
      }

      if (method === 'POST' && pathname === '/api/order-list') {
        const denied = requireAuth()
        if (denied) return denied
        try {
          const body = await request.json()
          const title = (body.title || '').trim()
          if (!title) return json({ error: 'title is required' }, 400, corsHeaders)
          // اگه از قبل هست دوباره اضافه نکن
          const existing = await db.prepare('SELECT id FROM order_list WHERE LOWER(title) = ?').bind(title.toLowerCase()).first()
          if (existing) return json({ id: existing.id, alreadyExists: true }, 200, corsHeaders)
          const id = crypto.randomUUID()
          await db
            .prepare('INSERT INTO order_list (id, title, releaseDate, source, director) VALUES (?, ?, ?, ?, ?)')
            .bind(id, title, body.releaseDate || null, body.source || null, body.director || null)
            .run()
          return json({ id, alreadyExists: false }, 200, corsHeaders)
        } catch (e) {
          return json({ error: 'Failed to add to order list' }, 500, corsHeaders)
        }
      }

      if (method === 'DELETE' && pathname.startsWith('/api/order-list/')) {
        const denied = requireAuth()
        if (denied) return denied
        const id = pathname.split('/').pop()
        try {
          await db.prepare('DELETE FROM order_list WHERE id = ?').bind(id).run()
          return json({ ok: true }, 200, corsHeaders)
        } catch (e) {
          return json({ error: 'Failed to remove' }, 500, corsHeaders)
        }
      }

      // ---- هنرمندهای دنبال‌شده (کارگردان/بازیگر) ----
      if (method === 'GET' && pathname === '/api/followed') {
        try {
          const result = await db.prepare('SELECT * FROM followed_people ORDER BY addedAt DESC').all()
          return json(result.results || [], 200, corsHeaders)
        } catch (e) {
          return json([], 200, corsHeaders)
        }
      }

      if (method === 'POST' && pathname === '/api/followed') {
        const denied = requireAuth()
        if (denied) return denied
        try {
          const body = await request.json()
          const name = (body.name || '').trim()
          if (!name) return json({ error: 'name is required' }, 400, corsHeaders)
          await db
            .prepare('INSERT INTO followed_people (name, type, photo) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING')
            .bind(name, body.type || null, body.photo || null)
            .run()
          return json({ ok: true }, 200, corsHeaders)
        } catch (e) {
          return json({ error: 'Failed to follow' }, 500, corsHeaders)
        }
      }

      if (method === 'DELETE' && pathname.startsWith('/api/followed/')) {
        const denied = requireAuth()
        if (denied) return denied
        const name = decodeURIComponent(pathname.split('/').pop())
        try {
          await db.prepare('DELETE FROM followed_people WHERE name = ?').bind(name).run()
          return json({ ok: true }, 200, corsHeaders)
        } catch (e) {
          return json({ error: 'Failed to unfollow' }, 500, corsHeaders)
        }
      }

      // ---- لینک‌های مصاحبه‌ی دستی برای هر هنرمند (ذخیره روی people_photos) ----
      if (method === 'POST' && pathname === '/api/interview-links') {
        const denied = requireAuth()
        if (denied) return denied
        try {
          const body = await request.json()
          const name = (body.name || '').trim()
          if (!name) return json({ error: 'name is required' }, 400, corsHeaders)
          const links = Array.isArray(body.links) ? body.links : []
          const existing = await db.prepare('SELECT name FROM people_photos WHERE name = ?').bind(name).first()
          if (existing) {
            await db.prepare('UPDATE people_photos SET interviewLinks = ? WHERE name = ?').bind(JSON.stringify(links), name).run()
          } else {
            await db.prepare('INSERT INTO people_photos (name, interviewLinks) VALUES (?, ?)').bind(name, JSON.stringify(links)).run()
          }
          return json({ ok: true }, 200, corsHeaders)
        } catch (e) {
          return json({ error: 'Failed to save interview links' }, 500, corsHeaders)
        }
      }

      // ---- GET /api/acclaimed-unseen (فیلم‌های پرامتیاز TMDB که تو آرشیو نیستن) ----
      if (method === 'GET' && pathname === '/api/acclaimed-unseen') {
        try {
          if (!env.TMDB_API_KEY) return json([], 200, corsHeaders)
          const ACCLAIMED_CACHE_KEY = 'acclaimedcache:v1'
          if (env.BACKUPS) {
            try {
              const cached = await env.BACKUPS.get(ACCLAIMED_CACHE_KEY, 'json')
              if (cached) return json(cached, 200, corsHeaders)
            } catch {}
          }
          const tmdbKey = env.TMDB_API_KEY
          const existingRows = await db.prepare('SELECT LOWER(TRIM(REPLACE(title, char(8217), char(39)))) AS t, year FROM films').all()
          const existingKeys = new Set((existingRows.results || []).map((r) => `${r.t}::${r.year || ''}`))
          const acclaimed = []
          for (let page = 1; page <= 2 && acclaimed.length < 20; page++) {
            const res = await fetch(`https://api.themoviedb.org/3/movie/top_rated?api_key=${tmdbKey}&page=${page}`)
            if (!res.ok) break
            const data = await res.json()
            for (const m of data.results || []) {
              const title = (m.title || '').toLowerCase().trim().replace(/\u2019/g, "'")
              const year = m.release_date ? Number(m.release_date.slice(0, 4)) : null
              if (existingKeys.has(`${title}::${year || ''}`)) continue
              acclaimed.push({
                tmdbId: m.id,
                title: m.title,
                year,
                rating: m.vote_average,
                votes: m.vote_count,
                poster: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null,
              })
              if (acclaimed.length >= 20) break
            }
          }
          if (env.BACKUPS) {
            try { await env.BACKUPS.put(ACCLAIMED_CACHE_KEY, JSON.stringify(acclaimed), { expirationTtl: 21600 }) } catch {}
          }
          return json(acclaimed, 200, corsHeaders)
        } catch (e) {
          return json([], 200, corsHeaders)
        }
      }

      // ---- GET /api/tmdb-backdrops?title=X&year=Y&type=movie|tv (عکس‌های پشت‌صحنه/استیل) ----
      if (method === 'GET' && pathname === '/api/tmdb-backdrops') {
        try {
          if (!env.TMDB_API_KEY) return json({ backdrops: [] }, 200, corsHeaders)
          const tmdbKey = env.TMDB_API_KEY
          const title = url.searchParams.get('title')
          const year = url.searchParams.get('year')
          const type = url.searchParams.get('type') === 'series' || url.searchParams.get('type') === 'tv' ? 'tv' : 'movie'
          if (!title) return json({ backdrops: [] }, 200, corsHeaders)
          const searchUrl = `https://api.themoviedb.org/3/search/${type}?api_key=${tmdbKey}&query=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}`
          const searchRes = await fetch(searchUrl)
          if (!searchRes.ok) return json({ backdrops: [] }, 200, corsHeaders)
          const searchData = await searchRes.json()
          const hit = (searchData.results || [])[0]
          if (!hit) return json({ backdrops: [] }, 200, corsHeaders)
          const res = await fetch(`https://api.themoviedb.org/3/${type}/${hit.id}/images?api_key=${tmdbKey}`)
          if (!res.ok) return json({ backdrops: [] }, 200, corsHeaders)
          const data = await res.json()
          const backdrops = (data.backdrops || [])
            .slice(0, 12)
            .map((b) => `https://image.tmdb.org/t/p/w780${b.file_path}`)
          return json({ backdrops }, 200, corsHeaders)
        } catch (e) {
          return json({ backdrops: [] }, 200, corsHeaders)
        }
      }

      if (method === 'GET' && pathname === '/api/cinema-news') {
        try {
          const [birthdays, upcoming, trailers, headlines, headlinesFa, generalUpcoming, trending, trendingPeople, bornTodayGeneralRaw, festivals] =
            await Promise.all([
              fetchTodaysBirthdays(db),
              fetchUpcomingFromCollection(db, env),
              fetchTrendingTrailers(db, env),
              fetchCinemaHeadlines(db),
              fetchCinemaHeadlinesFa(db),
              fetchGeneralUpcoming(db, env),
              fetchTrendingAndBoxOffice(db, env),
              fetchTrendingPeople(db, env),
              fetchBornTodayGeneral(db),
              fetchFestivalCalendar(db),
            ])
          // اونایی که تو «تولدهای امروزِ کالکشن» هستن رو از لیست عمومی حذف کن که یه
          // آدم دوبار نیاد. birthdays فقط از people_photos (کشِ PersonModal) میاد،
          // پس ممکنه یه نفر تو آرشیو باشه ولی صفحه‌ش هنوز باز نشده و اونجا نباشه —
          // برای همین برای بقیه‌ی لیست عمومی هم مستقیم تو films چک می‌کنیم که واقعاً
          // تو آرشیو نیستن، نه فقط تو کشِ عکس.
          const collectionNames = new Set(birthdays.map((b) => b.name.toLowerCase()))
          const bornTodayGeneral = []
          for (const p of bornTodayGeneralRaw) {
            const nameLower = p.name.toLowerCase()
            if (collectionNames.has(nameLower)) continue
            let inCollection = false
            try {
              const like = `%${nameLower}%`
              const filmsRes = await db
                .prepare('SELECT title FROM films WHERE LOWER(director) LIKE ? OR LOWER("cast") LIKE ? LIMIT 3')
                .bind(like, like)
                .all()
              const rows = filmsRes.results || []
              if (rows.length) {
                inCollection = true
                birthdays.push({ name: p.name, photo: p.photo || null, age: p.age, films: rows.map((f) => f.title) })
                collectionNames.add(nameLower)
              }
            } catch {}
            if (!inCollection) bornTodayGeneral.push(p)
          }

          // برای نمایش «آخرین بروزرسانی» بالای بخش اخبار
          let newsUpdatedAt = null
          try {
            const newsMeta = await db
              .prepare("SELECT fetchedAt FROM cinema_news_cache WHERE key IN ('headlines','headlines_fa') ORDER BY fetchedAt DESC LIMIT 1")
              .first()
            newsUpdatedAt = newsMeta?.fetchedAt || null
          } catch {}

          return json(
            { birthdays, upcoming, trailers, headlines, headlinesFa, generalUpcoming, trending, trendingPeople, bornTodayGeneral, newsUpdatedAt, festivals },
            200,
            corsHeaders
          )
        } catch (e) {
          return json(
            {
              birthdays: [],
              upcoming: [],
              trailers: [],
              headlines: [],
              headlinesFa: [],
              generalUpcoming: { movies: [], series: [] },
              trending: { trendingMoviesWeek: [], trendingSeriesWeek: [], popularMonth: [], boxOffice: [] },
              trendingPeople: [],
              bornTodayGeneral: [],
              festivals: [],
            },
            200,
            corsHeaders
          )
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
          return json({ error: 'Invalid request body' }, 400, corsHeaders)
        }
        const username = (body.username || '').trim().replace(/^@/, '')
        if (!username) return json({ error: 'Letterboxd username is required' }, 400, corsHeaders)

        let xml
        try {
          const res = await fetch(`https://letterboxd.com/${encodeURIComponent(username)}/rss/`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CinefilioArchive/1.0)' },
          })
          if (!res.ok) return json({ error: `Letterboxd username not found or feed unavailable (${res.status})` }, 400, corsHeaders)
          xml = await res.text()
        } catch {
          return json({ error: 'Failed to connect to Letterboxd' }, 502, corsHeaders)
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

      // ---- POST /api/films/scan-photo (عکس از قفسه/جلد بلوری‌ها، تشخیص
      // عنوان‌ها با Cloudflare Workers AI — مستقیم روی زیرساخت خود Cloudflare
      // اجرا می‌شه (نه یه fetch بیرونی به یه شرکت دیگه)، پس محدودیت جغرافیایی
      // ندارد. فقط لیست {title, year} برمی‌گردونه؛ افزودن واقعی فیلم‌ها با
      // POST /api/films معمولی (که خودش enrich می‌کنه) انجام می‌شه ----
      if (method === 'POST' && pathname === '/api/films/scan-photo') {
        const denied = requireAuth()
        if (denied) return denied
        if (!env.AI) {
          return json({ error: 'AI binding not configured on the Worker' }, 400, corsHeaders)
        }
        const body = await request.json().catch(() => ({}))
        const { image, mediaType: imgMediaType } = body
        if (!image || typeof image !== 'string') {
          return json({ error: 'image (base64) is required' }, 400, corsHeaders)
        }
        // ورودی ممکنه data URL کامل باشه (data:image/jpeg;base64,....) یا فقط
        // خود base64؛ هر دو رو پشتیبانی می‌کنیم.
        let mediaType = imgMediaType || 'image/jpeg'
        let base64Data = image
        const dataUrlMatch = image.match(/^data:([^;]+);base64,(.*)$/s)
        if (dataUrlMatch) {
          mediaType = dataUrlMatch[1]
          base64Data = dataUrlMatch[2]
        }
        const dataUrl = `data:${mediaType};base64,${base64Data}`
        const prompt = `این عکسی از چند تا جلد یا لبه‌ی بلوری/دی‌وی‌دی روی هم یا کنار همه.
فقط عنوان‌هایی که واقعاً و به‌وضوح تو همین عکس می‌بینی رو لیست کن — هرگز عنوانی رو از خودت نساز یا حدس نزن،
و هیچ عنوانی رو بیشتر از یه‌بار تکرار نکن. تعداد آیتم‌های لیست باید دقیقاً برابر با تعداد جلد/باکسی باشه که تو عکس می‌بینی، نه بیشتر.
فقط یه آبجکت JSON خالص برگردون، بدون هیچ توضیح یا Markdown، دقیقاً به این فرمت:
{"films":[{"title":"Original English Title","year":1999}]}
اگه سال رو مطمئن نیستی، year رو null بذار. عنوان رو به همون زبان اصلی/انگلیسی روی جلد بنویس، نه ترجمه.
اگه یه عنوان کامل خونا نیست یا نامشخصه، از لیست حذفش کن.`

        let aiData
        try {
          aiData = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: dataUrl } },
                ],
              },
            ],
            max_tokens: 3000,
            temperature: 0.2,
          })
        } catch (e) {
          return json({ error: `Workers AI error: ${e.message}` }, 502, corsHeaders)
        }
        // aiData.response معمولاً رشته است، ولی گاهی مدل یه object/array
        // برمی‌گردونه (بسته به نسخه‌ی مدل) — این حالت رو هم پوشش می‌دیم
        let rawResponse = aiData.response
        if (typeof rawResponse !== 'string') {
          rawResponse = rawResponse == null ? '' : JSON.stringify(rawResponse)
        }
        const raw = rawResponse.trim().replace(/^```json\s*|\s*```$/g, '')
        console.log('Workers AI raw response (first 2000 chars):', raw.slice(0, 2000))
        let parsed
        try {
          parsed = JSON.parse(raw)
        } catch {
          // مدل گاهی متن اضافه دور JSON می‌ذاره؛ سعی می‌کنیم فقط بخش {...} رو دربیاریم
          const match = raw.match(/\{[\s\S]*\}/)
          if (match) {
            try {
              parsed = JSON.parse(match[0])
            } catch {
              // ممکنه به‌خاطر محدودیت max_tokens وسط آرایه بریده شده باشه — سعی
              // می‌کنیم تا آخرین آبجکت کامل رو نگه داریم و JSON رو ببندیم
              const lastComplete = match[0].lastIndexOf('},')
              if (lastComplete > -1) {
                try {
                  parsed = JSON.parse(match[0].slice(0, lastComplete + 1) + ']}')
                } catch {}
              }
            }
          }
        }
        if (!parsed) {
          return json({ error: 'Could not parse titles from the photo — try a clearer/closer shot, or fewer covers per photo' }, 502, corsHeaders)
        }
        const detected = Array.isArray(parsed) ? parsed : parsed.films
        if (!Array.isArray(detected)) {
          return json({ error: 'Unexpected response format from Workers AI' }, 502, corsHeaders)
        }
        const cleaned = detected
          .map((d) => ({
            title: String(d.title || '').trim(),
            year: d.year ? parseInt(d.year, 10) || null : null,
          }))
          .filter((d) => d.title)
        // dedupe (case-insensitive عنوان+سال) و سقف منطقی — اگه مدل توهم زده
        // باشه و صدها ردیف ساخته باشه، بیش از این تعداد قابل قبول برای یه
        // عکس نیست
        const seen = new Set()
        const deduped = []
        for (const f of cleaned) {
          const key = `${f.title.toLowerCase()}::${f.year || ''}`
          if (seen.has(key)) continue
          seen.add(key)
          deduped.push(f)
          if (deduped.length >= 60) break
        }
        return json({ films: deduped }, 200, corsHeaders)
      }

      // ---- POST /api/import (Excel import) ----
      if (method === 'POST' && pathname === '/api/import') {
        const denied = requireAuth()
        if (denied) return denied
        const form = await request.formData()
        const file = form.get('file')
        if (!file || typeof file.arrayBuffer !== 'function') {
          return json({ error: 'No file uploaded' }, 400, corsHeaders)
        }
        const buffer = await file.arrayBuffer()
        if (!buffer || buffer.byteLength === 0) {
          return json({ error: 'No file uploaded' }, 400, corsHeaders)
        }

        const wb = XLSX.read(buffer, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (!rows.length) return json({ error: 'File is empty' }, 400, corsHeaders)

        const imported = rows.map((r, i) => rowToFilm(r, i))

        // نکته‌ی مهم (باگ قبلی): قبلاً همه‌ی ردیف‌ها اول با OMDb غنی‌سازی
        // می‌شدن (Promise.all رو کل فایل) و فقط بعدش نوبت INSERT می‌رسید. تو
        // فایل‌های بزرگ (صدها ردیف)، این فاز غنی‌سازی به سقف زمان اجرا/تعداد
        // درخواست Cloudflare Workers می‌خورد و کل ریکوئست fail می‌شد — یعنی
        // هیچ ردیفی، حتی اونایی که غنی‌سازی‌شون لازم نبود، ذخیره نمی‌شد، بدون
        // خطای واضح به کاربر. الان اول INSERT/UPDATE (که فقط دیتابیسه، سریع و
        // بدون تماس بیرونی) انجام می‌شه؛ غنی‌سازی OMDb فقط best-effort و بعد
        // از ذخیره‌شدن موفقِ همه‌چیز، و فقط برای فایل‌های کوچیک انجام می‌شه.
        let added = 0
        let updated = 0
        const newlyAddedIds = []
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
            newlyAddedIds.push(f.id)
            added++
          }
        }

        // غنی‌سازی OMDb: فقط best-effort، فقط برای فایل‌های کوچیک (≤15 ردیف)
        // که مطمئنیم تو سقف subrequest جا می‌شن. فایل‌های بزرگ‌تر رو کاربر
        // می‌تونه بعداً از دکمه‌ی «Enrich» به‌صورت دسته‌ای پر کنه.
        let enriched = 0
        if (imported.length <= 15 && env.OMDB_API_KEY) {
          const key = env.OMDB_API_KEY
          for (const id of newlyAddedIds) {
            try {
              const row = await db.prepare('SELECT * FROM films WHERE id = ?').bind(id).first()
              if (!row) continue
              const parsed = parseFilmRow(row)
              const enrichedFilm = await enrichFilm(parsed, key, () => bumpApiUsage('omdb'))
              await updateFilm(db, { ...enrichedFilm, id })
              enriched++
            } catch {}
          }
        }

        return json({ count: imported.length, added, updated, enriched }, 200, corsHeaders)
      }

      // ---- GET /api/export/json (optional ?mediaType=&itemType= to scope the backup) ----
      if (method === 'GET' && pathname === '/api/export/json') {
        const denied = requireAuth()
        if (denied) return denied
        const mediaType = url.searchParams.get('mediaType')
        const itemType = url.searchParams.get('itemType')
        const driveParam = url.searchParams.get('drive')
        const letterParam = (url.searchParams.get('letter') || '').toUpperCase()
        let sql = 'SELECT * FROM films'
        const conditions = []
        const params = []
        if (mediaType) { conditions.push('mediaType = ?'); params.push(mediaType) }
        if (itemType === 'series') { conditions.push("itemType = 'series'") }
        else if (itemType === 'movie') { conditions.push("(itemType IS NULL OR itemType != 'series')") }
        if (driveParam) {
          // driveNumber ممکنه «7» یا «Drive 7» ذخیره شده باشه، comma-separated
          // هم باشه؛ برای سریال‌ها ممکنه فقط تو seasonDrives (فصل‌های
          // جداگونه) ثبت شده باشه، نه فیلد کلی driveNumber. از json_each
          // استفاده می‌کنیم تا فقط فیلد drive چک بشه، نه seasons.
          conditions.push(`(
            driveNumber = ? OR driveNumber = ? OR
            driveNumber LIKE ? OR driveNumber LIKE ? OR
            driveNumber LIKE ? OR driveNumber LIKE ? OR
            driveNumber LIKE ? OR driveNumber LIKE ? OR
            (seasonDrives IS NOT NULL AND EXISTS (
              SELECT 1 FROM json_each(seasonDrives) je WHERE
                je.value ->> 'drive' LIKE ?
            ))
          )`)
          params.push(
            driveParam, `Drive ${driveParam}`,
            `${driveParam},%`, `Drive ${driveParam},%`,
            `%, ${driveParam}`, `%, Drive ${driveParam}`,
            `%, ${driveParam},%`, `%, Drive ${driveParam},%`,
            `%${driveParam}%`
          )
        }
        if (letterParam) {
          // مرتب‌سازی/فیلتر الفبایی حرف اول عنوان، با نادیده گرفتن "The " ابتدای عنوان
          const sortableTitle = `CASE WHEN title LIKE 'The %' THEN substr(title,5) ELSE title END`
          if (letterParam === '#') {
            conditions.push(`UPPER(SUBSTR(${sortableTitle}, 1, 1)) NOT BETWEEN 'A' AND 'Z'`)
          } else {
            conditions.push(`UPPER(SUBSTR(${sortableTitle}, 1, 1)) = ?`)
            params.push(letterParam)
          }
        }
        if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
        sql += ` ORDER BY (CASE WHEN LOWER(title) LIKE 'the %' THEN SUBSTR(title, 5) ELSE title END) COLLATE NOCASE ASC`
        const result = await db.prepare(sql).bind(...params).all()
        const films = (result.results || []).map(parseFilmRow)
        const filenameScope = itemType === 'series' ? 'series-' : mediaType ? `${mediaType}-` : ''
        return json(films, 200, {
          ...corsHeaders,
          'Content-Disposition': `attachment; filename="${filenameScope}films-backup.json"`,
        })
      }

      // ---- GET /api/export/excel (optional ?mediaType=&itemType=&closet=&row=&shelf=&drive=&letter= to scope the backup) ----
      if (method === 'GET' && pathname === '/api/export/excel') {
        const denied = requireAuth()
        if (denied) return denied
        const mediaType = url.searchParams.get('mediaType')
        const itemType = url.searchParams.get('itemType')
        const closetParam = url.searchParams.get('closet')
        const rowParam = url.searchParams.get('row')
        const shelfParam = url.searchParams.get('shelf')
        const driveParam = url.searchParams.get('drive')
        const letterParam = (url.searchParams.get('letter') || '').toUpperCase()
        let sql = 'SELECT * FROM films'
        const conditions = []
        const params = []
        if (mediaType) { conditions.push('mediaType = ?'); params.push(mediaType) }
        if (itemType === 'series') { conditions.push("itemType = 'series'") }
        else if (itemType === 'movie') { conditions.push("(itemType IS NULL OR itemType != 'series')") }
        if (closetParam) { conditions.push('closet = ?'); params.push(closetParam) }
        if (rowParam) { conditions.push('row = ?'); params.push(rowParam) }
        if (shelfParam) { conditions.push('shelf = ?'); params.push(shelfParam) }
        if (driveParam) {
          // driveNumber ممکنه «7» یا «Drive 7» ذخیره شده باشه، comma-separated
          // هم باشه؛ برای سریال‌ها ممکنه فقط تو seasonDrives (فصل‌های
          // جداگونه) ثبت شده باشه، نه فیلد کلی driveNumber. از json_each
          // استفاده می‌کنیم تا فقط فیلد drive چک بشه، نه seasons.
          conditions.push(`(
            driveNumber = ? OR driveNumber = ? OR
            driveNumber LIKE ? OR driveNumber LIKE ? OR
            driveNumber LIKE ? OR driveNumber LIKE ? OR
            driveNumber LIKE ? OR driveNumber LIKE ? OR
            (seasonDrives IS NOT NULL AND EXISTS (
              SELECT 1 FROM json_each(seasonDrives) je WHERE
                je.value ->> 'drive' LIKE ?
            ))
          )`)
          params.push(
            driveParam, `Drive ${driveParam}`,
            `${driveParam},%`, `Drive ${driveParam},%`,
            `%, ${driveParam}`, `%, Drive ${driveParam}`,
            `%, ${driveParam},%`, `%, Drive ${driveParam},%`,
            `%${driveParam}%`
          )
        }
        if (letterParam) {
          // مرتب‌سازی/فیلتر الفبایی حرف اول عنوان، با نادیده گرفتن "The " ابتدای عنوان
          const sortableTitle = `CASE WHEN title LIKE 'The %' THEN substr(title,5) ELSE title END`
          if (letterParam === '#') {
            conditions.push(`UPPER(SUBSTR(${sortableTitle}, 1, 1)) NOT BETWEEN 'A' AND 'Z'`)
          } else {
            conditions.push(`UPPER(SUBSTR(${sortableTitle}, 1, 1)) = ?`)
            params.push(letterParam)
          }
        }
        if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
        sql += ` ORDER BY (CASE WHEN LOWER(title) LIKE 'the %' THEN SUBSTR(title, 5) ELSE title END) COLLATE NOCASE ASC`
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
                Criterion: f.criterion ? `Yes${f.criterionCopies > 1 ? ` ×${f.criterionCopies}` : ''}` : 'No',
                Copies: f.copies || 1,
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

        // برگه‌ی خلاصه: تعداد کل و تعداد نسخه‌های کرایتریون، اول از همه.
        const criterionCount = films.filter((f) => f.criterion).length
        const summaryRows = [
          { Metric: 'Total items', Value: films.length },
          { Metric: 'Criterion Collection editions', Value: criterionCount },
          { Metric: 'Generated', Value: new Date().toLocaleString() },
        ]
        const summaryWs = XLSX.utils.json_to_sheet(summaryRows, { skipHeader: true })
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')
        XLSX.utils.book_append_sheet(wb, ws, 'Film Archive')
        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: false })
        const locationScope = [closetParam ? `C${closetParam}` : '', rowParam ? `R${rowParam}` : '', shelfParam ? `S${shelfParam}` : ''].join('')
        const letterScope = letterParam ? `${letterParam}-` : ''
        const excelFilenameScope = locationScope || letterScope || (itemType === 'series' ? 'series-' : mediaType ? `${mediaType}-` : '')
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
        const raw = await env.BACKUPS.get(key, 'arrayBuffer')
        if (!raw) return json({ error: 'Backup not found' }, 404, corsHeaders)
        // بکاپ‌های جدید gzip‌شده‌ن (magic bytes 1f 8b)؛ بکاپ‌های قدیمی‌تر که قبل از
        // این تغییر ذخیره شدن، متن خام JSON بودن — هر دو رو پشتیبانی می‌کنیم.
        const bytes = new Uint8Array(raw)
        const isGzip = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
        const value = isGzip ? await gunzipToText(bytes) : new TextDecoder().decode(bytes)
        return new Response(value, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="films-backup-${dateParam}.json"`,
          },
        })
      }

      // ---- POST /api/backups/run-now (admin) — اجرای فوری بکاپ روزانه (KV + GitHub)
      // بدون نیاز به صبر تا کرون ساعت ۴ بامداد؛ برای تست تنظیمات GitHub مفیده. ----
      if (method === 'POST' && pathname === '/api/backups/run-now') {
        const denied = requireAdmin()
        if (denied) return denied
        try {
          await runDailyBackup(env)
          return json({ ok: true, githubConfigured: !!env.GITHUB_BACKUP_TOKEN }, 200, corsHeaders)
        } catch (e) {
          return json({ ok: false, error: String(e) }, 500, corsHeaders)
        }
      }

      // ---- SPA fallback ----
      // Static assets are handled by wrangler's asset system; this Worker only
      // deals with /api/* routes. Return 404 for anything else.
      return new Response('Not Found', { status: 404, headers: corsHeaders })

    } catch (err) {
      // خطای غیرمنتظره‌ی هر endpoint — هم به کاربر جواب می‌ده، هم (اگه تنظیم شده باشه) به تلگرام هشدار می‌فرسته
      try {
        await notifyServerError(env, `API error on ${method} ${pathname}: ${err.message}`)
      } catch {}
      return json({ error: err.message }, 500, corsHeaders)
    }
  }
// هشدار خطای سرور از طریق تلگرام — اگه TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID
// (هر دو wrangler secret) ست نشده باشن، بی‌سروصدا رد می‌شه. برای گرفتن این دوتا:
//   ۱) با @BotFather تو تلگرام یه بات بساز، توکنش رو بگیر (TELEGRAM_BOT_TOKEN)
//   ۲) به بات پیام بده، بعد https://api.telegram.org/bot<TOKEN>/getUpdates رو باز کن
//      و chat.id رو از جواب JSON بردار (TELEGRAM_CHAT_ID)
async function notifyServerError(env, message) {
  const token = env.TELEGRAM_BOT_TOKEN
  const chatId = env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `🎬 Cinefilm Archive — خطای سرور:\n${message}`,
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => {})
}

// هر روز ساعت ۴ بامداد UTC (یه ساعت بعد از enrichment) کل جدول films رو به‌صورت
// JSON در KV ذخیره می‌کنه؛ کلید بر اساس تاریخ ساخته می‌شه (backup:YYYY-MM-DD) تا
// تاریخچه‌ی روزانه حفظ بشه. بکاپ‌های قدیمی‌تر از ۳۰ روز خودکار پاک می‌شن تا فضای
// KV پر نشه. یه کلید ثابت "backup:latest" هم برای دسترسی سریع نگه داشته می‌شه.
//
// علاوه بر KV (که هر دو رو Cloudflare نگه می‌داره)، یه کپی هم رو GitHub push
// می‌شه (backups/latest-backup.json تو همون repo) تا اگه یه روز خود اکانت
// Cloudflare مشکل پیدا کرد (هک/تعلیق/حذف اشتباه)، یه نسخه‌ی کاملاً جدا هم
// وجود داشته باشه. این بخش نیاز به GITHUB_BACKUP_TOKEN داره (wrangler secret)؛
// اگه ست نشده باشه، فقط رد می‌شه و بکاپ KV طبق معمول انجام می‌شه.
async function runDailyBackup(env) {
  const db = env.DB
  const result = await db
    .prepare(`SELECT * FROM films ORDER BY (CASE WHEN LOWER(title) LIKE 'the %' THEN SUBSTR(title, 5) ELSE title END) COLLATE NOCASE ASC`)
    .all()
  const films = (result.results || []).map(parseFilmRow)
  const payload = JSON.stringify({ backedUpAt: new Date().toISOString(), count: films.length, films })

  const dateKey = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  // KV محدودیت ۲۵ مگابایتی داره؛ دیتای films دیگه از این حد رد شده، پس قبل از
  // ذخیره gzip می‌کنیم. GET /api/backups/:date موقع خوندن decompress می‌کنه.
  const compressed = await gzipText(payload)
  await env.BACKUPS.put(`backup:${dateKey}`, compressed)
  await env.BACKUPS.put('backup:latest', compressed)

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

  console.log(`Daily backup: saved ${films.length} films as backup:${dateKey} (${compressed.byteLength} bytes gzipped)`)

  try {
    await pushBackupToGitHub(env, compressed, dateKey)
  } catch (e) {
    console.log(`GitHub backup skipped/failed: ${e.message}`)
  }
}

// gzip یه رشته و برگردوندن Uint8Array — برای دور زدن محدودیت ۲۵ مگابایتی KV
// و کوچیک نگه‌داشتن فایل قبل از push به GitHub.
async function gzipText(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

// عکس gzipText — یه Uint8Array/ArrayBuffer فشرده رو به رشته‌ی اصلی برمی‌گردونه.
async function gunzipToText(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(stream).text()
}

// بکاپ روزانه (فشرده‌شده با gzip) رو به‌صورت یه فایل ثابت
// (backups/latest-backup.json.gz) تو repo خود پروژه commit می‌کنه — هر بار
// overwrite می‌شه، تا تاریخچه‌ی git بی‌جهت پر نشه. چون فایل چند مگابایته و
// GitHub Contents API فقط تا ۱ مگابایت جواب می‌ده، از Git Data API
// (blob → tree → commit → update ref) استفاده می‌کنیم که تا ۱۰۰ مگابایت رو
// پشتیبانی می‌کنه. اگه GITHUB_BACKUP_TOKEN ست نشده باشه، بی‌سروصدا رد می‌شه.
async function pushBackupToGitHub(env, compressedBytes, dateKey) {
  const token = env.GITHUB_BACKUP_TOKEN
  if (!token) return
  const owner = env.GITHUB_BACKUP_OWNER || 'maz1maz'
  const repo = env.GITHUB_BACKUP_REPO || 'movies-archive'
  const branch = env.GITHUB_BACKUP_BRANCH || 'main'
  const filePath = 'backups/latest-backup.json.gz'
  const api = `https://api.github.com/repos/${owner}/${repo}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'CinefilmArchive-Backup/1.0',
  }
  const gh = async (path, opts = {}) => {
    const res = await fetch(`${api}${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`GitHub API ${opts.method || 'GET'} ${path} -> ${res.status}: ${errText.slice(0, 300)}`)
    }
    return res.json()
  }

  // 1) sha آخرین commit روی برنچ
  const ref = await gh(`/git/refs/heads/${branch}`)
  const latestCommitSha = ref.object.sha

  // 2) sha درخت (tree) پایه‌ی همون commit
  const latestCommit = await gh(`/git/commits/${latestCommitSha}`)
  const baseTreeSha = latestCommit.tree.sha

  // 3) آپلود محتوای فایل به‌عنوان blob (بدون محدودیت ۱ مگابایتی Contents API)
  const blob = await gh(`/git/blobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: uint8ToBase64(compressedBytes), encoding: 'base64' }),
  })

  // 4) ساخت tree جدید که فقط همین فایل رو نسبت به base tree عوض می‌کنه
  const tree = await gh(`/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: [{ path: filePath, mode: '100644', type: 'blob', sha: blob.sha }],
    }),
  })

  // 5) ساخت commit جدید روی همون tree
  const commit = await gh(`/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Daily backup ${dateKey}`,
      tree: tree.sha,
      parents: [latestCommitSha],
    }),
  })

  // 6) هدایت برنچ به commit جدید
  await gh(`/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha }),
  })

  console.log(`GitHub backup: pushed ${filePath} (${dateKey}, ${compressedBytes.byteLength} bytes)`)
}

// base64 encode یه Uint8Array بزرگ بدون خطای call-stack (chunk-by-chunk،
// چون String.fromCharCode.apply روی آرایه‌های چندمگابایتی کرش می‌کنه)
function uint8ToBase64(bytes) {
  const CHUNK = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

// ---------- Helpers ----------

// TTL هوشمند برای کش‌های cinema_news_cache: اگه دیتای کش‌شده خالی باشه
// (آرایه‌ی خالی — یعنی احتمالاً یه fetch شکست‌خورده بوده، نه این‌که واقعاً
// چیزی برای نمایش نیست)، به‌جای TTL کامل (مثلاً ۲۴ ساعت)، یه TTL خیلی
// کوتاه‌تر استفاده می‌کنیم تا خودش دفعه‌ی بعد که کسی صفحه رو باز کرد دوباره
// امتحان کنه — بدون نیاز به حذف دستی ردیف از دیتابیس بعد از هر تغییر منطق.
const EMPTY_CACHE_TTL_MS = 30 * 60 * 1000 // ۳۰ دقیقه برای نتیجه‌ی خالی
function isCacheFresh(fetchedAt, dataStr, fullTtlMs) {
  if (!fetchedAt) return false
  const age = Date.now() - new Date(fetchedAt).getTime()
  let isEmpty = true
  try {
    const parsed = JSON.parse(dataStr || '[]')
    isEmpty = Array.isArray(parsed) ? parsed.length === 0 : !parsed || Object.keys(parsed).length === 0
  } catch {
    isEmpty = true
  }
  return age < (isEmpty ? EMPTY_CACHE_TTL_MS : fullTtlMs)
}

// آدرس صفحه‌ی شخصیِ letterboxd.com (actor یا director) رو با امتحان کردن
// اسلاگ ساخته‌شده از اسم پیدا می‌کنه. اگه هیچ‌کدوم جواب نداد (اسم غیرمعمول
// یا Letterboxd اصلاً صفحه‌ای براش نداره)، null برمی‌گردونه و فرانت به لینک
// جستجو fallback می‌کنه.
async function resolveLetterboxdPersonUrl(name) {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) return null
  const headers = { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' }
  for (const kind of ['actor', 'director']) {
    try {
      const res = await fetch(`https://letterboxd.com/${kind}/${slug}/`, { headers })
      if (res.ok) return `https://letterboxd.com/${kind}/${slug}/`
    } catch {}
  }
  return null
}

// تیترهای مهم سینمایی از فیدهای RSS چند منبع معتبر — یه بار در روز کش می‌شه
// (عمومیه، نه شخصی‌سازی‌شده).
async function fetchCinemaHeadlines(db) {
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('headlines').first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 6 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data || '[]')
      } catch {
        return []
      }
    }

    const feeds = [
      { url: 'https://variety.com/feed/', source: 'Variety' },
      { url: 'https://www.hollywoodreporter.com/feed/', source: 'The Hollywood Reporter' },
      { url: 'https://www.indiewire.com/feed/', source: 'IndieWire' },
      { url: 'https://deadline.com/feed/', source: 'Deadline' },
    ]
    const headers = { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' }
    const all = []
    for (const f of feeds) {
      try {
        const res = await fetch(f.url, { headers })
        if (!res.ok) continue
        const xml = await res.text()
        all.push(...parseRssItems(xml, f.source))
      } catch {}
    }

    all.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    // قبلاً اینجا فقط ۶ تا نگه داشته می‌شد و بعد سمت کلاینت به فیلم/سریال
    // فیلتر می‌شد — با فقط ۶ تیتر کلی (که بیشترشون فیلمه)، بخش «Series
    // news» عملاً همیشه خالی بود. حالا مجموعه‌ی بزرگ‌تری نگه می‌داریم تا
    // بعد از فیلتر شدن هم چیزی برای هر دو دسته بمونه.
    const headlines = all.slice(0, 24)

    // ترجمه‌ی کوتاه فارسیِ هر تیتر انگلیسی، برای نمایش زیر عنوان اصلی
    await Promise.all(
      headlines.map(async (h) => {
        h.titleFa = await translateToFa(h.title)
      })
    )

    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind('headlines', JSON.stringify(headlines))
      .run()

    return headlines
  } catch {
    return []
  }
}

// ترجمه‌ی سریعِ عنوان. اول MyMemory (رایگان، برای استفاده‌ی برنامه‌نویسی
// طراحی شده، رو IPهای دیتاسنتر مثل Cloudflare Workers پایدارتره) و اگه جواب
// نداد، اندپوینت غیررسمی گوگل ترنسلیت به‌عنوان fallback. اگه هیچ‌کدوم در
// دسترس نبودن یا جواب غیرمنتظره دادن، فقط null برمی‌گردونه و تیتر بدون
// ترجمه نمایش داده می‌شه.
async function translateToFa(text) {
  if (!text) return null
  const hasPersianChars = (s) => /[\u0600-\u06FF]/.test(s || '')

  const tryMyMemory = async () => {
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|fa`, {
        headers: { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' },
      })
      if (!res.ok) return null
      const data = await res.json()
      const translated = data?.responseData?.translatedText
      return hasPersianChars(translated) ? translated : null
    } catch {
      return null
    }
  }

  const tryGoogle = async () => {
    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fa&dt=t&q=${encodeURIComponent(text)}`,
        { headers: { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' } }
      )
      if (!res.ok) return null
      const data = await res.json()
      const parts = data?.[0] || []
      const translated = parts.map((p) => p?.[0]).filter(Boolean).join('')
      return hasPersianChars(translated) ? translated : null
    } catch {
      return null
    }
  }

  // هر دو سرویس رو هم‌زمان می‌زنیم (نه یکی بعد از اون یکی) و هرکدوم زودتر
  // جواب معتبر (شامل حروف فارسی) داد همونو برمی‌داریم — چون این دو سرویسِ
  // رایگان گاهی رو IPهای دیتاسنتری مثل Cloudflare Workers rate-limit می‌شن،
  // اجرای موازی شانس موفقیت رو بدون هزینه‌ی زمانی اضافه بالا می‌بره.
  const [myMemoryResult, googleResult] = await Promise.allSettled([tryMyMemory(), tryGoogle()])
  const a = myMemoryResult.status === 'fulfilled' ? myMemoryResult.value : null
  const b = googleResult.status === 'fulfilled' ? googleResult.value : null
  return a || b || null
}

// تیترهای مهم سینمای فارسی‌زبان (ایران) از چند منبع — همون منطق و کش کش
// انگلیسی، فقط منابع فارسی. بعضی از این فیدها ممکنه گاهی در دسترس نباشن؛
// چون fetch هرکدوم جدا try/catch شده، بقیه‌ی فیدها لطمه نمی‌بینن.
async function fetchCinemaHeadlinesFa(db) {
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('headlines_fa').first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 6 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data || '[]')
      } catch {
        return []
      }
    }

    const feeds = [
      { urls: ['https://cinemacinema.ir/rss', 'https://cinemacinema.ir/feed/'], source: 'سینما سینما' },
      { urls: ['https://www.filmnews.ir/rss', 'https://www.filmnews.ir/feed/'], source: 'فیلم نیوز' },
      { urls: ['https://caffecinema.com/feed/', 'https://www.caffecinema.com/feed/'], source: 'کافه سینما' },
      { urls: ['https://www.cinemapress.ir/rss'], source: 'سینماپرس' },
      { urls: ['http://www.sourehcinema.ir/rss', 'http://www.sourehcinema.ir/feed/'], source: 'سوره سینما' },
    ]
    const headers = { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' }
    // هر منبع رو جدا نگه می‌داریم و بعد round-robin ترکیب می‌کنیم (اول یکی از
    // هر منبع، بعد دومی از هر منبع، ...) تا لیست همیشه از چند منبع پر بشه، نه
    // این‌که یه منبع که بیشتر/سریع‌تر پست می‌ذاره کل لیست رو با sort-by-date پر کنه.
    // هر منبع چند آدرس کاندید داره (RSS مسیرهای مختلفی داره تو سایت‌های مختلف)
    // — اولین آدرسی که جواب داد استفاده می‌شه.
    const perSource = []
    for (const f of feeds) {
      let items = []
      for (const url of f.urls) {
        try {
          const res = await fetch(url, { headers })
          if (!res.ok) continue
          const xml = await res.text()
          const parsed = parseRssItems(xml, f.source)
          if (parsed.length) {
            items = parsed
            break
          }
        } catch {}
      }
      perSource.push(items)
    }
    const maxLen = Math.max(0, ...perSource.map((s) => s.length))
    const interleaved = []
    for (let i = 0; i < maxLen; i++) {
      for (const src of perSource) {
        if (src[i]) interleaved.push(src[i])
      }
    }
    const headlines = interleaved.slice(0, 15)

    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind('headlines_fa', JSON.stringify(headlines))
      .run()

    return headlines
  } catch {
    return []
  }
}

// پارسر ساده‌ی RSS با regex (Workers دسترسی به DOMParser نداره) — فقط
// title/link/pubDate هر <item> رو در میاره، کافیه برای لیست تیترها.
function parseRssItems(xml, sourceName) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = itemRegex.exec(xml)) && items.length < 15) {
    const block = m[1]
    const rawTitle = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''
    const rawLink = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || ''
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || ''
    const title = decodeHtmlEntities(rawTitle.replace('<![CDATA[', '').replace(']]>', '').trim())
    const link = rawLink.replace('<![CDATA[', '').replace(']]>', '').trim()
    if (title && link) items.push({ title, link, pubDate, source: sourceName })
  }
  return items
}

function emptyPersonInfo() {
  return {
    photo: null,
    bio: null,
    birthDate: null,
    deathDate: null,
    height: null,
    spouse: null,
    children: null,
    imdbId: null,
    letterboxdUrl: null,
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

// افرادی از people_photos (کش تولد/عکس که PersonModal پرش می‌کنه) که تولدشون
// امروزه، فیلتر شده به اونایی که واقعاً توی آرشیو (کارگردان یا بازیگر) نقشی
// دارن. چون people_photos فقط با باز کردن PersonModal پر می‌شه، این لیست
// به‌مرور کامل‌تر می‌شه، نه از روز اول.
async function fetchTodaysBirthdays(db) {
  try {
    const peopleRes = await db
      .prepare(
        `SELECT name, photo, birthDate FROM people_photos
         WHERE birthDate IS NOT NULL AND deathDate IS NULL
         AND strftime('%m-%d', birthDate) = strftime('%m-%d', 'now')`
      )
      .all()
    const people = peopleRes.results || []
    if (!people.length) return []

    const out = []
    for (const p of people) {
      const nameLower = p.name.toLowerCase()
      const like = `%${nameLower}%`
      const filmsRes = await db
        .prepare('SELECT title, director, "cast" FROM films WHERE LOWER(director) LIKE ? OR LOWER("cast") LIKE ? LIMIT 6')
        .bind(like, like)
        .all()
      const rows = filmsRes.results || []
      if (!rows.length) continue // فقط اهالی خودِ کالکشن، نه هر کسی که تصادفاً کش شده

      // اسم با حروف درست (people_photos.name همیشه lowercase ذخیره می‌شه)
      let displayName = p.name
      for (const f of rows) {
        if (f.director && f.director.toLowerCase().includes(nameLower)) {
          const match = f.director.split(',').map((s) => s.trim()).find((s) => s.toLowerCase() === nameLower)
          displayName = match || f.director
          break
        }
        try {
          const cast = JSON.parse(f.cast || '[]')
          const match = Array.isArray(cast)
            ? cast.find((c) => ((typeof c === 'object' ? c.name : c) || '').toLowerCase() === nameLower)
            : null
          if (match) {
            displayName = typeof match === 'object' ? match.name : match
            break
          }
        } catch {}
      }

      out.push({
        name: displayName,
        photo: p.photo,
        age: ageFromBirthDate(p.birthDate),
        films: rows.map((f) => f.title).slice(0, 3),
      })
    }
    return out
  } catch {
    return []
  }
}

// فیلم/سریال‌های در راهِ پرتکرارترین کارگردان‌ها و بازیگرهای کالکشن (از
// روی تعداد عناوینی که ازشون تو آرشیو هست). هر فرد جدا توی cinema_news_cache
// کش می‌شه (۳ روزه) تا هر بار مودال باز می‌شه TMDB دوباره چک نشه.
async function fetchUpcomingFromCollection(db, env) {
  if (!env.TMDB_API_KEY) return []
  try {
    const filmsRes = await db.prepare('SELECT director, "cast" FROM films').all()
    const films = filmsRes.results || []
    const counts = new Map()
    for (const f of films) {
      if (f.director) {
        for (const d of f.director.split(',').map((s) => s.trim()).filter(Boolean)) {
          counts.set(d, (counts.get(d) || 0) + 1)
        }
      }
      try {
        const cast = JSON.parse(f.cast || '[]')
        if (Array.isArray(cast)) {
          for (const c of cast) {
            const name = typeof c === 'object' ? c.name : c
            if (name) counts.set(name, (counts.get(name) || 0) + 1)
          }
        }
      } catch {}
    }
    const topPeople = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name)

    const results = []
    for (const name of topPeople) {
      const cacheKey = `upcoming:${name.toLowerCase()}`
      const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind(cacheKey).first()
      const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 3 * 24 * 60 * 60 * 1000)
      let items
      if (fresh) {
        try {
          items = JSON.parse(cached.data || '[]')
        } catch {
          items = []
        }
      } else {
        items = await fetchPersonUpcoming(name, env)
        await db
          .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
          .bind(cacheKey, JSON.stringify(items))
          .run()
      }
      for (const it of items) results.push({ ...it, personName: name })
    }

    // یکتاسازی (ممکنه یه فیلم هم بازیگر هم کارگردانش تو کالکشن باشن) +
    // مرتب‌سازی بر اساس نزدیک‌ترین تاریخ اکران
    const seen = new Set()
    const unique = []
    for (const r of results.sort((a, b) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999'))) {
      const key = `${r.title}|${r.releaseDate}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(r)
    }
    return unique.slice(0, 20)
  } catch {
    return []
  }
}

async function fetchPersonUpcoming(name, env) {
  const tmdbKey = env.TMDB_API_KEY
  async function tmdbGet(path, params) {
    const qs = new URLSearchParams(params).toString()
    const attempts = [
      { url: `https://api.themoviedb.org/3${path}?${qs}&api_key=${encodeURIComponent(tmdbKey)}`, headers: { accept: 'application/json' } },
      { url: `https://api.themoviedb.org/3${path}?${qs}`, headers: { Authorization: `Bearer ${tmdbKey}`, accept: 'application/json' } },
    ]
    for (const a of attempts) {
      try {
        const res = await fetch(a.url, { headers: a.headers })
        if (res.ok) return await res.json()
      } catch {}
    }
    return null
  }

  let upcoming = []
  try {
    const search = await tmdbGet('/search/person', { query: name })
    const person = (search?.results || [])[0]
    if (person) {
      const credits = await tmdbGet(`/person/${person.id}/combined_credits`, {})
      const today = new Date().toISOString().slice(0, 10)
      const all = [...(credits?.cast || []), ...(credits?.crew || [])]
      const seen = new Set()
      for (const c of all) {
        const releaseDate = c.release_date || c.first_air_date
        if (!releaseDate || releaseDate <= today) continue
        const title = c.title || c.name
        if (!title) continue
        const key = `${c.media_type}:${c.id}`
        if (seen.has(key)) continue
        seen.add(key)
        upcoming.push({
          title,
          releaseDate,
          poster: c.poster_path ? `https://image.tmdb.org/t/p/w300${c.poster_path}` : null,
          mediaType: c.media_type === 'tv' ? 'series' : 'movie',
          role: c.job || (c.character ? 'Actor' : null),
          infoUrl: `https://www.themoviedb.org/${c.media_type === 'tv' ? 'tv' : 'movie'}/${c.id}`,
        })
      }
    }
  } catch {}

  // TMDB اکثر وقتا برای سریال‌ها تاریخ اپیزود بعدی نداره (فقط تاریخ اولین
  // پخش رو می‌دونه)، برای همین اغلب این بخش برای بازیگرهای سریالی خالی
  // می‌مونه. TVMaze دقیقاً برای همین جاست: سریال‌های در حال پخش + تاریخ
  // اپیزود بعدی. نتایجش رو اضافه می‌کنیم (نه جایگزین)، با یکتاسازی بر اساس عنوان.
  try {
    const tvMazeItems = await fetchTvMazePersonUpcoming(name)
    const existingTitles = new Set(upcoming.map((u) => u.title.toLowerCase()))
    for (const item of tvMazeItems) {
      if (existingTitles.has(item.title.toLowerCase())) continue
      existingTitles.add(item.title.toLowerCase())
      upcoming.push(item)
    }
  } catch {}

  return upcoming.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate)).slice(0, 5)
}

// تریلرهای فیلم‌های نزدیک‌به‌اکران هالیوود — عمومیه (نه شخصی‌سازی‌شده بر اساس
// کالکشن)، برای همین فقط یه بار در روز کلاً کش می‌شه، نه به‌ازای هر کاربر.
async function fetchTrendingTrailers(db, env) {
  if (!env.TMDB_API_KEY) return []
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('trailers').first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 24 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data || '[]')
      } catch {
        return []
      }
    }

    const tmdbKey = env.TMDB_API_KEY
    async function tmdbGet(path, params) {
      const qs = new URLSearchParams(params).toString()
      const attempts = [
        { url: `https://api.themoviedb.org/3${path}?${qs}&api_key=${encodeURIComponent(tmdbKey)}`, headers: { accept: 'application/json' } },
        { url: `https://api.themoviedb.org/3${path}?${qs}`, headers: { Authorization: `Bearer ${tmdbKey}`, accept: 'application/json' } },
      ]
      for (const a of attempts) {
        try {
          const res = await fetch(a.url, { headers: a.headers })
          if (res.ok) return await res.json()
        } catch {}
      }
      return null
    }

    const upcomingRes = await tmdbGet('/movie/upcoming', { region: 'US', page: '1' })
    const movies = (upcomingRes?.results || []).slice(0, 5)

    const trailers = []
    for (const m of movies) {
      const videosRes = await tmdbGet(`/movie/${m.id}/videos`, {})
      const vids = videosRes?.results || []
      const trailer =
        vids.find((v) => v.type === 'Trailer' && v.site === 'YouTube' && v.official) ||
        vids.find((v) => v.type === 'Trailer' && v.site === 'YouTube')
      if (!trailer) continue
      trailers.push({
        title: m.title,
        releaseDate: m.release_date,
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null,
        youtubeKey: trailer.key,
      })
    }

    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind('trailers', JSON.stringify(trailers))
      .run()

    return trailers
  } catch {
    return []
  }
}

// فیلم/سریال‌های در راه به‌طور کلی (نه فقط اهالی کالکشن) — برای کسی که فقط
// می‌خواد ببینه چه چیزی به‌زودی میاد، بدون ربط به این‌که تو آرشیوش هست یا نه.
// فیلم از TMDB /movie/upcoming، سریال از /discover/tv با first_air_date از
// امروز به بعد. یک‌روزه کش می‌شه، عمومیه.
async function fetchGeneralUpcoming(db, env) {
  if (!env.TMDB_API_KEY) return { movies: [], series: [] }
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('general_upcoming').first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 24 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data || '{"movies":[],"series":[]}')
      } catch {
        return { movies: [], series: [] }
      }
    }

    const tmdbKey = env.TMDB_API_KEY
    async function tmdbGet(path, params) {
      const qs = new URLSearchParams(params).toString()
      const attempts = [
        { url: `https://api.themoviedb.org/3${path}?${qs}&api_key=${encodeURIComponent(tmdbKey)}`, headers: { accept: 'application/json' } },
        { url: `https://api.themoviedb.org/3${path}?${qs}`, headers: { Authorization: `Bearer ${tmdbKey}`, accept: 'application/json' } },
      ]
      for (const a of attempts) {
        try {
          const res = await fetch(a.url, { headers: a.headers })
          if (res.ok) return await res.json()
        } catch {}
      }
      return null
    }

    const today = new Date().toISOString().slice(0, 10)

    const moviesRes = await tmdbGet('/movie/upcoming', { region: 'US', page: '1' })
    const movies = (moviesRes?.results || [])
      .filter((m) => m.title && m.release_date)
      .slice(0, 12)
      .map((m) => ({
        title: m.title,
        releaseDate: m.release_date,
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null,
        infoUrl: `https://www.themoviedb.org/movie/${m.id}`,
      }))

    // نکته: قبلاً اینجا /discover/tv با first_air_date.gte بود که فقط
    // سریال‌های کاملاً تازه (قسمت اولشون هنوز پخش نشده) رو می‌گرفت — یعنی
    // تقریباً همیشه خالی، چون اکثر سریال‌های محبوب همین الان در حال پخشن
    // (فصل جدید دارن، نه اولین قسمت). به‌جاش /tv/on_the_air که سریال‌های
    // با اپیزود در ۷ روز آینده رو می‌ده، خیلی بیشتر نتیجه‌ی مرتبط داره.
    const seriesRes = await tmdbGet('/tv/on_the_air', { region: 'US', page: '1' })
    const series = (seriesRes?.results || [])
      .filter((s) => s.name && s.first_air_date)
      .slice(0, 12)
      .map((s) => ({
        title: s.name,
        releaseDate: s.first_air_date,
        poster: s.poster_path ? `https://image.tmdb.org/t/p/w300${s.poster_path}` : null,
        infoUrl: `https://www.themoviedb.org/tv/${s.id}`,
      }))

    const data = { movies, series }
    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind('general_upcoming', JSON.stringify(data))
      .run()

    return data
  } catch {
    return { movies: [], series: [] }
  }
}

// ترند هفته (فیلم+سریال)، پرطرفدارترین این ماه، و «گیشه» (چون TMDB چارت واقعی
// فروش نداره، از فیلم‌های در حال اکران، مرتب‌شده بر اساس محبوبیت، به‌عنوان
// نزدیک‌ترین جایگزین در دسترس استفاده می‌کنیم). چهار فراخوانی TMDB، یک‌روزه
// کش می‌شه، عمومیه.
async function fetchTrendingAndBoxOffice(db, env) {
  const empty = { trendingMoviesWeek: [], trendingSeriesWeek: [], popularMonth: [], boxOffice: [] }
  if (!env.TMDB_API_KEY) return empty
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('trending_boxoffice').first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 24 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data || 'null') || empty
      } catch {
        return empty
      }
    }

    const tmdbKey = env.TMDB_API_KEY
    async function tmdbGet(path, params) {
      const qs = new URLSearchParams(params).toString()
      const attempts = [
        { url: `https://api.themoviedb.org/3${path}?${qs}&api_key=${encodeURIComponent(tmdbKey)}`, headers: { accept: 'application/json' } },
        { url: `https://api.themoviedb.org/3${path}?${qs}`, headers: { Authorization: `Bearer ${tmdbKey}`, accept: 'application/json' } },
      ]
      for (const a of attempts) {
        try {
          const res = await fetch(a.url, { headers: a.headers })
          if (res.ok) return await res.json()
        } catch {}
      }
      return null
    }

    const mapMovie = (m) => ({
      title: m.title,
      releaseDate: m.release_date || null,
      poster: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null,
      rating: typeof m.vote_average === 'number' ? Math.round(m.vote_average * 10) / 10 : null,
      infoUrl: `https://www.themoviedb.org/movie/${m.id}`,
    })
    const mapSeries = (s) => ({
      title: s.name,
      releaseDate: s.first_air_date || null,
      poster: s.poster_path ? `https://image.tmdb.org/t/p/w300${s.poster_path}` : null,
      rating: typeof s.vote_average === 'number' ? Math.round(s.vote_average * 10) / 10 : null,
      infoUrl: `https://www.themoviedb.org/tv/${s.id}`,
    })

    const [trendingMoviesRes, trendingSeriesRes, popularRes] = await Promise.all([
      tmdbGet('/trending/movie/week', {}),
      tmdbGet('/trending/tv/week', {}),
      tmdbGet('/movie/popular', { region: 'US', page: '1' }),
    ])

    // برای «گیشه» به‌جای پروکسی محبوبیت، از فیلد revenue واقعیِ TMDB استفاده
    // می‌کنیم (چون Box Office Mojo تو robots.txt خودش دسترسی خودکار رو کلاً
    // بسته). فیلم‌های «در حال اکران» اغلب هنوز revenue ثبت‌شده ندارن (این
    // فیلد با تأخیر آپدیت می‌شه)، برای همین به‌جاش مستقیم از discover با
    // sort_by=revenue.desc تو ۶ ماه اخیر می‌گیریم — TMDB خودش این‌جوری فقط
    // فیلم‌هایی که واقعاً revenue ثبت‌شده دارن رو بالا میاره.
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const todayStr = new Date().toISOString().slice(0, 10)
    const boxRes = await tmdbGet('/discover/movie', {
      sort_by: 'revenue.desc',
      'primary_release_date.gte': sixMonthsAgo,
      'primary_release_date.lte': todayStr,
      region: 'US',
      page: '1',
    })
    const boxOfficeCandidates = (boxRes?.results || []).filter((m) => m.title).slice(0, 10)
    const boxOfficeWithRevenue = await Promise.all(
      boxOfficeCandidates.map(async (m) => {
        const detail = await tmdbGet(`/movie/${m.id}`, {})
        return { ...m, revenue: detail?.revenue || 0 }
      })
    )

    const data = {
      trendingMoviesWeek: (trendingMoviesRes?.results || []).filter((m) => m.title).slice(0, 8).map(mapMovie),
      trendingSeriesWeek: (trendingSeriesRes?.results || []).filter((s) => s.name).slice(0, 8).map(mapSeries),
      popularMonth: (popularRes?.results || []).filter((m) => m.title).slice(0, 8).map(mapMovie),
      boxOffice: boxOfficeWithRevenue
        .filter((m) => m.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((m) => ({ ...mapMovie(m), revenue: m.revenue })),
    }

    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind('trending_boxoffice', JSON.stringify(data))
      .run()

    return data
  } catch {
    return empty
  }
}

// پرطرفدارترین آدم‌های این هفته (بازیگر/کارگردان) — از TMDB trending/person،
// شبیه بخش «Trending people» توی IMDb. یک‌روزه کش می‌شه.
async function fetchTrendingPeople(db, env) {
  if (!env.TMDB_API_KEY) return []
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('trending_people').first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 24 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data || '[]')
      } catch {
        return []
      }
    }

    const tmdbKey = env.TMDB_API_KEY
    async function tmdbGet(path, params) {
      const qs = new URLSearchParams(params).toString()
      const attempts = [
        { url: `https://api.themoviedb.org/3${path}?${qs}&api_key=${encodeURIComponent(tmdbKey)}`, headers: { accept: 'application/json' } },
        { url: `https://api.themoviedb.org/3${path}?${qs}`, headers: { Authorization: `Bearer ${tmdbKey}`, accept: 'application/json' } },
      ]
      for (const a of attempts) {
        try {
          const res = await fetch(a.url, { headers: a.headers })
          if (res.ok) return await res.json()
        } catch {}
      }
      return null
    }

    const res = await tmdbGet('/trending/person/week', { language: 'en-US' })
    const isLatinName = (name) => /^[A-Za-z0-9À-ÖØ-öø-ÿ'’.\-\s]+$/.test(name || '')
    const people = (res?.results || [])
      .filter((p) => p.name && !p.adult && isLatinName(p.name))
      .slice(0, 10)
      .map((p) => ({
        name: p.name,
        photo: p.profile_path ? `https://image.tmdb.org/t/p/w300${p.profile_path}` : null,
        knownFor: (p.known_for || [])
          .map((k) => k.title || k.name)
          .filter(Boolean)
          .slice(0, 2)
          .join(', '),
        infoUrl: `https://www.themoviedb.org/person/${p.id}`,
      }))

    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind('trending_people', JSON.stringify(people))
      .run()

    return people
  } catch {
    return []
  }
}

// تولدهای امروز به‌طور کلی (نه فقط اهالی کالکشن) — از Wikidata SPARQL: هنرمندان
// سینما که امروز متولد شدن، مرتب بر اساس تعداد sitelink (معیار شهرت). برای
// محدود موندن تعداد fetchها، فقط ۴ نفر اول عکس می‌گیرن.
async function fetchBornTodayGeneral(db) {
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('born_today').first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 24 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data || '[]')
      } catch {
        return []
      }
    }

    const now = new Date()
    const month = now.getUTCMonth() + 1
    const day = now.getUTCDate()
    const sparql = `SELECT DISTINCT ?person ?personLabel ?dob ?sitelinks WHERE {
      VALUES ?occ { wd:Q33999 wd:Q2526255 wd:Q10800557 }
      ?person wdt:P106 ?occ .
      ?person wdt:P569 ?dob .
      FILTER(MONTH(?dob) = ${month} && DAY(?dob) = ${day})
      ?person wikibase:sitelinks ?sitelinks .
      FILTER(?sitelinks > 30)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } ORDER BY DESC(?sitelinks) LIMIT 30`

    const wikidataHeaders = {
      'User-Agent': 'CinefilmArchive/1.0 (https://github.com/maz1maz/movies-archive; personal, single-user film archive app)',
      accept: 'application/sparql-results+json',
    }
    let res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers: wikidataHeaders })
    if (!res.ok) {
      // یه بار دیگه امتحان کن — سرویس Wikidata گاهی زیر بار سنگین موقتاً رد می‌کنه
      res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers: wikidataHeaders })
    }
    if (!res.ok) return []
    const data = await res.json()
    const rows = data?.results?.bindings || []
    const seenNames = new Set()
    const people = []
    for (const r of rows) {
      const name = r.personLabel?.value || null
      if (!name) continue
      const key = name.toLowerCase()
      if (seenNames.has(key)) continue // یه نفر ممکنه چند occupation match بشه (بازیگر + کارگردان)، تکراری نگیر
      seenNames.add(key)
      const dob = r.dob?.value ? r.dob.value.slice(0, 10) : null
      const year = dob ? parseInt(dob.slice(0, 4), 10) : null
      people.push({ name, birthYear: year, age: year ? now.getUTCFullYear() - year : null })
      if (people.length >= 10) break
    }

    // فقط برای ۴ نفر اول عکس بگیر (هزینه‌ی fetch رو کنترل می‌کنه)
    for (let i = 0; i < Math.min(4, people.length); i++) {
      try {
        const wikiRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=200&titles=${encodeURIComponent(people[i].name)}`,
          { headers: { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' } }
        )
        if (wikiRes.ok) {
          const wd = await wikiRes.json()
          const page = Object.values(wd?.query?.pages || {})[0]
          if (page?.thumbnail?.source) people[i].photo = page.thumbnail.source
        }
      } catch {}
    }

    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind('born_today', JSON.stringify(people))
      .run()

    return people
  } catch {
    return []
  }
}

// تقویم جشنواره‌های مهم سینمایی (Cannes/Venice/Berlinale/Sundance/TIFF/Oscars)
// — کاملاً خودکار، بدون هیچ لیست دستی. برای هر جشنواره:
//   ۱) با wbsearchentities اسم رو به Wikidata Q-ID تبدیل می‌کنیم (کش نمی‌شه چون
//      خودش سریعه و به‌ندرت عوض می‌شه، ولی نتیجه‌ی نهایی کل تابع کش می‌شه)
//   ۲) با SPARQL دنبال آیتم‌هایی می‌گردیم که «جزئی از سری» (P179) همون
//      جشنواره‌ن و تاریخ شروع (P580) دارن؛ نزدیک‌ترین ادیشن به امروز (چه در
//      حال برگزاری، چه در آینده) رو انتخاب می‌کنیم.
// کل نتیجه ۱۴ روز کش می‌شه (isCacheFresh) — چون تاریخ جشنواره‌ها به‌ندرت عوض می‌شه.
const FESTIVAL_SERIES = [
  'Cannes Film Festival',
  'Venice Film Festival',
  'Berlin International Film Festival',
  'Sundance Film Festival',
  'Toronto International Film Festival',
  'Academy Awards',
]

async function fetchFestivalCalendar(db) {
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('festivals').first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 14 * 24 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data || '[]')
      } catch {
        return []
      }
    }

    const wikidataHeaders = {
      'User-Agent': 'CinefilmArchive/1.0 (https://github.com/maz1maz/movies-archive; personal, single-user film archive app)',
      accept: 'application/sparql-results+json',
    }

    const results = await Promise.all(FESTIVAL_SERIES.map((name) => fetchOneFestival(name, wikidataHeaders)))
    const festivals = results.filter(Boolean)

    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind('festivals', JSON.stringify(festivals))
      .run()

    return festivals
  } catch {
    return []
  }
}

async function fetchOneFestival(seriesName, headers) {
  try {
    // ۱) اسم رو به Wikidata Q-ID تبدیل کن
    const searchRes = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(seriesName)}&language=en&type=item&format=json&limit=1`,
      { headers }
    )
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()
    const qid = searchData?.search?.[0]?.id
    if (!qid) return null

    // ۲) نزدیک‌ترین ادیشن (P179 = این جشنواره) به امروز رو پیدا کن — چه در حال
    // برگزاری چه در آینده. از ۳۰ روز پیش شروع می‌کنیم تا جشنوالی که همین الان
    // در حال برگزاریه رو هم از دست ندیم.
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const sparql = `SELECT ?item ?itemLabel ?start ?end ?website ?locationLabel WHERE {
      ?item wdt:P179 wd:${qid} .
      ?item wdt:P580 ?start .
      OPTIONAL { ?item wdt:P582 ?end. }
      OPTIONAL { ?item wdt:P856 ?website. }
      OPTIONAL { ?item wdt:P276 ?location. }
      FILTER(?start > "${cutoff}T00:00:00Z"^^xsd:dateTime)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } ORDER BY ASC(?start) LIMIT 1`

    let res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers })
    if (!res.ok) {
      res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers })
    }
    if (!res.ok) return null
    const data = await res.json()
    const row = data?.results?.bindings?.[0]
    if (!row) return null

    const start = row.start?.value ? row.start.value.slice(0, 10) : null
    const end = row.end?.value ? row.end.value.slice(0, 10) : start
    if (!start) return null

    return {
      name: row.itemLabel?.value || seriesName,
      location: row.locationLabel?.value || null,
      start,
      end,
      url: row.website?.value || null,
    }
  } catch {
    return null
  }
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
  const empty = { birthDate: null, deathDate: null, height: null, spouseIds: [], childrenIds: [], imdbId: null }
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

    // P345 = IMDb ID (برای اشخاص معمولاً به شکل nm1234567)
    const imdbId = claims.P345?.[0]?.mainsnak?.datavalue?.value || null

    return { birthDate, deathDate, height, spouseIds, childrenIds, imdbId }
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

// TMDB زبان اصلی رو با کد دو-حرفی ISO 639-1 برمی‌گردونه (مثلاً "fr")، ولی برای
// نمایش به کاربر اسم کامل بهتره؛ فقط زبان‌های رایج توی آرشیو فیلم رو پوشش می‌ده.
const LANGUAGE_CODE_NAMES = {
  en: 'English', fr: 'French', de: 'German', it: 'Italian', es: 'Spanish',
  ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ru: 'Russian', pt: 'Portuguese',
  fa: 'Persian', ar: 'Arabic', hi: 'Hindi', sv: 'Swedish', no: 'Norwegian',
  da: 'Danish', fi: 'Finnish', nl: 'Dutch', pl: 'Polish', tr: 'Turkish',
  he: 'Hebrew', cs: 'Czech', el: 'Greek', hu: 'Hungarian', th: 'Thai',
  id: 'Indonesian', vi: 'Vietnamese', uk: 'Ukrainian', ro: 'Romanian',
  ca: 'Catalan', sr: 'Serbian', hr: 'Croatian', bn: 'Bengali', ta: 'Tamil',
}
function languageCodeToName(code) {
  return LANGUAGE_CODE_NAMES[code] || code
}

// دقیقاً همون کاری که کاربر دستی انجام می‌ده: با عنوان (و سال) جستجو می‌کنه،
// بعد بین چند نتیجه‌ی بالای TMDB، اونی که کارگردانش با کارگردان شناخته‌شده‌ی
// فیلم (تو دیتابیس) یکی هست رو به‌عنوان تطبیق تأییدشده انتخاب می‌کنه — نه صرفاً
// اولین نتیجه‌ی جستجو (که باعث قاطی‌شدن فیلم‌های هم‌اسم می‌شه، مثل Deep Water).
// در آخر imdbId فیلم تأییدشده رو برمی‌گردونه تا enrichFilm/fetchTmdbExtras با
// همون آیدی دقیق (نه جستجوی مبهم عنوان) کار کنن.
function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // حذف اکسان‌ها
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}
function directorNamesOverlap(knownDirector, candidateDirectorNames) {
  if (!knownDirector || !candidateDirectorNames?.length) return false
  const knownParts = String(knownDirector).split(/[,&]/).map(normalizeName).filter(Boolean)
  const candParts = candidateDirectorNames.map(normalizeName).filter(Boolean)
  return knownParts.some((k) => candParts.some((c) => c === k || c.includes(k) || k.includes(c)))
}

async function findVerifiedImdbId(title, year, knownDirector, itemType, env) {
  const tmdbKey = env.TMDB_API_KEY
  if (!title || !tmdbKey) return null
  async function tmdbGet(path, params) {
    const qs = new URLSearchParams({ api_key: tmdbKey, ...params }).toString()
    try {
      const res = await fetch(`https://api.themoviedb.org/3${path}?${qs}`, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }
  const kind = itemType === 'series' ? 'tv' : 'movie'
  const searchParams = { query: title }
  if (year) searchParams[kind === 'tv' ? 'first_air_date_year' : 'year'] = String(year)
  const searchData = await tmdbGet(`/search/${kind}`, searchParams)
  const candidates = (searchData?.results || []).slice(0, 5)
  if (!candidates.length) return null

  // اگه کارگردان شناخته‌شده‌ست، بین کاندیدها دنبال تطبیق کارگردان می‌گردیم —
  // این همون گام تأییدیه‌ای که کاربر دستی انجام می‌ده.
  if (knownDirector) {
    for (const cand of candidates) {
      const credits = await tmdbGet(`/${kind}/${cand.id}/credits`, {})
      const directorNames = kind === 'tv'
        ? (credits?.crew || []).filter((c) => c.job === 'Director' || c.department === 'Directing').map((c) => c.name)
        : (credits?.crew || []).filter((c) => c.job === 'Director').map((c) => c.name)
      if (directorNamesOverlap(knownDirector, directorNames)) {
        const ext = await tmdbGet(`/${kind}/${cand.id}/external_ids`, {})
        if (ext?.imdb_id) return ext.imdb_id
      }
    }
    // هیچ کاندیدی کارگردانش تأیید نشد — به‌جای انتخاب اشتباه، چیزی برنمی‌گردونیم
    return null
  }

  // کارگردان شناخته‌شده نیست (خودش هم خالیه) — همون بهترین نتیجه رو با احتیاط برمی‌گردونیم
  const top = candidates[0]
  const ext = await tmdbGet(`/${kind}/${top.id}/external_ids`, {})
  return ext?.imdb_id || null
}

// خروجی fetchTmdbExtras رو روی فیلم اعمال می‌کنه — فقط فیلدهای خالی رو پر می‌کنه،
// هیچ‌وقت چیزی که خود کاربر/OMDb از قبل پر کرده رو رونویسی نمی‌کنه.
function isEmptyArrayField(v) {
  if (Array.isArray(v)) return v.length === 0
  return !v || v === '[]'
}
function applyTmdbExtras(film, extras) {
  if (!extras) return
  if (!film.tagline && extras.tagline) film.tagline = extras.tagline
  if (!film.budget && extras.budget) film.budget = extras.budget
  if (!film.revenue && extras.revenue) film.revenue = extras.revenue
  if (!film.originalLanguage && extras.originalLanguage) film.originalLanguage = languageCodeToName(extras.originalLanguage)
  if (isEmptyArrayField(film.productionCompanies) && extras.productionCompanies) {
    film.productionCompanies = JSON.stringify(extras.productionCompanies)
  }
  if (isEmptyArrayField(film.productionCountries) && extras.productionCountries) {
    film.productionCountries = JSON.stringify(extras.productionCountries)
  }
  if (!film.homepage && extras.homepage) film.homepage = extras.homepage
  if (isEmptyArrayField(film.spokenLanguages) && extras.spokenLanguages) {
    film.spokenLanguages = JSON.stringify(extras.spokenLanguages)
  }
  if (!film.status && extras.status) film.status = extras.status
  if (film.popularity == null && extras.popularity != null) film.popularity = extras.popularity
}

// تگ‌لاین/بودجه/فروش/زبان اصلی رو از TMDB می‌گیره — این‌ها توی OMDb نیستن. اول با imdbId، فیلم/سریال رو روی TMDB پیدا می‌کنیم (endpoint find)،
// بعد جزئیات کامل (endpoint movie/tv) رو می‌گیریم چون budget/revenue/tagline
// فقط توی جزئیات کامل‌ان، نه توی نتیجه‌ی find.
async function fetchTmdbExtras(imdbId, itemType, env) {
  const tmdbKey = env.TMDB_API_KEY
  if (!imdbId) return { extras: null, debug: 'no imdbId' }
  if (!tmdbKey) return { extras: null, debug: 'TMDB_API_KEY not set' }
  async function tmdbGet(url, useBearer) {
    const headers = useBearer
      ? { Authorization: `Bearer ${tmdbKey}`, accept: 'application/json' }
      : { accept: 'application/json' }
    const finalUrl = useBearer ? url : `${url}${url.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(tmdbKey)}`
    try {
      const res = await fetch(finalUrl, { headers })
      if (!res.ok) return { data: null, status: res.status }
      return { data: await res.json(), status: res.status }
    } catch (e) {
      return { data: null, status: 'fetch-error: ' + String(e) }
    }
  }
  let r1 = await tmdbGet(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`, false)
  if (!r1.data) r1 = await tmdbGet(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`, true)
  if (!r1.data) return { extras: null, debug: `find failed, status=${r1.status}` }
  const findData = r1.data
  const movieHit = (findData.movie_results || [])[0]
  const tvHit = (findData.tv_results || [])[0]
  const hit = itemType === 'series' ? (tvHit || movieHit) : (movieHit || tvHit)
  if (!hit) return { extras: null, debug: `find succeeded but no movie/tv match for ${imdbId}` }
  const kind = tvHit && !movieHit ? 'tv' : 'movie'
  let r2 = await tmdbGet(`https://api.themoviedb.org/3/${kind}/${hit.id}`, false)
  if (!r2.data) r2 = await tmdbGet(`https://api.themoviedb.org/3/${kind}/${hit.id}`, true)
  if (!r2.data) return { extras: null, debug: `details failed, status=${r2.status}` }
  const details = r2.data
  const extras = {
    tagline: details.tagline || undefined,
    budget: kind === 'movie' && details.budget ? details.budget : undefined,
    revenue: kind === 'movie' && details.revenue ? details.revenue : undefined,
    originalLanguage: details.original_language || undefined,
    productionCompanies: Array.isArray(details.production_companies) && details.production_companies.length
      ? details.production_companies.map((c) => c.name).filter(Boolean)
      : undefined,
    productionCountries: Array.isArray(details.production_countries) && details.production_countries.length
      ? details.production_countries.map((c) => c.name).filter(Boolean)
      : undefined,
    homepage: details.homepage || undefined,
    spokenLanguages: Array.isArray(details.spoken_languages) && details.spoken_languages.length
      ? details.spoken_languages.map((l) => l.english_name || l.name).filter(Boolean)
      : undefined,
    status: details.status || undefined,
    popularity: typeof details.popularity === 'number' ? details.popularity : undefined,
  }
  return { extras, debug: `ok, tmdbId=${hit.id}, kind=${kind}` }
}

// جوایز یه شخص (P166 «award received» روی Wikidata)، گروه‌بندی‌شده بر اساس
// اسم جایزه با تعداد تکرار — مثلاً «Academy Award for Best Director ×2».
async function fetchDirectorAwards(name) {
  try {
    const wikiRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageprops&titles=${encodeURIComponent(name)}`,
      { headers: { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' } }
    )
    if (!wikiRes.ok) return []
    const wikiData = await wikiRes.json()
    const page = Object.values(wikiData?.query?.pages || {})[0]
    const qid = page?.pageprops?.wikibase_item
    if (!qid) return []

    const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json`, {
      headers: { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' },
    })
    if (!res.ok) return []
    const data = await res.json()
    const claims = data?.entities?.[qid]?.claims || {}
    const awardClaims = claims.P166 || []
    if (!awardClaims.length) return []

    const awardIds = awardClaims.map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean)
    const labels = await resolveWikidataLabels(awardIds)

    // هر جایزه با سالش جدا نگه داشته می‌شه (نه فقط شمارش) — اگه شخص یه جایزه
    // رو چند سال برده باشه، هر سالش جدا لیست می‌شه. P585 = «point in time».
    const results = []
    for (const c of awardClaims) {
      const id = c.mainsnak?.datavalue?.value?.id
      const label = id && labels[id]
      if (!label) continue
      const timeVal = c.qualifiers?.P585?.[0]?.datavalue?.value?.time
      let year = null
      if (timeVal) {
        const m = timeVal.match(/^\+?(-?\d{1,4})-/)
        if (m) year = parseInt(m[1], 10)
      }
      // اگه برای یه فیلم/کار خاص بوده (P1686 «for work»)، اسمش رو هم می‌گیریم.
      const workId = c.qualifiers?.P1686?.[0]?.datavalue?.value?.id
      results.push({ label, year, workId })
    }

    // اسم فیلم‌هایی که جایزه بابتشون بوده رو resolve می‌کنیم.
    const workIds = [...new Set(results.map((r) => r.workId).filter(Boolean))]
    const workLabels = workIds.length ? await resolveWikidataLabels(workIds) : {}
    for (const r of results) {
      r.forWork = r.workId ? workLabels[r.workId] || null : null
      delete r.workId
    }

    // یکتاسازی (همون جایزه/سال/کار ممکنه از چند claim تکراری بیاد)
    const seen = new Set()
    const deduped = results.filter((r) => {
      const key = `${r.label}|${r.year}|${r.forWork}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    deduped.sort((a, b) => (b.year || 0) - (a.year || 0))
    return deduped.slice(0, 40)
  } catch {
    return []
  }
}

// فیلم‌هایی که این کارگردان ساخته ولی توی آرشیو نیستن، فیلترشده به اونایی که
// امتیازشون واقعاً بالاست. فیلتر اصلی رو رو امتیاز خودِ TMDB (vote_average،
// که رایگان و بدون درخواست اضافه از قبل داریمش) انجام می‌دیم، نه OMDb — چون
// کوتای رایگان OMDb (۱۰۰۰ درخواست/روز) خیلی زود با همین یه فیچر تموم می‌شه.
// OMDb/Letterboxd فقط برای غنی‌سازی (امتیاز رسمی IMDb، پوستر بهتر) best-effort
// امتحان می‌شن؛ اگه جواب ندادن، نتیجه رو حذف نمی‌کنیم.
async function fetchDirectorRecommendations(db, name, env) {
  if (!env.TMDB_API_KEY) return []
  const tmdbKey = env.TMDB_API_KEY

  async function tmdbGet(path, params) {
    const qs = new URLSearchParams(params).toString()
    const attempts = [
      { url: `https://api.themoviedb.org/3${path}?${qs}&api_key=${encodeURIComponent(tmdbKey)}`, headers: { accept: 'application/json' } },
      { url: `https://api.themoviedb.org/3${path}?${qs}`, headers: { Authorization: `Bearer ${tmdbKey}`, accept: 'application/json' } },
    ]
    for (const a of attempts) {
      try {
        const res = await fetch(a.url, { headers: a.headers })
        if (res.ok) return await res.json()
      } catch {}
    }
    return null
  }

  try {
    const search = await tmdbGet('/search/person', { query: name })
    const person = (search?.results || [])[0]
    if (!person) return []

    const credits = await tmdbGet(`/person/${person.id}/movie_credits`, {})
    const directed = (credits?.crew || []).filter((c) => c.job === 'Director')
    const seen = new Set()
    const candidates = []
    for (const c of directed) {
      if (!c.title || !c.release_date) continue
      const key = `${c.id}`
      if (seen.has(key)) continue
      seen.add(key)
      candidates.push({
        tmdbId: c.id,
        title: c.title,
        year: parseInt(c.release_date.slice(0, 4), 10),
        popularity: c.popularity || 0,
        tmdbRating: typeof c.vote_average === 'number' ? c.vote_average : null,
        posterPath: c.poster_path || null,
      })
    }
    if (!candidates.length) return []

    // فیلم‌هایی که از قبل تو آرشیون رو حذف کن (تطبیق با عنوان+سال، نادیده
    // گرفتن حروف بزرگ/کوچیک — همون منطق دوپلیکیت‌یاب).
    const existingRes = await db.prepare('SELECT title, year FROM films').all()
    const existingKeys = new Set(
      (existingRes.results || []).map((f) => `${normalizeTitle(f.title)}|${f.year || ''}`)
    )
    const missing = candidates.filter((c) => !existingKeys.has(`${normalizeTitle(c.title)}|${c.year || ''}`))

    // فیلتر اصلیِ کیفیت: امتیاز خودِ TMDB بالای ۷ (همون مقیاس IMDb، رایگان،
    // از قبل داریمش). فقط پرمحبوب‌ترین ۲۰ تا از این‌ها رو برای غنی‌سازی چک می‌کنیم.
    const toCheck = missing
      .filter((c) => c.tmdbRating != null && c.tmdbRating > 7)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 20)

    const results = []
    for (const c of toCheck) {
      let imdbRating = null
      let runtimeMins = null
      // پوستر رو اول از TMDB می‌گیریم (image.tmdb.org، همیشه از مرورگر لود
      // می‌شه)، نه از OMDb (که پوسترش رو media-amazon.com می‌ده و اون سایت
      // خیلی وقتا hotlinking از دامنه‌های دیگه رو بلاک می‌کنه و تصویر شکسته میاد).
      let poster = c.posterPath ? `https://image.tmdb.org/t/p/w300${c.posterPath}` : null

      // مدت‌زمان رو مستقیم از خود TMDB می‌گیریم (منبع اصلی و مطمئن‌تر از
      // OMDb برای این مورد) تا مطمئن بشیم فیلم کوتاه نیست.
      try {
        const details = await tmdbGet(`/movie/${c.tmdbId}`, {})
        if (typeof details?.runtime === 'number' && details.runtime > 0) {
          runtimeMins = details.runtime
        }
      } catch {}

      // OMDb فقط best-effort: اگه کوتاش تموم شده باشه یا جواب نده، مشکلی
      // نیست — امتیاز TMDB رو به‌جاش نگه می‌داریم، نه این‌که کل پیشنهاد رو حذف کنیم.
      try {
        const omdbRes = await fetch(
          `https://www.omdbapi.com/?apikey=${env.OMDB_API_KEY}&t=${encodeURIComponent(c.title)}&y=${c.year}&type=movie`,
          { signal: AbortSignal.timeout(8000) }
        )
        if (omdbRes.ok) {
          const omdbData = await omdbRes.json()
          if (omdbData.Response === 'True' && omdbData.imdbRating && omdbData.imdbRating !== 'N/A') {
            const parsed = parseFloat(omdbData.imdbRating)
            if (!isNaN(parsed)) imdbRating = parsed
            if (!poster && omdbData.Poster && omdbData.Poster !== 'N/A') poster = omdbData.Poster
          }
          if (runtimeMins == null) {
            const runtimeMatch = (omdbData.Runtime || '').match(/(\d+)/)
            if (runtimeMatch) runtimeMins = parseInt(runtimeMatch[1], 10)
          }
        }
      } catch {}

      // فقط فیلم بلند (۴۰ دقیقه به بالا) — اگه مدت‌زمانش از هیچ منبعی معلوم
      // نشد (نه TMDB نه OMDb)، به‌جای اینکه با شک نشونش بدیم، حذفش می‌کنیم.
      if (runtimeMins == null || runtimeMins < 40) continue

      // برچسب UI می‌گه «IMDb»، پس باید واقعاً IMDb باشه — نه امتیاز TMDB که
      // جای خالیش رو پر کنه. اگه OMDb واقعی جواب نداد، این پیشنهاد رو حذف
      // می‌کنیم به‌جای اینکه یه عدد از منبع دیگه رو با برچسب اشتباه نشون بدیم.
      if (imdbRating == null || imdbRating <= 7) continue

      // لترباکس هم best-effort — اگه واقعاً امتیازش پایینه (زیر ۳.۵) حذفش
      // می‌کنیم، ولی اگه فقط جواب نداد (بلاک/تغییر مارک‌آپ) نادیده می‌گیریم.
      const lb = await fetchLetterboxdRating(c.title, c.year)
      if (lb && lb.rating <= 3.5) continue

      results.push({
        title: c.title,
        year: c.year,
        imdbRating,
        letterboxdRating: lb ? lb.rating : null,
        poster,
      })
    }

    return results.sort((a, b) => b.imdbRating - a.imdbRating)
  } catch {
    return []
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
  if (typeof film.relatedFilms === 'string' && film.relatedFilms) {
    try { film.relatedFilms = JSON.parse(film.relatedFilms) } catch { film.relatedFilms = [] }
  } else if (!film.relatedFilms) {
    film.relatedFilms = []
  }
  if (typeof film.festivalAwards === 'string' && film.festivalAwards) {
    try { film.festivalAwards = JSON.parse(film.festivalAwards) } catch { film.festivalAwards = [] }
  } else if (!film.festivalAwards) {
    film.festivalAwards = []
  }
  if (typeof film.productionCompanies === 'string' && film.productionCompanies) {
    try { film.productionCompanies = JSON.parse(film.productionCompanies) } catch { film.productionCompanies = [] }
  } else if (!film.productionCompanies) {
    film.productionCompanies = []
  }
  if (typeof film.productionCountries === 'string' && film.productionCountries) {
    try { film.productionCountries = JSON.parse(film.productionCountries) } catch { film.productionCountries = [] }
  } else if (!film.productionCountries) {
    film.productionCountries = []
  }
  if (typeof film.spokenLanguages === 'string' && film.spokenLanguages) {
    try { film.spokenLanguages = JSON.parse(film.spokenLanguages) } catch { film.spokenLanguages = [] }
  } else if (!film.spokenLanguages) {
    film.spokenLanguages = []
  }
  film.trailerWatched = Boolean(film.trailerWatched)
  film.cultClassic = Boolean(film.cultClassic)
  film.experimental = Boolean(film.experimental)
  return film
}

// ---------- TMDB Collections (based on / sequel / prequel graph) ----------

// جزئیات کامل یه مجموعه‌ی TMDB (اسم، پوستر، لیست همه‌ی فیلم‌های عضو) —
// ۳۰ روز کش می‌شه چون به‌ندرت تغییر می‌کنه (فقط وقتی فیلم جدیدی به مجموعه اضافه بشه).
async function fetchCollectionDetails(db, env, collectionId) {
  const cacheKey = `collection:${collectionId}`
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind(cacheKey).first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 30 * 24 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data)
      } catch {}
    }
  } catch {}

  if (!env.TMDB_API_KEY) return null
  try {
    const res = await fetch(`https://api.themoviedb.org/3/collection/${collectionId}?api_key=${env.TMDB_API_KEY}`)
    if (!res.ok) return null
    const data = await res.json()
    const result = {
      id: data.id,
      name: data.name,
      poster: data.poster_path ? `https://image.tmdb.org/t/p/w342${data.poster_path}` : null,
      parts: (data.parts || [])
        .filter((p) => p.release_date)
        .map((p) => ({
          tmdbId: p.id,
          title: p.title,
          year: p.release_date ? parseInt(p.release_date.slice(0, 4), 10) : null,
          poster: p.poster_path ? `https://image.tmdb.org/t/p/w185${p.poster_path}` : null,
        }))
        .sort((a, b) => (a.year || 9999) - (b.year || 9999)),
    }
    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind(cacheKey, JSON.stringify(result))
      .run()
    return result
  } catch {
    return null
  }
}

// یه فیلم رو به یه TMDB collection وصل می‌کنه (اگه قبلاً چک نشده باشه). نتیجه
// رو مستقیم روی ردیف films ذخیره می‌کنه (collectionId='' یعنی چک‌شده و متعلق
// به هیچ مجموعه‌ای نیست، تا دوباره هر بار fetch نشه).
async function resolveFilmCollection(db, env, film) {
  if (film.collectionId != null) {
    // قبلاً چک شده — یا عضو یه مجموعه‌ست، یا مطمئنیم که نیست
    if (!film.collectionId) return null
    return { collectionId: film.collectionId, collectionName: film.collectionName, collectionPoster: film.collectionPoster }
  }
  if (!env.TMDB_API_KEY || film.itemType === 'series') {
    return null // TMDB collections فقط برای فیلمن، نه سریال
  }

  let tmdbMovieId = null
  try {
    if (film.imdbId) {
      const findRes = await fetch(
        `https://api.themoviedb.org/3/find/${film.imdbId}?api_key=${env.TMDB_API_KEY}&external_source=imdb_id`
      )
      if (findRes.ok) {
        const findData = await findRes.json()
        tmdbMovieId = findData?.movie_results?.[0]?.id || null
      }
    }
    if (!tmdbMovieId && film.title) {
      const q = encodeURIComponent(film.title)
      const yearParam = film.year ? `&year=${film.year}` : ''
      const searchRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${env.TMDB_API_KEY}&query=${q}${yearParam}`)
      if (searchRes.ok) {
        const searchData = await searchRes.json()
        tmdbMovieId = searchData?.results?.[0]?.id || null
      }
    }
    if (!tmdbMovieId) {
      await db.prepare("UPDATE films SET collectionId = '' WHERE id = ?").bind(film.id).run()
      return null
    }

    const movieRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbMovieId}?api_key=${env.TMDB_API_KEY}`)
    if (!movieRes.ok) return null
    const movieData = await movieRes.json()
    const collection = movieData.belongs_to_collection

    if (!collection) {
      await db.prepare("UPDATE films SET collectionId = '' WHERE id = ?").bind(film.id).run()
      return null
    }

    const collectionPoster = collection.poster_path ? `https://image.tmdb.org/t/p/w342${collection.poster_path}` : null
    await db
      .prepare('UPDATE films SET collectionId = ?, collectionName = ?, collectionPoster = ? WHERE id = ?')
      .bind(String(collection.id), collection.name, collectionPoster, film.id)
      .run()
    return { collectionId: String(collection.id), collectionName: collection.name, collectionPoster }
  } catch {
    return null
  }
}

// اقتباس از کتاب — خودکار از Wikidata، فیلد P144 «based on». اگه فیلم روی
// اثری مبتنیه، اسم اثر + نویسنده (P50) رو برمی‌گردونه. مثل collections، فقط
// یه بار چک می‌شه: basedOnBook=NULL یعنی هنوز چک‌نشده، ''=چک‌شده بدون اقتباس.
async function resolveBookAdaptation(db, env, film) {
  if (film.basedOnBook != null) {
    if (!film.basedOnBook) return null
    return { basedOnBook: film.basedOnBook, bookAuthor: film.bookAuthor || null }
  }
  if (!film.imdbId) return null

  try {
    const headers = {
      'User-Agent': 'CinefilmArchive/1.0 (https://github.com/maz1maz/movies-archive; personal, single-user film archive app)',
      accept: 'application/sparql-results+json',
    }
    const sparql = `SELECT ?workLabel ?authorLabel WHERE {
      ?film wdt:P345 "${film.imdbId}".
      ?film wdt:P144 ?work.
      OPTIONAL { ?work wdt:P50 ?author. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 1`

    let res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers })
    if (!res.ok) {
      res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers })
    }
    if (!res.ok) return null
    const data = await res.json()
    const row = data?.results?.bindings?.[0]

    if (!row) {
      await db.prepare("UPDATE films SET basedOnBook = '' WHERE id = ?").bind(film.id).run()
      return null
    }

    const workTitle = row.workLabel?.value || ''
    const author = row.authorLabel?.value || null
    if (!workTitle) {
      await db.prepare("UPDATE films SET basedOnBook = '' WHERE id = ?").bind(film.id).run()
      return null
    }

    await db.prepare('UPDATE films SET basedOnBook = ?, bookAuthor = ? WHERE id = ?').bind(workTitle, author, film.id).run()
    return { basedOnBook: workTitle, bookAuthor: author }
  } catch {
    return null
  }
}

// لوکیشن فیلم‌برداری — خودکار از Wikidata، فیلد P915 «filming location». مثل
// basedOnBook: shootingLocation=NULL یعنی هنوز چک‌نشده، ''=چک‌شده بدون لوکیشن ثبت‌شده.
async function resolveShootingLocation(db, env, film) {
  if (film.shootingLocation != null) {
    return film.shootingLocation || null
  }
  if (!film.imdbId) return null

  try {
    const headers = {
      'User-Agent': 'CinefilmArchive/1.0 (https://github.com/maz1maz/movies-archive; personal, single-user film archive app)',
      accept: 'application/sparql-results+json',
    }
    const sparql = `SELECT ?locationLabel WHERE {
      ?film wdt:P345 "${film.imdbId}".
      ?film wdt:P915 ?location.
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 5`

    let res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers })
    if (!res.ok) {
      res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers })
    }
    if (!res.ok) return null
    const data = await res.json()
    const rows = data?.results?.bindings || []

    if (!rows.length) {
      await db.prepare("UPDATE films SET shootingLocation = '' WHERE id = ?").bind(film.id).run()
      return null
    }

    const locations = [...new Set(rows.map((r) => r.locationLabel?.value).filter(Boolean))].join(', ')
    if (!locations) {
      await db.prepare("UPDATE films SET shootingLocation = '' WHERE id = ?").bind(film.id).run()
      return null
    }

    await db.prepare('UPDATE films SET shootingLocation = ? WHERE id = ?').bind(locations, film.id).run()
    return locations
  } catch {
    return null
  }
}

// جدول تشخیص جشنواره از روی متن اسم جایزه (Wikidata P166) — فقط ۵ جشنواره‌ی
// معتبر اصلی رو می‌شناسیم تا کارت پر از بج نشه؛ جوایز صنفی/منطقه‌ای نادیده
// گرفته می‌شن. هر کدوم یه emoji و رنگ مخصوص به خودش داره (نه لوگوی واقعی —
// به‌خاطر کپی‌رایت، لوگوهای رسمی جشنواره‌ها استفاده نمی‌شن).
const FESTIVAL_BADGES = [
  { test: /palme d.?or|cannes/i, festival: 'Cannes', icon: '🌿', color: '#d4af37' },
  { test: /golden lion|venice/i, festival: 'Venice', icon: '🦁', color: '#c9a227' },
  { test: /golden bear|berlin/i, festival: 'Berlin', icon: '🐻', color: '#c0392b' },
  { test: /academy award|oscar/i, festival: 'Oscar', icon: '🏆', color: '#f5c518' },
  { test: /sundance/i, festival: 'Sundance', icon: '🏔️', color: '#4a90d9' },
]

// همه‌ی جوایز واقعی فیلم — خودکار از Wikidata P166 «award received»، با سال
// دقیق (P585 قید «point in time») و دسته/عنوان جایزه (مثلاً «Academy Award
// for Best Actor»). ۵ جشنواره‌ی اصلی (بالا) بج و آیکون رنگی می‌گیرن، بقیه‌ی
// جوایز (گلدن گلوب، بفتا، اسکار، امی، جوایز صنفی و ...) هم لیست می‌شن ولی با
// آیکون عمومی. festivalAwards=NULL یعنی هنوز چک‌نشده، '[]'=چک‌شده بدون جایزه.
async function resolveFestivalAwards(db, env, film) {
  if (film.festivalAwards != null) {
    try {
      return JSON.parse(film.festivalAwards || '[]')
    } catch {
      return []
    }
  }
  if (!film.imdbId) return []

  try {
    const headers = {
      'User-Agent': 'CinefilmArchive/1.0 (https://github.com/maz1maz/movies-archive; personal, single-user film archive app)',
      accept: 'application/sparql-results+json',
    }
    // p:P166/ps:P166 + pq:P585 برای گرفتن قید «سال» روی خودِ claim
    // (wdt:P166 ساده فقط اسم جایزه رو می‌ده، بدون سال).
    const sparql = `SELECT ?awardLabel ?year WHERE {
      ?film wdt:P345 "${film.imdbId}".
      ?film p:P166 ?statement.
      ?statement ps:P166 ?award.
      OPTIONAL { ?statement pq:P585 ?time. BIND(YEAR(?time) AS ?year) }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 60`

    let res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers })
    if (!res.ok) {
      res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers })
    }
    if (!res.ok) return []
    const data = await res.json()
    const rows = data?.results?.bindings || []

    const matched = []
    const seen = new Set()
    for (const r of rows) {
      const label = r.awardLabel?.value
      if (!label) continue
      const year = r.year?.value ? parseInt(r.year.value, 10) : null
      const key = `${label}|${year}`
      if (seen.has(key)) continue
      seen.add(key)
      const badge = FESTIVAL_BADGES.find((b) => b.test.test(label))
      matched.push({
        award: label,
        year,
        festival: badge?.festival || null,
        icon: badge?.icon || '🏅',
        color: badge?.color || '#8a8a8a',
      })
    }

    matched.sort((a, b) => (b.year || 0) - (a.year || 0))
    await db.prepare('UPDATE films SET festivalAwards = ? WHERE id = ?').bind(JSON.stringify(matched), film.id).run()
    return matched
  } catch {
    return []
  }
}

// پوسترهای جایگزین یه فیلم/سریال از TMDB — برای اسلایدشوی خودکار روی کارت
// تو گرید. با imdbId فیلم TMDB رو پیدا می‌کنیم، عکس‌هاش رو می‌گیریم، تا ۵ تای
// برتر (بر اساس رأی) رو نگه می‌داریم. ۳۰ روز کش می‌شه (نتیجه‌ی خالی فقط
// ۳۰ دقیقه، تا اگه فیلم تازه امروز اضافه شده دوباره امتحان بشه).
// اسکن کل آرشیو برای پیدا کردن لینک‌های پوستر خراب (404 یا هر خطای دیگه).
// دسته‌دسته (concurrency محدود) چک می‌شه تا subrequest محدودیت Workers رد
// نشه؛ هر چند صد تا یه‌بار پیشرفت رو تو DB ذخیره می‌کنه تا حتی وسط کار هم
// بشه وضعیتش رو دید.
// اسکن کل آرشیو برای پیدا کردن لینک‌های پوستر خراب (404 یا هر خطای دیگه) —
// تکه‌تکه (هر بار CHUNK_SIZE فیلم). قبلاً بین تکه‌ها با یه fetch واقعی به
// خودِ Worker ادامه می‌داد، ولی self-fetch به دامنه‌ی workers.dev ظاهراً با
// یه محافظت لبه‌ی Cloudflare برخورد می‌کرد و ۴۰۴ می‌گرفت. الان به‌جاش یه
// کرون هر-۱-دقیقه (به wrangler.jsonc نگاه کن) هر بار یه تکه رو پیش می‌بره —
// چون هر تیک کرون یه invocation کاملاً جدا و مستقله، مشکل سقف subrequest هم
// همچنان حل می‌مونه، بدون نیاز به self-fetch.
async function runPosterAuditChunk(db) {
  const CHUNK_SIZE = 25
  const saveProgress = async (payload) => {
    try {
      await db
        .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES ('poster_audit', ?, datetime('now'))")
        .bind(JSON.stringify(payload))
        .run()
    } catch {}
  }

  try {
    const row = await db.prepare('SELECT data FROM cinema_news_cache WHERE key = ?').bind('poster_audit').first()
    const prev = row ? JSON.parse(row.data) : null
    if (!prev || prev.status !== 'running') return // چیزی برای ادامه نیست

    // قبلاً کل جدول (همه‌ی فیلم‌های دارای پوستر) رو با SELECT بدون LIMIT
    // می‌خوند و فقط سمت JS با slice() یه تکه‌ی ۲۵تایی برمی‌داشت — یعنی هر
    // چانک، صرف‌نظر از اینکه فقط ۲۵ ردیف لازم داشت، هزاران row-read از D1
    // مصرف می‌کرد. الان مستقیم با LIMIT/OFFSET همون ۲۵ تا رو می‌خونه.
    const offset = prev._offset || 0
    const totalRow = await db
      .prepare("SELECT COUNT(*) as cnt FROM films WHERE poster IS NOT NULL AND poster != ''")
      .first()
    const total = (totalRow && totalRow.cnt) || 0
    const batchRows = await db
      .prepare("SELECT id, title, poster FROM films WHERE poster IS NOT NULL AND poster != '' LIMIT ? OFFSET ?")
      .bind(CHUNK_SIZE, offset)
      .all()
    const batch = batchRows.results || []
    const broken = prev.broken || []

    await Promise.all(
      batch.map(async (f) => {
        try {
          const headers = { 'User-Agent': 'CinefilmArchive/1.0 (personal film archive app; poster link check)' }
          let res
          try {
            res = await fetch(f.poster, { method: 'HEAD', headers, signal: AbortSignal.timeout(8000) })
          } catch {
            res = null
          }
          if (!res || !res.ok) {
            res = await fetch(f.poster, { method: 'GET', headers, signal: AbortSignal.timeout(8000) })
          }
          if (!res.ok) broken.push({ id: f.id, title: f.title, poster: f.poster, status: res.status })
        } catch (e) {
          broken.push({ id: f.id, title: f.title, poster: f.poster, status: 'error', error: String(e).slice(0, 80) })
        }
      })
    )

    const newOffset = offset + batch.length
    const done = newOffset >= total
    await saveProgress({
      status: done ? 'done' : 'running',
      total,
      checked: newOffset,
      broken,
      _offset: newOffset,
    })
  } catch (e) {
    await saveProgress({ status: 'error', error: String(e) })
  }
}

async function fetchAltPosters(db, env, film) {
  const cacheKey = `posters:${film.id}`
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind(cacheKey).first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 30 * 24 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data)
      } catch {}
    }
  } catch {}

  if (!env.TMDB_API_KEY || !film.imdbId) return []
  try {
    const mediaType = film.itemType === 'series' ? 'tv' : 'movie'
    const findRes = await fetch(
      `https://api.themoviedb.org/3/find/${film.imdbId}?api_key=${env.TMDB_API_KEY}&external_source=imdb_id`
    )
    if (!findRes.ok) return []
    const findData = await findRes.json()
    const tmdbId = findData?.[`${mediaType}_results`]?.[0]?.id
    if (!tmdbId) return []

    const imgRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/images?api_key=${env.TMDB_API_KEY}`)
    if (!imgRes.ok) return []
    const imgData = await imgRes.json()
    const candidates = (imgData.posters || [])
      .filter((p) => p.file_path)
      .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
      .slice(0, 10)
      .map((p) => `https://image.tmdb.org/t/p/w500${p.file_path}`)

    // چندتا از این «پوسترهای جایگزین» عکس کاملاً یکسانن (فقط file_path
    // TMDB فرق داره — مثلاً یه‌بار با کیفیت متفاوت آپلود شده). بایت‌های هر
    // عکس رو می‌گیریم و هش می‌کنیم؛ اگه هش یکی بود یعنی عیناً همون عکسه، رد
    // می‌شه. این فقط یه‌بار در ماه (وقتی کش این فیلم منقضی شده) اجرا می‌شه.
    const seenHashes = new Set()
    const posters = []
    for (const url of candidates) {
      if (posters.length >= 5) break
      try {
        const imgFetch = await fetch(url)
        if (!imgFetch.ok) continue
        const buf = await imgFetch.arrayBuffer()
        const hashBuf = await crypto.subtle.digest('SHA-256', buf)
        const hashHex = [...new Uint8Array(hashBuf)].map((b) => b.toString(16).padStart(2, '0')).join('')
        if (seenHashes.has(hashHex)) continue
        seenHashes.add(hashHex)
        posters.push(url)
      } catch {
        posters.push(url)
      }
    }

    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind(cacheKey, JSON.stringify(posters))
      .run()
    return posters
  } catch {
    return []
  }
}

async function insertFilm(db, film) {
  const { id, title, originalTitle, closet, shelf, row, director, producer, cast, year, genre, rating, runtime, country, synopsis, poster, studio, rated, format, borrowedTo, borrowedDate, watched, imdbId, imdbVotes, metadataEnrichmentAttemptedAt, myRating, criterion, criterionCopies, copies, mediaType, driveNumber, itemType, seasonsEpisodes, letterboxdRating, watchlisted, seasonDrives,
    originalLanguage, boxOffice, tagline, budget, revenue, metascore, rottenTomatoes, releaseDate,
    productionCompanies, productionCountries, homepage, spokenLanguages, status, popularity,
    network, seriesStatus, schedule } = film
  await db.prepare(
    `INSERT INTO films (id, title, originalTitle, closet, shelf, row, director, producer, cast, year, genre, rating, runtime, country, synopsis, poster, studio, rated, format, borrowedTo, borrowedDate, watched, imdbId, imdbVotes, metadataEnrichmentAttemptedAt, myRating, criterion, criterionCopies, copies, mediaType, driveNumber, itemType, seasonsEpisodes, letterboxdRating, watchlisted, seasonDrives,
      originalLanguage, boxOffice, tagline, budget, revenue, metascore, rottenTomatoes, releaseDate,
      productionCompanies, productionCountries, homepage, spokenLanguages, status, popularity,
      network, seriesStatus, schedule)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?)`
  ).bind(
    id, title || null, originalTitle || null, closet || null, shelf || null, row || null,
    director || null, producer || null, cast ? (Array.isArray(cast) ? JSON.stringify(cast) : cast) : null,
    year || null, genre ? (Array.isArray(genre) ? JSON.stringify(genre) : genre) : null,
    rating || null, runtime || null, country || null,
    synopsis || null, poster || null, studio || null, rated || null,
    format || null, borrowedTo || null, borrowedDate || null,
    watched ? 1 : 0, imdbId || null, imdbVotes || null,
    metadataEnrichmentAttemptedAt || null, myRating || 0, criterion ? 1 : 0,
    criterion ? (criterionCopies || 1) : null,
    copies || 1, mediaType || 'physical', driveNumber || null,
    itemType || 'movie', seasonsEpisodes || null, letterboxdRating || null, watchlisted ? 1 : 0,
    seasonDrives ? (Array.isArray(seasonDrives) ? JSON.stringify(seasonDrives) : seasonDrives) : null,
    originalLanguage || null, boxOffice || null, tagline || null, budget || null, revenue || null,
    metascore || null, rottenTomatoes || null, releaseDate || null,
    productionCompanies ? (Array.isArray(productionCompanies) ? JSON.stringify(productionCompanies) : productionCompanies) : null,
    productionCountries ? (Array.isArray(productionCountries) ? JSON.stringify(productionCountries) : productionCountries) : null,
    homepage || null,
    spokenLanguages ? (Array.isArray(spokenLanguages) ? JSON.stringify(spokenLanguages) : spokenLanguages) : null,
    status || null, popularity || null,
    network || null, seriesStatus || null, schedule || null
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
    const before = { ...parsed }
    let enriched
    try {
      enriched = await enrichFilm(parsed, env.OMDB_API_KEY, () => bumpApiUsage('omdb'))
    } catch (e) {
      if (e.code === 'OMDB_QUOTA_EXCEEDED') {
        quotaExceeded = true
        break
      }
      throw e
    }
    try {
      const { extras } = await fetchTmdbExtras(enriched.imdbId, enriched.itemType, env)
      applyTmdbExtras(enriched, extras)
    } catch {}
    const fields = ENRICHABLE_FIELDS.filter((f) => isEmptyMetadata(before[f]) && !isEmptyMetadata(enriched[f]))
    if (fields.length) updated++
    enriched.metadataEnrichmentAttemptedAt = new Date().toISOString()
    await updateFilm(db, enriched)
    try {
      await syncSharedMetadataToSibling(db, enriched)
    } catch {}
  }

  const remaining = await db
    .prepare(
      `SELECT COUNT(*) as count FROM films WHERE (metadataEnrichmentAttemptedAt IS NULL OR poster IS NULL OR poster = '')${scopeClause}`
    )
    .first()

  return { processed: candidates.length, updated, remaining: remaining?.count || 0, quotaExceeded }
}

async function updateFilm(db, film) {
  const { id, title, originalTitle, closet, shelf, row, director, producer, cast, year, genre, rating, runtime, country, synopsis, poster, studio, rated, format, borrowedTo, borrowedDate, watched, imdbId, imdbVotes, metadataEnrichmentAttemptedAt, myRating, criterion, criterionCopies, copies, mediaType, driveNumber, itemType, seasonsEpisodes, letterboxdRating, letterboxdVotes, watchlisted, seasonDrives, personalReview, personalReviewUrl, personalReviewDate, reviews,
    cinematicMovement, relatedFilms, trailerWatched, trailerWatchedDate, basedOnBook, bookAuthor, screenwriter, cultClassic, shootingLocation, editionType, festivalAwards, screeningFormat, pacing, experimental, myNotes,
    originalLanguage, boxOffice, tagline, budget, revenue, metascore, rottenTomatoes, releaseDate,
    productionCompanies, productionCountries, homepage, spokenLanguages, status, popularity,
    network, seriesStatus, schedule } = film
  await db.prepare(
    `UPDATE films SET title=?, originalTitle=?, closet=?, shelf=?, row=?, director=?, producer=?, cast=?, year=?, genre=?, rating=?, runtime=?, country=?, synopsis=?, poster=?, studio=?, rated=?, format=?, borrowedTo=?, borrowedDate=?, watched=?, imdbId=?, imdbVotes=?, metadataEnrichmentAttemptedAt=?, myRating=?, criterion=?, criterionCopies=?, copies=?, mediaType=?, driveNumber=?, itemType=?, seasonsEpisodes=?, letterboxdRating=?, letterboxdVotes=?, watchlisted=?, seasonDrives=?, personalReview=?, personalReviewUrl=?, personalReviewDate=?, reviews=?,
      cinematicMovement=?, relatedFilms=?, trailerWatched=?, trailerWatchedDate=?, basedOnBook=?, bookAuthor=?, screenwriter=?, cultClassic=?, shootingLocation=?, editionType=?, festivalAwards=?, screeningFormat=?, pacing=?, experimental=?, myNotes=?,
      originalLanguage=?, boxOffice=?, tagline=?, budget=?, revenue=?, metascore=?, rottenTomatoes=?, releaseDate=?,
      productionCompanies=?, productionCountries=?, homepage=?, spokenLanguages=?, status=?, popularity=?,
      network=?, seriesStatus=?, schedule=?
     WHERE id=?`
  ).bind(
    title || null, originalTitle || null, closet || null, shelf || null, row || null,
    director || null, producer || null, cast && Array.isArray(cast) ? JSON.stringify(cast) : cast || null,
    year || null, genre && Array.isArray(genre) ? JSON.stringify(genre) : genre || null,
    rating || null, runtime || null, country || null,
    synopsis || null, poster || null, studio || null, rated || null,
    format || null, borrowedTo || null, borrowedDate || null,
    watched ? 1 : 0, imdbId || null, imdbVotes || null,
    metadataEnrichmentAttemptedAt || null, myRating || 0, criterion ? 1 : 0,
    criterion ? (criterionCopies || 1) : null,
    copies || 1, mediaType || 'physical', driveNumber || null,
    itemType || 'movie', seasonsEpisodes || null, letterboxdRating || null, letterboxdVotes || null, watchlisted ? 1 : 0,
    seasonDrives ? (Array.isArray(seasonDrives) ? JSON.stringify(seasonDrives) : seasonDrives) : null,
    personalReview || null, personalReviewUrl || null, personalReviewDate || null,
    reviews ? (Array.isArray(reviews) ? JSON.stringify(reviews) : reviews) : null,
    cinematicMovement || null,
    relatedFilms ? (Array.isArray(relatedFilms) ? JSON.stringify(relatedFilms) : relatedFilms) : null,
    trailerWatched ? 1 : 0, trailerWatchedDate || null,
    basedOnBook || null, bookAuthor || null, screenwriter || null,
    cultClassic ? 1 : 0, shootingLocation || null, editionType || null,
    festivalAwards ? (Array.isArray(festivalAwards) ? JSON.stringify(festivalAwards) : festivalAwards) : null,
    screeningFormat || null, pacing || null, experimental ? 1 : 0, myNotes || null,
    originalLanguage || null, boxOffice || null, tagline || null, budget || null, revenue || null,
    metascore || null, rottenTomatoes || null, releaseDate || null,
    productionCompanies ? (Array.isArray(productionCompanies) ? JSON.stringify(productionCompanies) : productionCompanies) : null,
    productionCountries ? (Array.isArray(productionCountries) ? JSON.stringify(productionCountries) : productionCountries) : null,
    homepage || null,
    spokenLanguages ? (Array.isArray(spokenLanguages) ? JSON.stringify(spokenLanguages) : spokenLanguages) : null,
    status || null, popularity || null,
    network || null, seriesStatus || null, schedule || null,
    id
  ).run()
}

// فیلدهای «توصیفیِ» فیلم که مستقل از فرمت (فیزیکی/دیجیتال) هستن و باید بین
// دو نسخه‌ی هم‌نام (بلوری + دیجیتالِ همون فیلم) یکسان بمونن. فیلدهای مخصوص
// فرمت (closet/shelf/row/driveNumber/format/criterion/copies/watched/...)
// عمداً اینجا نیستن، چون طبیعتاً بین دو نسخه فرق دارن.
const SHARED_METADATA_FIELDS = [
  'originalTitle', 'director', 'producer', 'cast', 'genre', 'rating',
  'runtime', 'country', 'synopsis', 'poster', 'studio', 'rated',
  'imdbId', 'imdbVotes', 'letterboxdRating', 'letterboxdVotes',
]

// بعد از هر آپدیت/enrich روی یه فیلم، اگه همون فیلم (با عنوان+سال یکسان) هم
// به‌صورت فیزیکی هم دیجیتال توی آرشیو باشه، فیلدهای توصیفی مشترک رو از رکورد
// تازه‌آپدیت‌شده روی نسخه‌ی دیگه هم می‌ریزیم — تا دیگه سینوپسیس/کست/امتیاز
// بین دو نسخه فرق نکنه. دیتای تازه‌تر (همینی که الان آپدیت شد) همیشه ارجحیت داره.
async function syncSharedMetadataToSibling(db, film) {
  if (!film.title || !film.mediaType) return
  const otherMediaType = film.mediaType === 'digital' ? 'physical' : 'digital'
  const sibling = await db
    .prepare(
      `SELECT * FROM films WHERE id != ? AND mediaType = ? AND LOWER(TRIM(REPLACE(title, char(8217), char(39)))) = LOWER(TRIM(REPLACE(?, char(8217), char(39)))) AND (year IS ? OR year = ?) LIMIT 1`
    )
    .bind(film.id, otherMediaType, film.title, film.year ?? null, film.year ?? null)
    .first()
  if (!sibling) return
  const siblingParsed = parseFilmRow(sibling)
  let changed = false
  for (const key of SHARED_METADATA_FIELDS) {
    const incoming = film[key]
    const isIncomingEmpty = incoming == null || (Array.isArray(incoming) ? incoming.length === 0 : String(incoming).trim() === '')
    if (isIncomingEmpty) continue
    const current = siblingParsed[key]
    const same = Array.isArray(incoming) && Array.isArray(current)
      ? JSON.stringify(incoming) === JSON.stringify(current)
      : incoming === current
    if (!same) {
      siblingParsed[key] = incoming
      changed = true
    }
  }
  if (changed) await updateFilm(db, siblingParsed)
}

