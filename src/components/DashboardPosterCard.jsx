import { proxyImg } from '../utils/proxyImg.js'
import { useState } from 'react'
import { addToOrderList } from '../utils/orderList.js'
import { imdbUrl } from '../utils/imdbLink.js'

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

function OrderBadge({ title, className = '' }) {
  const [state, setState] = useState('idle') // idle | adding | added
  const handleClick = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (state !== 'idle') return
    setState('adding')
    try {
      // شماره‌ی ردیف («9. Hoppers») نباید تو لیست سفارش بره
      await addToOrderList({ title: String(title).replace(/^\d+\.\s+/, ''), source: 'Watchlist' })
      setState('added')
    } catch {
      setState('idle')
    }
  }
  return (
    <button type="button" className={`dashboard-badge dashboard-badge-order ${className}`} onClick={handleClick} disabled={state !== 'idle'}>
      {state === 'added' ? 'Added ✓' : state === 'adding' ? '…' : 'Order'}
    </button>
  )
}

export default function DashboardPosterCard({ title, subtitle, poster, badgeText, badgeVariant, inArchive, clickable, showMissingBadge, onClick, media = null, posterHref = null }) {
  const isClickable = clickable !== undefined ? clickable : inArchive
  const showMissing = showMissingBadge !== undefined ? showMissingBadge : !inArchive
  const [c1, c2] = PALETTE[hashCode(String(title)) % PALETTE.length]
  // کارت فیلمی که نداری (با دکمه‌ی Order) — اگه لینک جدا داده نشده، پوستر به IMDb می‌ره
  const yearInSubtitle = String(subtitle || '').match(/\b(19|20)\d{2}\b/)?.[0]
  posterHref =
    posterHref ||
    (showMissing ? imdbUrl({ title: String(title).replace(/^\d+\.\s+/, ''), year: yearInSubtitle }) : null)

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
        {/* لینک واقعی (نه window.open که تو اپ نصب‌شده بلاک می‌شد) */}
        {posterHref ? (
          <a className="dashboard-poster-imdb-link" href={posterHref} target="_blank" rel="noopener noreferrer" title={`${title} — open on IMDb`}>
            {poster ? (
              <img src={proxyImg(poster)} alt={title} loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />
            ) : (
              <span className="poster-fallback">{title}</span>
            )}
          </a>
        ) : poster ? (
          <img src={proxyImg(poster)} alt={title} loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />
        ) : (
          <span className="poster-fallback">{title}</span>
        )}
        {badgeText && (
          <span className={`dashboard-badge dashboard-badge-${badgeVariant || 'default'}`}>{badgeText}</span>
        )}
        {showMissing && <OrderBadge title={title} />}
        {/* فقط دیجیتالش رو داری: Order برای خرید بلوری، بالا‌راست (پایین‌راست جای Digitalه) */}
        {!showMissing && media?.digital && !media?.bluray && <OrderBadge title={title} className="dashboard-badge-order-top" />}
        {/* نسخه‌ها: بلوری پایین‌چپ، دیجیتال پایین‌راست */}
        {media?.bluray && <span className="dashboard-badge dashboard-media-bluray">Blu-ray</span>}
        {media?.digital && <span className="dashboard-badge dashboard-media-digital">Digital</span>}
      </div>
      <div className="card-body">
        <h3 className="card-title">{title}</h3>
        {subtitle && <p className="card-meta">{subtitle}</p>}
      </div>
    </Wrapper>
  )
}
