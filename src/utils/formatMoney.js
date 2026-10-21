// پول رو سه‌رقم‌سه‌رقم با واحد خوانا نشون می‌ده:
// 116112375 / "$116,112,375" → "$116,112,375 (116.1 million)"
// اگه عدد قابل‌خوندن نبود، همون متن اصلی برمی‌گرده.
const UNITS = [
  [1e9, 'billion'],
  [1e6, 'million'],
  [1e3, 'thousand'],
]

export function formatMoney(value) {
  if (value == null || value === '') return ''
  const digits = String(value).replace(/[^\d.]/g, '')
  const n = Math.round(Number(digits))
  if (!digits || !Number.isFinite(n) || n <= 0) return String(value)
  const grouped = `$${n.toLocaleString('en-US')}`
  const unit = UNITS.find(([size]) => n >= size)
  if (!unit) return grouped
  const short = (n / unit[0]).toFixed(1).replace(/\.0$/, '')
  return `${grouped} (${short} ${unit[1]})`
}
