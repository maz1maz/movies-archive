import { proxyImg } from '../utils/proxyImg.js'

// محتوای یه جلد روی قفسه (هم نمای Section هم Wall) — شبیه نمونه‌ی «Physical
// Filmshelf»: عطف با برچسب فرمت بالا، عنوان عمودی (بالا به پایین) با Inter و
// سال پایین؛ وقتی جلد باز می‌شه، پوستر سمت چپ و یه پنل اطلاعات سمت راست.
// خودِ ظرف (.bluray-case، رنگ، هاور، کلیک) تو کامپوننت والده.

// برچسب فرمت بالای عطف: [خط اول، خط دوم، کلاس رنگ]
export function spineFormat(f, style) {
  if (f.criterion || style?.type === 'criterion') return ['CRIT.', 'COLL.', 'crit']
  if (style?.type === '4k' || /4k|uhd/i.test(f.format || '')) return ['4K', 'UHD', 'uhd']
  if (style?.type === 'steelbook' || /steel/i.test(f.format || '')) return ['STEEL', 'BOOK', 'steel']
  if (/dvd/i.test(f.format || '')) return ['DVD', 'VIDEO', 'dvd']
  return ['BLU-', 'RAY', 'blu']
}

export default function SpineCase({ film: f, style, copyIdx = 0, copyCount = 1, onOpen }) {
  const [fmt1, fmt2, fmtClass] = spineFormat(f, style)
  // همه‌ی آرشیو بلوریه، پس برچسب فقط برای Criterion نشون داده می‌شه
  const showFormat = fmtClass === 'crit'
  const location = f.closet ? `C${f.closet}${f.row ? `·R${f.row}` : ''}${f.shelf ? `·S${f.shelf}` : ''}` : ''
  const meta = [f.year, f.runtime ? `${f.runtime} min` : null, f.country ? String(f.country).split(',').slice(0, 2).join(' / ') : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <>
      <div className="case-glare" />

      <div className="case-spine-view">
        {showFormat && (
          <span className={`spine-format spine-format-${fmtClass}`}>
            <span>{fmt1}</span>
            <span>{fmt2}</span>
          </span>
        )}
        <div className="case-spine">
          <span className="spine-title" style={{ color: style?.text || '#fff' }}>
            {f.title}
          </span>
        </div>
        <span className="spine-foot" style={{ color: style?.text || '#fff' }}>
          {copyCount > 1 ? `${copyIdx + 1}/${copyCount}` : f.year || ''}
        </span>
      </div>

      <div className="case-expand-view">
        <div className="case-expand-poster">
          {f.poster ? (
            <img src={proxyImg(f.poster)} alt="" loading="lazy" decoding="async" />
          ) : (
            <div className="case-expand-poster-fallback">🎬</div>
          )}
        </div>
        <div className="case-expand-panel" style={{ '--case-tint': style?.bg || '#1b1c20' }}>
          {(showFormat || f.rating) && (
            <span className="case-panel-kicker">
              {[showFormat ? 'Criterion Collection' : null, f.rating ? `★ ${Number(f.rating).toFixed(1)} IMDb` : null].filter(Boolean).join(' · ')}
            </span>
          )}
          <span className="case-panel-title">{f.title}</span>
          {f.director && <span className="case-panel-director">{f.director}</span>}
          {meta && <span className="case-panel-meta">{meta}</span>}
          <span className="case-panel-tags">
            {showFormat && <span className={`case-panel-format spine-format-${fmtClass}`}>CRITERION</span>}
            {location && <span className="case-panel-loc">{location}</span>}
            {copyCount > 1 && <span className="case-panel-loc">copy {copyIdx + 1}/{copyCount}</span>}
          </span>
          <button
            type="button"
            className="case-panel-open"
            onClick={(e) => {
              e.stopPropagation()
              onOpen && onOpen(f)
            }}
          >
            Open case
          </button>
        </div>
      </div>
    </>
  )
}
