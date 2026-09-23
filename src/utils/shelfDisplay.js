// Shared "spine shelf" display helpers used by both BookshelfView.jsx and
// LocationBrowserModal.jsx, so the two views can't drift out of sync again
// (LocationBrowserModal previously had its own copy of this JSX without
// these helpers ever being copied over, which crashed the shelf view).

const SPINE_PALETTES = [
  { bg: '#86198f', text: '#fdf4ff', badge: 'dts', badgeText: 'DTS' },
  { bg: '#15803d', text: '#f0fdf4', badge: 'st', badgeText: 'ST' },
  { bg: '#1e3a8a', text: '#eff6ff', badge: 'do', badgeText: 'DO' },
  { bg: '#18181b', text: '#fafafa', badge: 'cin', badgeText: 'CIN' },
  { bg: '#b45309', text: '#fffbeb', badge: 'dts', badgeText: 'DTS' },
  { bg: '#be123c', text: '#fff1f2', badge: 'me', badgeText: 'ME' },
  { bg: '#0369a1', text: '#f0f9ff', badge: 'v', badgeText: 'V' },
  { bg: '#4d7c0f', text: '#f7fee7', badge: 'dts', badgeText: 'DTS' },
  { bg: '#6d28d9', text: '#f5f3ff', badge: 'do', badgeText: 'DO' },
  { bg: '#9f1239', text: '#fff1f2', badge: 'st', badgeText: 'ST' },
  { bg: '#334155', text: '#f8fafc', badge: 'fa', badgeText: 'FA' },
  { bg: '#047857', text: '#ecfdf5', badge: 'cin', badgeText: 'CIN' },
]

// رنگ‌بندی معنادار بر اساس ژانر اصلی فیلم — به‌جای رنگ تصادفیِ بی‌معنی
// قبلی (هش روی عنوان)، حالا اسکن کردن قفسه واقعاً یه‌چیزی نشون می‌ده: چشمت
// می‌تونه دنبال یه ژانر خاص بگرده. کرایتریون/استیل‌بوک/4K هنوز بالای همه‌ی
// این‌ها اولویت دارن (چک اول تابع)، رنگ ژانر فقط برای بلوری‌های معمولیه.
const GENRE_PALETTE = {
  drama: { bg: '#0f5c5c', text: '#e6fffa', badge: 'do', badgeText: 'DRA' },
  comedy: { bg: '#c2760f', text: '#fff7e6', badge: 'st', badgeText: 'COM' },
  action: { bg: '#9a1c1c', text: '#ffecec', badge: 'v', badgeText: 'ACT' },
  adventure: { bg: '#b5490f', text: '#fff2e8', badge: 'v', badgeText: 'ADV' },
  horror: { bg: '#1f1023', text: '#f3e8ff', badge: 'me', badgeText: 'HOR' },
  thriller: { bg: '#3f0d3f', text: '#fbe8ff', badge: 'me', badgeText: 'THR' },
  'sci-fi': { bg: '#0a5ea8', text: '#e6f4ff', badge: 'v', badgeText: 'SCI' },
  scifi: { bg: '#0a5ea8', text: '#e6f4ff', badge: 'v', badgeText: 'SCI' },
  fantasy: { bg: '#4327a1', text: '#f0ebff', badge: 'do', badgeText: 'FAN' },
  romance: { bg: '#a3195b', text: '#ffe6f0', badge: 'me', badgeText: 'ROM' },
  documentary: { bg: '#3d5a1f', text: '#f2fce6', badge: 'cin', badgeText: 'DOC' },
  animation: { bg: '#7e22ce', text: '#f5e6ff', badge: 'st', badgeText: 'ANI' },
  crime: { bg: '#1e293b', text: '#e6ecf5', badge: 'fa', badgeText: 'CRI' },
  mystery: { bg: '#2b2440', text: '#ece6ff', badge: 'fa', badgeText: 'MYS' },
  war: { bg: '#4a4321', text: '#faf6e6', badge: 'dts', badgeText: 'WAR' },
  history: { bg: '#5c4423', text: '#fbf2e6', badge: 'dts', badgeText: 'HIS' },
  music: { bg: '#8a5a0f', text: '#fff5e0', badge: 'st', badgeText: 'MUS' },
  musical: { bg: '#8a5a0f', text: '#fff5e0', badge: 'st', badgeText: 'MUS' },
  family: { bg: '#0e7490', text: '#e6fbff', badge: 'do', badgeText: 'FAM' },
  biography: { bg: '#374151', text: '#eef0f2', badge: 'do', badgeText: 'BIO' },
  western: { bg: '#78350f', text: '#fff1e0', badge: 'v', badgeText: 'WES' },
}

