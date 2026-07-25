# dev_steps/

These are the original exploratory scripts, run one at a time while building
the catalog. They are kept for reference only.

**You do not need them** — everything here was consolidated, cleaned up and
improved in `../catalog_builder.py`, which is the version to actually use.

Rough order they were run in:

| Script | Purpose |
|---|---|
| `keys.py` | Shared title-normalisation helpers |
| `step1_candidates.py` … `step4_pick.py` | First matching attempt (89 misses) |
| `step5_cands2.py` … `step7_basics_for_aka.py` | Title variants + AKA fallback |
| `step8_meta.py`, `step11_meta2.py` | Crew / cast / ratings extraction |
| `step9_match.py`, `step12_final_match.py` | Scored matching |
| `step10_fix.py`, `step13_override.py` | Typo fixes and hand-set IMDb IDs |
| `step14_wikidata.py`, `wdfetch.py` | Wikidata via the official endpoint (hit an outage) |
| `wdfetch2.py` | Wikidata via the QLever mirror — the one that worked |
| `wikifetch.py` | Wikipedia synopses, run repeatedly against rate limits |
| `build_xlsx.py` | Spreadsheet writer |

Note: these expect hard-coded paths under `/home/user/work/` and a populated
cache. `catalog_builder.py` has no such assumptions.
