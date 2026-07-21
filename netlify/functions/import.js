// POST /api/import — import films from Excel
import XLSX from "xlsx";
import { readFilms, writeFilms, rowToFilm, normalizeTitle, jsonResponse, errorResponse } from "../lib/data.js";
import { enrichFilm } from "./omdb.js";

export default async (req) => {
  try {
    // Read the raw body as ArrayBuffer
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!buffer || buffer.length === 0) {
      return errorResponse("No file sent", 400);
    }

    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

    if (!rows.length) return errorResponse("File is empty", 400);

    let imported = rows.map((r, i) => rowToFilm(r, i));

    // Optional OMDb enrichment
    const key = process.env.OMDB_API_KEY;
    if (key) {
      imported = await Promise.all(
        imported.map(async (f) => {
          try {
            return await enrichFilm(f, key);
          } catch {
            return f;
          }
        })
      );
    }

    // Merge with existing archive
    const existing = await readFilms();
    const byTitle = new Map(existing.map((f) => [normalizeTitle(f.title), f]));
    let added = 0;
    let updated = 0;

    for (const f of imported) {
      const t = normalizeTitle(f.title);
      if (byTitle.has(t)) {
        const old = byTitle.get(t);
        byTitle.set(t, { ...old, ...f, id: old.id });
        updated++;
      } else {
        byTitle.set(t, f);
        added++;
      }
    }

    await writeFilms([...byTitle.values()]);
    return jsonResponse({ count: imported.length, added, updated });
  } catch (e) {
    return errorResponse(e.message, 500);
  }
};

export const config = {
  path: "/api/import",
  method: "POST",
};
