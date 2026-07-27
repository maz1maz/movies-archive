import FilmCard from './FilmCard.jsx'

export default function FilmGrid({ films, onSelect, onToggleWatch, hasBluray }) {
  return (
    <div className="grid">
      {films.map((film) => (
        <FilmCard
          key={film.id}
          film={film}
          onSelect={onSelect}
          onToggleWatch={onToggleWatch}
          hasBluray={hasBluray ? hasBluray(film) : false}
        />
      ))}
    </div>
  )
}
