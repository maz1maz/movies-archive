// GET /api/films — list films with filtering, sorting
// POST /api/films — add a film and fill missing public metadata from OMDb
import { readFilms, writeFilms, jsonResponse, errorResponse } from "../lib/data.js";
import { enrichFilm } from "./omdb.js";

const ENRICHABLE_FIELDS = [
  "originalTitle",
  "year",
  "director",
  "cast",
  "genre",
  "rating",
  "runtime",
  "country",
  "synopsis",
  "poster",
  "rated",
  "studio",
  "imdbVotes",
  "imdbId",
];

function isEmptyMetadata(value) {
  if (Array.isArray(value)) return value.length === 0;
  return value == null || String(value).trim() === "";
}

async function enrichMissingMetadata(film) {
  const key = process.env.OMDB_API_KEY;
  if (!key) return { film, enabled: false, fields: [] };

  try {
    const enriched = await enrichFilm(film, key);
    const fields = ENRICHABLE_FIELDS.filter(
      (field) => isEmptyMetadata(film[field]) && !isEmptyMetadata(enriched[field])
    );
    return { film: enriched, enabled: true, fields };
  } catch {
    return { film, enabled: true, fields: [] };
  }
}

export default async (req) => {
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (!String(body?.title || "").trim()) {
        return errorResponse("title is required", 400);
      }

      const film = {
        ...body,
        id: `f${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: String(body.title).trim(),
        shelf: body.shelf || "",
        row: body.row || "",
      };
      const enrichment = await enrichMissingMetadata(film);
      const films = await readFilms();
      films.push(enrichment.film);
      await writeFilms(films);

      return jsonResponse(
        {
          ...enrichment.film,
          _enrichment: {
            enabled: enrichment.enabled,
            fields: enrichment.fields,
          },
        },
        201
      );
    } catch (error) {
      return errorResponse(error.message, 500);
    }
  }

  if (req.method !== "GET") return errorResponse("Method not allowed", 405);

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const genre = url.searchParams.get("genre");
  const shelf = url.searchParams.get("shelf");
  const sort = url.searchParams.get("sort");
  const alpha = url.searchParams.get("alpha");
  const decade = url.searchParams.get("decade");
  const loaned = url.searchParams.get("loaned");
  const watched = url.searchParams.get("watched");
  const minRating = url.searchParams.get("minRating");

  let films = await readFilms();

  if (loaned === "1") films = films.filter((f) => f.borrowedTo);
  if (watched === "1") films = films.filter((f) => f.watched === true);
  if (watched === "0") films = films.filter((f) => f.watched !== true);
  if (minRating) films = films.filter((f) => Number(f.rating || 0) >= Number(minRating));

  if (q) {
    const s = q.toLowerCase();
    films = films.filter(
      (f) =>
        (f.title || "").toLowerCase().includes(s) ||
        (f.originalTitle || "").toLowerCase().includes(s) ||
        (f.director || "").toLowerCase().includes(s) ||
        (f.cast || []).join(" ").toLowerCase().includes(s)
    );
  }
  if (genre) films = films.filter((f) => (f.genre || []).includes(genre));
  if (shelf) films = films.filter((f) => (f.shelf || "").toString() === shelf);
  if (alpha) {
    const a = alpha.toLowerCase();
    if (a === "0-9") {
      films = films.filter((f) => /^\d/.test(f.title || ""));
    } else {
      films = films.filter((f) => {
        const t = (f.title || "").toLowerCase();
        return t && t[0] === a;
      });
    }
  }
  if (decade) {
    const d = parseInt(decade, 10);
    if (!isNaN(d)) {
      films = films.filter(
        (f) => typeof f.year === "number" && Math.floor(f.year / 10) * 10 === d
      );
    }
  }

  if (sort === "year_desc") films.sort((a, b) => (b.year || 0) - (a.year || 0));
  else if (sort === "year_asc") films.sort((a, b) => (a.year || 0) - (b.year || 0));
  else if (sort === "rating") films.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (sort === "shelf") {
    films.sort((a, b) => (a.shelf || "").localeCompare(b.shelf || "", "en"));
  }

  return jsonResponse(films);
};

export const config = {
  path: "/api/films",
};
