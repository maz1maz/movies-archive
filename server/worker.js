// Cloudflare Workers API — replaces the old Express/Netlify server.
// Handles all /api/* routes using D1 for persistent storage.
import { json, rowToFilm, normalizeTitle, EDITABLE, ENRICHABLE_FIELDS, isEmptyMetadata, countSeasonsFromText, decodeHtmlEntities } from './helpers.js'
import { enrichFilm } from './omdb.js'
import { fetchTotalSeasons, enrichSeriesFromTVMazeById, fetchTvMazePersonUpcoming } from './tvmaze.js'
import * as XLSX from 'xlsx'
import { hashPassword, verifyPassword, getSessionUser, createSession, destroySession, sessionCookieHeader } from './auth.js'

import { notifyServerError, runDailyBackup, gunzipToText } from './lib/backup.js'
import { resolveLetterboxdPersonUrl, syncLetterboxdUserToReviews, parseLetterboxdRss, parseLetterboxdBasic, titleToLetterboxdSlug, fetchLetterboxdRating } from './lib/letterboxd.js'
import { fetchCinemaHeadlines, fetchCinemaHeadlinesFa } from './lib/cinemaNews.js'
import { fetchTodaysBirthdays, fetchUpcomingFromCollection, fetchTrendingTrailers, fetchGeneralUpcoming, fetchTrendingAndBoxOffice, fetchTrendingPeople, fetchBornTodayGeneral, fetchFestivalCalendar, ageFromBirthDate } from './lib/tmdbFeeds.js'
import { fetchWikidataFacts, resolveWikidataLabels, emptyPersonInfo } from './lib/wikidata.js'
import { findVerifiedImdbId, applyTmdbExtras, fetchTmdbExtras, fetchDirectorAwards, fetchDirectorRecommendations } from './lib/tmdbEnrich.js'
import { parseFilmRow, fetchCollectionDetails, resolveFilmCollection, resolveBookAdaptation, resolveShootingLocation, resolveFestivalAwards, runPosterAuditChunk, fetchAltPosters, insertFilm, enrichScopeClause, enrichBatch, updateFilm, syncSharedMetadataToSibling } from './lib/filmsDb.js'

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
    if (event.cron === '0 5 * * 7') {
      // هفتگی: sync نقد/رتبه‌ی سعید و علیرضا از لترباکسدشون — روی آرایه‌ی
      // چندنویسنده‌ی reviews[]، نه فیلد مشترک personalReview/myRating.
      const users = [
        { username: 'amosaeed', authorLabel: 'saeed' },
        { username: 'benadriann', authorLabel: 'alireza' },
      ]
      const results = []
      for (const u of users) {
        try {
          const r = await syncLetterboxdUserToReviews(env.DB, u.username, u.authorLabel)
          results.push(r)
        } catch (e) {
          await notifyServerError(env, `Weekly Letterboxd sync failed for ${u.username}: ${e.message}`).catch(() => {})
        }
      }
      console.log('Weekly Letterboxd sync:', JSON.stringify(results))
      return
    }

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

    // مثل requireAuth، ولی نقش «viewer» (کاربرهای Google که فقط اجازه‌ی
    // تماشا+امتیاز/ریویوی شخصی دارن) رو هم بلاک می‌کنه. برای هر endpoint
    // تغییردهنده (اضافه/ویرایش/حذف/امانت/جابه‌جایی قفسه و...) از این
    // استفاده کن، نه requireAuth ساده — به‌جز ذخیره‌ی امتیاز/ریویوی شخصی
    // که viewer هم باید بتونه انجامش بده.
    const requireEditAccess = () =>
      !currentUser
        ? json({ error: 'You need to log in for this action' }, 401, corsHeaders)
        : currentUser.role === 'viewer'
        ? json({ error: 'Viewer accounts can browse and rate/review only' }, 403, corsHeaders)
        : null

    // ---- گیت کلی: بدون لاگین هیچ‌چیزی از سایت در دسترس نیست — نه مرور،
    // نه سرچ، هیچی. فقط خود مسیرهای auth (لاگین/گوگل/خروج/وضعیت فعلی)
    // بدون لاگین قابل‌دسترسن، وگرنه هیچ‌کس نمی‌تونه اصلاً وارد بشه. ----
    const PUBLIC_AUTH_PATHS = ['/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/films/counts']
    if (!currentUser && pathname.startsWith('/api/') && !PUBLIC_AUTH_PATHS.includes(pathname)) {
      return json({ error: 'You need to log in to use the archive' }, 401, corsHeaders)
    }

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
        const role = body.role === 'admin' ? 'admin' : body.role === 'viewer' ? 'viewer' : 'user'
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
          if (body.role === 'admin' || body.role === 'user' || body.role === 'viewer') {
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
        const denied = requireEditAccess()
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
          const denied = requireEditAccess()
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
          const denied = requireEditAccess()
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
        const denied = requireEditAccess()
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
        const { q, genre, shelf, closet, sort, alpha, decade, drive, loaned, watched, minRating, mediaType, itemType, limit, offset, criterion } = Object.fromEntries(url.searchParams)
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
        if (criterion === '1') { sql += ' AND criterion = 1' }
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
        const searchIn = url.searchParams.get('searchIn') // 'people' یعنی صریحاً بازیگر/کارگردان/تهیه‌کننده هم جست‌وجو بشه
        if (q) {
          const ql = q.toLowerCase()
          const s = `%${ql}%`
          if (searchIn === 'people') {
            // کاربر صریحاً خواسته بازیگر/کارگردان/تهیه‌کننده هم چک بشه —
            // اینجا برخلاف حالت پیش‌فرض، substring ساده کافیه، چون همینو خواسته.
            sql += ` AND (LOWER(director) LIKE ? OR LOWER(producer) LIKE ? OR LOWER("cast") LIKE ?)`
            params.push(s, s, s)
          } else if (!ql.trim().includes(' ')) {
            // یه کلمه‌ی تنها (بدون فاصله، مثل "joe")، فقط تو عنوان بگرد —
            // وگرنه هر فیلمی که یه بازیگر به همون اسم کوچیک توش باشه
            // (مثلاً هر فیلم Joe Pesci برای سرچ "joe") هم میومد، که ربطی به
            // چیزی که کاربر دنبالشه نداره.
            sql += ` AND (LOWER(title) LIKE ? OR LOWER(originalTitle) LIKE ?)`
            params.push(s, s)
          } else {
            // اسم کامل (با فاصله، مثل "joe pesci") — کست/کارگردان هم بررسی می‌شه.
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

      // ---- GET /api/films/poster-color-batch (films with a poster but no
      // extracted dominant color yet — must come BEFORE the generic
      // /api/films/:id route below, which would otherwise treat
      // "poster-color-batch" as a film id and 404 first) ----
      if (method === 'GET' && pathname === '/api/films/poster-color-batch') {
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '40', 10) || 40, 100)
        const { results } = await db
          .prepare(
            `SELECT id, poster FROM films
             WHERE poster IS NOT NULL AND poster != '' AND posterColor IS NULL
             LIMIT ?`
          )
          .bind(limit)
          .all()
        return json(results, 200, corsHeaders)
      }

      // ---- GET /api/films/enrich-status (just the remaining count, no
      // processing) — must come BEFORE the generic /api/films/:id route
      // below, which would otherwise treat "enrich-status" as a film id
      // and 404 first. ----
      if (method === 'GET' && pathname === '/api/films/enrich-status') {
        const remaining = await db
          .prepare(
            `SELECT COUNT(*) as count FROM films WHERE (metadataEnrichmentAttemptedAt IS NULL OR poster IS NULL OR poster = '')${enrichScopeClause(url.searchParams)}`
          )
          .first()
        return json({ remaining: remaining?.count || 0 }, 200, corsHeaders)
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
        const denied = requireEditAccess()
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
        const body = await request.json()
        // نقش viewer فقط اجازه‌ی تغییر امتیاز/ریویوی شخصی خودش رو داره — نه
        // بقیه‌ی فیلدها. اگه body شامل چیزی خارج از این لیست بود، بلاکش کن.
        const VIEWER_ALLOWED_FIELDS = ['myRating', 'personalReview', 'personalReviewUrl', 'personalReviewDate', 'myReview', 'reviews']
        if (currentUser?.role === 'viewer' && Object.keys(body).some((k) => !VIEWER_ALLOWED_FIELDS.includes(k))) {
          return json({ error: 'Viewer accounts can only update their own rating/review' }, 403, corsHeaders)
        }
        const existing = await db.prepare('SELECT * FROM films WHERE id = ?').bind(patchMatch[1]).first()
        if (!existing) return json({ error: 'not found' }, 404, corsHeaders)
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
        const denied = requireEditAccess()
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
        const denied = requireEditAccess()
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
        const denied = requireEditAccess()
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
      const RESERVED_FILM_SUBPATHS = ['enrich', 'scan-photo', 'season-counts', 'poster-color-batch', 'reset-locations', 'bulk-move', 'bulk-set-drive', 'by-person', 'counts', 'enrich-status']
      if (method === 'POST' && enrichOneMatch && !RESERVED_FILM_SUBPATHS.includes(enrichOneMatch[1])) {
        const denied = requireEditAccess()
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

      // ---- POST /api/films/enrich ----
      // Optional ?mediaType=physical|digital and ?itemType=movie|series scope
      // the batch to whichever section the user currently has open, so the
      // "Fill missing details" button only touches that section's films.
      if (method === 'POST' && pathname === '/api/films/enrich') {
        const denied = requireEditAccess()
        if (denied) return denied
        const requestedLimit = parseInt(url.searchParams.get('limit') || '10', 10)
        const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 15) : 10
        const result = await enrichBatch(db, env, limit, enrichScopeClause(url.searchParams))
        return json(result, 200, corsHeaders)
      }

      // ---- POST /api/films/season-counts (fetch "total seasons produced so
      // far" from TVMaze for series that don't have it yet) ----
      if (method === 'POST' && pathname === '/api/films/season-counts') {
        const denied = requireEditAccess()
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
          const authErr = requireEditAccess()
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
        const denied = requireEditAccess()
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
        const denied = requireEditAccess()
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
        const denied = requireEditAccess()
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
        const denied = requireEditAccess()
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
        const denied = requireEditAccess()
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
        const denied = requireEditAccess()
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
        const denied = requireEditAccess()
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

      // ---- POST /api/shelf/reset (clear closet/row/shelf for every film
      // matching the given scope — used by the "Reset Shelf/Row/Closet"
      // buttons on the bookshelf page) ----
      if (method === 'POST' && pathname === '/api/shelf/reset') {
        const denied = requireEditAccess()
        if (denied) return denied
        let body = {}
        try {
          body = await request.json()
        } catch {
          return json({ error: 'Invalid request body' }, 400, corsHeaders)
        }
        const scope = body.scope
        const closet = (body.closet ?? '').toString().trim()
        const row = (body.row ?? '').toString().trim()
        const shelf = (body.shelf ?? '').toString().trim()
        if (!['shelf', 'row', 'closet'].includes(scope)) {
          return json({ error: 'scope must be shelf, row, or closet' }, 400, corsHeaders)
        }
        if (!closet) return json({ error: 'closet is required' }, 400, corsHeaders)
        if (scope !== 'closet' && !row) return json({ error: 'row is required for this scope' }, 400, corsHeaders)
        if (scope === 'shelf' && !shelf) return json({ error: 'shelf is required for this scope' }, 400, corsHeaders)

        let sql = "UPDATE films SET closet = NULL, row = NULL, shelf = NULL WHERE closet = ?"
        const binds = [closet]
        if (scope === 'row' || scope === 'shelf') {
          sql += ' AND row = ?'
          binds.push(row)
        }
        if (scope === 'shelf') {
          sql += ' AND shelf = ?'
          binds.push(shelf)
        }
        const result = await db.prepare(sql).bind(...binds).run()
        return json({ success: true, cleared: result.meta?.changes ?? 0 }, 200, corsHeaders)
      }

      // ---- POST /api/films/poster-color-batch — { colors: [{id, color}] } ----
      if (method === 'POST' && pathname === '/api/films/poster-color-batch') {
        const denied = requireEditAccess()
        if (denied) return denied
        let body = {}
        try {
          body = await request.json()
        } catch {
          return json({ error: 'Invalid request body' }, 400, corsHeaders)
        }
        const colors = Array.isArray(body.colors) ? body.colors : []
        let updated = 0
        for (const c of colors) {
          if (!c || !c.id) continue
          // color=='' یعنی این پوستر قابل خوندن نبود (CORS یا خطای لود) —
          // بازم ثبتش می‌کنیم (رشته‌ی خالی، نه NULL) که دیگه هر دفعه دوباره
          // امتحانش نکنیم؛ getSpineColor خودش رشته‌ی خالی رو نادیده می‌گیره.
          await db.prepare('UPDATE films SET posterColor = ? WHERE id = ?').bind(c.color || '', c.id).run()
          updated++
        }
        return json({ success: true, updated }, 200, corsHeaders)
      }

      // ---- POST /api/shelf/fill (assign the next N alphabetically-sorted,
      // not-yet-shelved physical films — starting at/after startTitle — to a
      // given closet/row/shelf). Sorting ignores a leading "The", matching
      // the same convention used by the bookshelf display itself. ----
      if (method === 'POST' && pathname === '/api/shelf/fill') {
        const denied = requireEditAccess()
        if (denied) return denied
        let body = {}
        try {
          body = await request.json()
        } catch {
          return json({ error: 'Invalid request body' }, 400, corsHeaders)
        }
        const closet = (body.closet ?? '').toString().trim()
        const row = (body.row ?? '').toString().trim()
        const shelf = (body.shelf ?? '').toString().trim()
        const startTitle = (body.startTitle ?? '').toString().trim()
        const count = parseInt(body.count, 10)
        if (!closet || !row || !shelf) return json({ error: 'closet, row and shelf are required' }, 400, corsHeaders)
        if (!startTitle) return json({ error: 'startTitle is required' }, 400, corsHeaders)
        if (!Number.isFinite(count) || count < 1) return json({ error: 'count must be a positive number' }, 400, corsHeaders)

        const sortKey = (t) => (t || '').replace(/^the\s+/i, '').toLowerCase()

        const { results: unassigned } = await db
          .prepare(
            `SELECT id, title, copies FROM films
             WHERE mediaType != 'digital'
               AND (closet IS NULL OR closet = '')
               AND (row IS NULL OR row = '')
               AND (shelf IS NULL OR shelf = '')`
          )
          .all()

        unassigned.sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title)))
        const startKey = sortKey(startTitle)
        const startIdx = unassigned.findIndex((f) => sortKey(f.title).localeCompare(startKey) >= 0)
        if (startIdx === -1) {
          return json({ error: `No unassigned film found alphabetically at or after "${startTitle}"` }, 404, corsHeaders)
        }

        // count یعنی تعداد جای خالیِ فیزیکی روی قفسه (اسپاین‌ها)، نه تعداد
        // عنوان — یه فیلم با copies=3 سه تا اسپاین اشغال می‌کنه، پس سه واحد
        // از count رو مصرف می‌کنه، نه یکی.
        const batch = []
        let slotsUsed = 0
        for (let i = startIdx; i < unassigned.length && slotsUsed < count; i++) {
          const f = unassigned[i]
          const copies = Number(f.copies) > 0 ? Number(f.copies) : 1
          if (slotsUsed + copies > count && batch.length > 0) break
          batch.push({ ...f, copies })
          slotsUsed += copies
        }
        if (!batch.length) {
          return json({ error: 'No matching unassigned films found' }, 404, corsHeaders)
        }

        for (const f of batch) {
          await db.prepare('UPDATE films SET closet = ?, row = ?, shelf = ? WHERE id = ?').bind(closet, row, shelf, f.id).run()
        }

        return json(
          {
            success: true,
            assigned: batch.length,
            slotsUsed,
            firstTitle: batch[0].title,
            lastTitle: batch[batch.length - 1].title,
            remainingAfter: unassigned.length - (startIdx + batch.length),
          },
          200,
          corsHeaders
        )
      }

      // ---- POST /api/letterboxd-sync (pull the user's own diary entries/reviews
      // from their public Letterboxd RSS feed and attach them to matching films) ----
      // محدودیت مهم: فید RSS لترباکس فقط ~۵۰ ورودی آخر دیاری رو می‌ده، نه کل
      // تاریخچه؛ هر بار sync فقط همین اواخر رو چک می‌کنه.
      if (method === 'POST' && pathname === '/api/letterboxd-sync') {
        const denied = requireEditAccess()
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
        const denied = requireEditAccess()
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
        const denied = requireEditAccess()
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
        const denied = requireEditAccess()
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
        const denied = requireEditAccess()
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
