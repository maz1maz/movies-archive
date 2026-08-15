import { IconLayers, IconMasks, IconCheck } from './icons.jsx'

// تب «Roadmap» — فقط لیست ایده‌های آینده، بدون قابلیت فعال. هر آیتم بعداً
// جداگانه پیاده‌سازی می‌شه و از این لیست به ستون «انجام‌شده» منتقل می‌شه.
const DONE_ITEMS = [
  { title: 'گزارش سلامت دیتابیس', desc: 'تب DB Health — اسکن و لیست رکوردهای ناقص (بدون پوستر/خلاصه/کارگردان/ژانر/لوکیشن و...)' },
  { title: 'سیستم لاگ تغییرات (Audit Trail)', desc: 'تب Audit Trail — ثبت create/update/delete با مقدار قبل/بعد و کاربر' },
  { title: 'API Rate Limit Monitoring', desc: 'شمارنده‌ی روزانه‌ی OMDb تو D1 + نوار هشدار تو تب DB Health وقتی به ۸۰٪ سقف نزدیک بشه' },
  { title: 'تست خودکار قبل از دیپلوی', desc: 'predeploy — چک سینتکس server/*.js، build کامل، تطبیق schema.sql با worker.js، و اختیاری چک زنده‌ی OMDb/TMDB' },
  { title: 'بکاپ چندلایه', desc: 'علاوه بر KV، هر بکاپ روزانه رو backups/latest-backup.json تو خود repo هم commit می‌کنه (GITHUB_BACKUP_TOKEN)' },
]

const TECHNICAL_ITEMS = [
  { title: 'کش هوشمند با Invalidation خودکار', desc: 'پاک‌سازی خودکار کش به‌جای حذف دستی جدول‌ها' },
  { title: 'صفحه آمار مصرف API', desc: 'نمودار روزانه مصرف TMDB / OMDb / Wikidata' },
  { title: 'نسخه‌بندی اسکیمای دیتابیس', desc: 'فایل migration برای هر تغییر ساختار جدول' },
  { title: 'نوتیفیکیشن خطاهای سرور', desc: 'اطلاع‌رسانی (ایمیل/تلگرام) موقع کرش Worker' },
  { title: 'Rate Limiting روی Endpointهای عمومی', desc: 'محدودیت درخواست برای دسترسی مهمان (guest)' },
]

