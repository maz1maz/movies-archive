import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import { enrichFilm } from './omdb.js'

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

// ---------- نگاشت ستون‌های اکسل به فیلدها ----------
// هم اسم فارسی هم انگلیسی رو قبول می‌کنیم
const HEADER_MAP = {
  'نام فیلم': 'title',
  عنوان: 'title',
  فیلم: 'title',
  title: 'title',
  'نام اصلی': 'originalTitle',
  'نام لاتین': 'originalTitle',
  originaltitle: 'originalTitle',
  original_title: 'originalTitle',
  قفسه: 'shelf',
  shelf: 'shelf',
  ردیف: 'row',
  'ردیف محل': 'row',
  'محل قرارگیری': 'row',
  row: 'row',
  کارگردان: 'director',
  director: 'director',
  بازیگران: 'cast',
  بازیگر: 'cast',
  cast: 'cast',
  actors: 'cast',
  سال: 'year',
  year: 'year',
  ژانر: 'genre',
  genre: 'genre',
  امتیاز: 'rating',
  نمره: 'rating',
  rating: 'rating',
  زمان: 'runtime',
  مدت: 'runtime',
  دقیقه: 'runtime',
  runtime: 'runtime',
  کشور: 'country',
  country: 'country',
  خلاصه: 'synopsis',
  داستان: 'synopsis',
  synopsis: 'synopsis',
  'لینک پوستر': 'poster',
  پوستر: 'poster',
  عکس: 'poster',
  poster: 'poster',
  image: 'poster',
  studio: 'studio',
  کمپانی: 'studio',
  استودیو: 'studio',
  سازنده: 'studio',
  publisher: 'studio',
  rated: 'rated',
  mpaa: 'rated',
  'رده بندی سنی': 'rated',
  'درجه سنی': 'rated',
  'رده سنی': 'rated',
  format: 'format',
  فرمت: 'format',
  نوع: 'format',
  نسخه: 'format',
  borrowedto: 'borrowedTo',
  'امانت به': 'borrowedTo',
  امانت: 'borrowedTo',
  borroweddate: 'borrowedDate',
  'تاریخ امانت': 'borrowedDate',
  watched: 'watched',
  'watch status': 'watched',
  watchstatus: 'watched',
  seen: 'watched',
  'وضعیت تماشا': 'watched',
  'وضعیت مشاهده': 'watched',
  'دیده شده': 'watched',
  'دیده‌شده': 'watched',
  'تماشا شده': 'watched',
  'تماشا‌شده': 'watched',
}

// Empty or unrecognised values are left untouched during an import. This makes
// it safe to update an existing archive from a spreadsheet without resetting
// its saved watch status accidentally.
function parseWatched(value) {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[‌‍]/g, ' ')
    .replace(/\s+/g, ' ')

  if (['1', 'true', 'yes', 'y', 'watched', 'seen', '✓', '✔', 'بله', 'بلی', 'آره', 'اری', 'آری', 'دیده شده', 'تماشا شده'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'n', 'unwatched', 'not watched', '✗', '×', 'نه', 'خیر', 'دیده نشده', 'تماشا نشده'].includes(normalized)) {
    return false
  }
  return undefined
}

function parseCell(v) {
  if (v == null) return ''
  if (typeof v === 'number') return String(v)
  return String(v).trim()
}
function toList(str) {
  if (!str) return []
  return str
    .split(/[،,|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}
function normalizeTitle(t) {
  return (t || '').toString().trim().toLowerCase()
}

function rowToFilm(row, index) {
  const film = { id: `f${Date.now()}_${index}` }
  for (const [key, val] of Object.entries(row)) {
    const field = HEADER_MAP[key.trim().toLowerCase()]
    if (!field) continue
    let v = parseCell(val)
    if (field === 'cast' || field === 'genre') v = toList(v)
    if (field === 'rating') v = v ? parseFloat(v) : undefined
    if (field === 'year' || field === 'runtime')
      v = v ? parseInt(v, 10) : undefined
    if (field === 'watched') v = parseWatched(v)
    if (v === '' || v === undefined) continue
    film[field] = v
  }
  if (!film.title) film.title = 'بدون نام'
  return film
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

// ویرایش یک فیلم (ذخیره توی films.json)
const EDITABLE = [
  'title',
  'originalTitle',
  'shelf',
  'row',
  'director',
  'cast',
  'year',
  'genre',
  'rating',
  'runtime',
  'country',
  'synopsis',
  'poster',
  'studio',
  'rated',
  'format',
  'borrowedTo',
  'borrowedDate',
  'watched',
]
app.post('/api/films', (req, res) => {
  const films = readFilms()
  const body = req.body || {}
  if (!String(body.title || '').trim()) {
    return res.status(400).json({ error: 'title is required' })
  }
  const film = {
    id: `f${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: String(body.title).trim(),
    shelf: body.shelf || '',
    row: body.row || '',
    ...body,
  }
  film.id = film.id
  films.push(film)
  writeFilms(films)
  res.status(201).json(film)
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
