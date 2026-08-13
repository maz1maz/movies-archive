// هلپر مشترک برای اضافه‌کردن یه عنوان به «لیست سفارش» (از دکمه‌ی Order، چه تو
// Watchlists چه تو بخش Coming Soon اخبار سینما). سرور خودش تکراری رو نادیده
// می‌گیره.
export async function addToOrderList({ title, releaseDate, source }) {
  const res = await fetch('/api/order-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, releaseDate, source }),
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to add to order list')
  return res.json()
}
