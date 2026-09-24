// TTL هوشمند برای کش‌های cinema_news_cache: اگه دیتای کش‌شده خالی باشه
// (آرایه‌ی خالی — یعنی احتمالاً یه fetch شکست‌خورده بوده، نه این‌که واقعاً
// چیزی برای نمایش نیست)، به‌جای TTL کامل (مثلاً ۲۴ ساعت)، یه TTL خیلی
// کوتاه‌تر استفاده می‌کنیم تا خودش دفعه‌ی بعد که کسی صفحه رو باز کرد دوباره
// امتحان کنه — بدون نیاز به حذف دستی ردیف از دیتابیس بعد از هر تغییر منطق.
export const EMPTY_CACHE_TTL_MS = 30 * 60 * 1000 // ۳۰ دقیقه برای نتیجه‌ی خالی

export function isCacheFresh(fetchedAt, dataStr, fullTtlMs) {
  if (!fetchedAt) return false
  const age = Date.now() - new Date(fetchedAt).getTime()
  let isEmpty = true
  try {
    const parsed = JSON.parse(dataStr || '[]')
    isEmpty = Array.isArray(parsed) ? parsed.length === 0 : !parsed || Object.keys(parsed).length === 0
  } catch {
    isEmpty = true
  }
  return age < (isEmpty ? EMPTY_CACHE_TTL_MS : fullTtlMs)
}
