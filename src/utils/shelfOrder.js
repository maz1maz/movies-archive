// ترتیب جلدها تو یه بخش قفسه — هم نمای Shelves و هم برچسب موقعیت تو صفحه‌ی فیلم
// از همین استفاده می‌کنن تا شماره‌ی جایگاه همیشه یکی باشه.
export function sortKey(title) {
  return String(title || '')
    .replace(/^the\s+/i, '')
    .toLowerCase()
}
// ترتیب طبیعی: «Film 2» قبل از «Film 10»
export const compareTitles = (a, b) => sortKey(a.title).localeCompare(sortKey(b.title), undefined, { numeric: true })

// شماره‌ی جایگاه (از ۱) یه فیلم تو بخشش: {start, end} (با چند نسخه، بازه) یا null
export function shelfSlotOf(films, film) {
  if (!film || !film.closet) return null
  const key = (f) => `${f.closet}|${f.row || '–'}|${f.shelf || '–'}`
  const k = key(film)
  const list = films
    .filter((f) => f.mediaType !== 'digital' && f.closet && key(f) === k)
    .sort(compareTitles)
  let pos = 0
  for (const f of list) {
    const copies = Math.max(1, Number(f.copies) || 1)
    if (f.id === film.id) return { start: pos + 1, end: pos + copies }
    pos += copies
  }
  return null
}

// نقشه‌ی id → {start, end} برای همه‌ی فیلم‌های فیزیکی؛ یه بار برای کل آرشیو
// (برای لیست‌هایی که برای هر کارت شماره‌ی جایگاه می‌خوان)
export function buildSlotIndex(films) {
  const bySection = new Map()
  for (const f of films) {
    if (f.mediaType === 'digital' || !f.closet) continue
    const k = `${f.closet}|${f.row || '–'}|${f.shelf || '–'}`
    if (!bySection.has(k)) bySection.set(k, [])
    bySection.get(k).push(f)
  }
  const out = new Map()
  for (const list of bySection.values()) {
    list.sort(compareTitles)
    let pos = 0
    for (const f of list) {
      const copies = Math.max(1, Number(f.copies) || 1)
      out.set(f.id, { start: pos + 1, end: pos + copies })
      pos += copies
    }
  }
  return out
}

// متن شماره‌ی جایگاه: «22» یا برای چند نسخه بازه‌ی «22–23»
export function slotLabel(slot) {
  if (!slot) return ''
  return slot.start === slot.end ? String(slot.start) : `${slot.start}–${slot.end}`
}
