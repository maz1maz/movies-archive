// Curated 'best of genre' lists for the Dashboard's Genre Tops tab
/* eslint-disable */
const GENRE_TOPS_DATA = {
    "Action": {
        movies: [
            { title: "The Dark Knight", year: 2008, director: "Christopher Nolan" },
            { title: "Mad Max: Fury Road", year: 2015, director: "George Miller" },
            { title: "The Matrix", year: 1999, director: "Lana Wachowski, Lilly Wachowski" },
            { title: "Terminator 2: Judgment Day", year: 1991, director: "James Cameron" },
            { title: "Die Hard", year: 1988, director: "John McTiernan" },
            { title: "Raiders of the Lost Ark", year: 1981, director: "Steven Spielberg" },
            { title: "Gladiator", year: 2000, director: "Ridley Scott" },
            { title: "Seven Samurai", year: 1954, director: "Akira Kurosawa" },
            { title: "Aliens", year: 1986, director: "James Cameron" },
            { title: "John Wick", year: 2014, director: "Chad Stahelski" },
            { title: "Inception", year: 2010, director: "Christopher Nolan" },
            { title: "Léon: The Professional", year: 1994, director: "Luc Besson" },
            { title: "Heat", year: 1995, director: "Michael Mann" },
            { title: "Speed", year: 1994, director: "Jan de Bont" },
            { title: "Kill Bill: Vol. 1", year: 2003, director: "Quentin Tarantino" }
        ]
    },
    "Comedy": {
        movies: [
            { title: "Some Like It Hot", year: 1959, director: "Billy Wilder" },
            { title: "Modern Times", year: 1936, director: "Charlie Chaplin" },
            { title: "City Lights", year: 1931, director: "Charlie Chaplin" },
            { title: "Monty Python and the Holy Grail", year: 1975, director: "Terry Gilliam, Terry Jones" },
            { title: "Groundhog Day", year: 1993, director: "Harold Ramis" },
            { title: "The Grand Budapest Hotel", year: 2014, director: "Wes Anderson" },
            { title: "Superbad", year: 2007, director: "Greg Mottola" },
            { title: "Shaun of the Dead", year: 2004, director: "Edgar Wright" },
            { title: "The Big Lebowski", year: 1998, director: "Joel Coen, Ethan Coen" },
            { title: "Airplane!", year: 1980, director: "Jim Abrahams, David Zucker, Jerry Zucker" },
            { title: "Dr. Strangelove", year: 1964, director: "Stanley Kubrick" },
            { title: "The Hangover", year: 2009, director: "Todd Phillips" },
            { title: "Annie Hall", year: 1977, director: "Woody Allen" },
            { title: "Amélie", year: 2001, director: "Jean-Pierre Jeunet" },
            { title: "Dumb and Dumber", year: 1994, director: "Peter Farrelly, Bobby Farrelly" }
        ]
    },
    "Drama": {
        movies: [
            { title: "The Shawshank Redemption", year: 1994, director: "Frank Darabont" },
            { title: "The Godfather", year: 1972, director: "Francis Ford Coppola" },
            { title: "The Godfather Part II", year: 1974, director: "Francis Ford Coppola" },
            { title: "12 Angry Men", year: 1957, director: "Sidney Lumet" },
            { title: "Schindler's List", year: 1993, director: "Steven Spielberg" },
            { title: "Forrest Gump", year: 1994, director: "Robert Zemeckis" },
            { title: "Fight Club", year: 1999, director: "David Fincher" },
            { title: "One Flew Over the Cuckoo's Nest", year: 1975, director: "Milos Forman" },
            { title: "Parasite", year: 2019, director: "Bong Joon-ho" },
            { title: "Casablanca", year: 1942, director: "Michael Curtiz" },
            { title: "Citizen Kane", year: 1941, director: "Orson Welles" },
            { title: "Whiplash", year: 2014, director: "Damien Chazelle" },
            { title: "The Green Mile", year: 1999, director: "Frank Darabont" },
            { title: "Good Will Hunting", year: 1997, director: "Gus Van Sant" },
            { title: "A Separation", year: 2011, director: "Asghar Farhadi" }
        ]
    },
    "Sci-Fi": {
        movies: [
            { title: "Interstellar", year: 2014, director: "Christopher Nolan" },
            { title: "Inception", year: 2010, director: "Christopher Nolan" },
            { title: "2001: A Space Odyssey", year: 1968, director: "Stanley Kubrick" },
            { title: "Blade Runner 2049", year: 2017, director: "Denis Villeneuve" },
            { title: "Blade Runner", year: 1982, director: "Ridley Scott" },
            { title: "Alien", year: 1979, director: "Ridley Scott" },
            { title: "Star Wars: Episode V - The Empire Strikes Back", year: 1980, director: "Irvin Kershner" },
            { title: "Star Wars: Episode IV - A New Hope", year: 1977, director: "George Lucas" },
            { title: "The Thing", year: 1982, director: "John Carpenter" },
            { title: "Arrival", year: 2016, director: "Denis Villeneuve" },
            { title: "Back to the Future", year: 1985, director: "Robert Zemeckis" },
            { title: "The Matrix", year: 1999, director: "Lana Wachowski, Lilly Wachowski" },
            { title: "Eternal Sunshine of the Spotless Mind", year: 2004, director: "Michel Gondry" },
            { title: "Children of Men", year: 2006, director: "Alfonso Cuarón" },
            { title: "District 9", year: 2009, director: "Neill Blomkamp" }
        ]
    },
    "Horror": {
        movies: [
            { title: "The Shining", year: 1980, director: "Stanley Kubrick" },
            { title: "Psycho", year: 1960, director: "Alfred Hitchcock" },
            { title: "Alien", year: 1979, director: "Ridley Scott" },
            { title: "The Exorcist", year: 1973, director: "William Friedkin" },
            { title: "Get Out", year: 2017, director: "Jordan Peele" },
            { title: "Halloween", year: 1978, director: "John Carpenter" },
            { title: "Hereditary", year: 2018, director: "Ari Aster" },
            { title: "Rosemary's Baby", year: 1968, director: "Roman Polanski" },
            { title: "The Silence of the Lambs", year: 1991, director: "Jonathan Demme" },
            { title: "The Thing", year: 1982, director: "John Carpenter" },
            { title: "A Nightmare on Elm Street", year: 1984, director: "Wes Craven" },
            { title: "Let the Right One In", year: 2008, director: "Tomas Alfredson" },
            { title: "The Conjuring", year: 2013, director: "James Wan" },
            { title: "The Texas Chain Saw Massacre", year: 1974, director: "Tobe Hooper" },
            { title: "It Follows", year: 2014, director: "David Robert Mitchell" }
        ]
    },
    "Romance": {
        movies: [
            { title: "Casablanca", year: 1942, director: "Michael Curtiz" },
            { title: "Before Sunrise", year: 1995, director: "Richard Linklater" },
            { title: "Before Sunset", year: 2004, director: "Richard Linklater" },
            { title: "Before Midnight", year: 2013, director: "Richard Linklater" },
            { title: "Eternal Sunshine of the Spotless Mind", year: 2004, director: "Michel Gondry" },
            { title: "In the Mood for Love", year: 2000, director: "Wong Kar-wai" },
            { title: "Titanic", year: 1997, director: "James Cameron" },
            { title: "Pride & Prejudice", year: 2005, director: "Joe Wright" },
            { title: "La La Land", year: 2016, director: "Damien Chazelle" },
            { title: "Portrait of a Lady on Fire", year: 2019, director: "Céline Sciamma" },
            { title: "Her", year: 2013, director: "Spike Jonze" },
            { title: "The Notebook", year: 2004, director: "Nick Cassavetes" },
            { title: "Call Me by Your Name", year: 2017, director: "Luca Guadagnino" },
            { title: "Roman Holiday", year: 1953, director: "William Wyler" },
            { title: "Amélie", year: 2001, director: "Jean-Pierre Jeunet" }
        ]
    },
    "Thriller": {
        movies: [
            { title: "Se7en", year: 1995, director: "David Fincher" },
            { title: "Parasite", year: 2019, director: "Bong Joon-ho" },
            { title: "Psycho", year: 1960, director: "Alfred Hitchcock" },
            { title: "Shutter Island", year: 2010, director: "Martin Scorsese" },
            { title: "The Silence of the Lambs", year: 1991, director: "Jonathan Demme" },
            { title: "Zodiac", year: 2007, director: "David Fincher" },
            { title: "The Departed", year: 2006, director: "Martin Scorsese" },
            { title: "Prisoners", year: 2013, director: "Denis Villeneuve" },
            { title: "Rear Window", year: 1954, director: "Alfred Hitchcock" },
            { title: "Oldboy", year: 2003, director: "Park Chan-wook" },
            { title: "Memento", year: 2000, director: "Christopher Nolan" },
            { title: "Nightcrawler", year: 2014, director: "Dan Gilroy" },
            { title: "Vertigo", year: 1958, director: "Alfred Hitchcock" },
            { title: "No Country for Old Men", year: 2007, director: "Joel Coen, Ethan Coen" },
            { title: "Black Swan", year: 2010, director: "Darren Aronofsky" }
        ]
    },
    "Crime": {
        movies: [
            { title: "The Godfather", year: 1972, director: "Francis Ford Coppola" },
            { title: "Pulp Fiction", year: 1994, director: "Quentin Tarantino" },
            { title: "Goodfellas", year: 1990, director: "Martin Scorsese" },
            { title: "Se7en", year: 1995, director: "David Fincher" },
            { title: "City of God", year: 2002, director: "Fernando Meirelles, Kátia Lund" },
            { title: "The Dark Knight", year: 2008, director: "Christopher Nolan" },
            { title: "The Departed", year: 2006, director: "Martin Scorsese" },
            { title: "Léon: The Professional", year: 1994, director: "Luc Besson" },
            { title: "Heat", year: 1995, director: "Michael Mann" },
            { title: "Scarface", year: 1983, director: "Brian De Palma" },
            { title: "No Country for Old Men", year: 2007, director: "Joel Coen, Ethan Coen" },
            { title: "Fargo", year: 1996, director: "Joel Coen, Ethan Coen" },
            { title: "The Usual Suspects", year: 1995, director: "Bryan Singer" },
            { title: "Casino", year: 1995, director: "Martin Scorsese" },
            { title: "Snatch", year: 2000, director: "Guy Ritchie" }
        ]
    },
    "Adventure": {
        movies: [
            { title: "The Lord of the Rings: The Fellowship of the Ring", year: 2001, director: "Peter Jackson" },
            { title: "The Lord of the Rings: The Two Towers", year: 2002, director: "Peter Jackson" },
            { title: "The Lord of the Rings: The Return of the King", year: 2003, director: "Peter Jackson" },
            { title: "Raiders of the Lost Ark", year: 1981, director: "Steven Spielberg" },
            { title: "Interstellar", year: 2014, director: "Christopher Nolan" },
            { title: "Spirited Away", year: 2001, director: "Hayao Miyazaki" },
            { title: "Back to the Future", year: 1985, director: "Robert Zemeckis" },
            { title: "Jurassic Park", year: 1993, director: "Steven Spielberg" },
            { title: "Star Wars: Episode IV - A New Hope", year: 1977, director: "George Lucas" },
            { title: "Gladiator", year: 2000, director: "Ridley Scott" },
            { title: "Life of Pi", year: 2012, director: "Ang Lee" },
            { title: "Cast Away", year: 2000, director: "Robert Zemeckis" },
            { title: "Into the Wild", year: 2007, director: "Sean Penn" },
            { title: "Pirates of the Caribbean: The Curse of the Black Pearl", year: 2003, director: "Gore Verbinski" },
            { title: "Lawrence of Arabia", year: 1962, director: "David Lean" }
        ]
    },
    "Animation": {
        movies: [
            { title: "Spirited Away", year: 2001, director: "Hayao Miyazaki" },
            { title: "The Lion King", year: 1994, director: "Roger Allers, Rob Minkoff" },
            { title: "Spider-Man: Into the Spider-Verse", year: 2018, director: "Bob Persichetti, Peter Ramsey, Rodney Rothman" },
            { title: "Spider-Man: Across the Spider-Verse", year: 2023, director: "Joaquim Dos Santos, Kemp Powers, Justin K. Thompson" },
            { title: "Toy Story", year: 1995, director: "John Lasseter" },
            { title: "Toy Story 3", year: 2010, director: "Lee Unkrich" },
            { title: "WALL-E", year: 2008, director: "Andrew Stanton" },
            { title: "Coco", year: 2017, director: "Lee Unkrich" },
            { title: "Your Name", year: 2016, director: "Makoto Shinkai" },
            { title: "Up", year: 2009, director: "Pete Docter" },
            { title: "Inside Out", year: 2015, director: "Pete Docter" },
            { title: "My Neighbor Totoro", year: 1988, director: "Hayao Miyazaki" },
            { title: "Grave of the Fireflies", year: 1988, director: "Isao Takahata" },
            { title: "Princess Mononoke", year: 1997, director: "Hayao Miyazaki" },
            { title: "Ratatouille", year: 2007, director: "Brad Bird" }
        ]
    },
    "Fantasy": {
        movies: [
            { title: "The Lord of the Rings: The Return of the King", year: 2003, director: "Peter Jackson" },
            { title: "Harry Potter and the Deathly Hallows: Part 2", year: 2011, director: "David Yates" },
            { title: "Spirited Away", year: 2001, director: "Hayao Miyazaki" },
            { title: "Pan's Labyrinth", year: 2006, director: "Guillermo del Toro" },
            { title: "The Princess Bride", year: 1987, director: "Rob Reiner" },
            { title: "Avatar", year: 2009, director: "James Cameron" },
            { title: "Groundhog Day", year: 1993, director: "Harold Ramis" },
            { title: "Pirates of the Caribbean: The Curse of the Black Pearl", year: 2003, director: "Gore Verbinski" },
            { title: "Edward Scissorhands", year: 1990, director: "Tim Burton" },
            { title: "Star Wars: Episode V - The Empire Strikes Back", year: 1980, director: "Irvin Kershner" },
            { title: "The Wizard of Oz", year: 1939, director: "Victor Fleming" },
            { title: "Mary Poppins", year: 1964, director: "Robert Stevenson" },
            { title: "Big", year: 1988, director: "Penny Marshall" },
            { title: "Beauty and the Beast", year: 1991, director: "Gary Trousdale, Kirk Wise" },
            { title: "Jumanji", year: 1995, director: "Joe Johnston" }
        ]
    },
    "Mystery": {
        movies: [
            { title: "Se7en", year: 1995, director: "David Fincher" },
            { title: "Shutter Island", year: 2010, director: "Martin Scorsese" },
            { title: "Memento", year: 2000, director: "Christopher Nolan" },
            { title: "Prisoners", year: 2013, director: "Denis Villeneuve" },
            { title: "Zodiac", year: 2007, director: "David Fincher" },
            { title: "Psycho", year: 1960, director: "Alfred Hitchcock" },
            { title: "The Usual Suspects", year: 1995, director: "Bryan Singer" },
            { title: "Rear Window", year: 1954, director: "Alfred Hitchcock" },
            { title: "Vertigo", year: 1958, director: "Alfred Hitchcock" },
            { title: "L.A. Confidential", year: 1997, director: "Curtis Hanson" },
            { title: "Gone Girl", year: 2014, director: "David Fincher" },
            { title: "Knives Out", year: 2019, director: "Rian Johnson" },
            { title: "Chinatown", year: 1974, director: "Roman Polanski" },
            { title: "Oldboy", year: 2003, director: "Park Chan-wook" },
            { title: "The Prestige", year: 2006, director: "Christopher Nolan" }
        ]
    }
};

export function getGenreTops() {
  return GENRE_TOPS_DATA
}
