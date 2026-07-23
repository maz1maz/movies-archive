import { useEffect, useState } from 'react'

// یه زیرمجموعه‌ی تصادفی از پوسترها رو برای کلاژ پس‌زمینه انتخاب می‌کنه.
// posters اولش خالیه (چون لیست فیلم‌ها با تأخیر از سرور میاد)، پس نمی‌شه
// با useState(() => ...) یه‌بار برای همیشه محاسبه‌ش کرد — باید صبر کنیم
// داده واقعاً برسه، بعد فقط همون یه‌بار انتخاب تصادفی رو قفل کنیم.
function usePosterSample(posters, count) {
  const [sample, setSample] = useState([])
  useEffect(() => {
    if (sample.length > 0) return
    const withPoster = (posters || []).filter(Boolean)
    if (withPoster.length === 0) return
    const shuffled = [...withPoster].sort(() => Math.random() - 0.5)
    setSample(shuffled.slice(0, count))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posters])
  return sample
}

// زاویه‌های ثابت و متنوع برای هر کارت پوستر — نه کاملاً شلخته و تصادفی،
// نه یه شبکه‌ی صاف و بی‌روح؛ حس یه دیوار پر از پوستر واقعی رو می‌ده.
const TILT_ANGLES = [-7, 4, -3, 6, -5, 3, -8, 5, -4, 7, -6, 2, -2, 8]

// fixed={true}: پس‌زمینه‌ی کل صفحه (پشت هدر/گرید صفحات آرشیو)، با محو
// بیشتر چون پشتش محتوای زیادی هست که باید کاملاً خوانا بمونه.
// fixed={false} (پیش‌فرض): برای صفحات پوشه (انتخاب فیزیکی/دیجیتال)،
// با محو کمتر چون پشتش فقط دوتا کارت بزرگه و خودِ پوسترها باید دیده بشن.
export default function PosterCollage({ posters, count = 14, fixed = false }) {
  const sample = usePosterSample(posters, count)
  if (sample.length === 0) return null
  return (
    <div className={fixed ? 'folder-collage page-collage' : 'folder-collage'} aria-hidden="true">
      <div className="folder-collage-grid">
        {sample.map((src, i) => (
          <div
            className="folder-collage-tile"
            key={i}
            style={{ '--tilt': `${TILT_ANGLES[i % TILT_ANGLES.length]}deg` }}
          >
            <img src={src} alt="" loading="lazy" />
          </div>
        ))}
      </div>
      <div className={fixed ? 'folder-collage-overlay page-collage-overlay' : 'folder-collage-overlay'} />
    </div>
  )
}
