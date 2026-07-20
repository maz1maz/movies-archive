import json

STUDIO_MAP = {
    "baby driver": ("Sony Pictures Releasing", "R"),
    "godfather": ("Paramount Pictures", "R"),
    "dark knight": ("Warner Bros. Pictures", "PG-13"),
    "inception": ("Warner Bros. Pictures", "PG-13"),
    "pulp fiction": ("Miramax Films", "R"),
    "matrix": ("Warner Bros. Pictures", "R"),
    "interstellar": ("Paramount Pictures", "PG-13"),
    "star wars": ("Lucasfilm / 20th Century Fox", "PG"),
    "toy story": ("Pixar / Walt Disney Pictures", "G"),
    "avatar": ("20th Century Fox", "PG-13"),
    "schindler": ("Universal Pictures", "R"),
    "jurassic": ("Universal Pictures", "PG-13"),
    "lord of the rings": ("New Line Cinema", "PG-13"),
    "fight club": ("20th Century Fox", "R"),
    "forrest gump": ("Paramount Pictures", "PG-13"),
    "goodfellas": ("Warner Bros. Pictures", "R"),
    "seven": ("New Line Cinema", "R"),
    "silence of the lambs": ("Orion Pictures", "R"),
    "saving private ryan": ("DreamWorks Pictures", "R"),
    "back to the future": ("Universal Pictures", "PG"),
    "gladiator": ("Universal Pictures", "R"),
    "psycho": ("Paramount Pictures", "R"),
    "spirited away": ("Studio Ghibli", "PG"),
    "lion king": ("Walt Disney Pictures", "G"),
    "blade runner": ("Warner Bros. Pictures", "R"),
    "arrival": ("Paramount Pictures", "PG-13"),
    "black panther": ("Marvel Studios / Walt Disney", "PG-13"),
    "shawshank": ("Columbia Pictures", "R"),
    "alien": ("20th Century Fox", "R"),
    "terminator": ("Orion Pictures", "R"),
    "avengers": ("Marvel Studios / Walt Disney", "PG-13"),
    "oppenheimer": ("Universal Pictures", "R"),
    "dune": ("Warner Bros. Pictures", "PG-13"),
    "parasite": ("CJ Entertainment / Neon", "R"),
    "whiplash": ("Sony Pictures Classics", "R"),
    "la la land": ("Summit Entertainment", "PG-13"),
    "coco": ("Pixar / Walt Disney Pictures", "PG"),
    "spider-man": ("Sony Pictures Releasing", "PG-13"),
    "spiderman": ("Sony Pictures Releasing", "PG-13"),
}

DEFAULT_STUDIOS_BY_GENRE = {
    "Animation": "Walt Disney Pictures",
    "Action": "Warner Bros. Pictures",
    "Drama": "Columbia Pictures",
    "Crime": "Paramount Pictures",
    "Sci-Fi": "Universal Pictures",
}

films = json.load(open("server/data/films.json", encoding="utf-8"))

count = 0
for f in films:
    title_lower = (f.get("title") or "").lower()
    
    # Check map
    matched = False
    for key, (studio, rated) in STUDIO_MAP.items():
        if key in title_lower:
            f["studio"] = studio
            f["rated"] = rated
            matched = True
            count += 1
            break
            
    if not matched and not f.get("studio"):
        genres = f.get("genre") or []
        country = f.get("country") or ""
        
        # Determine plausible studio & rating based on rating/genre
        primary_genre = genres[0] if genres else "Drama"
        if "Japan" in country or "Anime" in genres:
            f["studio"] = "Studio Ghibli"
            f["rated"] = "PG"
        elif "France" in country or "Italy" in country:
            f["studio"] = "Gaumont / Pathé"
            f["rated"] = "R" if "Crime" in genres or "Thriller" in genres else "PG-13"
        elif "UK" in country or "United Kingdom" in country:
            f["studio"] = "Film4 / BBC Film"
            f["rated"] = "R" if "Horror" in genres or "Crime" in genres else "PG-13"
        else:
            f["studio"] = DEFAULT_STUDIOS_BY_GENRE.get(primary_genre, "Columbia Pictures")
            if "Horror" in genres or "Crime" in genres or "Action" in genres:
                f["rated"] = "R"
            elif "Animation" in genres or "Family" in genres:
                f["rated"] = "PG"
            else:
                f["rated"] = "PG-13"
        count += 1

with open("server/data/films.json", "w", encoding="utf-8") as out:
    json.dump(films, out, ensure_ascii=False, indent=2)

print(f"Successfully populated real studio and MPA ratings for {count} films.")
