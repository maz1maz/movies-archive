// نگاشت بین «section» فعلی برنامه (physical / physical-series / digital-movie /
// digital-series) و پارامترهای mediaType+itemType که API انتظارشون رو داره —
// تا این تبدیل تو چند جای App.jsx تکرار نشه.

export function sectionToMediaItemType(sec) {
  if (sec === 'physical') return { mediaType: 'physical', itemType: 'movie' }
  if (sec === 'physical-series') return { mediaType: 'physical', itemType: 'series' }
  if (sec === 'digital-movie') return { mediaType: 'digital', itemType: 'movie' }
  if (sec === 'digital-series') return { mediaType: 'digital', itemType: 'series' }
  return {}
}

export function enrichScopeLabel(sec) {
  if (sec === 'physical') return 'physical movies'
  if (sec === 'physical-series') return 'physical series'
  if (sec === 'digital-movie') return 'digital movies'
  if (sec === 'digital-series') return 'digital series'
  return null
}

export function enrichScopeParams(sec) {
  const params = new URLSearchParams()
  if (sec === 'physical' || sec === 'digital-movie') params.set('itemType', 'movie')
  else if (sec === 'physical-series' || sec === 'digital-series') params.set('itemType', 'series')
  if (sec === 'physical' || sec === 'physical-series') params.set('mediaType', 'physical')
  else if (sec === 'digital-movie' || sec === 'digital-series') params.set('mediaType', 'digital')
  return params.toString()
}

// نام‌های کارگردان/بازیگر رو نرمال می‌کنه (کوچیک، بدون فاصله‌ی اضافه) تا
// مقایسه‌ی «همون شخص» بین دو رکورد قابل اعتماد باشه.
export function normNames(s) {
  return String(s || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
}
