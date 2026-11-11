import FilmCard from './FilmCard.jsx'
import { slotLabel } from '../utils/shelfOrder.js'

export default function FilmGrid({ films, onSelect, onToggleWatch, hasBluray, hasDigital, slotIndex }) {
  return (
    <div className="grid">
      {films.map((film) => (
        <FilmCard
          key={film.id}
          film={film}
          onSelect={onSelect}
          onToggleWatch={onToggleWatch}
          hasBluray={hasBluray ? hasBluray(film) : false}
          hasDigital={hasDigital ? hasDigital(film) : false}
          slot={slotLabel(slotIndex?.get(film.id))}
        />
      ))}
    </div>
  )
}
