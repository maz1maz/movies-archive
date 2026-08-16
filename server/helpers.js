// Helpers shared by the Worker API — ported 1:1 from server/index.js and
// netlify/lib/data.js so import/edit behavior stays identical everywhere.

// Accepts both Persian and English column names from the Excel file.
export const HEADER_MAP = {
  "نام فیلم": "title", "عنوان": "title", "فیلم": "title", title: "title",
  "نام اصلی": "originalTitle", "نام لاتین": "originalTitle",
  originaltitle: "originalTitle", original_title: "originalTitle",
  قفسه: "shelf", shelf: "shelf",
  کمد: "closet", closet: "closet",
  ردیف: "row", "ردیف محل": "row", "محل قرارگیری": "row", row: "row",
  کارگردان: "director", director: "director",
  بازیگران: "cast", بازیگر: "cast", cast: "cast", actors: "cast",
  سال: "year", year: "year",
  ژانر: "genre", genre: "genre",
  امتیاز: "rating", نمره: "rating", rating: "rating",
  زمان: "runtime", مدت: "runtime", دقیقه: "runtime", runtime: "runtime",
  کشور: "country", country: "country",
  خلاصه: "synopsis", داستان: "synopsis", synopsis: "synopsis",
  "لینک پوستر": "poster", پوستر: "poster", عکس: "poster", poster: "poster", image: "poster",
  studio: "studio", کمپانی: "studio", استودیو: "studio", سازنده: "studio", publisher: "studio",
  rated: "rated", mpaa: "rated", "رده بندی سنی": "rated", "درجه سنی": "rated", "رده سنی": "rated",
  format: "format", فرمت: "format", نوع: "format", نسخه: "format",
  borrowedto: "borrowedTo", "امانت به": "borrowedTo", امانت: "borrowedTo",
  borroweddate: "borrowedDate", "تاریخ امانت": "borrowedDate",
  watched: "watched", "watch status": "watched", watchstatus: "watched", seen: "watched",
  "وضعیت تماشا": "watched", "وضعیت مشاهده": "watched",
  "دیده شده": "watched", "دیده‌شده": "watched",
  "تماشا شده": "watched", "تماشا‌شده": "watched",
  myrating: "myRating", "my rating": "myRating", "امتیاز من": "myRating", "نمره من": "myRating",
  criterion: "criterion", "کرایتریون": "criterion", "نسخه کرایتریون": "criterion",
  copies: "copies", "تعداد نسخه": "copies", "نسخه ها": "copies", "تعداد": "copies",
  mediatype: "mediaType", "نوع رسانه": "mediaType", digital: "mediaType",
  drivenumber: "driveNumber", "شماره هارد": "driveNumber", "هارد": "driveNumber", drive: "driveNumber",
  itemtype: "itemType", "نوع محتوا": "itemType", "فیلم یا سریال": "itemType", type: "itemType",
  seasonsepisodes: "seasonsEpisodes", "فصل و قسمت": "seasonsEpisodes", seasons: "seasonsEpisodes",
}

// Empty or unrecognised values are left untouched during an import. This makes
// it safe to update an existing archive from a spreadsheet without resetting
// its saved watch status accidentally.
export function parseWatched(value) {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[‌‍]/g, " ")
    .replace(/\s+/g, " ")

  if (["1", "true", "yes", "y", "watched", "seen", "✓", "✔", "✔️", "بله", "بلی", "آره", "اری", "آری", "دیده شده", "تماشا شده"].includes(normalized)) return true
  if (["0", "false", "no", "n", "unwatched", "not watched", "✗", "×", "نه", "خیر", "دیده نشده", "تماشا نشده"].includes(normalized)) return false
  return undefined
}

function parseCell(v) {
  if (v == null) return ""
  if (typeof v === "number") return String(v)
  return String(v).trim()
}

