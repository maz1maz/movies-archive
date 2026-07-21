// Shared data access layer for Netlify Functions
// Uses Netlify Blobs for persistent storage with a bundled fallback
import { getStore } from "@netlify/blobs";
import seedFilms from "./seed-films.js";

const STORE_NAME = "film-archive";
const DATA_KEY = "films";

let _store = null;
function getBlobStore() {
  if (!_store) _store = getStore(STORE_NAME);
  return _store;
}

export async function readFilms() {
  try {
    const store = getBlobStore();
    const data = await store.get(DATA_KEY, { type: "json" });
    if (data && Array.isArray(data) && data.length > 0) return data;
  } catch {}
  // Fallback to bundled seed data
  return seedFilms;
}

export async function writeFilms(films) {
  const store = getBlobStore();
  await store.setJSON(DATA_KEY, films);
}

// ---------- Header mapping for Excel import ----------
const HEADER_MAP = {
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
};

// Do not overwrite an existing watch status when the spreadsheet cell is
// blank or has an unsupported value.
function parseWatched(value) {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[‌‍]/g, " ")
    .replace(/\s+/g, " ");

  if (["1", "true", "yes", "y", "watched", "seen", "✓", "✔", "بله", "بلی", "آره", "اری", "آری", "دیده شده", "تماشا شده"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "unwatched", "not watched", "✗", "×", "نه", "خیر", "دیده نشده", "تماشا نشده"].includes(normalized)) return false;
  return undefined;
}

function parseCell(v) {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

function toList(str) {
  if (!str) return [];
  return str.split(/[،,|]/).map((s) => s.trim()).filter(Boolean);
}

function normalizeTitle(t) {
  return (t || "").toString().trim().toLowerCase();
}

function rowToFilm(row, index) {
  const film = { id: `f${Date.now()}_${index}` };
  for (const [key, val] of Object.entries(row)) {
    const field = HEADER_MAP[key.trim().toLowerCase()];
    if (!field) continue;
    let v = parseCell(val);
    if (field === "cast" || field === "genre") v = toList(v);
    if (field === "rating") v = v ? parseFloat(v) : undefined;
    if (field === "year" || field === "runtime") v = v ? parseInt(v, 10) : undefined;
    if (field === "watched") v = parseWatched(v);
    if (v === "" || v === undefined) continue;
    film[field] = v;
  }
  if (!film.title) film.title = "بدون نام";
  return film;
}

export { rowToFilm, normalizeTitle };

export const EDITABLE = [
  "title", "originalTitle", "shelf", "row", "director", "cast",
  "year", "genre", "rating", "runtime", "country", "synopsis",
  "poster", "studio", "rated", "format", "borrowedTo", "borrowedDate",
  "watched",
];

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export function errorResponse(message, status = 500) {
  return jsonResponse({ error: message }, status);
}
