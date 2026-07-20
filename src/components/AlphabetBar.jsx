const CHARS = [
  '0-9',
  ...'abcdefghijklmnopqrstuvwxyz'.split(''),
]

export default function AlphabetBar({ alpha, setAlpha }) {
  return (
    <div className="alpha-bar">
      <button
        className={alpha === '' ? 'alpha-btn active' : 'alpha-btn'}
        onClick={() => setAlpha('')}
      >
        All
      </button>
      {CHARS.map((c) => (
        <button
          key={c}
          className={alpha === c ? 'alpha-btn active' : 'alpha-btn'}
          onClick={() => setAlpha(c)}
        >
          {c.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
