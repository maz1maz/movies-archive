import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import { enrichFilm } from './omdb.js'
import { ENRICHABLE_FIELDS, EDITABLE, rowToFilm, normalizeTitle, isEmptyMetadata } from './helpers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PORT = process.env.PORT || 3001
const DATA_DIR = path.join(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'films.json')

const app = express()
app.use(express.json())

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
})

// ---------- ذخیره‌سازی ----------
function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]')
}
function readFilms() {
  ensureData()
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
  } catch {
    return []
  }
}
function writeFilms(films) {
  ensureData()
  // Keep a rolling backup before every write so imports and edits are recoverable.
  const backupDir = path.join(DATA_DIR, 'backups')
  fs.mkdirSync(backupDir, { recursive: true })
  if (fs.existsSync(DATA_FILE)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    fs.copyFileSync(DATA_FILE, path.join(backupDir, `films-${stamp}.json`))
    const backups = fs.readdirSync(backupDir).sort()
    for (const old of backups.slice(0, -30)) fs.unlinkSync(path.join(backupDir, old))
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(films, null, 2), 'utf-8')
}

// Keep enrichment failure non-fatal: a film must still be saved when OMDb is
// temporarily unavailable or has no match for its title.
async function enrichMissingMetadata(film) {
  const key = process.env.OMDB_API_KEY
  if (!key) return { film, enabled: false, fields: [] }

  try {
    const enriched = await enrichFilm(film, key)
    const fields = ENRICHABLE_FIELDS.filter(
      (field) => isEmptyMetadata(film[field]) && !isEmptyMetadata(enriched[field])
    )
    return { film: enriched, enabled: true, fields }
  } catch {
    return { film, enabled: true, fields: [] }
  }
}

// ---------- مسیرهای API ----------
app.get('/api/films', (req, res) => {
  const { q, genre, shelf, sort, alpha, decade, loaned, watched, minRating } = req.query
  let films = readFilms()
  if (loaned === '1') films = films.filter((f) => f.borrowedTo)
  if (watched === '1') films = films.filter((f) => f.watched === true)
  if (watched === '0') films = films.filter((f) => f.watched !== true)
  if (minRating) films = films.filter((f) => Number(f.rating || 0) >= Number(minRating))
  if (q) {
    const s = q.toString().toLowerCase()
    films = films.filter(
      (f) =>
        (f.title || '').toLowerCase().includes(s) ||
        (f.originalTitle || '').toLowerCase().includes(s) ||
        (f.director || '').toLowerCase().includes(s) ||
        (f.cast || []).join(' ').toLowerCase().includes(s)
    )
  }
  if (genre) films = films.filter((f) => (f.genre || []).includes(genre))
  if (shelf) films = films.filter((f) => (f.shelf || '').toString() === shelf)
  if (alpha) {
    const a = alpha.toString().toLowerCase()
    if (a === '0-9') {
      films = films.filter((f) => /^\d/.test(f.title || ''))
    } else {
      films = films.filter((f) => {
        const t = (f.title || '').toLowerCase()
        return t && t[0] === a
      })
    }
  }
  if (decade) {
    const d = parseInt(decade, 10)
    if (!isNaN(d)) {
      films = films.filter(
        (f) => typeof f.year === 'number' && Math.floor(f.year / 10) * 10 === d
      )
    }
  }
  if (sort === 'year_desc') films.sort((a, b) => (b.year || 0) - (a.year || 0))
  else if (sort === 'year_asc') films.sort((a, b) => (a.year || 0) - (b.year || 0))
  else if (sort === 'rating')
    films.sort((a, b) => (b.rating || 0) - (a.rating || 0))
  else if (sort === 'shelf')
    films.sort((a, b) =>
      (a.shelf || '').localeCompare(b.shelf || '', 'en')
    )
  res.json(films)
})

app.get('/api/films/:id', (req, res) => {
  const film = readFilms().find((f) => f.id === req.params.id)
  if (!film) return res.status(404).json({ error: 'یافت نشد' })
  res.json(film)
})

// Process a bounded batch so a large imported catalogue can be completed
// without holding one request open for hundreds of external lookups.
app.post('/api/films/enrich', async (req, res) => {
  if (!process.env.OMDB_API_KEY) {
    return res.status(400).json({ error: 'OMDB_API_KEY is not configured' })
  }

  const requestedLimit = parseInt(req.query.limit, 10)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 15)
    : 10
  const films = readFilms()
  const candidates = films
    .map((film, index) => ({ film, index }))
    .filter(({ film }) =>
      ENRICHABLE_FIELDS.some((field) => isEmptyMetadata(film[field])) &&
      !film.metadataEnrichmentAttemptedAt
    )
    .slice(0, limit)

  let updated = 0
  for (const { film, index } of candidates) {
    const enrichment = await enrichMissingMetadata(film)
    if (enrichment.fields.length) updated++
    films[index] = {
      ...enrichment.film,
      metadataEnrichmentAttemptedAt: new Date().toISOString(),
    }
  }

  if (candidates.length) writeFilms(films)
  const remaining = films.filter(
    (film) =>
      ENRICHABLE_FIELDS.some((field) => isEmptyMetadata(film[field])) &&
      !film.metadataEnrichmentAttemptedAt
  ).length
  res.json({ processed: candidates.length, updated, remaining })
})

