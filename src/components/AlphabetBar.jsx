const CHARS = [
  ...'abcdefghijklmnopqrstuvwxyz'.split(''),
  '0-9',
  '#', // عنوان‌هایی که با علامت یا حرف لهجه‌دار شروع می‌شن ('71، (500)، Élite)
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
