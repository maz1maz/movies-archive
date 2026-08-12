// Shared "spine shelf" display helpers used by both BookshelfView.jsx and
// LocationBrowserModal.jsx, so the two views can't drift out of sync again
// (LocationBrowserModal previously had its own copy of this JSX without
// these helpers ever being copied over, which crashed the shelf view).

const SPINE_PALETTES = [
  { bg: '#86198f', text: '#fdf4ff', badge: 'dts', badgeText: 'DTS' },
  { bg: '#15803d', text: '#f0fdf4', badge: 'st', badgeText: 'ST' },
  { bg: '#1e3a8a', text: '#eff6ff', badge: 'do', badgeText: 'DO' },
  { bg: '#18181b', text: '#fafafa', badge: 'cin', badgeText: 'CIN' },
  { bg: '#b45309', text: '#fffbeb', badge: 'dts', badgeText: 'DTS' },
  { bg: '#be123c', text: '#fff1f2', badge: 'me', badgeText: 'ME' },
  { bg: '#0369a1', text: '#f0f9ff', badge: 'v', badgeText: 'V' },
  { bg: '#4d7c0f', text: '#f7fee7', badge: 'dts', badgeText: 'DTS' },
  { bg: '#6d28d9', text: '#f5f3ff', badge: 'do', badgeText: 'DO' },
  { bg: '#9f1239', text: '#fff1f2', badge: 'st', badgeText: 'ST' },
  { bg: '#334155', text: '#f8fafc', badge: 'fa', badgeText: 'FA' },
  { bg: '#047857', text: '#ecfdf5', badge: 'cin', badgeText: 'CIN' },
]

export function getSpineColor(film, idx = 0) {
  if (film.criterion) {
    const isWhite = idx % 2 === 0
    return {
      bg: isWhite ? '#f3f4f6' : '#27272a',
      text: isWhite ? '#111827' : '#fafafa',
      type: 'criterion',
      badge: 'crit',
      badgeText: 'C',
    }
  }
  const str = String(film.title || '').toLowerCase()
  if (str.includes('clockwork') || str.includes('steel') || idx === 19) {
    return {
      bg: 'linear-gradient(90deg, #9ca3af 0%, #d1d5db 50%, #6b7280 100%)',
      text: '#111827',
      type: 'steelbook',
      badge: 'w',
      badgeText: 'WB',
    }
  }
  if ((film.format || '').toLowerCase().includes('4k') || str.includes('4k')) {
    return {
      bg: '#09090b',
      text: '#fafafa',
      type: '4k',
      badge: 'hdr',
      badgeText: 'HDR',
    }
  }
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  const pal = SPINE_PALETTES[Math.abs(hash) % SPINE_PALETTES.length]
  return { ...pal, type: 'bluray' }
}

export function getEditionBadge(film) {
  const str = `${film.title || ''} ${film.format || ''}`.toLowerCase()
  if (str.includes('director')) return 'DIR CUT'
  if (str.includes('4k') || str.includes('uhd')) return 'HDR10'
  if (film.criterion) return 'DTS-HD'
  const idHash = String(film.id || '')
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0)
  return idHash % 2 === 0 ? 'DOLBY' : 'DTS-HD'
}

export function getStudioBadgeText(studio) {
  const s = String(studio || '').trim()
  if (!s) return null
  const sl = s.toLowerCase()
  if (sl.includes('a24')) return 'A24'
  if (sl.includes('warner')) return 'WB'
  if (sl.includes('universal')) return 'UNIV'
  if (sl.includes('sony')) return 'SONY'
  if (sl.includes('paramount')) return 'PARA'
  if (sl.includes('criterion')) return 'CRIT'
  if (sl.includes('arrow')) return 'ARROW'
  if (sl.includes('mgm')) return 'MGM'
  if (sl.includes('disney')) return 'DISNEY'
  return s.slice(0, 5).toUpperCase()
}
