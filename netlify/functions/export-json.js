// GET /api/export/json — download full JSON backup
import { readFilms } from "../lib/data.js";

export default async () => {
  const films = await readFilms();
  return new Response(JSON.stringify(films, null, 2), {
    status: 200,
    headers: {
      "Content-Disposition": 'attachment; filename="films-backup.json"',
      "Content-Type": "application/json",
    },
  });
};

export const config = { path: "/api/export/json", method: "GET" };
