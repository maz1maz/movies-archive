// بعضی شبکه‌ها (مثلاً ایران بدون VPN) نمی‌تونن مستقیم به image.tmdb.org یا
// upload.wikimedia.org وصل بشن، حتی اگه خودِ سایت باز بشه. این تابع اون
// عکس‌ها رو از یه پراکسیِ خودِ Worker رد می‌کنه (که بهشون دسترسی داره) تا تو
// هر شبکه‌ای لود بشن. برای عکس‌های خودِ آرشیو (که از قبل حل شده) کاری نمی‌کنه.
const PROXIED_HOSTS = ['image.tmdb.org', 'upload.wikimedia.org']

export function proxyImg(url) {
  if (!url) return url
  try {
    const u = new URL(url)
    if (PROXIED_HOSTS.includes(u.hostname)) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`
    }
  } catch {
    // اگه URL نسبی یا نامعتبر بود، همون‌طوری که هست برگردون
  }
  return url
}
