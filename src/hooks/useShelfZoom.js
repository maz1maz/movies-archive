import { useEffect, useState } from 'react'

// زوم قفسه بین Location و Bookshelf مشترکه و تو مرورگر یادش می‌مونه.
// localStorage ممکنه در دسترس نباشه (حالت خصوصی و …) — اون‌وقت فقط پیش‌فرض.
const KEY = 'cinefilm:shelf-zoom'
export const MIN_SHELF_ZOOM = 0.5
export const MAX_SHELF_ZOOM = 1.5

function readZoom(fallback) {
  try {
    const v = Number(window.localStorage.getItem(KEY))
    if (Number.isFinite(v) && v >= MIN_SHELF_ZOOM && v <= MAX_SHELF_ZOOM) return v
  } catch {}
  return fallback
}

export function useShelfZoom(fallback = 0.8) {
  const [zoom, setZoom] = useState(() => readZoom(fallback))
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, String(zoom))
    } catch {}
  }, [zoom])
  return [zoom, setZoom]
}
