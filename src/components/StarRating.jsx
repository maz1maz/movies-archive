import { IconStar } from './icons.jsx'

// اگه onChange داده بشه، تعاملیه (برای فرم ویرایش)؛ وگرنه فقط نمایشیه
// (برای کارت/مودال فیلم). کلیک روی همون ستاره‌ی فعلی امتیاز رو پاک می‌کنه.
export default function StarRating({ value = 0, onChange, size = 16 }) {
  const stars = [1, 2, 3, 4, 5]
  const interactive = typeof onChange === 'function'
  const Tag = interactive ? 'button' : 'span'

  return (
    <span className={interactive ? 'star-rating interactive' : 'star-rating'}>
      {stars.map((n) => (
        <Tag
          key={n}
          type={interactive ? 'button' : undefined}
          className={n <= value ? 'star filled' : 'star'}
          onClick={interactive ? () => onChange(n === value ? 0 : n) : undefined}
          aria-label={interactive ? `Rate ${n} star${n > 1 ? 's' : ''}` : undefined}
        >
          <IconStar width={size} height={size} />
        </Tag>
      ))}
    </span>
  )
}
