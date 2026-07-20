// GET /api/shelves
import { readFilms, jsonResponse } from "../lib/data.js";

export default async () => {
  const films = await readFilms();
  const set = new Set();
  films.forEach((f) => {
    if (f.shelf) set.add(f.shelf.toString());
  });
  return jsonResponse([...set].sort((a, b) => a.localeCompare(b, "fa")));
};

export const config = { path: "/api/shelves", method: "GET" };
