// کارت پوستری مشترک برای تب‌های داشبورد (Oscars / Genre Tops / Watchlists) —
// همون ظاهر کارت‌های آرشیو اصلی رو تکرار می‌کنه تا این بخش هم‌شکل بقیه‌ی اپ باشه.
const PALETTE = [
  ['#3a2f5b', '#1f1830'],
  ['#5b3a3a', '#301f1f'],
  ['#2f5b4f', '#183026'],
  ['#5b4f2f', '#302618'],
  ['#2f3f5b', '#182330'],
  ['#4f2f5b', '#261830'],
]

function hashCode(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export default function DashboardPosterCard({ title, subtitle, poster, badgeText, badgeVariant, inArchive, clickable, showMissingBadge, onClick }) {
  const isClickable = clickable !== undefined ? clickable : inArchive
  const showMissing = showMissingBadge !== undefined ? showMissingBadge : !inArchive
  const [c1, c2] = PALETTE[hashCode(String(title)) % PALETTE.length]

  // وقتی کارت خودش کلیک‌پذیر نیست (فیلم تو آرشیو نیست)، از یه <div> استفاده
  // می‌کنیم نه <button>، چون دکمه‌ی «Order» داخلش باید خودش جدا کلیک‌پذیر
  // بمونه — تو <button disabled> هیچ چیز داخلیش کلیک نمی‌خوره.
  const Wrapper = isClickable ? 'button' : 'div'
  const wrapperProps = isClickable ? { type: 'button', onClick } : {}

  return (
    <Wrapper
      className={`card dashboard-poster-card${isClickable ? '' : ' dashboard-poster-card-dim'}${showMissing ? ' dashboard-poster-card-missing' : ''}`}
      {...wrapperProps}
    >
      <div className="poster" style={!poster ? { background: `linear-gradient(160deg, ${c1}, ${c2})` } : undefined}>
        {poster ? (
          <img src={poster} alt={title} loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />
        ) : (
          <span className="poster-fallback">{title}</span>
        )}
        {badgeText && (
          <span className={`dashboard-badge dashboard-badge-${badgeVariant || 'default'}`}>{badgeText}</span>
        )}
        {showMissing && (
          <a
            className="dashboard-badge dashboard-badge-order"
            href={`https://www.amazon.com/s?k=${encodeURIComponent(title)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Order
          </a>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title">{title}</h3>
        {subtitle && <p className="card-meta">{subtitle}</p>}
      </div>
    </Wrapper>
  )
}
