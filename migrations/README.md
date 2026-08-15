# Migrations

از این به بعد، هر تغییر ساختاری روی دیتابیس (CREATE TABLE، ALTER TABLE، CREATE INDEX)
باید به‌جای اجرای مستقیم روی D1، یه فایل SQL جدید اینجا بشه.

## قانون نام‌گذاری

```
NNNN_short-description.sql
```

- `NNNN` یه عدد ۴رقمی افزایشی (0005، 0006، ...) — همیشه بعد از آخرین فایل موجود.
- توضیح کوتاه انگلیسی با خط تیره، نه فاصله.

## اجرا

```
npm run migrate
```

اسکریپت (`scripts/migrate.mjs`) خودش چک می‌کنه کدوم فایل‌ها قبلاً اعمال شدن
(از روی جدول `schema_migrations`) و فقط پندینگ‌ها رو اجرا می‌کنه.

## قانون مهم

هر فایل باید idempotent باشه — یعنی `CREATE TABLE IF NOT EXISTS`،
`CREATE INDEX IF NOT EXISTS`، نه `CREATE TABLE` ساده. چون اگه یه روز
دستی هم اجرا بشه، دوباره اجرا کردنش نباید خطا بده.

بعد از نوشتن migration جدید، `schema.sql` رو هم دستی آپدیت کن — اون فایل
snapshot کامل و خواناییه، migrations/ تاریخچه‌ی تدریجیه.