export function getSpineColor(film, idx = 0) {
  if (film.criterion) {
    return {
      bg: '#d9a441',
      text: '#1a1305',
      type: 'criterion',
      badge: 'crit',
      badgeText: 'C',
    }
  }
  const str = String(film.title || '').toLowerCase()
  if (str.includes('clockwork') || str.includes('steel') || idx === 19) {
    return {
      bg: 'linear-gradient(90deg, #9ca3af 0%, #d1d5db 50%, #6b7280 100%)',
      text: '#111827',
      type: 'steelbook',
      badge: 'w',
      badgeText: 'WB',
    }
  }
  if ((film.format || '').toLowerCase().includes('4k') || str.includes('4k')) {
    return {
      bg: '#09090b',
      text: '#fafafa',
      type: '4k',
      badge: 'hdr',
      badgeText: 'HDR',
    }
  }

  // اگه رنگ غالب پوستر این فیلم قبلاً استخراج شده (فیلد posterColor)،
  // همونو به‌عنوان پایه‌ی رنگ جلد استفاده کن — این‌جوری هر جلد رنگ واقعی و
  // منحصربه‌فرد خودش رو داره، نه یه رنگ تکراری از یه دسته‌ی محدود.
  if (film.posterColor && /^#[0-9a-f]{6}$/i.test(film.posterColor)) {
    const hex = film.posterColor
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const shade = (v, f) => Math.max(0, Math.min(255, Math.round(v * f)))
    const top = `rgb(${shade(r, 1.15)},${shade(g, 1.15)},${shade(b, 1.15)})`
    const bottom = `rgb(${shade(r, 0.65)},${shade(g, 0.65)},${shade(b, 0.65)})`
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return {
      bg: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`,
      text: luminance > 0.55 ? '#1a1a1a' : '#f5f5f5',
      type: 'poster-color',
      badge: '',
      badgeText: '',
    }
  }

  // ژانر اصلی رو از فیلد genre (آرایه یا JSON-string) دربیار و رنگش رو
  // از GENRE_PALETTE بگیر — این‌جوری رنگ هر جلد یه معنی داره، نه فقط تزئین.
  let genres = film.genre
  if (typeof genres === 'string') {
    try {
      genres = JSON.parse(genres)
    } catch {
      genres = [genres]
    }
  }
  const firstGenre = Array.isArray(genres) && genres.length ? String(genres[0]).toLowerCase().trim() : null
  if (firstGenre && GENRE_PALETTE[firstGenre]) {
    return { ...GENRE_PALETTE[firstGenre], type: 'bluray' }
  }

  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  const pal = SPINE_PALETTES[Math.abs(hash) % SPINE_PALETTES.length]
  return { ...pal, type: 'bluray' }
}

export function getEditionBadge(film) {
  const str = `${film.title || ''} ${film.format || ''}`.toLowerCase()
  if (str.includes('director')) return 'DIR CUT'
  if (str.includes('4k') || str.includes('uhd')) return 'HDR10'
  if (film.criterion) return 'DTS-HD'
  const idHash = String(film.id || '')
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0)
  return idHash % 2 === 0 ? 'DOLBY' : 'DTS-HD'
}

// برچسبِ فرمتِ بالای جلد (4K UHD / BLU-RAY / DVD VIDEO / CRIT. COLL.) —
// اول کرایتریون، بعد فیلدِ واقعیِ format فیلم، وگرنه نوعِ استخراج‌شده از
// getSpineColor.
export function getFormatLabel(film, spineType) {
  if (film.criterion) return 'CRIT. COLL.'
  const fmt = String(film.format || '').toLowerCase()
  if (fmt.includes('4k') || fmt.includes('uhd') || spineType === '4k') return '4K UHD'
  if (fmt.includes('dvd')) return 'DVD VIDEO'
  if (spineType === 'steelbook') return 'STEELBOOK'
  return 'BLU-RAY'
}

export function getStudioBadgeText(studio) {
  const s = String(studio || '').trim()
  if (!s) return null
  const sl = s.toLowerCase()
  if (sl.includes('a24')) return 'A24'
  if (sl.includes('warner')) return 'WB'
  if (sl.includes('universal')) return 'UNIV'
  if (sl.includes('sony')) return 'SONY'
  if (sl.includes('paramount')) return 'PARA'
  if (sl.includes('criterion')) return 'CRIT'
  if (sl.includes('arrow')) return 'ARROW'
  if (sl.includes('mgm')) return 'MGM'
  if (sl.includes('disney')) return 'DISNEY'
  return s.slice(0, 5).toUpperCase()
}
