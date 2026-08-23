// driveNumber می‌تونه یه رشته‌ی جدا‌شده‌با‌کاما باشه (مثلاً «1, 2, 4»)، وقتی
// همون آیتم روی چندتا هارد کپی شده — دقیقاً همون قرارداد فیلتر drive تو
// worker.js (driveNumber = ? OR driveNumber LIKE '<d>,%' OR ...)
export function parseDriveNumbers(raw) {
  if (!raw) return []
  return String(raw)
    .split(',')
    .map((s) => s.trim().replace(/^drive\s*/i, ''))
    .filter(Boolean)
}

// بعضی ردیف‌ها driveNumber رو «Drive 7» ذخیره کردن، بعضی فقط «7» — این
// دوتا رو یکی نشون می‌ده تا «Drive Drive 7» ساخته نشه
export function driveLabel(raw) {
  return parseDriveNumbers(raw)
    .map((d) => `Drive ${d}`)
    .join(', ')
}

export function driveSortValue(d) {
  // درایوهایی مثل «HDD-01» یا «9» رو عددی مرتب می‌کنه، نه رشته‌ای (که «10»
  // رو قبل از «2» می‌ذاشت)
  const m = String(d).match(/(\d+)/)
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER
}
