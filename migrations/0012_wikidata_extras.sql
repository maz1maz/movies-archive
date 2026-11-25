-- 0012_wikidata_extras
-- داده‌های اضافه از Wikidata، همه در یک ستون JSON:
-- setIn (P840 + مختصات)، periods (P2408)، subjects (P921)، nominations (P1411)،
-- color (P462)، boxOffice/budget (P2142/P2130، فقط دلار)، faTitle/faWiki،
-- links (MUBI/Rotten Tomatoes/Metacritic).
-- NULL = هنوز چک نشده؛ '{}' = چک شده و چیزی پیدا نشد.
ALTER TABLE films ADD COLUMN wikidata TEXT;
