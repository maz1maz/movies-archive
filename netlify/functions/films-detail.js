// GET /api/films/:id — single film
// PATCH /api/films/:id — update film
import { readFilms, writeFilms, EDITABLE, jsonResponse, errorResponse } from "../lib/data.js";

export default async (req, context) => {
  const id = context.params.id;

  if (req.method === "GET") {
    const films = await readFilms();
    const film = films.find((f) => f.id === id);
    if (!film) return errorResponse("not found", 404);
    return jsonResponse(film);
  }

  if (req.method === "PATCH") {
    const body = await req.json();
    const films = await readFilms();
    const i = films.findIndex((f) => f.id === id);
    if (i < 0) return errorResponse("not found", 404);

    const updated = { ...films[i] };
    for (const k of EDITABLE) {
      if (k in body) updated[k] = body[k];
    }
    updated.id = films[i].id;
    films[i] = updated;
    await writeFilms(films);
    return jsonResponse(updated);
  }

  return errorResponse("Method not allowed", 405);
};

export const config = {
  path: "/api/films/:id",
};
