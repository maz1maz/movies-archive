import FilmCard from './FilmCard.jsx'

export default function FilmGrid({ films, onSelect, onToggleWatch }) {
  return (
    <div className="grid">
      {films.map((film) => (
        <FilmCard key={film.id} film={film} onSelect={onSelect} onToggleWatch={onToggleWatch} />
      ))}
    </div>
  )
}
