// بازه‌ی الفبای یه بخش قفسه، مثل «A – Ba»: «The» و علامت‌های اول عنوان نادیده
// گرفته می‌شن. دو حرف کافیه، مگه این‌که اول و آخر یکی بشن — اون‌وقت تا ۵ حرف.
const clean = (t) => String(t || '').replace(/^the\s+/i, '').replace(/^[^\p{L}\p{N}]+/u, '')

export function alphabetRange(firstTitle, lastTitle) {
  const x = clean(firstTitle)
  const y = clean(lastTitle)
  let n = 2
  while (n < 5 && x.slice(0, n).toLowerCase() === y.slice(0, n).toLowerCase() && (x.length > n || y.length > n)) n++
  const fmt = (v) => v.slice(0, n).replace(/^./, (ch) => ch.toUpperCase()) || '#'
  return `${fmt(x)} – ${fmt(y)}`
}
