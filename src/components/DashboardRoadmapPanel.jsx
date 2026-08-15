import { IconMasks, IconCheck } from './icons.jsx'

// تب «Roadmap» — فقط لیست ایده‌های آینده، بدون قابلیت فعال. هر آیتم بعداً
// جداگانه پیاده‌سازی می‌شه و از این لیست به ستون «انجام‌شده» منتقل می‌شه.
const DONE_ITEMS = [
  { title: 'گزارش سلامت دیتابیس', desc: 'تب DB Health — اسکن و لیست رکوردهای ناقص (بدون پوستر/خلاصه/کارگردان/ژانر/لوکیشن و...)' },
  { title: 'سیستم لاگ تغییرات (Audit Trail)', desc: 'تب Audit Trail — ثبت create/update/delete با مقدار قبل/بعد و کاربر' },
  { title: 'API Rate Limit Monitoring', desc: 'شمارنده‌ی روزانه‌ی OMDb تو D1 + نوار هشدار تو تب DB Health وقتی به ۸۰٪ سقف نزدیک بشه' },
  { title: 'تست خودکار قبل از دیپلوی', desc: 'predeploy — چک سینتکس server/*.js، build کامل، تطبیق schema.sql با worker.js، و اختیاری چک زنده‌ی OMDb/TMDB' },
  { title: 'بکاپ چندلایه', desc: 'علاوه بر KV، هر بکاپ روزانه رو backups/latest-backup.json.gz تو خود repo هم commit می‌کنه (GITHUB_BACKUP_TOKEN)' },
  { title: 'صفحه آمار مصرف API', desc: 'تب API Usage — نمودار ۳۰ روز اخیر مصرف OMDb از api_usage_daily' },
  { title: 'نسخه‌بندی اسکیمای دیتابیس', desc: 'پوشه‌ی migrations/ + جدول schema_migrations + npm run migrate' },
  { title: 'نوتیفیکیشن خطاهای سرور', desc: 'هشدار تلگرام موقع خطای API یا شکست کرون‌های daily backup/enrichment (TELEGRAM_BOT_TOKEN)' },
  { title: 'Rate Limiting روی Endpointهای عمومی', desc: 'محدودیت ۶۰ درخواست/دقیقه برای مهمان‌ها، رو KV جدا (RATE_LIMIT) — کاربر لاگین‌شده محدودیت نداره' },
  {
    title: 'کش هوشمند با Invalidation خودکار',
    desc: 'TTL کوتاه‌تر خودکار برای نتیجه‌ی خالی/شکست‌خورده (به‌جای TTL کامل) در همه‌ی کش‌های cinema_news_cache و director_extras؛ + رفع باگ people_photos که ثبت لینک مصاحبه، fetch بیوگرافی رو برای همیشه بلاک می‌کرد',
  },
  { title: 'دنبال‌کردن هنرمند', desc: 'دکمه Follow/Unfollow رو PersonModal + تب Following تو Dashboard (گالری کارت با عکس)' },
  { title: 'تقویم جشنواره‌ها و اکران‌ها', desc: 'تب Festivals تو Cinema News — کاملاً خودکار از Wikidata (بدون لیست دستی): P179 پیدا می‌کنه نزدیک‌ترین ادیشن هر جشنواره رو، کش ۱۴ روزه' },
  { title: 'گراف رابطه فیلم‌ها', desc: 'بخش «Part of: X Collection» تو MovieModal (از belongs_to_collection تی‌ام‌دی‌بی) + تب Collections تو Dashboard؛ چک‌کردن خودکار موقع باز کردن هر فیلم، بدون نیاز به enrich دستی' },
  { title: 'بازیگر مشترک', desc: 'بخش «هم‌بازی‌های پرتکرار» تو PersonModal — کاملاً از دیتای cast موجود، بدون API؛ کلیک روی هرکدوم می‌بره به PersonModal اونا' },
  { title: 'اقتباسی از کتاب', desc: 'خودکار از Wikidata (P144 «based on» + P50 نویسنده)، بر اساس imdbId؛ نمایش تو FilmModal — بدون فیلتر جدا (فقط نمایش)' },
  {
    title: 'نویسنده فیلمنامه مورد علاقه',
    desc: 'OMDb حالا فیلد Writer رو هم خودکار پر می‌کنه (قبلاً نادیده گرفته می‌شد)؛ رفع باگ نمایش (film.writer اشتباه به‌جای screenwriter)؛ کلیک‌پذیر به PersonModal + قابل Follow؛ فقط فیلم‌های تازه enrich‌شده — بک‌فیل کل آرشیو نیاز به اسکریپت جدا داره',
  },
  { title: 'گراف سینمای کشورها', desc: 'قبلاً موجود بود — تب Overview، بخش «Top Countries» (بار چارت بر اساس فیلد country)' },
  { title: 'پوستر جایگزین', desc: 'چرخش پوسترهای TMDB فقط با هاور موس رو کارت (نه خودکار همیشه — قبلاً اذیت‌کننده بود)؛ fetch فقط وقتی کارت تو دیدرسه، کش ۳۰ روزه' },
  { title: 'همکاری کارگردان–بازیگر', desc: 'بخش «بازیگرهای پرتکرار» (روی صفحه کارگردان) یا «همکاری با کارگردان‌ها» (روی صفحه بازیگر) تو PersonModal — کاملاً از دیتای موجود، فقط همکاری‌های بیش از ۱ فیلم' },
  { title: 'لوکیشن فیلم‌برداری', desc: 'خودکار از Wikidata (P915 «filming location»)، بر اساس imdbId؛ نمایش «Filmed in» تو FilmModal — بدون فیلتر جغرافیایی (فقط نمایش)' },
  { title: 'نسخه اکستندد / دایرکتور کات', desc: 'ستون editionType (دستی، تو EditModal) — حالا تو FilmModal ردیف «Edition» و رو کارت گرید تگ کوچیک نشون داده می‌شه' },
  {
    title: 'جشنواره‌ای برنده جایزه',
    desc: 'خودکار از Wikidata (P166 «award received»)، محدود به ۵ جشنواره‌ی معتبر (Cannes/Venice/Berlin/Oscar/Sundance) با emoji و رنگ مخصوص (نه لوگوی واقعی، به‌خاطر کپی‌رایت)؛ بج رو کارت گرید (کنار Criterion/Blu-ray) + لیست کامل تو FilmModal',
  },
]

const CINEPHILE_ITEMS = [
  { title: 'یادداشت نقد شخصی', desc: 'فیلد یادداشت خصوصی جدا از reviewهای فعلی' },
  { title: 'رتبه‌بندی سالانه', desc: 'تب Top 10 هر سال بر اساس تاریخ تماشا' },
  { title: 'جنبش سینمایی', desc: 'فیلد و فیلتر برای مکتب‌هایی مثل نئورئالیسم' },
  { title: 'فیلم‌های الهام‌گرفته از هم', desc: 'لینک دستی بین دو فیلم با توضیح ارتباط' },
  { title: 'تریلر دیده‌شده', desc: 'تیک و تاریخ جدا برای دیدن تریلر هر فیلم' },
  { title: 'برچسب فیلم‌های کالت', desc: 'تگ دستی cult classic + فیلتر مخصوص' },
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
        icon={IconMasks}
        title="علایق فیلم‌بازی"
        subtitle="فیچرهای سینه‌فیلی برای آرشیو شخصی"
        items={CINEPHILE_ITEMS}
      />
    </div>
  )
}
