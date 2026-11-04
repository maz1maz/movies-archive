# گزینه‌های میزبانی و آدرس سایت (تصمیم باز)

تاریخ: ۲۰۲۶-۱۱-۰۴

## مشکل
- آدرس زنده `movies-archive.hamidreza-mazlaghani.workers.dev` اسم صاحب اکانت را نشان می‌دهد.
- دامین `cinearchive.ir` در Cloudflare اضافه نمی‌شود، پس Custom Domain ممکن نیست.

## گزینه ۱: تغییر زیردامنه‌ی workers.dev (ساده‌ترین)
- زیردامنه‌ی اکانت (`hamidreza-mazlaghani`) به اسم خنثی (مثلاً `cinearchive`) عوض می‌شود.
- آدرس جدید: `movies-archive.cinearchive.workers.dev`
- آدرس قدیمی از کار می‌افتد.
- **اثر روی کل اکانت:** Worker دیگر `pdmaz` (سایت دیگر) هم آدرسش عوض می‌شود:
  `pdmaz.cinearchive.workers.dev`. لینک‌های قدیمی آن می‌شکنند.
- اپ اندروید: آدرس در `MainActivity.kt` ثابت است و باید APK جدید ساخته و نصب شود.
- وضعیت کد: PR 109 مرج شده؛ CORS آدرس جدید را دارد و اندروید به آدرس جدید رفته.
  **خود تغییر زیردامنه هنوز اعمال نشده.** (آدرس قدیمی در `ALLOWED_ORIGINS` بعداً حذف شود.)
- اسم اکانت Cloudflare (داخل داشبورد) عمومی نیست و جداست.

## گزینه ۲: دامین غیر `.ir`
- دامین `.com` از Namecheap یا Porkbun بخر، در Cloudflare اضافه کن.
- بعد: `routes` با `custom_domain: true` و `workers_dev: false` در `wrangler.jsonc`.
- workers.dev کاملاً بسته می‌شود.

## گزینه ۳: سرور شخصی (کار بزرگ)
- `server/worker.js` (~۳٬۷۰۰ خط) به D1، KV، AI و کرون Cloudflare وابسته است.
- `server/index.js` نسخه‌ی قدیمی Express با فایل JSON است و ویژگی‌های جدید را ندارد.
- مراحل: بازنویسی به Node با SQLite، انتقال داده از D1، جایگزینی KV/AI/کرون،
  بعد دامین `.ir` مستقیم روی سرور.
- مزیت: دامین `.ir`، بدون سقف D1. هزینه: چند روز کار و نگهداری سرور/بکاپ/امنیت.

## Netlify
- مناسب نیست: D1، KV، AI و کرون ندارد. انتقال یعنی بازنویسی بزرگ.

## کمک برای مشکل ثبت دامین Cloudflare
community.cloudflare.com، `@CloudflareHelp` در X، Discord رسمی، تیکت Billing/Registrar در داشبورد.

## پیشنهاد
اگر هدف فقط پنهان‌کردن اسم است: گزینه ۱. اگر دامین `.ir` مهم است: گزینه ۳.
قبل از گزینه ۱ تصمیم درباره‌ی `pdmaz` لازم است.
