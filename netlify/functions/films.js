// GET /api/films — list films with filtering, sorting
import { readFilms, jsonResponse } from "../lib/data.js";

export default async (req) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const genre = url.searchParams.get("genre");
  const shelf = url.searchParams.get("shelf");
  const sort = url.searchParams.get("sort");
  const alpha = url.searchParams.get("alpha");
  const decade = url.searchParams.get("decade");

  let films = await readFilms();

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
  else if (sort === "shelf")
    films.sort((a, b) => (a.shelf || "").localeCompare(b.shelf || "", "en"));

  return jsonResponse(films);
};

export const config = {
  path: "/api/films",
  method: "GET",
};
