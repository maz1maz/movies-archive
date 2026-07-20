import json, os, re, time, urllib.parse, urllib.request

KEY = os.environ.get("OMDB_API_KEY")
if not KEY:
    raise SystemExit("OMDB_API_KEY not set")
BASE = "https://www.omdbapi.com/"

def fetch(title):
    qs = urllib.parse.urlencode({"apikey": KEY, "t": title, "type": "movie"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(BASE + "?" + qs, timeout=15) as r:
                d = json.load(r)
            if d.get("Response") == "True":
                return d
            if d.get("Error") == "Request limit reached!":
                print("  rate limit, sleeping 5s")
                time.sleep(5)
                continue
            return None
        except Exception as e:
            print("  err:", e)
            time.sleep(2)
    return None

def enrich(film):
    d = fetch(film["title"])
    if not d:
        return film
    out = dict(film)
    if d.get("Year") and d["Year"] != "N/A":
        try: out["year"] = int(d["Year"])
        except: pass
    if d.get("Director") and d["Director"] != "N/A":
        out["director"] = d["Director"]
    if d.get("Actors") and d["Actors"] != "N/A":
        out["cast"] = [a.strip() for a in d["Actors"].split(",") if a.strip()]
    if d.get("Genre") and d["Genre"] != "N/A":
        out["genre"] = [g.strip() for g in d["Genre"].split(",") if g.strip()]
    if d.get("imdbRating") and d["imdbRating"] != "N/A":
        try: out["rating"] = float(d["imdbRating"])
        except: pass
    m = re.search(r"(\d+)", d.get("Runtime", "") or "")
    if m:
        out["runtime"] = int(m.group(1))
    if d.get("Country") and d["Country"] != "N/A":
        out["country"] = d["Country"]
    if d.get("Plot") and d["Plot"] != "N/A":
        out["synopsis"] = d["Plot"]
    if d.get("Poster") and d["Poster"] != "N/A":
        out["poster"] = d["Poster"]
    out["imdbId"] = d.get("imdbID")
    return out

films = json.load(open("server/data/films.json", encoding="utf-8"))
print("enriching", len(films), "films…")
stats = {"poster":0,"director":0,"cast":0,"year":0,"genre":0}
for i, f in enumerate(films, 1):
    films[i-1] = enrich(f)
    for k in stats:
        if films[i-1].get(k): stats[k] += 1
    if i % 50 == 0:
        print(f"  {i}/{len(films)} done")
    time.sleep(0.2)

json.dump(films, open("server/data/films.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("saved. enriched fields:", stats)
