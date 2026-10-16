// جنبش‌های سینمایی — حدسِ خودکار از کارگردان + کشور + سال (بدون API).
// برچسب‌های TMDB (مثل french-new-wave) هم اگه باشن، اولویت دارن.

export const MOVEMENT_LABELS = {
  neorealism: 'Italian Neorealism',
  'french-new-wave': 'French New Wave',
  'german-expressionism': 'German Expressionism',
  noir: 'Film Noir',
  'neo-noir': 'Neo-Noir',
  'new-hollywood': 'New Hollywood',
  'iranian-new-wave': 'Iranian New Wave',
  'japanese-new-wave': 'Japanese New Wave',
  'dogme-95': 'Dogme 95',
  'slow-cinema': 'Slow Cinema',
  'czech-new-wave': 'Czechoslovak New Wave',
  'new-german-cinema': 'New German Cinema',
}

export const TAG_LABELS = {
  cult: 'Cult',
  experimental: 'Experimental / Avant-garde',
  ...MOVEMENT_LABELS,
}

const RULES = [
  { tag: 'neorealism', countries: ['italy'], from: 1943, to: 1956, directors: ['rossellini', 'de sica', 'visconti', 'de santis', 'zavattini', 'lattuada', 'germi'] },
  { tag: 'french-new-wave', countries: ['france'], from: 1958, to: 1970, directors: ['godard', 'truffaut', 'chabrol', 'rohmer', 'rivette', 'resnais', 'varda', 'demy', 'malle', 'marker', 'eustache'] },
  { tag: 'german-expressionism', countries: ['germany'], from: 1919, to: 1933, directors: ['murnau', 'lang', 'wiene', 'leni', 'pabst'] },
  { tag: 'new-hollywood', countries: ['usa', 'united states'], from: 1967, to: 1982, directors: ['coppola', 'scorsese', 'altman', 'bogdanovich', 'friedkin', 'ashby', 'rafelson', 'penn', 'cimino', 'malick', 'de palma', 'hopper', 'pakula', 'schatzberg'] },
  { tag: 'iranian-new-wave', countries: ['iran'], from: 1964, to: 2015, directors: ['kiarostami', 'makhmalbaf', 'mehrjui', 'beyzaie', 'panahi', 'kimiavi', 'naderi', 'shahid saless', 'farhadi', 'majidi', 'ghobadi', 'golestan', 'farrokhzad', 'taghvai'] },
  { tag: 'japanese-new-wave', countries: ['japan'], from: 1956, to: 1978, directors: ['oshima', 'imamura', 'shinoda', 'yoshida', 'teshigahara', 'hani', 'suzuki', 'matsumoto', 'wakamatsu'] },
  { tag: 'czech-new-wave', countries: ['czechoslovakia', 'czech'], from: 1962, to: 1970, directors: ['forman', 'chytilová', 'chytilova', 'menzel', 'němec', 'nemec', 'jireš', 'jires', 'passer', 'herz'] },
  { tag: 'new-german-cinema', countries: ['germany', 'west germany'], from: 1962, to: 1985, directors: ['fassbinder', 'herzog', 'wenders', 'schlöndorff', 'schlondorff', 'kluge', 'syberberg', 'von trotta'] },
  { tag: 'dogme-95', countries: ['denmark'], from: 1995, to: 2005, directors: ['von trier', 'vinterberg', 'kragh-jacobsen', 'levring'] },
]

const lc = (v) => String(v || '').toLowerCase()

// کارگردان باید تو لیست باشه، و کشور/سال هم بخونه — تا حدسِ الکی کم بشه.
export function guessMovements(film) {
  const year = Number(film?.year)
  if (!year) return []
  const country = lc(film.country)
  const director = lc(film.director)
  const genres = lc(Array.isArray(film.genre) ? film.genre.join(',') : film.genre)
  const out = []
  for (const r of RULES) {
    if (year < r.from || year > r.to) continue
    if (!r.countries.some((c) => country.includes(c))) continue
    if (!r.directors.some((d) => director.includes(d))) continue
    out.push(r.tag)
  }
  // فیلم نوآر کلاسیک: ژانر Film-Noir از OMDb
  if (genres.includes('film-noir') || genres.includes('film noir')) out.push('noir')
  return out
}

export function filmTags(film, tmdbTags = []) {
  return [...new Set([...(tmdbTags || []), ...guessMovements(film)])]
}
