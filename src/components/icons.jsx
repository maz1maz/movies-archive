// آیکون‌های خطی ساده (بدون وابستگی خارجی) برای جایگزینی ایموجی‌ها در رابط کاربری
const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const IconSearch = (props) => (
  <svg {...base} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
)

export const IconUpload = (props) => (
  <svg {...base} {...props}>
    <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
    <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </svg>
)

export const IconDownload = (props) => (
  <svg {...base} {...props}>
    <path d="M12 4v12M12 16l-4-4M12 16l4-4" />
    <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </svg>
)

export const IconSun = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
  </svg>
)

export const IconMoon = (props) => (
  <svg {...base} {...props}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
  </svg>
)

export const IconGrid = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1.2" />
    <rect x="14" y="3" width="7" height="7" rx="1.2" />
    <rect x="3" y="14" width="7" height="7" rx="1.2" />
    <rect x="14" y="14" width="7" height="7" rx="1.2" />
  </svg>
)

export const IconList = (props) => (
  <svg {...base} {...props}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
)

export const IconFilm = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
  </svg>
)

export const IconPin = (props) => (
  <svg {...base} {...props}>
    <path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
)

export const IconStar = (props) => (
  <svg {...base} fill="currentColor" stroke="none" viewBox="0 0 24 24" width={props.width || 18} height={props.height || 18}>
    <path d="M12 2.5l2.9 6.06 6.6.77-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.13 1.3-6.6-4.9-4.5 6.6-.77z" />
  </svg>
)

export const IconClose = (props) => (
  <svg {...base} {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const IconEdit = (props) => (
  <svg {...base} {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
)

export const IconSave = (props) => (
  <svg {...base} {...props}>
    <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    <path d="M8 4v5h8V4M7 20v-6h10v6" />
  </svg>
)

export const IconArchive = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="4" width="18" height="4.5" rx="1" />
    <path d="M4.5 8.5v9a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-9" />
    <path d="M10 13h4" />
  </svg>
)

export const IconClock = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
)

export const IconBarChart = (props) => (
  <svg {...base} {...props}>
    <path d="M4 20V10M10 20V4M16 20v-7M20 20H4" />
  </svg>
)

export const IconBookshelf = (props) => (
  <svg {...base} {...props}>
    <path d="M3 4v16M21 4v16M3 4h18M7 4v16M11 4v16M15 4v16" />
  </svg>
)

export const IconHandshake = (props) => (
  <svg {...base} {...props}>
    <path d="M8 12l3 3 5-5" />
    <path d="M2 11l4.5-4.5a2 2 0 0 1 2.8 0L11 8" />
    <path d="M22 11l-4.5-4.5a2 2 0 0 0-2.8 0L13 8" />
    <path d="M2 11v3a2 2 0 0 0 2 2h1M22 11v3a2 2 0 0 1-2 2h-1" />
  </svg>
)

export const IconUser = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20c1-4 4.5-6 7-6s6 2 7 6" />
  </svg>
)

export const IconBuilding = (props) => (
  <svg {...base} {...props}>
    <rect x="5" y="3" width="14" height="18" rx="1" />
    <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" />
  </svg>
)

export const IconCheck = (props) => (
  <svg {...base} {...props}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

export const IconPrinter = (props) => (
  <svg {...base} {...props}>
    <path d="M6 9V3h12v6" />
    <rect x="4" y="9" width="16" height="8" rx="1.2" />
    <path d="M6 17v4h12v-4" />
  </svg>
)

export const IconDocument = (props) => (
  <svg {...base} {...props}>
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M14 3v4h4M9 12h6M9 16h6" />
  </svg>
)

export const IconDisc = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.4" />
  </svg>
)

export const IconMasks = (props) => (
  <svg {...base} {...props}>
    <path d="M4 9c0-3 2.5-5 5.5-5S14 6 14 8c0 2.5-1.5 3.5-3.5 3.5S8 10.2 8 9" />
    <path d="M20 9c0-3-2.5-5-5.5-5" />
    <circle cx="7.2" cy="8.2" r="0.6" fill="currentColor" />
    <path d="M6 15c0 3 2.5 5 5.5 5S17 18 17 16c0-2.5-1.5-3.5-3.5-3.5S10 12.8 10 14" />
  </svg>
)

export const IconClapper = (props) => (
  <svg {...base} {...props}>
    <path d="M3 10.5L4.5 6h15L21 10.5z" />
    <rect x="3" y="10.5" width="18" height="9.5" rx="1" />
    <path d="M6 6l2 4.5M11 6l2 4.5M16 6l2 4.5" />
  </svg>
)
