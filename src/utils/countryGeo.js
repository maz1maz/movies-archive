import countries from 'i18n-iso-countries'
import enLocale from 'i18n-iso-countries/langs/en.json'

countries.registerLocale(enLocale)

// آرشیو رشته‌های خام و ناهمگونی برای کشور ثبت کرده (اسم‌های قدیمی، غلط
// املایی، کشورهای منحل‌شده و...) که i18n-iso-countries نمی‌تونه مستقیم
// به ISO alpha-2 تبدیلشون کنه. نزدیک‌ترین معادل امروزی رو دستی نگاشت می‌کنیم؛
// مواردی مثل «Hindi» (زبانه، نه کشور) یا «Republic of» (داده‌ی ناقص) عمداً
// نادیده گرفته می‌شن.
const MANUAL_ALPHA2_OVERRIDES = {
  'british hong kong': 'HK',
  czechoslovakia: 'CZ',
  'east germany': 'DE',
  'empire of japan': 'JP',
  'federal republic of yugoslavia': 'RS',
  korea: 'KR',
  moldova: 'MD',
  'netherlands antilles': 'CW',
  'occupied palestinian territory': 'PS',
  'serbia and montenegro': 'RS',
  'soviet union': 'RU',
  syria: 'SY',
  'the democratic republic of congo': 'CD',
  ussr: 'RU',
  'west germany': 'DE',
  yugoslavia: 'RS',
}

export function rawCountryToAlpha2(raw) {
  const trimmed = (raw || '').toString().trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (MANUAL_ALPHA2_OVERRIDES[lower]) return MANUAL_ALPHA2_OVERRIDES[lower]
  return countries.getAlpha2Code(trimmed, 'en') || null
}

export function alpha2ToNumericId(alpha2) {
  return countries.alpha2ToNumeric(alpha2) || null
}

// اسم رسمی ISO بعضی کشورها برای نمایش خیلی طولانی یا غیرمتعارفه («United
// States of America»، «Korea, Republic of»)؛ برای این چندتا از alias
// کوتاه‌تر استفاده می‌کنیم.
const DISPLAY_NAME_OVERRIDES = {
  GB: 'United Kingdom',
  KR: 'South Korea',
  RU: 'Russia',
  US: 'United States',
}

export function alpha2ToName(alpha2) {
  if (DISPLAY_NAME_OVERRIDES[alpha2]) return DISPLAY_NAME_OVERRIDES[alpha2]
  return countries.getName(alpha2, 'en', { select: 'alias' }) || countries.getName(alpha2, 'en') || alpha2
}

// یه فیلم رو ممکنه هم به‌صورت فیزیکی هم دیجیتال (یا حتی چند نسخه‌ی فیزیکی)
// تو آرشیو داشته باشیم — هرکدوم یه ردیف/id جدا تو films هستن. برای شمارش
// «چند تا فیلمِ متفاوت» در هر کشور، این نسخه‌های تکراری از یه عنوان رو یکی
// حساب می‌کنیم (وگرنه همون پوستر چندبار پشت‌سرهم تو لیست کشور دیده می‌شه).
function filmIdentityKey(film) {
  return `${String(film.title || '').trim().toLowerCase()}::${film.year || ''}`
}

// فیلم‌های آرشیو رو بر اساس کشور (ستون country، که می‌تونه چندتایی و
// جداشده با ویرگول باشه) گروه‌بندی می‌کنه. خروجی Map از alpha2 -> جزئیات
// (اسم، تعداد، فیلم‌ها، رشته‌های خامی که به این کشور نگاشت شدن).
export function aggregateFilmsByCountry(films) {
  const byAlpha2 = new Map()
  for (const film of films) {
    if (!film.country) continue
    const rawParts = String(film.country)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const seenForThisFilm = new Set()
    for (const raw of rawParts) {
      const alpha2 = rawCountryToAlpha2(raw)
      if (!alpha2 || seenForThisFilm.has(alpha2)) continue
      seenForThisFilm.add(alpha2)
      if (!byAlpha2.has(alpha2)) {
        byAlpha2.set(alpha2, {
          alpha2,
          numericId: alpha2ToNumericId(alpha2),
          name: alpha2ToName(alpha2),
          count: 0,
          films: [],
          rawVariants: new Set(),
          seenTitles: new Set(),
        })
      }
      const entry = byAlpha2.get(alpha2)
      entry.rawVariants.add(raw)
      const identityKey = filmIdentityKey(film)
      if (entry.seenTitles.has(identityKey)) continue
      entry.seenTitles.add(identityKey)
      entry.count++
      entry.films.push(film)
    }
  }
  return byAlpha2
}
