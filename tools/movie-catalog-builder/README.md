# Movie Catalog Builder

Fills a movie-collection spreadsheet with metadata from free, **no-API-key** sources.

## Files

| File | What it is |
|---|---|
| `catalog_builder.py` | The whole program, one file |
| `Movie_Catalog_Filled.xlsx` | The finished catalog (938 rows) |
| `cache/` | Downloaded datasets + per-stage JSON caches (created on first run) |

## Install & run

```bash
pip install openpyxl

python3 catalog_builder.py -i Archive-Full-Completed.csv -o Movie_Catalog_Filled.xlsx -w cache
```

First run downloads ~1.9 GB of IMDb datasets and takes roughly 25-40 minutes.
Every stage caches, so re-runs take seconds.

### Useful flags

```bash
--only download   # just grab the IMDb dumps
--only match      # stop after IMDb matching
--only web        # stop after Wikidata + Wikipedia
--only build      # only rebuild the .xlsx from cache (fast, for styling tweaks)
--wiki-passes 6   # more retry rounds against Wikipedia rate limits
```

## Input

A CSV with at least a `Title` column. `Year` and `Director` are optional but
greatly improve matching accuracy. A `#` id column is used if present.

Legacy encodings are auto-repaired — the source file here was **CP437 (DOS)**,
which is why accents originally showed as `Milo? Forman` / `Am�re Victoire`.

## What gets filled

| Filled automatically | Coverage |
|---|---|
| Director, Year, Genre | 100% |
| Rating (IMDb), Runtime, Country | ~100% |
| Cast (top 5 billed) | 99% |
| Synopsis | 98% |
| Poster URL | 97% |
| Studio | 62% |
| Original Title | 25% (only when it differs) |
| MPA Rating | 33% (only US-released titles have one) |
| IMDb ID + Link | 99% |

**Left blank on purpose** (yours to fill): Row, Watched, My Rating, Criterion,
Copies, Media Type, Drive Number, Content Type, Seasons/Episodes, Format.
`Shelf` is preserved from the input. These columns have dropdown validation
so you can pick values instead of typing.

## Output sheets

- **Collection** — the catalog, frozen header, autofilter, clickable links
- **Needs Review** — 6 box sets / compilations that aren't single films
- **Summary** — fill rate per column

## How matching works

1. **Candidate generation** — each title is expanded into variants
   (`"Andromeda Strain, The"` → `the andromeda strain`, `"Afire (Roter Himmel)"`
   → both parts, `(Copy 1)` stripped, etc.), then looked up in
   `title.basics`; anything still unresolved gets an `title.akas` scan for
   foreign release titles.
2. **Scoring** — each candidate is scored on title-type (feature film beats
   short), year distance, director surname match, and vote count. Best score wins;
   anything under 8 is logged as low-confidence.
3. **Manual overrides** — `TITLE_FIXES`, `ID_OVERRIDES` and `BOX_SETS` at the top
   of the script handle typos (`Black Dahia`), retitled releases
   (*Against All Enemies* = *Seberg*), and box sets. Edit these for your own list.

## Sources

- IMDb official datasets — https://datasets.imdbws.com (non-commercial use)
- Wikidata via the QLever mirror (the official WDQS endpoint was rate-limiting
  to 1 req/min during an outage)
- Wikipedia REST summary API

Posters are hotlinked Wikimedia URLs, not downloaded.
