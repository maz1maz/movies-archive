import fitz, json, re, os
from collections import defaultdict

PDF = "/home/user/uploads/B.pdf"
doc = fitz.open(PDF)
records = []

for pi in range(doc.page_count):
    p = doc[pi]
    words = p.get_text("words")
    lines = defaultdict(list)
    for w in words:
        x0, y0, x1, y1, txt = w[0], w[1], w[2], w[3], w[4]
        lines[round(y0 / 3) * 3].append((x0, txt))
    for y in sorted(lines):
        items = sorted(lines[y], key=lambda z: z[0])
        title_words, num, code = [], None, None
        for x0, t in items:
            if x0 < 188:
                title_words.append(t)
            elif 188 <= x0 <= 226:
                if t.isdigit():
                    num = t
            else:
                if re.match(r"^(\d{1,2}|[A-Z]\d)$", t) and t.isascii():
                    code = t
        if num is None and code is None:
            continue  # header / junk
        title = " ".join(title_words).strip()
        if not title or title == "Title" or "عنوان" in title:
            continue
        if num is None or code is None:
            print("SKIP incomplete:", repr(title), num, code)
            continue
        records.append({"title": title, "shelf": code, "row": num})

print("raw records:", len(records))
rows = [int(r["row"]) for r in records if r["row"].isdigit()]
print("row min/max:", min(rows), max(rows))
full = set(range(1, max(rows) + 1))
missing = sorted(full - set(rows))
print("missing row numbers:", (missing[:20], "...")[len(missing) > 20])
print("duplicate rows:", len(rows) - len(set(rows)))

films = []
for i, r in enumerate(records, 1):
    films.append({"id": f"f{i}", "title": r["title"], "shelf": r["shelf"], "row": r["row"]})

os.makedirs("server/data", exist_ok=True)
with open("server/data/films.json", "w", encoding="utf-8") as f:
    json.dump(films, f, ensure_ascii=False, indent=2)
print("wrote server/data/films.json:", len(films), "films")

import openpyxl
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Films"
ws.append(["Title", "Shelf", "Row"])
for fl in films:
    ws.append([fl["title"], fl["shelf"], fl["row"]])
wb.save("my-films.xlsx")
print("wrote my-films.xlsx")

with open("preview.html", "r", encoding="utf-8") as f:
    html = f.read()
data_json = json.dumps(films, ensure_ascii=False)
html = re.sub(r"const FILMS = \[.*?\];", "const FILMS = " + data_json + ";", html, count=1, flags=re.S)
with open("preview.html", "w", encoding="utf-8") as f:
    f.write(html)
print("updated preview.html")
print("first:", films[0])
print("last :", films[-1])
