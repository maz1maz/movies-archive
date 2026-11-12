// وقتی سقف روزانه‌ی خواندن D1 پر می‌شه (یا D1 به هر دلیل جواب نمی‌ده)، به‌جای صفحه‌ی خالی،
// آخرین بکاپ روزانه‌ی فیلم‌ها (backup:latest تو KV، هر روز ۴ بامداد UTC) رو برای خواندن
// نشون می‌دیم: لیست/جست‌وجو/شمارنده/ژانر/دهه/جزئیات فیلم. هر نوشتن با ۵۰۳ رد می‌شه.
// سشن لاگین هم از کپی KV (sess:<token>) تأیید می‌شه چون جدول sessions تو D1 هم بلاکه.

const SESSION_TTL = 86400

function cookie(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

// بعد از هر لاگین/درخواست موفق، سشن رو تو KV یادداشت می‌کنیم (فقط اگه نبود)
export async function rememberSession(env, request, user) {
  try {
    const token = cookie(request, 'cf_session')
    if (!token || !user || !env.BACKUPS) return
    const key = `sess:${token}`
    if (await env.BACKUPS.get(key)) return
    await env.BACKUPS.put(key, JSON.stringify({ id: user.id, username: user.username, role: user.role }), { expirationTtl: SESSION_TTL })
  } catch {}
}

export async function forgetSession(env, request) {
  try {
    const token = cookie(request, 'cf_session')
    if (token && env.BACKUPS) await env.BACKUPS.delete(`sess:${token}`)
  } catch {}
}

export function looksLikeD1Failure(text) {
  return /D1_|\bD1\b|SQLITE_|rows? read|daily.{0,20}limit|database.{0,30}(limit|exceed|block)/i.test(String(text || ''))
}

let cache = null // {at, backedUpAt, films} — تو حافظه‌ی همین isolate، ۱۰ دقیقه

async function gunzipToText(buf) {
  const ds = new DecompressionStream('gzip')
  const stream = new Response(buf).body.pipeThrough(ds)
  return await new Response(stream).text()
}

async function loadBackup(env) {
  if (cache && Date.now() - cache.at < 600000) return cache
  const buf = await env.BACKUPS.get('backup:latest', 'arrayBuffer')
  if (!buf) return null
  const data = JSON.parse(await gunzipToText(buf))
  cache = { at: Date.now(), backedUpAt: data.backedUpAt, films: data.films || [] }
  return cache
}

const normSort = (t) => String(t || '').replace(/^the\s+/i, '').toLowerCase()
const alphaKey = (f) => (/^the /i.test(f.title || '') ? String(f.title).slice(4) : String(f.title || ''))

function applyFilters(films, p) {
  const q = (p.get('q') || '').toLowerCase()
  const searchIn = p.get('searchIn')
  const genre = p.get('genre')
  const alpha = p.get('alpha')
  const decade = parseInt(p.get('decade') || '', 10)
  const minRating = Number(p.get('minRating') || 0)
  const drive = p.get('drive')
  const arr = (v) => (Array.isArray(v) ? v : v ? [v] : [])
  return films.filter((f) => {
    if (p.get('mediaType') && f.mediaType !== p.get('mediaType')) return false
    if (p.get('itemType') && f.itemType !== p.get('itemType')) return false
    if (p.get('loaned') === '1' && !f.borrowedTo) return false
    if (p.get('criterion') === '1' && !f.criterion) return false
    if (p.get('watched') === '1' && !f.watched) return false
    if (p.get('watched') === '0' && f.watched) return false
    if (minRating && !(f.rating >= minRating)) return false
    if (p.get('shelf') && String(f.shelf) !== p.get('shelf')) return false
    if (p.get('closet') && String(f.closet) !== p.get('closet')) return false
    if (drive && !String(f.driveNumber || '').toLowerCase().includes(String(drive).toLowerCase())) return false
    if (genre && !arr(f.genre).includes(genre)) return false
    if (!Number.isNaN(decade) && !(f.year >= decade && f.year < decade + 10)) return false
    if (alpha) {
      const t = alphaKey(f)
      if (alpha === '0-9') { if (!/^[0-9]/.test(t)) return false }
      else if (alpha === '#') { if (/^[a-zA-Z0-9]/.test(t)) return false }
      else if (!t.toLowerCase().startsWith(alpha.toLowerCase())) return false
    }
    if (q) {
      const has = (v) => String(v || '').toLowerCase().includes(q)
      if (searchIn === 'people') {
        if (!(has(f.director) || has(f.producer) || has(JSON.stringify(f.cast || [])))) return false
      } else if (!q.trim().includes(' ')) {
        if (!(has(f.title) || has(f.originalTitle))) return false
      } else if (!(has(f.title) || has(f.originalTitle) || has(f.director) || has(JSON.stringify(f.cast || [])))) return false
    }
    return true
  })
}

function sortFilms(list, sort) {
  const byTitle = (a, b) => normSort(a.title).localeCompare(normSort(b.title), undefined, { numeric: true, sensitivity: 'base' })
  const s = list.slice()
  if (sort === 'year_desc') s.sort((a, b) => (b.year || 0) - (a.year || 0))
  else if (sort === 'year_asc') s.sort((a, b) => (a.year || 0) - (b.year || 0))
  else if (sort === 'rating') s.sort((a, b) => (b.rating || 0) - (a.rating || 0))
  else if (sort === 'shelf') s.sort((a, b) => String(a.shelf || '').localeCompare(String(b.shelf || '')))
  else s.sort(byTitle)
  return s
}

export async function staleResponse(request, env, corsHeaders, json) {
  const url = new URL(request.url)
  const { pathname } = url
  const p = url.searchParams
  const fail = (msg, status = 503) => json({ error: msg, stale: true }, status, corsHeaders)
  const NOTE = 'Database daily limit reached — showing the saved copy. Changes are disabled until it resets (about 03:30 Tehran).'

  // سشن: از KV
  let user = null
  try {
    const token = cookie(request, 'cf_session')
    if (token) user = await env.BACKUPS.get(`sess:${token}`, 'json')
  } catch {}
  if (pathname === '/api/auth/me') return json({ user, stale: true }, 200, { ...corsHeaders, 'X-Stale-Data': '1' })
  if (request.method !== 'GET') return fail(NOTE)
  if (!user) return json({ error: 'You need to log in to use the archive' }, 401, corsHeaders)

  const backup = await loadBackup(env).catch(() => null)
  if (!backup) return fail(NOTE)
  const hdr = { ...corsHeaders, 'X-Stale-Data': backup.backedUpAt || '1' }
  const films = backup.films
  const ok = (data, extra = {}) => json(data, 200, { ...hdr, ...extra })

  if (pathname === '/api/films') {
    const sorted = sortFilms(applyFilters(films, p), p.get('sort'))
    if (p.get('limit')) {
      const limit = Math.min(Math.max(parseInt(p.get('limit'), 10) || 48, 1), 500)
      const offset = Math.max(parseInt(p.get('offset'), 10) || 0, 0)
      return ok(sorted.slice(offset, offset + limit), { 'X-Total-Count': String(sorted.length), 'Access-Control-Expose-Headers': 'X-Total-Count, X-Stale-Data' })
    }
    return ok(sorted, { 'Access-Control-Expose-Headers': 'X-Stale-Data' })
  }
  if (pathname === '/api/films/counts') {
    const c = { physical: 0, physicalSeries: 0, digital: 0, digitalMovies: 0, digitalSeries: 0, minYear: null }
    for (const f of films) {
      const dig = f.mediaType === 'digital'
      const ser = f.itemType === 'series'
      if (dig) { c.digital++; if (ser) c.digitalSeries++; else c.digitalMovies++ }
      else if (ser) c.physicalSeries++
      else c.physical++
      if (f.year > 1880 && (c.minYear === null || f.year < c.minYear)) c.minYear = f.year
    }
    return ok(c)
  }
  if (pathname === '/api/genres') return ok([...new Set(films.flatMap((f) => (Array.isArray(f.genre) ? f.genre : f.genre ? [f.genre] : [])))].sort())
  if (pathname === '/api/decades') return ok([...new Set(films.filter((f) => f.year).map((f) => Math.floor(f.year / 10) * 10))].sort((a, b) => a - b))
  if (pathname === '/api/shelves') return ok([...new Set(films.map((f) => f.shelf).filter(Boolean))].sort())
  if (pathname === '/api/closets') return ok([...new Set(films.map((f) => f.closet).filter(Boolean))].sort((a, b) => Number(a) - Number(b)))
  const m = pathname.match(/^\/api\/films\/([^/]+)$/)
  if (m) {
    const f = films.find((x) => x.id === m[1])
    return f ? ok(f) : fail('Not in the saved copy', 404)
  }
  return fail(NOTE)
}
