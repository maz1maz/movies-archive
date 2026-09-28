import { useRef } from 'react'

// برای مودال‌هایی که با کلیک روی پس‌زمینه (overlay) بسته می‌شن. اگه فقط از
// onClick={onClose} روی overlay استفاده بشه، انتخاب متن با موس (مثلاً از
// یه فیلد یا خلاصه‌ی فیلم) که تا بیرون کارد کشیده بشه هم یه «کلیک» رو
// overlay حساب می‌شه (چون mouseup اونجا اتفاق افتاده) و کل مودال بی‌دلیل
// بسته می‌شه. اینجا فقط وقتی mousedown و mouseup هردو مستقیماً روی خودِ
// overlay (نه چیزی داخلش) بوده باشن می‌بندیمش.
export function useOverlayClose(onClose) {
  const mouseDownOnOverlayRef = useRef(false)
  const onOverlayMouseDown = (e) => {
    mouseDownOnOverlayRef.current = e.target === e.currentTarget
  }
  const onOverlayClick = (e) => {
    if (mouseDownOnOverlayRef.current && e.target === e.currentTarget) onClose()
    mouseDownOnOverlayRef.current = false
  }
  return { onMouseDown: onOverlayMouseDown, onClick: onOverlayClick }
}
