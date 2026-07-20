import FilmCard from './FilmCard.jsx'

export default function FilmGrid({ films, onSelect }) {
  return (
    <div className="grid">
      {films.map((film) => (
        <FilmCard key={film.id} film={film} onSelect={onSelect} />
      ))}
    </div>
  )
}
