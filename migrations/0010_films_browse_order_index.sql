-- 0010_films_browse_order_index
-- مرور هر بخش (Blu-ray Movies و ...) با مرتب‌سازی الفبایی (نادیده‌گرفتن «The») با هر صفحه
-- کل بخش (~۲۸هزار ردیف) رو می‌خوند و مرتب می‌کرد. این ایندکس روی (mediaType, itemType) و
-- دقیقاً همون دو عبارت ORDER BY ساخته شده تا D1 فقط offset+limit ردیف رو بخونه.
-- عبارت‌ها باید کاراکتر به کاراکتر با ORDER BY تو server/worker.js یکی باشن.
CREATE INDEX IF NOT EXISTS idx_films_browse_order ON films(
  mediaType,
  itemType,
  (CASE WHEN SUBSTR((CASE WHEN LOWER(title) LIKE 'the %' THEN SUBSTR(title, 5) ELSE title END), 1, 1) BETWEEN '0' AND '9' THEN 1 ELSE 0 END),
  (CASE WHEN LOWER(title) LIKE 'the %' THEN SUBSTR(title, 5) ELSE title END) COLLATE NOCASE
);
