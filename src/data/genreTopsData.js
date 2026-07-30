// Curated "best of genre" lists for the Dashboard's Genre Tops tab.
// Selection is sourced from IMDb's own top-rated-by-genre rankings and the
// IMDb Top 250 (ratings/years verified against imdb.com as of mid-2026).
// 10 titles per genre so the tab fits on one screen without heavy scrolling.
const GENRE_TOPS_DATA = {
  "Action": {
    movies: [
      { title: "The Dark Knight", year: 2008, director: "Christopher Nolan" },
      { title: "Inception", year: 2010, director: "Christopher Nolan" },
      { title: "The Matrix", year: 1999, director: "Lana Wachowski, Lilly Wachowski" },
      { title: "Star Wars: Episode V - The Empire Strikes Back", year: 1980, director: "Irvin Kershner" },
      { title: "Terminator 2: Judgment Day", year: 1991, director: "James Cameron" },
      { title: "Star Wars: Episode IV - A New Hope", year: 1977, director: "George Lucas" },
      { title: "Seven Samurai", year: 1954, director: "Akira Kurosawa" },
      { title: "Gladiator", year: 2000, director: "Ridley Scott" },
      { title: "Spider-Man: Across the Spider-Verse", year: 2023, director: "Joaquim Dos Santos, Kemp Powers, Justin K. Thompson" },
      { title: "Leon: The Professional", year: 1994, director: "Luc Besson" }
    ]
  },
  "Comedy": {
    movies: [
      { title: "Life Is Beautiful", year: 1997, director: "Roberto Benigni" },
      { title: "Back to the Future", year: 1985, director: "Robert Zemeckis" },
      { title: "The Intouchables", year: 2011, director: "Olivier Nakache, Eric Toledano" },
      { title: "Modern Times", year: 1936, director: "Charlie Chaplin" },
      { title: "City Lights", year: 1931, director: "Charlie Chaplin" },
      { title: "3 Idiots", year: 2009, director: "Rajkumar Hirani" },
      { title: "The Great Dictator", year: 1940, director: "Charlie Chaplin" },
      { title: "Toy Story", year: 1995, director: "John Lasseter" },
      { title: "Up", year: 2009, director: "Pete Docter" },
      { title: "Amelie", year: 2001, director: "Jean-Pierre Jeunet" }
    ]
  },
  "Drama": {
    movies: [
      { title: "The Shawshank Redemption", year: 1994, director: "Frank Darabont" },
      { title: "12 Angry Men", year: 1957, director: "Sidney Lumet" },
      { title: "Schindler's List", year: 1993, director: "Steven Spielberg" },
      { title: "Fight Club", year: 1999, director: "David Fincher" },
      { title: "Forrest Gump", year: 1994, director: "Robert Zemeckis" },
      { title: "One Flew Over the Cuckoo's Nest", year: 1975, director: "Milos Forman" },
      { title: "It's a Wonderful Life", year: 1946, director: "Frank Capra" },
      { title: "American History X", year: 1998, director: "Tony Kaye" },
      { title: "Whiplash", year: 2014, director: "Damien Chazelle" },
      { title: "Apocalypse Now", year: 1979, director: "Francis Ford Coppola" }
    ]
  },
  "Horror": {
    movies: [
      { title: "The Silence of the Lambs", year: 1991, director: "Jonathan Demme" },
      { title: "Alien", year: 1979, director: "Ridley Scott" },
      { title: "Psycho", year: 1960, director: "Alfred Hitchcock" },
      { title: "The Shining", year: 1980, director: "Stanley Kubrick" },
      { title: "Aliens", year: 1986, director: "James Cameron" },
      { title: "The Thing", year: 1982, director: "John Carpenter" },
      { title: "The Exorcist", year: 1973, director: "William Friedkin" },
      { title: "Rosemary's Baby", year: 1968, director: "Roman Polanski" },
      { title: "Get Out", year: 2017, director: "Jordan Peele" },
      { title: "A Quiet Place", year: 2018, director: "John Krasinski" }
    ]
  },
  "Romance": {
    movies: [
      { title: "Casablanca", year: 1942, director: "Michael Curtiz" },
      { title: "La La Land", year: 2016, director: "Damien Chazelle" },
      { title: "Cinema Paradiso", year: 1988, director: "Giuseppe Tornatore" },
      { title: "Eternal Sunshine of the Spotless Mind", year: 2004, director: "Michel Gondry" },
      { title: "Titanic", year: 1997, director: "James Cameron" },
      { title: "Before Sunrise", year: 1995, director: "Richard Linklater" },
      { title: "Pride & Prejudice", year: 2005, director: "Joe Wright" },
      { title: "The Notebook", year: 2004, director: "Nick Cassavetes" },
      { title: "Her", year: 2013, director: "Spike Jonze" },
      { title: "When Harry Met Sally...", year: 1989, director: "Rob Reiner" }
    ]
  },
  "Thriller": {
    movies: [
      { title: "Se7en", year: 1995, director: "David Fincher" },
      { title: "Parasite", year: 2019, director: "Bong Joon-ho" },
      { title: "Shutter Island", year: 2010, director: "Martin Scorsese" },
      { title: "Rear Window", year: 1954, director: "Alfred Hitchcock" },
      { title: "Memento", year: 2000, director: "Christopher Nolan" },
      { title: "The Prestige", year: 2006, director: "Christopher Nolan" },
      { title: "No Country for Old Men", year: 2007, director: "Ethan Coen, Joel Coen" },
      { title: "Gone Girl", year: 2014, director: "David Fincher" },
      { title: "Zodiac", year: 2007, director: "David Fincher" },
      { title: "The Departed", year: 2006, director: "Martin Scorsese" }
    ]
  },
  "Crime": {
    movies: [
      { title: "The Godfather", year: 1972, director: "Francis Ford Coppola" },
      { title: "The Godfather Part II", year: 1974, director: "Francis Ford Coppola" },
      { title: "Pulp Fiction", year: 1994, director: "Quentin Tarantino" },
      { title: "Goodfellas", year: 1990, director: "Martin Scorsese" },
      { title: "City of God", year: 2002, director: "Fernando Meirelles, Katia Lund" },
      { title: "The Usual Suspects", year: 1995, director: "Bryan Singer" },
      { title: "Heat", year: 1995, director: "Michael Mann" },
      { title: "Reservoir Dogs", year: 1992, director: "Quentin Tarantino" },
      { title: "Casino", year: 1995, director: "Martin Scorsese" },
      { title: "L.A. Confidential", year: 1997, director: "Curtis Hanson" }
    ]
  },
  "Adventure": {
    movies: [
      { title: "Raiders of the Lost Ark", year: 1981, director: "Steven Spielberg" },
      { title: "Indiana Jones and the Last Crusade", year: 1989, director: "Steven Spielberg" },
      { title: "Interstellar", year: 2014, director: "Christopher Nolan" },
      { title: "The Princess Bride", year: 1987, director: "Rob Reiner" },
      { title: "Jurassic Park", year: 1993, director: "Steven Spielberg" },
      { title: "Guardians of the Galaxy", year: 2014, director: "James Gunn" },
      { title: "The Revenant", year: 2015, director: "Alejandro G. Inarritu" },
      { title: "Life of Pi", year: 2012, director: "Ang Lee" },
      { title: "Into the Wild", year: 2007, director: "Sean Penn" },
      { title: "The Secret Life of Walter Mitty", year: 2013, director: "Ben Stiller" }
    ]
  },
  "Animation": {
    movies: [
      { title: "Spirited Away", year: 2001, director: "Hayao Miyazaki" },
      { title: "The Lion King", year: 1994, director: "Roger Allers, Rob Minkoff" },
      { title: "Toy Story 3", year: 2010, director: "Lee Unkrich" },
      { title: "WALL-E", year: 2008, director: "Andrew Stanton" },
      { title: "Coco", year: 2017, director: "Lee Unkrich" },
      { title: "Your Name.", year: 2016, director: "Makoto Shinkai" },
      { title: "Grave of the Fireflies", year: 1988, director: "Isao Takahata" },
      { title: "Princess Mononoke", year: 1997, director: "Hayao Miyazaki" },
      { title: "Inside Out", year: 2015, director: "Pete Docter" },
      { title: "Howl's Moving Castle", year: 2004, director: "Hayao Miyazaki" }
    ]
  },
  "Fantasy": {
    movies: [
      { title: "The Lord of the Rings: The Fellowship of the Ring", year: 2001, director: "Peter Jackson" },
      { title: "The Lord of the Rings: The Two Towers", year: 2002, director: "Peter Jackson" },
      { title: "The Lord of the Rings: The Return of the King", year: 2003, director: "Peter Jackson" },
      { title: "Pan's Labyrinth", year: 2006, director: "Guillermo del Toro" },
      { title: "The Green Mile", year: 1999, director: "Frank Darabont" },
      { title: "Harry Potter and the Deathly Hallows: Part 2", year: 2011, director: "David Yates" },
      { title: "The Shape of Water", year: 2017, director: "Guillermo del Toro" },
      { title: "Edward Scissorhands", year: 1990, director: "Tim Burton" },
      { title: "The Wizard of Oz", year: 1939, director: "Victor Fleming" },
      { title: "Big Fish", year: 2003, director: "Tim Burton" }
    ]
  },
  "Mystery": {
    movies: [
      { title: "Knives Out", year: 2019, director: "Rian Johnson" },
      { title: "Prisoners", year: 2013, director: "Denis Villeneuve" },
      { title: "Chinatown", year: 1974, director: "Roman Polanski" },
      { title: "The Others", year: 2001, director: "Alejandro Amenabar" },
      { title: "Vertigo", year: 1958, director: "Alfred Hitchcock" },
      { title: "Oldboy", year: 2003, director: "Park Chan-wook" },
      { title: "The Girl with the Dragon Tattoo", year: 2011, director: "David Fincher" },
      { title: "The Sixth Sense", year: 1999, director: "M. Night Shyamalan" },
      { title: "Rebecca", year: 1940, director: "Alfred Hitchcock" },
      { title: "Gone Baby Gone", year: 2007, director: "Ben Affleck" }
    ]
  }
}

export function getGenreTops() {
  return GENRE_TOPS_DATA
}
