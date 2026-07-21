// GET /api/genres
import { readFilms, jsonResponse } from "../lib/data.js";

export default async () => {
  const films = await readFilms();
  const set = new Set();
  films.forEach((f) => (f.genre || []).forEach((g) => set.add(g)));
  return jsonResponse([...set].sort((a, b) => a.localeCompare(b, "fa")));
};

export const config = { path: "/api/genres", method: "GET" };
