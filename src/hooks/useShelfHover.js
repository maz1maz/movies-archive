// باز/بسته کردن جلدهای قفسه مستقیم با کلاس DOM (is-open روی جلد، has-open روی
// ردیف) — بدون state ری‌اکت. قبلاً هر هاور یه setState بود که کل صفحه (با
// لیست ۷هزارتایی موجودی) رو دوباره رندر می‌کرد و باز شدن جلدها لگ داشت.
// - ورود موس به یه جلد: همون باز می‌شه، بقیه‌ی ردیف بسته
// - خروج از کل ردیف: همه بسته
// - کلیک روی جلدِ بازشده: صفحه‌ی فیلم باز می‌شه (onOpen(filmId))؛ دیگه جلد رو
//   «بیرون نگه نمی‌داره»، چون با خروج موس بیرون موندنش گیج‌کننده بود.
export function useShelfHover(onOpen) {
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
    onMouseLeave: (e) => openIn(e.currentTarget, null),
    onClick: (e) => {
      // دکمه‌ی «Open case» خودش صفحه‌ی فیلم رو باز می‌کنه
      if (e.target.closest('.case-panel-open')) return
      const el = caseOf(e)
      if (!el) return
      // لمسی (بدون هاور): کلیک اول فقط جلد رو باز می‌کنه
      if (!el.classList.contains('is-open')) {
        openIn(e.currentTarget, el)
        return
      }
      if (el.dataset.filmId && onOpen) onOpen(el.dataset.filmId)
    },
  }
}
