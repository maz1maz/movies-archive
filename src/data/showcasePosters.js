// Curated posters for the landing page's ambient hero wall (Landing.jsx) and
// the "Poster wall" tab in the archive tour (LandingShowcase.jsx). Both used
// to hardcode their own copy of this exact list, which is why a handful of
// weak/blank-looking entries (a plain text poster, a low-contrast photo, a
// title with unsupported glyphs, two poster IDs that render as solid black)
// silently showed up in both places at once. Replaced those five with
// posters already vetted elsewhere in the codebase (LandingShowcase's own
// "Shelf detail" tab), so every entry here is a recognisable, working title.
export const SHOWCASE_POSTERS = [
  'https://m.media-amazon.com/images/M/MV5BOTA5MWFhMzAtOWU1OS00Yjk4LTlkNGItNGI3N2VkNzcyNGU2XkEyXkFqcGc@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BNGEwYjgwOGQtYjg5ZS00Njc1LTk2ZGEtM2QwZWQ2NjdhZTE5XkEyXkFqcGc@._V1_QL75_UY562_CR8,0,380,562_.jpg',
  'https://m.media-amazon.com/images/M/MV5BN2NhMDk2MmEtZDQzOC00MmY5LThhYzAtMDdjZGFjOGZjMjdjXkEyXkFqcGc@._V1_QL75_UX380_CR0,6,380,562_.jpg', // Alien
  'https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_QL75_UX380_CR0,0,380,562_.jpg',
  'https://m.media-amazon.com/images/M/MV5BZDhiMTljYjYtODc1Yy00MmEwLTg2OTYtYmE1YTRmNDE4MmEwXkEyXkFqcGc@._V1_QL75_UX380_CR0,11,380,562_.jpg', // Apocalypse Now
  'https://m.media-amazon.com/images/M/MV5BMTc5MDE2ODcwNV5BMl5BanBnXkFtZTgwMzI2NzQ2NzM@._V1_QL75_UX380_CR0,0,380,562_.jpg', // Avengers: Endgame
  'https://m.media-amazon.com/images/M/MV5BMDIxMzBlZDktZjMxNy00ZGI4LTgxNDEtYWRlNzRjMjJmOGQ1XkEyXkFqcGc@._V1_QL75_UX380_CR0,4,380,562_.jpg',
  'https://m.media-amazon.com/images/M/MV5BOGU4YzhhMTAtNjg1MC00NzY2LTg0NGQtOWJmNGQwNzgyOGE0XkEyXkFqcGc@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BNDdhMzVhOWQtNDU2Mi00ZmZmLWJiZDMtY2QxMjhjY2Y1ZTI5XkEyXkFqcGc@._V1_SX300.jpg', // The Apartment
  'https://m.media-amazon.com/images/M/MV5BZmUzZjk0NjEtOTFjMC00NDI2LTkwZmEtZWIxYjVjNDEwNWZiXkEyXkFqcGc@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BMjMzMTIzMTUwN15BMl5BanBnXkFtZTgwNjE0NTg0MTE@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BNDYwNzVjMTItZmU5YS00YjQ5LTljYjgtMjY2NDVmYWMyNWFmXkEyXkFqcGc@._V1_QL75_UY562_CR4,0,380,562_.jpg',
  'https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_QL75_UX380_CR0,0,380,562_.jpg',
  'https://m.media-amazon.com/images/M/MV5BZDc2YzhkODAtZmRmZS00YzcxLWJkYWEtM2ZhZjY3MmMyZmJiXkEyXkFqcGc@._V1_QL75_UX380_CR0,4,380,562_.jpg',
  'https://m.media-amazon.com/images/M/MV5BMTY3MjM1Mzc4N15BMl5BanBnXkFtZTgwODM0NzAxMDE@._V1_SX300.jpg', // A Clockwork Orange
  'https://m.media-amazon.com/images/M/MV5BMWM5ZjQxM2YtNDlmYi00ZDNhLWI4MWUtN2VkYjBlMTY1ZTkwXkEyXkFqcGc@._V1_QL75_UX380_CR0,4,380,562_.jpg',
]

// Extra posters only the larger ambient hero wall (Landing.jsx) needs, on
// top of SHOWCASE_POSTERS above.
export const HERO_WALL_EXTRA_POSTERS = [
  'https://m.media-amazon.com/images/M/MV5BMWQ2YWZlN2QtYzgyOC00ZTI1LTgwMzUtODUwOWMzZmRjNWE1XkEyXkFqcGdeQXVyNDc0MDM5MTg@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BMmFiMTQzZmItNjdjMi00Yjc0LWI0YWItNmIxOWVlOGIyYWIxXkEyXkFqcGc@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BN2E5NzI2ZGMtY2VjNi00YTRjLWI1MDUtZGY5OWU1MWJjZjRjXkEyXkFqcGc@._V1_QL75_UX380_CR0,3,380,562_.jpg',
  'https://m.media-amazon.com/images/M/MV5BYzdjMDAxZGItMjI2My00ODA1LTlkNzItOWFjMDU5ZDJlYWY3XkEyXkFqcGc@._V1_QL75_UX380_CR0,0,380,562_.jpg',
  'https://m.media-amazon.com/images/M/MV5BN2NmN2VhMTQtMDNiOS00NDlhLTliMjgtODE2ZTY0ODQyNDRhXkEyXkFqcGc@._V1_QL75_UX380_CR0,4,380,562_.jpg',
  'https://m.media-amazon.com/images/M/MV5BMmI3MmFiODctNzhkZi00ZWVmLWJjYTctYzMyMmIxNGE1ZGZhXkEyXkFqcGc@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BMTYyMTI3NzYxMl5BMl5BanBnXkFtZTcwMzM5ODQxNA@@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BOTY2Y2EzMTctYTZiMC00YzEzLWIwMDItODQyYWUyY2U2MTk4XkEyXkFqcGc@._V1_SX300.jpg',
]
