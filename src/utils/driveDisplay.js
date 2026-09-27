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

// موقع ذخیره (نه فقط موقع نمایش) هرچی کاربر تایپ کرده رو یکدست می‌کنه —
// «Drive 1»، «drive1» و «1» هر سه می‌شن «1». بدون این، یه فرم که مقدار
// از قبل «Drive 1»‌دار رو دوباره ذخیره می‌کرد (یا کپی/پیست اشتباه)، می‌تونست
// «Drive Drive 1» یا حتی چیزهای عجیب‌تر مثل «Drive.Drive 1» بسازه — چون
// replace فقط یه بار «drive» رو از اول رشته برمی‌داشت، نه همه‌ی رخدادهاش.
// اینجا با /gi همه‌ی رخدادهای کلمه‌ی drive رو (هرجا باشه) حذف می‌کنه.
export function normalizeDriveValue(raw) {
  return String(raw || '')
    .split(',')
    .map((s) =>
      s
        .replace(/drive/gi, '')
        .replace(/[.\s]+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .join(', ')
}

export function driveSortValue(d) {
  // درایوهایی مثل «HDD-01» یا «9» رو عددی مرتب می‌کنه، نه رشته‌ای (که «10»
  // رو قبل از «2» می‌ذاشت)
  const m = String(d).match(/(\d+)/)
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER
}
