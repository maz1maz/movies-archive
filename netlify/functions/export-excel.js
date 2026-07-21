// GET /api/export/excel — download full Excel backup
import XLSX from "xlsx";
import { readFilms } from "../lib/data.js";

export default async () => {
  const films = await readFilms();
  const rows = films.map((f) => ({
    Title: f.title || "",
    "Original Title": f.originalTitle || "",
    Shelf: f.shelf || "",
    Row: f.row || "",
    Format: f.format || "",
    Watched: f.watched === true ? "Yes" : "No",
    "Borrowed To": f.borrowedTo || "",
    "Borrowed Date": f.borrowedDate || "",
    Director: f.director || "",
    Cast: Array.isArray(f.cast)
      ? f.cast.map((x) => (typeof x === "object" ? x.name : x)).join(", ")
      : f.cast || "",
    Year: f.year || "",
    Genre: Array.isArray(f.genre) ? f.genre.join(", ") : f.genre || "",
    Rating: f.rating || "",
    Runtime: f.runtime || "",
    Country: f.country || "",
    Studio: f.studio || "",
    "MPA Rating": f.rated || "",
    Synopsis: f.synopsis || "",
    "Poster URL": f.poster || "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Film Archive");
  const buf = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

  return new Response(Buffer.from(buf, "base64"), {
    status: 200,
    headers: {
      "Content-Disposition": 'attachment; filename="movies-archive-export.xlsx"',
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
};

export const config = { path: "/api/export/excel", method: "GET" };