function toList(str) {
  if (!str) return []
  return str
    .split(/[،,|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function normalizeTitle(t) {
  return (t || "").toString().trim().toLowerCase()
}

// اسم ستون‌های اکسل رو قبل از مچ کردن با HEADER_MAP نرمال‌سازی می‌کنیم: پرانتز
// و توضیحات داخلش حذف می‌شه، بعد هر چیزی جز حروف/عدد (فاصله، اسلش، خط تیره)
// هم حذف می‌شه. این‌جوری هدرهای خواناتر مثل "Rating (IMDb)"، "Original Title"،
// "Drive Number" یا "Media Type (Physical/Digital)" هم درست به فیلد واقعی
// وصل می‌شن، نه اینکه چون دقیقاً برابر با کلید خام نبودن، بی‌صدا دیتاشون گم بشه.
function normalizeHeaderKey(key) {
  return key
    .toString()
    .replace(/\([^)]*\)/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9آ-ی]/g, "")
}

const NORMALIZED_HEADER_MAP = Object.fromEntries(
  Object.entries(HEADER_MAP).map(([k, v]) => [normalizeHeaderKey(k), v])
)
// چند هم‌معنی اضافه که در HEADER_MAP خام (با فاصله/پرانتز) وجود نداشت
NORMALIZED_HEADER_MAP.contenttype = "itemType"
NORMALIZED_HEADER_MAP.imdbid = "imdbId"
NORMALIZED_HEADER_MAP.mparating = "rated"
// ستون «فصل‌های موجود» فیلد مستقیمی توی سایت نداره؛ موقتاً می‌گیریمش تا بعد از
// حلقه‌ی اصلی، seasonDrives (چیزی که واقعاً توی صفحه‌ی فیلم نمایش داده می‌شه) رو
// از روش بسازیم — وگرنه بخش SEASONS بعد از ایمپورت خالی می‌موند.
NORMALIZED_HEADER_MAP.ownedseasons = "ownedSeasonsRaw"

// از متن ستون «فصل‌های موجود» (مثلاً "Seasons 1, 2 (16 eps)") یا در نبودش از
// متن کلی seasonsEpisodes (مثلاً "2 seasons / 16 episodes")، فهرست شماره‌ی
// فصل‌های موجود رو استخراج می‌کنه؛ برای ساخت seasonDrives موقع ایمپورت.
function extractOwnedSeasonsList(text) {
  if (!text) return null
  const t = String(text)
  // قبلاً عدد تعداد قسمت‌ها هم قاطیِ شماره‌ی فصل می‌شد (مثلاً "Season 2 · 12
  // episodes" غلط می‌شد "فصل ۲, ۱۲")؛ چون فرمت متن همیشه "...فصل‌ها · تعداد
  // قسمت" هست، فقط قسمت قبل از "·" (یا نبودش، کل متن) رو برای شماره‌ی فصل
  // در نظر می‌گیریم، نه قسمت episodes رو.
  const beforeDot = t.split("·")[0]
  const beforeParen = beforeDot.split("(")[0]
  // اعداد ۳-۴ رقمی معمولاً سالن (مثلاً بازه‌ی پخش "2015–2023")، نه شماره‌ی
  // فصل؛ قبلاً این‌ها اشتباهی به‌عنوان شماره‌ی فصل ("فصل ۲۰۱۵، ۲۰۲۳") ثبت
  // می‌شدن. فقط اعداد کوتاه (۱ یا ۲ رقمی) رو به‌عنوان شماره‌ی فصل واقعی قبول می‌کنیم.
  const nums = (beforeParen.match(/\d+/g) || []).filter((n) => n.length <= 2)
  if (nums.length) return nums.join(", ")
  const countMatch = t.match(/(\d+)\s*seasons?/i)
  if (countMatch) {
    const n = parseInt(countMatch[1], 10)
    if (n > 0 && n <= 50) return Array.from({ length: n }, (_, i) => i + 1).join(", ")
  }
  return null
}

export function rowToFilm(row, index) {
  const film = { id: `f${Date.now()}_${index}` }
  for (const [key, val] of Object.entries(row)) {
    const field = HEADER_MAP[key.trim().toLowerCase()] || NORMALIZED_HEADER_MAP[normalizeHeaderKey(key)]
    if (!field) continue
    let v = parseCell(val)
    if (field === "cast" || field === "genre") v = toList(v)
    if (field === "rating") v = v ? parseFloat(v) : undefined
    if (field === "myRating") v = v ? Math.max(0, Math.min(5, parseInt(v, 10))) : undefined
    if (field === "copies") v = v ? Math.max(1, parseInt(v, 10)) : undefined
    if (field === "mediaType") v = /digital|دیجیتال/i.test(v) ? "digital" : "physical"
    if (field === "itemType") v = /series|show|سریال/i.test(v) ? "series" : "movie"
    if (field === "year" || field === "runtime") v = v ? parseInt(v, 10) : undefined
    if (field === "watched" || field === "criterion") v = parseWatched(v)
    if (v === "" || v === undefined) continue
    film[field] = v
  }
  if (!film.title) film.title = "Untitled"
  // کل مجموعه‌ی فیزیکی این کاربر بلوریه؛ اگه اکسل ستون format نداشته باشه،
  // به‌جای خالی موندن (که باعث می‌شد بج بلوری نیاد)، خودش Blu-ray بشه.
  if (film.mediaType !== "digital" && !film.format) film.format = "Blu-ray"
  // موقع ایمپورت سریال دیجیتال/فیزیکی، اگه شماره‌ی هارد/قفسه مشخص باشه، از روی
  // فصل‌های موجود، seasonDrives رو خودمون می‌سازیم تا بخش SEASONS توی صفحه‌ی
  // فیلم خالی نمونه.
  const driveOrShelf = film.driveNumber || film.shelf
  if (film.itemType === "series" && driveOrShelf) {
    const seasonsList = extractOwnedSeasonsList(film.ownedSeasonsRaw || film.seasonsEpisodes)
    if (seasonsList) film.seasonDrives = [{ seasons: seasonsList, drive: driveOrShelf }]
  }
  delete film.ownedSeasonsRaw
  return film
}

export function decodeHtmlEntities(str) {
  if (!str) return str
  return str
    .replace(/&#0?39;/g, "'")
    .replace(/&#0?34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
}

export const EDITABLE = [
  "title", "originalTitle", "closet", "shelf", "row", "director", "cast",
  "year", "genre", "rating", "runtime", "country", "synopsis",
  "poster", "studio", "rated", "format", "borrowedTo", "borrowedDate",
  "watched", "myRating", "criterion", "criterionCopies",
  "copies", "mediaType", "driveNumber", "itemType", "seasonsEpisodes",
  "letterboxdRating", "watchlisted", "letterboxdVotes", "seasonDrives", "producer",
  "personalReview", "personalReviewUrl", "personalReviewDate", "reviews",
  "imdbId", "imdbVotes", "originalLanguage", "boxOffice", "tagline",
  "budget", "revenue", "metascore", "rottenTomatoes",
]

// از رو متن آزاد فصل‌ها (مثلاً "Seasons 2, 3, 4 · 18 episodes" یا
// "Season 14, Season 15") تعداد فصل‌های یکتا رو حساب می‌کنه. عمداً فقط قسمت
// قبل از "·" (که تعداد قسمت‌هاست، نه فصل) رو در نظر می‌گیره.
export function countSeasonsFromText(text) {
  if (!text) return null
  const beforeDot = String(text).split("·")[0]
  const numbers = beforeDot.match(/\d+/g)
  if (!numbers) return null
  const unique = new Set(numbers.map((n) => parseInt(n, 10)))
  return unique.size || null
}

export const ENRICHABLE_FIELDS = [
  "originalTitle", "year", "director", "cast", "genre", "rating",
  "runtime", "country", "synopsis", "poster", "rated", "studio",
  "imdbVotes", "imdbId", "originalLanguage", "boxOffice",
  "tagline", "budget", "revenue", "metascore", "rottenTomatoes",
]

export function isEmptyMetadata(value) {
  if (Array.isArray(value)) return value.length === 0
  return value == null || String(value).trim() === ""
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  })
}
