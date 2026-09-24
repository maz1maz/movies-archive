
export function emptyPersonInfo() {
  return {
    photo: null,
    bio: null,
    birthDate: null,
    deathDate: null,
    height: null,
    spouse: null,
    children: null,
    imdbId: null,
    letterboxdUrl: null,
  }
}


// اطلاعات ساختاریافته (تاریخ تولد، قد، همسر، فرزندان) رو از Wikidata
// می‌گیره — چون ویکی‌پدیای معمولی این‌ها رو به‌شکل فیلد جدا نمی‌ده،
// فقط متن آزاد. همسر/فرزندان اینجا هنوز فقط شناسه (Q-id) هستن، اسم واقعی‌شون
// رو resolveWikidataLabels جداگانه می‌گیره.
export async function fetchWikidataFacts(qid) {
  const empty = { birthDate: null, deathDate: null, height: null, spouseIds: [], childrenIds: [], imdbId: null }
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json`,
      { headers: { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' } }
    )
    if (!res.ok) return empty
    const data = await res.json()
    const claims = data?.entities?.[qid]?.claims || {}

    let birthDate = null
    const birthTime = claims.P569?.[0]?.mainsnak?.datavalue?.value?.time
    const bm = birthTime && birthTime.match(/^\+(\d{4})-(\d{2})-(\d{2})/)
    if (bm) birthDate = `${bm[1]}-${bm[2]}-${bm[3]}`

    let deathDate = null
    const deathTime = claims.P570?.[0]?.mainsnak?.datavalue?.value?.time
    const dm = deathTime && deathTime.match(/^\+(\d{4})-(\d{2})-(\d{2})/)
    if (dm) deathDate = `${dm[1]}-${dm[2]}-${dm[3]}`

    // قد روی Wikidata گاهی به متر ذخیره می‌شه (Q11573) و گاهی مستقیم به
    // سانتی‌متر (Q174728) — قبلاً همیشه فرض می‌شد متره و ضربدر ۱۰۰ می‌شد،
    // که برای مقادیری که از قبل سانتی‌متر بودن یه عدد مسخره مثل ۱۷۰۰۰ می‌داد.
    let height = null
    const heightVal = claims.P2048?.[0]?.mainsnak?.datavalue?.value
    if (heightVal?.amount) {
      const num = parseFloat(heightVal.amount)
      const unit = String(heightVal.unit || '')
      if (!isNaN(num)) {
        let cm
        if (unit.endsWith('Q174728')) cm = num // واحد صراحتاً سانتی‌متره
        else if (unit.endsWith('Q11573')) cm = num * 100 // واحد صراحتاً متره
        // واحد نامشخص/غیرمنتظره: بر اساس مقدار حدس بزن (قد آدم‌ها معمولاً
        // بین ۰.۵ تا ۲.۵ متر یا ۵۰ تا ۲۵۰ سانتی‌متره)، نه اینکه همیشه متر
        // فرض بشه (که باعث اعداد مسخره‌ای مثل ۶۴۰۰ سانتی‌متر می‌شد).
        else cm = num < 10 ? num * 100 : num
        // اگه بعد از این حدس هم عدد منطقی نبود (قد آدم نیست)، نادیده بگیر.
        if (cm >= 50 && cm <= 250) height = `${Math.round(cm)} cm`
      }
    }

    const spouseIds = (claims.P26 || [])
      .map((c) => c.mainsnak?.datavalue?.value?.id)
      .filter(Boolean)
      .slice(0, 2)
    const childrenIds = (claims.P40 || [])
      .map((c) => c.mainsnak?.datavalue?.value?.id)
      .filter(Boolean)
      .slice(0, 6)

    // P345 = IMDb ID (برای اشخاص معمولاً به شکل nm1234567)
    const imdbId = claims.P345?.[0]?.mainsnak?.datavalue?.value || null

    return { birthDate, deathDate, height, spouseIds, childrenIds, imdbId }
  } catch {
    return empty
  }
}


export async function resolveWikidataLabels(ids) {
  if (!ids.length) return {}
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=labels&languages=en&format=json`,
      { headers: { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' } }
    )
    if (!res.ok) return {}
    const data = await res.json()
    const out = {}
    for (const id of ids) {
      out[id] = data?.entities?.[id]?.labels?.en?.value || null
    }
    return out
  } catch {
    return {}
  }
}

// TMDB زبان اصلی رو با کد دو-حرفی ISO 639-1 برمی‌گردونه (مثلاً "fr")، ولی برای
// نمایش به کاربر اسم کامل بهتره؛ فقط زبان‌های رایج توی آرشیو فیلم رو پوشش می‌ده.
export const LANGUAGE_CODE_NAMES = {
  en: 'English', fr: 'French', de: 'German', it: 'Italian', es: 'Spanish',
  ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ru: 'Russian', pt: 'Portuguese',
  fa: 'Persian', ar: 'Arabic', hi: 'Hindi', sv: 'Swedish', no: 'Norwegian',
  da: 'Danish', fi: 'Finnish', nl: 'Dutch', pl: 'Polish', tr: 'Turkish',
  he: 'Hebrew', cs: 'Czech', el: 'Greek', hu: 'Hungarian', th: 'Thai',
  id: 'Indonesian', vi: 'Vietnamese', uk: 'Ukrainian', ro: 'Romanian',
  ca: 'Catalan', sr: 'Serbian', hr: 'Croatian', bn: 'Bengali', ta: 'Tamil',
}

export function languageCodeToName(code) {
  return LANGUAGE_CODE_NAMES[code] || code
}
