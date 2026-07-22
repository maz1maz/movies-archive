// GET /api/films/:id — single film
// PATCH /api/films/:id — update film
// POST /api/films/:id — fill only missing metadata from OMDb
import { readFilms, writeFilms, EDITABLE, jsonResponse, errorResponse } from "../lib/data.js";
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

export default async (req, context) => {
  const id = context.params.id;

  if (req.method === "GET") {
    const films = await readFilms();
    const film = films.find((f) => f.id === id);
    if (!film) return errorResponse("not found", 404);
    return jsonResponse(film);
  }

  if (req.method === "POST") {
    const films = await readFilms();
    const index = films.findIndex((film) => film.id === id);
    if (index < 0) return errorResponse("not found", 404);

    const enrichment = await enrichMissingMetadata(films[index]);
    films[index] = enrichment.film;
    await writeFilms(films);
    return jsonResponse({
      ...enrichment.film,
      _enrichment: {
        enabled: enrichment.enabled,
        fields: enrichment.fields,
      },
    });
  }

  if (req.method === "PATCH") {
    const body = await req.json();
    const films = await readFilms();
    const index = films.findIndex((film) => film.id === id);
    if (index < 0) return errorResponse("not found", 404);

    const updated = { ...films[index] };
    for (const key of EDITABLE) {
      if (key in body) updated[key] = body[key];
    }
    updated.id = films[index].id;
    films[index] = updated;
    await writeFilms(films);
    return jsonResponse(updated);
  }

  return errorResponse("Method not allowed", 405);
};

export const config = {
  path: "/api/films/:id",
};
