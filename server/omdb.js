// Optional metadata enrichment from OMDb. Values entered by the collector are
// never overwritten: OMDb only fills fields that are still empty.
import { enrichSeriesFromTVMaze } from './tvmaze.js'
import { ENRICHABLE_FIELDS, isEmptyMetadata } from './helpers.js'

const BASE = process.env.OMDB_BASE_URL || 'https://www.omdbapi.com/'

function isEmpty(value) {
  if (Array.isArray(value)) return value.length === 0
  return value == null || String(value).trim() === ''
}

function fillMissing(film, field, value) {
  if (!isEmpty(film[field]) || value == null || value === '') return
  film[field] = value
}

export async function enrichFilm(baseFilm, key) {
  let film = baseFilm

  // برای سریال، اول TVMaze رو امتحان می‌کنیم — رایگان، بدون کلید، و
  // مخصوص سریاله (OMDb بیشتر برای فیلمه و پوشش سریال‌هاش ضعیف‌تره).
  // هر چیزی که TVMaze پیدا نکرد، همچنان از OMDb (پایین‌تر) پر می‌شه.
  if (baseFilm.itemType === 'series') {
    try {
      film = await enrichSeriesFromTVMaze(baseFilm)
    } catch {
      film = baseFilm
    }
  }

  // بدون کلید OMDb هم، حداقل نتیجه‌ی TVMaze (برای سریال) رو برگردون —
  // قبلاً نبودِ کلید باعث می‌شد کل غنی‌سازی، حتی این بخش رایگانش، لغو بشه.
  if (!key) return film

  // اگه فیلدهای اصلیِ قابل‌غنی‌سازی (همونایی که واقعاً توی اکسل‌های ایمپورتی
  // پر می‌شن) از قبل پر شدن، اصلاً نیازی به زدن OMDb نیست. قبلاً این چک کل
  // ENRICHABLE_FIELDS رو می‌سنجید که شامل rated/studio/imdbVotes/imdbId هم
  // می‌شد — فیلدهایی که تقریباً هیچ‌وقت توی فایل اکسل ما پر نمی‌شن؛ در نتیجه
  // این چک همیشه true برمی‌گشت و OMDb برای هر ردیف زده می‌شد، حتی وقتی همه‌ی
  // اطلاعات اصلی (کارگردان/بازیگر/خلاصه/پوستر و...) از قبل کامل بود — همین
  // باعث fail شدن ایمپورت فایل‌های بزرگ و از‌قبل‌کامل با خطای «too many API» می‌شد.
  const CORE_ENRICHABLE_FIELDS = [
    "director", "cast", "genre", "rating", "runtime", "country", "synopsis", "poster",
  ]
  const stillNeedsEnrichment = CORE_ENRICHABLE_FIELDS.some((field) => isEmptyMetadata(film[field]))
  if (!stillNeedsEnrichment) return film

  // اگه imdbId از قبل معلومه (مثلاً از خود اکسل)، مستقیم با همون آیدی از
  // OMDb می‌گیریم — دقیق‌تر و مطمئن‌تر از جستجوی عنوان، که برای عنوان‌های
  // پرتکرار ممکنه فیلم اشتباهی رو برگردونه.
  const query = film.imdbId
    ? { apikey: key, i: film.imdbId }
    : { apikey: key, t: film.title, type: film.itemType === 'series' ? 'series' : 'movie' }
  if (!film.imdbId && film.year) query.y = String(film.year)

  const res = await fetch(`${BASE}?${new URLSearchParams(query).toString()}`, {
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return film

  const data = await res.json()
  if (data.Response !== 'True') {
    // سهمیه‌ی روزانه‌ی رایگان OMDb (۱۰۰۰ درخواست) تموم شده — این یه خطای
    // موقتیه (فردا دوباره باز می‌شه)، نه اینکه این فیلم پیدا نشده باشه؛
    // برای همین جدا علامت‌گذاریش می‌کنیم تا caller بتونه ادامه‌ی دسته رو
    // متوقف کنه، به‌جای اینکه بی‌فایده برای بقیه هم درخواست بفرسته.
    if (/request limit reached/i.test(data.Error || '')) {
      const err = new Error('OMDB_QUOTA_EXCEEDED')
      err.code = 'OMDB_QUOTA_EXCEEDED'
      throw err
    }
    return film
  }

  const out = { ...film }
  if (data.Year && data.Year !== 'N/A') {
    const year = parseInt(data.Year, 10)
    if (!Number.isNaN(year)) fillMissing(out, 'year', year)
  }
  if (data.Title && data.Title !== 'N/A') fillMissing(out, 'originalTitle', data.Title)
  if (data.Title && data.Title !== 'N/A') fillMissing(out, 'title', data.Title)
  if (data.Director && data.Director !== 'N/A') fillMissing(out, 'director', data.Director)
  if (data.Actors && data.Actors !== 'N/A') {
    fillMissing(
      out,
      'cast',
      data.Actors.split(',').map((name) => name.trim()).filter(Boolean)
    )
  }
  if (data.Genre && data.Genre !== 'N/A') {
    fillMissing(
      out,
      'genre',
      data.Genre.split(',').map((genre) => genre.trim()).filter(Boolean)
    )
  }
  if (data.imdbRating && data.imdbRating !== 'N/A') {
    const rating = parseFloat(data.imdbRating)
    if (!Number.isNaN(rating)) fillMissing(out, 'rating', rating)
  }
  const runtime = (data.Runtime || '').match(/(\d+)/)
  if (runtime) fillMissing(out, 'runtime', parseInt(runtime[1], 10))
  if (data.Country && data.Country !== 'N/A') fillMissing(out, 'country', data.Country)
  if (data.Plot && data.Plot !== 'N/A') fillMissing(out, 'synopsis', data.Plot)
  if (data.Poster && data.Poster !== 'N/A') fillMissing(out, 'poster', data.Poster)
  if (data.Rated && data.Rated !== 'N/A') fillMissing(out, 'rated', data.Rated)
  if (data.Production && data.Production !== 'N/A') fillMissing(out, 'studio', data.Production)
  if (data.imdbVotes && data.imdbVotes !== 'N/A') fillMissing(out, 'imdbVotes', data.imdbVotes)
  if (data.imdbID) fillMissing(out, 'imdbId', data.imdbID)
  if (data.Type && data.Type !== 'N/A') {
    fillMissing(out, 'itemType', data.Type === 'series' ? 'series' : 'movie')
  }

  return out
}
