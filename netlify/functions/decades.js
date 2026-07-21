// GET /api/decades
import { readFilms, jsonResponse } from "../lib/data.js";

export default async () => {
  const films = await readFilms();
  const set = new Set();
  films.forEach((f) => {
    if (typeof f.year === "number") set.add(Math.floor(f.year / 10) * 10);
  });
  return jsonResponse([...set].sort((a, b) => a - b));
};

export const config = { path: "/api/decades", method: "GET" };
