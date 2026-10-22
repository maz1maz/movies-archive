import { useRef } from 'react'

// باز/بسته کردن جلدهای قفسه مستقیم با کلاس DOM (is-open روی جلد، has-open روی
// ردیف) — بدون state ری‌اکت. قبلاً هر هاور یه setState بود که کل صفحه (با
// لیست ۷هزارتایی موجودی) رو دوباره رندر می‌کرد و باز شدن جلدها لگ داشت.
// - ورود موس به یه جلد: همون باز می‌شه، بقیه‌ی ردیف بسته
// - خروج از کل ردیف: همه بسته، مگه جلدی که با کلیک «بیرون کشیده» شده
// - کلیک روی جلد: بیرون کشیدنش (باز می‌مونه)؛ کلیک دوباره: برگردوندنش
// onPin(filmId | null) برای جاهایی که باید بدونن کدوم جلد بیرونه (مثل نوار جزئیات).
export function useShelfHover(onPin) {
  const pinned = useRef(null)

  const openIn = (row, el) => {
    row.querySelectorAll('.bluray-case.is-open').forEach((x) => {
      if (x !== el) x.classList.remove('is-open')
    })
    if (el) {
      el.classList.add('is-open')
      row.classList.add('has-open')
    } else {
      row.classList.remove('has-open')
    }
  }
  const caseOf = (e) => {
    const el = e.target.closest('.bluray-case')
    return el && !el.classList.contains('bluray-case-ghost') ? el : null
  }

  return {
    onMouseOver: (e) => {
      const el = caseOf(e)
      if (el && !el.classList.contains('is-open')) openIn(e.currentTarget, el)
    },
    onMouseLeave: (e) => {
      const row = e.currentTarget
      openIn(row, pinned.current && row.contains(pinned.current) ? pinned.current : null)
    },
    onClick: (e) => {
      // دکمه‌ی «Open case» خودش صفحه‌ی فیلم رو باز می‌کنه
      if (e.target.closest('.case-panel-open')) return
      const el = caseOf(e)
      if (!el) return
      const prev = pinned.current
      if (prev === el) {
        pinned.current = null
        onPin && onPin(null)
        return
      }
      if (prev && !e.currentTarget.contains(prev)) {
        prev.classList.remove('is-open')
        prev.closest('.bluray-shelf-row')?.classList.remove('has-open')
      }
      pinned.current = el
      openIn(e.currentTarget, el)
      onPin && onPin(el.dataset.filmId || null)
    },
  }
}
