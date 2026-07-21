// GET /api/template — download empty Excel template
import XLSX from "xlsx";

export default async () => {
  const ws = XLSX.utils.aoa_to_sheet([
    [
      "Title", "Shelf", "Row", "Format", "Watched", "Director", "Cast",
      "Year", "Genre", "Rating", "Runtime", "Country",
      "Studio", "MPA Rating", "Synopsis", "Poster URL", "Original Title",
    ],
    [
      "Example: The Godfather", "A", "3", "4K UHD", "No",
      "Francis Ford Coppola", "Marlon Brando, Al Pacino",
      "1972", "Crime, Drama", "9.2", "175", "USA",
      "Paramount Pictures", "R", "Story of the Corleone crime family",
      "https://example.com/poster.jpg", "The Godfather",
    ],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Films");
  const buf = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

  return new Response(Buffer.from(buf, "base64"), {
    status: 200,
    headers: {
      "Content-Disposition": 'attachment; filename="film-archive-template.xlsx"',
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
};

export const config = { path: "/api/template", method: "GET" };