app.post('/api/films', async (req, res) => {
  const films = readFilms()
  const body = req.body || {}
  if (!String(body.title || '').trim()) {
    return res.status(400).json({ error: 'title is required' })
  }

  const film = {
    ...body,
    id: `f${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: String(body.title).trim(),
    shelf: body.shelf || '',
    row: body.row || '',
  }
  const enrichment = await enrichMissingMetadata(film)
  films.push(enrichment.film)
  writeFilms(films)
  res.status(201).json({
    ...enrichment.film,
    _enrichment: {
      enabled: enrichment.enabled,
      fields: enrichment.fields,
    },
  })
})

// Fill only missing public metadata for an existing film. This is useful for
// items that were added before automatic enrichment was enabled.
app.post('/api/films/:id', async (req, res) => {
  const films = readFilms()
  const i = films.findIndex((film) => film.id === req.params.id)
  if (i < 0) return res.status(404).json({ error: 'not found' })

  const enrichment = await enrichMissingMetadata(films[i])
  films[i] = enrichment.film
  writeFilms(films)
  res.json({
    ...enrichment.film,
    _enrichment: {
      enabled: enrichment.enabled,
      fields: enrichment.fields,
    },
  })
})

app.patch('/api/films/:id', (req, res) => {
  const films = readFilms()
  const i = films.findIndex((f) => f.id === req.params.id)
  if (i < 0) return res.status(404).json({ error: 'not found' })
  const updated = { ...films[i] }
  for (const k of EDITABLE) {
    if (k in req.body) updated[k] = req.body[k]
  }
  updated.id = films[i].id
  films[i] = updated
  writeFilms(films)
  res.json(updated)
})

app.get('/api/genres', (req, res) => {
  const set = new Set()
  readFilms().forEach((f) => (f.genre || []).forEach((g) => set.add(g)))
  res.json([...set].sort((a, b) => a.localeCompare(b, 'fa')))
})

app.get('/api/shelves', (req, res) => {
  const set = new Set()
  readFilms().forEach((f) => {
    if (f.shelf) set.add(f.shelf.toString())
  })
  res.json([...set].sort((a, b) => a.localeCompare(b, 'fa')))
})

app.get('/api/decades', (req, res) => {
  const set = new Set()
  readFilms().forEach((f) => {
    if (typeof f.year === 'number')
      set.add(Math.floor(f.year / 10) * 10)
  })
  res.json([...set].sort((a, b) => a - b))
})

// جستجوی تکی اطلاعات فیلم از OMDb (برای پرشدن خودکار فرم افزودن فیلم)
app.get('/api/omdb-lookup', async (req, res) => {
  const key = process.env.OMDB_API_KEY
  if (!key) {
    return res.status(400).json({ error: 'OMDB_API_KEY تنظیم نشده — امکان جستجوی خودکار از IMDb وجود نداره' })
  }
  const title = (req.query.title || '').toString().trim()
  if (!title) return res.status(400).json({ error: 'عنوان فیلم رو وارد کن' })
  const year = (req.query.year || '').toString().trim()

  try {
    const before = { title, year: year ? parseInt(year, 10) : undefined }
    const found = await enrichFilm(before, key)
    const gotNewData = Object.keys(found).some(
      (k) => !(k in before) || found[k] !== before[k]
    )
    if (!gotNewData) {
      return res.status(404).json({ error: 'فیلمی با این عنوان توی IMDb پیدا نشد' })
    }
    res.json(found)
  } catch (e) {
    res.status(502).json({ error: 'خطا در ارتباط با OMDb' })
  }
})

// کش ساده‌ی حافظه‌ای برای عکس بازیگرها (فقط برای اجرای لوکال؛ نسخه‌ی
// Cloudflare Worker از جدول D1 برای کش دائمی استفاده می‌کنه)
const actorPhotoCache = new Map()

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
    // سانتی‌متر (Q174728) — قبلاً همیشه فرض می‌شد متره که برای مقادیر
    // سانتی‌متری یه عدد مسخره مثل ۱۷۰۰۰ می‌داد.
    let height = null
    const heightVal = claims.P2048?.[0]?.mainsnak?.datavalue?.value
    if (heightVal?.amount) {
      const num = parseFloat(heightVal.amount)
      const unit = String(heightVal.unit || '')
      if (!isNaN(num)) {
        if (unit.endsWith('Q174728')) height = `${Math.round(num)} cm`
        else height = `${Math.round(num * 100)} cm`
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

app.get('/api/actor-photo', async (req, res) => {
  const name = (req.query.name || '').toString().trim()
  const empty = { photo: null, bio: null, birthDate: null, deathDate: null, height: null, spouse: null, children: null, age: null }
  if (!name) return res.json(empty)
  const cacheKey = name.toLowerCase()
  if (actorPhotoCache.has(cacheKey)) {
    const cached = actorPhotoCache.get(cacheKey)
    return res.json({ ...cached, age: cached.deathDate ? null : ageFromBirthDate(cached.birthDate) })
  }
  const info = { photo: null, bio: null, birthDate: null, deathDate: null, height: null, spouse: null, children: null }
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
        if (wd.spouseIds.length) info.spouse = wd.spouseIds.map((id) => labels[id]).filter(Boolean).join(', ') || null
        if (wd.childrenIds.length) info.children = wd.childrenIds.map((id) => labels[id]).filter(Boolean).join(', ') || null
      }
    }
    actorPhotoCache.set(cacheKey, info)
    res.json({ ...info, age: info.deathDate ? null : ageFromBirthDate(info.birthDate) })
  } catch (e) {
    res.json(empty)
  }
})

// ایمپورت اکسل (ادغام با داده‌های قبلی بر اساس نام فیلم)
app.post('/api/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'فایل ارسال نشد' })
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
    if (!rows.length) return res.status(400).json({ error: 'فایل خالیه' })

    let imported = rows.map((r, i) => rowToFilm(r, i))

    const key = process.env.OMDB_API_KEY
    if (key) {
      imported = await Promise.all(
        imported.map(async (f) => {
          try {
            return await enrichFilm(f, key)
          } catch {
            return f
          }
        })
      )
    }

    // ادغام با آرشیو قبلی
    const existing = readFilms()
    const byTitle = new Map(existing.map((f) => [normalizeTitle(f.title), f]))
    let added = 0
    let updated = 0
    for (const f of imported) {
      const t = normalizeTitle(f.title)
      if (byTitle.has(t)) {
        const old = byTitle.get(t)
        byTitle.set(t, { ...old, ...f, id: old.id })
        updated++
      } else {
        byTitle.set(t, f)
        added++
      }
    }
    writeFilms([...byTitle.values()])
    res.json({ count: imported.length, added, updated })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// دانلود قالب اکسل خالی
app.get('/api/template', (req, res) => {
  const ws = XLSX.utils.aoa_to_sheet([
    [
      'Title',
      'Shelf',
      'Row',
      'Format',
      'Watched',
      'Director',
      'Cast',
      'Year',
      'Genre',
      'Rating',
      'Runtime',
      'Country',
      'Studio',
      'MPA Rating',
      'Synopsis',
      'Poster URL',
      'Original Title',
    ],
    [
      'Example: The Godfather',
      'A',
      '3',
      '4K UHD',
      'No',
      'Francis Ford Coppola',
      'Marlon Brando, Al Pacino',
      '1972',
      'Crime, Drama',
      '9.2',
      '175',
      'USA',
      'Paramount Pictures',
      'R',
      'Story of the Corleone crime family',
      'https://example.com/poster.jpg',
      'The Godfather',
    ],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'فیلم‌ها')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="film-archive-template.xlsx"'
  )
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  res.send(buf)
})

// دانلود کامل بکاپ داده‌ها (JSON)
app.get('/api/export/json', (req, res) => {
  const films = readFilms()
  res.setHeader('Content-Disposition', 'attachment; filename="films-backup.json"')
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(films, null, 2))
})

// دانلود کامل بکاپ اکسل
app.get('/api/export/excel', (req, res) => {
  const films = readFilms()
  const rows = films.map(f => ({
    'Title': f.title || '',
    'Original Title': f.originalTitle || '',
    'Shelf': f.shelf || '',
    'Row': f.row || '',
    'Format': f.format || '',
    'Watched': f.watched === true ? 'Yes' : 'No',
    'Borrowed To': f.borrowedTo || '',
    'Borrowed Date': f.borrowedDate || '',
    'Director': f.director || '',
    'Cast': Array.isArray(f.cast) ? f.cast.map(x => typeof x === 'object' ? x.name : x).join(', ') : (f.cast || ''),
    'Year': f.year || '',
    'Genre': Array.isArray(f.genre) ? f.genre.join(', ') : (f.genre || ''),
    'Rating': f.rating || '',
    'Runtime': f.runtime || '',
    'Country': f.country || '',
    'Studio': f.studio || '',
    'MPA Rating': f.rated || '',
    'Synopsis': f.synopsis || '',
    'Poster URL': f.poster || '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'آرشیو فیلم‌ها')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', 'attachment; filename="movies-archive-export.xlsx"')
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

// ---------- سرو کردن نسخه ساخته‌شده (production) ----------
const dist = path.join(__dirname, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.listen(PORT, () =>
  console.log(`🎬 ارشیو فیلم روی http://localhost:${PORT} در حال اجراست`)
)
