import { useState } from 'react'
import FilmGrid from './FilmGrid.jsx'
import { IconArchive } from './icons.jsx'

// آیتم‌های دیجیتال رو بر اساس شماره‌ی هارد گروه‌بندی می‌کنه — مثل قفسه‌ها،
// ولی برای درایوها. اول لیست هاردها رو نشون می‌ده، با کلیک روی هرکدوم
// می‌ری تو و فقط همون هارد رو می‌بینی.
export default function CollectionsView({ films, onSelect }) {
  const [activeDrive, setActiveDrive] = useState(null)

  const digitalFilms = films.filter((f) => f.mediaType === 'digital')

  const groups = {}
  digitalFilms.forEach((f) => {
    const key = f.driveNumber || 'بدون شماره هارد'
    if (!groups[key]) groups[key] = []
    groups[key].push(f)
  })
  const driveNames = Object.keys(groups).sort()

  if (driveNames.length === 0) {
    return (
      <div className="status empty-state">
        <span className="empty-icon">
          <IconArchive width={22} height={22} />
        </span>
        <p>هنوز هیچ آیتم دیجیتالی‌ای با شماره‌ی هارد ثبت نشده.</p>
        <p className="empty-hint">
          موقع افزودن/ویرایش فیلم، «Media Type» رو روی Digital بذار و یه «Drive Number» بهش بده.
        </p>
      </div>
    )
  }

  if (activeDrive && groups[activeDrive]) {
    return (
      <div className="collections-view">
        <button className="btn btn-ghost collections-back" onClick={() => setActiveDrive(null)}>
          ← همه‌ی هاردها
        </button>
        <h2 className="collections-drive-title">{activeDrive}</h2>
        <FilmGrid films={groups[activeDrive]} onSelect={onSelect} />
      </div>
    )
  }

  return (
    <div className="collections-view">
      <div className="collections-drive-list">
        {driveNames.map((name) => (
          <button key={name} className="collections-drive-card" onClick={() => setActiveDrive(name)}>
            <span className="collections-drive-icon">
              <IconArchive width={24} height={24} />
            </span>
            <div>
              <h3>{name}</h3>
              <p>{groups[name].length} آیتم</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
