// POST /api/films/enrich — enrich the archive in small, safe batches
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

export default async (req) => {
  const key = process.env.OMDB_API_KEY;
  if (!key) return errorResponse("OMDB_API_KEY is not configured", 400);

  const url = new URL(req.url);
  const requestedLimit = parseInt(url.searchParams.get("limit"), 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 15)
    : 10;
  const films = await readFilms();
  const candidates = films
    .map((film, index) => ({ film, index }))
    .filter(
      ({ film }) =>
        ENRICHABLE_FIELDS.some((field) => isEmptyMetadata(film[field])) &&
        !film.metadataEnrichmentAttemptedAt
    )
    .slice(0, limit);

  let updated = 0;
  for (const { film, index } of candidates) {
    try {
      const enriched = await enrichFilm(film, key);
      const changed = ENRICHABLE_FIELDS.some(
        (field) => isEmptyMetadata(film[field]) && !isEmptyMetadata(enriched[field])
      );
      if (changed) updated++;
      films[index] = {
        ...enriched,
        metadataEnrichmentAttemptedAt: new Date().toISOString(),
      };
    } catch {
      films[index] = {
        ...film,
        metadataEnrichmentAttemptedAt: new Date().toISOString(),
      };
    }
  }

  if (candidates.length) await writeFilms(films);
  const remaining = films.filter(
    (film) =>
      ENRICHABLE_FIELDS.some((field) => isEmptyMetadata(film[field])) &&
      !film.metadataEnrichmentAttemptedAt
  ).length;
  return jsonResponse({ processed: candidates.length, updated, remaining });
};

export const config = {
  path: "/api/films/enrich",
  method: "POST",
};