const CINEPHILE_ITEMS = [
  { title: 'یادداشت نقد شخصی', desc: 'فیلد یادداشت خصوصی جدا از reviewهای فعلی' },
  { title: 'رتبه‌بندی سالانه', desc: 'تب Top 10 هر سال بر اساس تاریخ تماشا' },
  { title: 'دنبال‌کردن هنرمند', desc: 'دکمه Follow روی کارگردان/بازیگر + تب دنبال‌شده‌ها' },
  { title: 'تقویم جشنواره‌ها و اکران‌ها', desc: 'بخش جدید تو Cinema News از RSS/TMDB' },
  { title: 'جنبش سینمایی', desc: 'فیلد و فیلتر برای مکتب‌هایی مثل نئورئالیسم' },
  { title: 'گراف رابطه فیلم‌ها', desc: 'based on / remake / sequel از TMDB collections' },
  { title: 'فیلم‌های الهام‌گرفته از هم', desc: 'لینک دستی بین دو فیلم با توضیح ارتباط' },
  { title: 'بازیگر مشترک', desc: 'نمایش فیلم‌های مشترک دو بازیگر از دیتای cast موجود' },
  { title: 'تریلر دیده‌شده', desc: 'تیک و تاریخ جدا برای دیدن تریلر هر فیلم' },
  { title: 'اقتباسی از کتاب', desc: 'فیلد کتاب/نویسنده مبدأ + فیلتر «اقتباسی»' },
  { title: 'نویسنده فیلمنامه مورد علاقه', desc: 'نقش writer مثل کارگردان، با قابلیت دنبال‌کردن' },
  { title: 'گراف سینمای کشورها', desc: 'نمودار کشورهای فیلم‌های دیده‌شده از production_countries' },
  { title: 'پوستر جایگزین', desc: 'گالری چند پوستر از TMDB با انتخاب پوستر نمایشی' },
  { title: 'برچسب فیلم‌های کالت', desc: 'تگ دستی cult classic + فیلتر مخصوص' },
  { title: 'همکاری کارگردان–بازیگر', desc: 'فیلم‌های مشترک دو نفر، رو PersonModal' },
  { title: 'لوکیشن فیلم‌برداری', desc: 'فیلد لوکیشن از TMDB/Wikidata + فیلتر جغرافیایی' },
  { title: 'نسخه اکستندد / دایرکتور کات', desc: 'فیلد نسخه (Theatrical/Extended/Director’s Cut)' },
  { title: 'جشنواره‌ای برنده جایزه', desc: 'بج طلایی برای فیلم‌های برنده Cannes/Oscar/Berlinale' },
  { title: 'فرمت اصلی اکران', desc: 'بج 35mm / 70mm / IMAX / دیجیتال' },
  { title: 'عکس پشت‌صحنه', desc: 'گالری behind-the-scenes از TMDB تو MovieModal' },
  { title: 'برچسب ریتم فیلم', desc: 'تگ دستی کند/متوسط/تند + فیلتر' },
  { title: 'گراف ژانر بر اساس دهه', desc: 'روند ژانر غالب در طول زمان تماشا' },
  { title: 'فیلم‌های تحسین‌شده ولی ندیده', desc: 'فیلتر امتیاز بالا مقایسه‌شده با watchlist فعلی' },
  { title: 'مصاحبه کارگردان', desc: 'لینک دستی یوتیوب/مقاله، مرتبط به هر فیلم' },
  { title: 'برچسب تجربی / آوانگارد', desc: 'تگ دستی experimental، جدا از cult' },
]

function RoadmapGroup({ icon: Icon, title, subtitle, items, done }) {
  return (
    <div className="stats-box" style={{ marginBottom: 18 }}>
      <div className="stats-box-head" style={{ marginBottom: '4px' }}>
        <h3>
          <Icon width={16} height={16} /> {title} ({items.length})
        </h3>
        <span className="stats-box-sub">{subtitle}</span>
      </div>
      <div className="roadmap-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8, marginTop: 10 }}>
        {items.map((it) => (
          <div
            key={it.title}
            className="roadmap-item"
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: done ? 'var(--success-bg, rgba(60,160,100,0.10))' : 'var(--card-bg, rgba(127,127,127,0.08))',
              border: done ? '1px solid var(--success-border, rgba(60,160,100,0.35))' : '1px solid var(--border-color, rgba(127,127,127,0.15))',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14 }}>{done ? '✅ ' : ''}{it.title}</div>
            <div style={{ fontSize: 12.5, opacity: 0.75, marginTop: 2 }}>{it.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// این تب فقط لیستِ ایده‌هاست؛ عمداً هیچ منطق/دیتابیسی پشتش نیست.
export default function DashboardRoadmapPanel() {
  return (
    <div className="dashboard-roadmap-tab">
      <p className="dashboard-eyebrow" style={{ marginTop: 18 }}>
        فقط لیست — هنوز پیاده‌سازی نشده
      </p>
      <RoadmapGroup
        icon={IconCheck}
        title="انجام‌شده"
        subtitle="آیتم‌های پیاده‌سازی‌شده از این روادمپ"
        items={DONE_ITEMS}
        done
      />
      <RoadmapGroup
        icon={IconLayers}
        title="زیرساخت و فنی"
        subtitle="بهبودهای پایداری، مانیتورینگ و نگهداری سیستم"
        items={TECHNICAL_ITEMS}
      />
      <RoadmapGroup
        icon={IconMasks}
        title="علایق فیلم‌بازی"
        subtitle="فیچرهای سینه‌فیلی برای آرشیو شخصی"
        items={CINEPHILE_ITEMS}
      />
    </div>
  )
}
