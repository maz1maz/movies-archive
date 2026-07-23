// Helpers shared by the Worker API — ported 1:1 from server/index.js and
// netlify/lib/data.js so import/edit behavior stays identical everywhere.

// Accepts both Persian and English column names from the Excel file.
export const HEADER_MAP = {
  "نام فیلم": "title", "عنوان": "title", "فیلم": "title", title: "title",
  "نام اصلی": "originalTitle", "نام لاتین": "originalTitle",
  originaltitle: "originalTitle", original_title: "originalTitle",
  قفسه: "shelf", shelf: "shelf",
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

export function rowToFilm(row, index) {
  const film = { id: `f${Date.now()}_${index}` }
  for (const [key, val] of Object.entries(row)) {
    const field = HEADER_MAP[key.trim().toLowerCase()]
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
  if (!film.title) film.title = "بدون نام"
  return film
}

export const EDITABLE = [
  "title", "originalTitle", "shelf", "row", "director", "cast",
  "year", "genre", "rating", "runtime", "country", "synopsis",
  "poster", "studio", "rated", "format", "borrowedTo", "borrowedDate",
  "watched", "myRating", "criterion",
  "copies", "mediaType", "driveNumber", "itemType", "seasonsEpisodes",
]

export const ENRICHABLE_FIELDS = [
  "originalTitle", "year", "director", "cast", "genre", "rating",
  "runtime", "country", "synopsis", "poster", "rated", "studio",
  "imdbVotes", "imdbId",
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
