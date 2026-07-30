// داده‌های اسکار (برندگان و کاندیداها) — استخراج‌شده برای بخش داشبورد
/* eslint-disable */
const OSCAR_DATA = {
    2026: {
        ceremony: 98,
        categories: [
            {
                name: "Best Picture",
                persianName: "بهترین فیلم",
                nominees: [
                    { title: "One Battle After Another", winner: true },
                    { title: "Bugonia", winner: false },
                    { title: "F1", winner: false },
                    { title: "Frankenstein", winner: false },
                    { title: "Hamnet", winner: false },
                    { title: "Marty Supreme", winner: false },
                    { title: "The Secret Agent", winner: false },
                    { title: "Sentimental Value", winner: false },
                    { title: "Sinners", winner: false },
                    { title: "Train Dreams", winner: false }
                ]
            },
            {
                name: "Best Directing",
                persianName: "بهترین کارگردانی",
                nominees: [
                    { name: "Paul Thomas Anderson", title: "One Battle After Another", winner: true },
                    { name: "Chloé Zhao", title: "Sentimental Value", winner: false },
                    { name: "Ryan Coogler", title: "Sinners", winner: false },
                    { name: "Guillermo del Toro", title: "Frankenstein", winner: false },
                    { name: "Yorgos Lanthimos", title: "Bugonia", winner: false }
                ]
            },
            {
                name: "Best Actor in a Leading Role",
                persianName: "بهترین بازیگر نقش اول مرد",
                nominees: [
                    { name: "Michael B. Jordan", title: "Sinners", winner: true },
                    { name: "Timothée Chalamet", title: "Marty Supreme", winner: false },
                    { name: "Leonardo DiCaprio", title: "One Battle After Another", winner: false },
                    { name: "Ethan Hawke", title: "Blue Moon", winner: false },
                    { name: "Wagner Moura", title: "The Secret Agent", winner: false }
                ]
            },
            {
                name: "Best Actress in a Leading Role",
                persianName: "بهترین بازیگر نقش اول زن",
                nominees: [
                    { name: "Jessie Buckley", title: "Hamnet", winner: true },
                    { name: "Rose Byrne", title: "If I Had Legs I'd Kick You", winner: false },
                    { name: "Kate Hudson", title: "Song Sung Blue", winner: false },
                    { name: "Renate Reinsve", title: "Sentimental Value", winner: false },
                    { name: "Emma Stone", title: "Bugonia", winner: false }
                ]
            },
            {
                name: "Best Actor in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل مرد",
                nominees: [
                    { name: "Sean Penn", title: "One Battle After Another", winner: true },
                    { name: "Benicio del Toro", title: "One Battle After Another", winner: false },
                    { name: "Jacob Elordi", title: "Frankenstein", winner: false },
                    { name: "Delroy Lindo", title: "Sinners", winner: false },
                    { name: "Stellan Skarsgård", title: "Sentimental Value", winner: false }
                ]
            },
            {
                name: "Best Actress in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل زن",
                nominees: [
                    { name: "Amy Madigan", title: "Weapons", winner: true },
                    { name: "Elle Fanning", title: "Sentimental Value", winner: false },
                    { name: "Inga Ibsdotter Lilleaas", title: "Sentimental Value", winner: false },
                    { name: "Wunmi Mosaku", title: "Sinners", winner: false },
                    { name: "Teyana Taylor", title: "One Battle After Another", winner: false }
                ]
            },
            {
                name: "Best Animated Feature Film",
                persianName: "بهترین انیمیشن بلند",
                nominees: [
                    { title: "KPop Demon Hunters", winner: true },
                    { title: "Elio", winner: false },
                    { title: "Arco", winner: false }
                ]
            },
            {
                name: "Best International Feature Film",
                persianName: "بهترین فیلم بین‌المللی",
                nominees: [
                    { title: "Sentimental Value", winner: true },
                    { title: "The Secret Agent", winner: false },
                    { title: "It Was Just an Accident", winner: false },
                    { title: "Sirāt", winner: false },
                    { title: "The Voice of Hind Rajab", winner: false }
                ]
            },
            {
                name: "Best Original Score",
                persianName: "بهترین موسیقی متن اصلی",
                nominees: [
                    { name: "Ludwig Göransson", title: "Sinners", winner: true },
                    { name: "Jerskin Fendrix", title: "Bugonia", winner: false },
                    { name: "Alexandre Desplat", title: "Frankenstein", winner: false },
                    { name: "Max Richter", title: "Hamnet", winner: false },
                    { name: "Jonny Greenwood", title: "One Battle After Another", winner: false }
                ]
            },
            {
                name: "Best Cinematography",
                persianName: "بهترین فیلم‌برداری",
                nominees: [
                    { name: "Autumn Durald Arkapaw", title: "Sinners", winner: true },
                    { name: "Dan Laustsen", title: "Frankenstein", winner: false },
                    { name: "Darius Khondji", title: "Marty Supreme", winner: false },
                    { name: "Michael Bauman", title: "One Battle After Another", winner: false },
                    { name: "Adolpho Veloso", title: "Train Dreams", winner: false }
                ]
            }
        ]
    },
    2025: {
        ceremony: 97,
        categories: [
            {
                name: "Best Picture",
                persianName: "بهترین فیلم",
                nominees: [
                    { title: "Anora", winner: true },
                    { title: "The Brutalist", winner: false },
                    { title: "A Complete Unknown", winner: false },
                    { title: "Conclave", winner: false },
                    { title: "Dune: Part Two", winner: false },
                    { title: "Emilia Pérez", winner: false },
                    { title: "I'm Still Here", winner: false },
                    { title: "Nickel Boys", winner: false },
                    { title: "The Substance", winner: false },
                    { title: "Wicked", winner: false }
                ]
            },
            {
                name: "Best Directing",
                persianName: "بهترین کارگردانی",
                nominees: [
                    { name: "Sean Baker", title: "Anora", winner: true },
                    { name: "Brady Corbet", title: "The Brutalist", winner: false },
                    { name: "James Mangold", title: "A Complete Unknown", winner: false },
                    { name: "Edward Berger", title: "Conclave", winner: false },
                    { name: "Jacques Audiard", title: "Emilia Pérez", winner: false }
                ]
            },
            {
                name: "Best Actor in a Leading Role",
                persianName: "بهترین بازیگر نقش اول مرد",
                nominees: [
                    { name: "Adrien Brody", title: "The Brutalist", winner: true },
                    { name: "Timothée Chalamet", title: "A Complete Unknown", winner: false },
                    { name: "Colman Domingo", title: "Sing Sing", winner: false },
                    { name: "Ralph Fiennes", title: "Conclave", winner: false },
                    { name: "Sebastian Stan", title: "The Apprentice", winner: false }
                ]
            },
            {
                name: "Best Actress in a Leading Role",
                persianName: "بهترین بازیگر نقش اول زن",
                nominees: [
                    { name: "Mikey Madison", title: "Anora", winner: true },
                    { name: "Cynthia Erivo", title: "Wicked", winner: false },
                    { name: "Karla Sofía Gascón", title: "Emilia Pérez", winner: false },
                    { name: "Demi Moore", title: "The Substance", winner: false },
                    { name: "Fernanda Torres", title: "I'm Still Here", winner: false }
                ]
            },
            {
                name: "Best Actor in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل مرد",
                nominees: [
                    { name: "Kieran Culkin", title: "A Real Pain", winner: true },
                    { name: "Yura Borisov", title: "Anora", winner: false },
                    { name: "Edward Norton", title: "A Complete Unknown", winner: false },
                    { name: "Guy Pearce", title: "The Brutalist", winner: false },
                    { name: "Jeremy Strong", title: "The Apprentice", winner: false }
                ]
            },
            {
                name: "Best Actress in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل زن",
                nominees: [
                    { name: "Zoe Saldaña", title: "Emilia Pérez", winner: true },
                    { name: "Monica Barbaro", title: "A Complete Unknown", winner: false },
                    { name: "Ariana Grande", title: "Wicked", winner: false },
                    { name: "Felicity Jones", title: "The Brutalist", winner: false },
                    { name: "Isabella Rossellini", title: "Conclave", winner: false }
                ]
            },
            {
                name: "Best Animated Feature Film",
                persianName: "بهترین انیمیشن بلند",
                nominees: [
                    { title: "Flow", winner: true },
                    { title: "Inside Out 2", winner: false },
                    { title: "Memoir of a Snail", winner: false },
                    { title: "Wallace & Gromit: Vengeance Most Fowl", winner: false },
                    { title: "The Wild Robot", winner: false }
                ]
            },
            {
                name: "Best International Feature Film",
                persianName: "بهترین فیلم بین‌المللی",
                nominees: [
                    { title: "I'm Still Here", winner: true },
                    { title: "The Girl with the Needle", winner: false },
                    { title: "Emilia Pérez", winner: false },
                    { title: "The Seed of the Sacred Fig", winner: false },
                    { title: "Flow", winner: false }
                ]
            },
            {
                name: "Best Original Score",
                persianName: "بهترین موسیقی متن اصلی",
                nominees: [
                    { name: "Daniel Blumberg", title: "The Brutalist", winner: true },
                    { name: "Conclave", winner: false },
                    { name: "Dune: Part Two", winner: false },
                    { name: "Emilia Pérez", winner: false },
                    { name: "Wicked", winner: false }
                ]
            },
            {
                name: "Best Cinematography",
                persianName: "بهترین فیلم‌برداری",
                nominees: [
                    { name: "Lol Crawley", title: "The Brutalist", winner: true },
                    { name: "Greig Fraser", title: "Dune: Part Two", winner: false },
                    { name: "Paul Guillaume", title: "Emilia Pérez", winner: false },
                    { name: "Edward Lachman", title: "Maria", winner: false },
                    { name: "Jarin Blaschke", title: "Nosferatu", winner: false }
                ]
            }
        ]
    },
    2024: {
        ceremony: 96,
        categories: [
            {
                name: "Best Picture",
                persianName: "بهترین فیلم",
                nominees: [
                    { title: "Oppenheimer", winner: true },
                    { title: "American Fiction", winner: false },
                    { title: "Anatomy of a Fall", winner: false },
                    { title: "Barbie", winner: false },
                    { title: "The Holdovers", winner: false },
                    { title: "Killers of the Flower Moon", winner: false },
                    { title: "Maestro", winner: false },
                    { title: "Past Lives", winner: false },
                    { title: "Poor Things", winner: false },
                    { title: "The Zone of Interest", winner: false }
                ]
            },
            {
                name: "Best Directing",
                persianName: "بهترین کارگردانی",
                nominees: [
                    { name: "Christopher Nolan", title: "Oppenheimer", winner: true },
                    { name: "Justine Triet", title: "Anatomy of a Fall", winner: false },
                    { name: "Martin Scorsese", title: "Killers of the Flower Moon", winner: false },
                    { name: "Yorgos Lanthimos", title: "Poor Things", winner: false },
                    { name: "Jonathan Glazer", title: "The Zone of Interest", winner: false }
                ]
            },
            {
                name: "Best Actor in a Leading Role",
                persianName: "بهترین بازیگر نقش اول مرد",
                nominees: [
                    { name: "Cillian Murphy", title: "Oppenheimer", winner: true },
                    { name: "Bradley Cooper", title: "Maestro", winner: false },
                    { name: "Colman Domingo", title: "Rustin", winner: false },
                    { name: "Paul Giamatti", title: "The Holdovers", winner: false },
                    { name: "Jeffrey Wright", title: "American Fiction", winner: false }
                ]
            },
            {
                name: "Best Actress in a Leading Role",
                persianName: "بهترین بازیگر نقش اول زن",
                nominees: [
                    { name: "Emma Stone", title: "Poor Things", winner: true },
                    { name: "Annette Bening", title: "Nyad", winner: false },
                    { name: "Lily Gladstone", title: "Killers of the Flower Moon", winner: false },
                    { name: "Sandra Hüller", title: "Anatomy of a Fall", winner: false },
                    { name: "Carey Mulligan", title: "Maestro", winner: false }
                ]
            },
            {
                name: "Best Actor in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل مرد",
                nominees: [
                    { name: "Robert Downey Jr.", title: "Oppenheimer", winner: true },
                    { name: "Sterling K. Brown", title: "American Fiction", winner: false },
                    { name: "Robert De Niro", title: "Killers of the Flower Moon", winner: false },
                    { name: "Ryan Gosling", title: "Barbie", winner: false },
                    { name: "Mark Ruffalo", title: "Poor Things", winner: false }
                ]
            },
            {
                name: "Best Actress in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل زن",
                nominees: [
                    { name: "Da'Vine Joy Randolph", title: "The Holdovers", winner: true },
                    { name: "Emily Blunt", title: "Oppenheimer", winner: false },
                    { name: "Danielle Brooks", title: "The Color Purple", winner: false },
                    { name: "America Ferrera", title: "Barbie", winner: false },
                    { name: "Jodie Foster", title: "Nyad", winner: false }
                ]
            },
            {
                name: "Best Animated Feature Film",
                persianName: "بهترین انیمیشن بلند",
                nominees: [
                    { title: "The Boy and the Heron", winner: true },
                    { title: "Elemental", winner: false },
                    { title: "Nimona", winner: false },
                    { title: "Robot Dreams", winner: false },
                    { title: "Spider-Man: Across the Spider-Verse", winner: false }
                ]
            },
            {
                name: "Best International Feature Film",
                persianName: "بهترین فیلم بین‌المللی",
                nominees: [
                    { title: "The Zone of Interest", winner: true },
                    { title: "Io Capitano", winner: false },
                    { title: "Perfect Days", winner: false },
                    { title: "Society of the Snow", winner: false },
                    { title: "The Teachers' Lounge", winner: false }
                ]
            },
            {
                name: "Best Original Score",
                persianName: "بهترین موسیقی متن اصلی",
                nominees: [
                    { name: "Ludwig Göransson", title: "Oppenheimer", winner: true },
                    { name: "Laura Karpman", title: "American Fiction", winner: false },
                    { name: "John Williams", title: "Indiana Jones and the Dial of Destiny", winner: false },
                    { name: "Robbie Robertson", title: "Killers of the Flower Moon", winner: false },
                    { name: "Jerskin Fendrix", title: "Poor Things", winner: false }
                ]
            },
            {
                name: "Best Cinematography",
                persianName: "بهترین فیلم‌برداری",
                nominees: [
                    { name: "Hoyte van Hoytema", title: "Oppenheimer", winner: true },
                    { name: "Edward Lachman", title: "El Conde", winner: false },
                    { name: "Rodrigo Prieto", title: "Killers of the Flower Moon", winner: false },
                    { name: "Matthew Libatique", title: "Maestro", winner: false },
                    { name: "Robbie Ryan", title: "Poor Things", winner: false }
                ]
            }
        ]
    },
    2023: {
        ceremony: 95,
        categories: [
            {
                name: "Best Picture",
                persianName: "بهترین فیلم",
                nominees: [
                    { title: "Everything Everywhere All at Once", winner: true },
                    { title: "All Quiet on the Western Front", winner: false },
                    { title: "Avatar: The Way of Water", winner: false },
                    { title: "The Banshees of Inisherin", winner: false },
                    { title: "Elvis", winner: false },
                    { title: "The Fabelmans", winner: false },
                    { title: "Tár", winner: false },
                    { title: "Top Gun: Maverick", winner: false },
                    { title: "Triangle of Sadness", winner: false },
                    { title: "Women Talking", winner: false }
                ]
            },
            {
                name: "Best Directing",
                persianName: "بهترین کارگردانی",
                nominees: [
                    { name: "Daniel Kwan and Daniel Scheinert", title: "Everything Everywhere All at Once", winner: true },
                    { name: "Martin McDonagh", title: "The Banshees of Inisherin", winner: false },
                    { name: "Steven Spielberg", title: "The Fabelmans", winner: false },
                    { name: "Todd Field", title: "Tár", winner: false },
                    { name: "Ruben Östlund", title: "Triangle of Sadness", winner: false }
                ]
            },
            {
                name: "Best Actor in a Leading Role",
                persianName: "بهترین بازیگر نقش اول مرد",
                nominees: [
                    { name: "Brendan Fraser", title: "The Whale", winner: true },
                    { name: "Austin Butler", title: "Elvis", winner: false },
                    { name: "Colin Farrell", title: "The Banshees of Inisherin", winner: false },
                    { name: "Paul Mescal", title: "Aftersun", winner: false },
                    { name: "Bill Nighy", title: "Living", winner: false }
                ]
            },
            {
                name: "Best Actress in a Leading Role",
                persianName: "بهترین بازیگر نقش اول زن",
                nominees: [
                    { name: "Michelle Yeoh", title: "Everything Everywhere All at Once", winner: true },
                    { name: "Cate Blanchett", title: "Tár", winner: false },
                    { name: "Ana de Armas", title: "Blonde", winner: false },
                    { name: "Andrea Riseborough", title: "To Leslie", winner: false },
                    { name: "Michelle Williams", title: "The Fabelmans", winner: false }
                ]
            },
            {
                name: "Best Actor in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل مرد",
                nominees: [
                    { name: "Ke Huy Quan", title: "Everything Everywhere All at Once", winner: true },
                    { name: "Brendan Gleeson", title: "The Banshees of Inisherin", winner: false },
                    { name: "Brian Tyree Henry", title: "Causeway", winner: false },
                    { name: "Judd Hirsch", title: "The Fabelmans", winner: false },
                    { name: "Barry Keoghan", title: "The Banshees of Inisherin", winner: false }
                ]
            },
            {
                name: "Best Actress in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل زن",
                nominees: [
                    { name: "Jamie Lee Curtis", title: "Everything Everywhere All at Once", winner: true },
                    { name: "Angela Bassett", title: "Black Panther: Wakanda Forever", winner: false },
                    { name: "Hong Chau", title: "The Whale", winner: false },
                    { name: "Kerry Condon", title: "The Banshees of Inisherin", winner: false },
                    { name: "Stephanie Hsu", title: "Everything Everywhere All at Once", winner: false }
                ]
            },
            {
                name: "Best Animated Feature Film",
                persianName: "بهترین انیمیشن بلند",
                nominees: [
                    { title: "Guillermo del Toro's Pinocchio", winner: true },
                    { title: "Marcel the Shell with Shoes On", winner: false },
                    { title: "Puss in Boots: The Last Wish", winner: false },
                    { title: "The Sea Beast", winner: false },
                    { title: "Turning Red", winner: false }
                ]
            },
            {
                name: "Best International Feature Film",
                persianName: "بهترین فیلم بین‌المللی",
                nominees: [
                    { title: "All Quiet on the Western Front", winner: true },
                    { title: "Argentina, 1985", winner: false },
                    { title: "Close", winner: false },
                    { title: "EO", winner: false },
                    { title: "The Quiet Girl", winner: false }
                ]
            },
            {
                name: "Best Original Score",
                persianName: "بهترین موسیقی متن اصلی",
                nominees: [
                    { name: "Volker Bertelmann", title: "All Quiet on the Western Front", winner: true },
                    { name: "Justin Hurwitz", title: "Babylon", winner: false },
                    { name: "Carter Burwell", title: "The Banshees of Inisherin", winner: false },
                    { name: "Son Lux", title: "Everything Everywhere All at Once", winner: false },
                    { name: "John Williams", title: "The Fabelmans", winner: false }
                ]
            },
            {
                name: "Best Cinematography",
                persianName: "بهترین فیلم‌برداری",
                nominees: [
                    { name: "James Friend", title: "All Quiet on the Western Front", winner: true },
                    { name: "Darius Khondji", title: "Bardo, False Chronicle of a Handful of Truths", winner: false },
                    { name: "Mandy Walker", title: "Elvis", winner: false },
                    { name: "Roger Deakins", title: "Empire of Light", winner: false },
                    { name: "Florian Hoffmeister", title: "Tár", winner: false }
                ]
            }
        ]
    },
    2022: {
        ceremony: 94,
        categories: [
            {
                name: "Best Picture",
                persianName: "بهترین فیلم",
                nominees: [
                    { title: "CODA", winner: true },
                    { title: "Belfast", winner: false },
                    { title: "Don't Look Up", winner: false },
                    { title: "Drive My Car", winner: false },
                    { title: "Dune", winner: false },
                    { title: "King Richard", winner: false },
                    { title: "Licorice Pizza", winner: false },
                    { title: "Nightmare Alley", winner: false },
                    { title: "The Power of the Dog", winner: false },
                    { title: "West Side Story", winner: false }
                ]
            },
            {
                name: "Best Directing",
                persianName: "بهترین کارگردانی",
                nominees: [
                    { name: "Jane Campion", title: "The Power of the Dog", winner: true },
                    { name: "Kenneth Branagh", title: "Belfast", winner: false },
                    { name: "Ryusuke Hamaguchi", title: "Drive My Car", winner: false },
                    { name: "Paul Thomas Anderson", title: "Licorice Pizza", winner: false },
                    { name: "Steven Spielberg", title: "West Side Story", winner: false }
                ]
            },
            {
                name: "Best Actor in a Leading Role",
                persianName: "بهترین بازیگر نقش اول مرد",
                nominees: [
                    { name: "Will Smith", title: "King Richard", winner: true },
                    { name: "Javier Bardem", title: "Being the Ricardos", winner: false },
                    { name: "Benedict Cumberbatch", title: "The Power of the Dog", winner: false },
                    { name: "Andrew Garfield", title: "Tick, Tick... Boom!", winner: false },
                    { name: "Denzel Washington", title: "The Tragedy of Macbeth", winner: false }
                ]
            },
            {
                name: "Best Actress in a Leading Role",
                persianName: "بهترین بازیگر نقش اول زن",
                nominees: [
                    { name: "Jessica Chastain", title: "The Eyes of Tammy Faye", winner: true },
                    { name: "Olivia Colman", title: "The Lost Daughter", winner: false },
                    { name: "Penélope Cruz", title: "Parallel Mothers", winner: false },
                    { name: "Nicole Kidman", title: "Being the Ricardos", winner: false },
                    { name: "Kristen Stewart", title: "Spencer", winner: false }
                ]
            },
            {
                name: "Best Actor in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل مرد",
                nominees: [
                    { name: "Troy Kotsur", title: "CODA", winner: true },
                    { name: "Ciarán Hinds", title: "Belfast", winner: false },
                    { name: "Jesse Plemons", title: "The Power of the Dog", winner: false },
                    { name: "J.K. Simmons", title: "Being the Ricardos", winner: false },
                    { name: "Kodi Smit-McPhee", title: "The Power of the Dog", winner: false }
                ]
            },
            {
                name: "Best Actress in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل زن",
                nominees: [
                    { name: "Ariana DeBose", title: "West Side Story", winner: true },
                    { name: "Jessie Buckley", title: "The Lost Daughter", winner: false },
                    { name: "Judi Dench", title: "Belfast", winner: false },
                    { name: "Kirsten Dunst", title: "The Power of the Dog", winner: false },
                    { name: "Aunjanue Ellis", title: "King Richard", winner: false }
                ]
            },
            {
                name: "Best Animated Feature Film",
                persianName: "بهترین انیمیشن بلند",
                nominees: [
                    { title: "Encanto", winner: true },
                    { title: "Flee", winner: false },
                    { title: "Luca", winner: false },
                    { title: "The Mitchells vs. the Machines", winner: false },
                    { title: "Raya and the Last Dragon", winner: false }
                ]
            },
            {
                name: "Best International Feature Film",
                persianName: "بهترین فیلم بین‌المللی",
                nominees: [
                    { title: "Drive My Car", winner: true },
                    { title: "Flee", winner: false },
                    { title: "The Hand of God", winner: false },
                    { title: "Lunana: A Yak in the Classroom", winner: false },
                    { title: "The Worst Person in the World", winner: false }
                ]
            },
            {
                name: "Best Original Score",
                persianName: "بهترین موسیقی متن اصلی",
                nominees: [
                    { name: "Hans Zimmer", title: "Dune", winner: true },
                    { name: "Nicholas Britell", title: "Don't Look Up", winner: false },
                    { name: "Germaine Franco", title: "Encanto", winner: false },
                    { name: "Alberto Iglesias", title: "Parallel Mothers", winner: false },
                    { name: "Jonny Greenwood", title: "The Power of the Dog", winner: false }
                ]
            },
            {
                name: "Best Cinematography",
                persianName: "بهترین فیلم‌برداری",
                nominees: [
                    { name: "Greig Fraser", title: "Dune", winner: true },
                    { name: "Dan Laustsen", title: "Nightmare Alley", winner: false },
                    { name: "Ari Wegner", title: "The Power of the Dog", winner: false },
                    { name: "Bruno Delbonnel", title: "The Tragedy of Macbeth", winner: false },
                    { name: "Janusz Kamiński", title: "West Side Story", winner: false }
                ]
            }
        ]
    },
    2021: {
        ceremony: 93,
        categories: [
            {
                name: "Best Picture",
                persianName: "بهترین فیلم",
                nominees: [
                    { title: "Nomadland", winner: true },
                    { title: "The Father", winner: false },
                    { title: "Judas and the Black Messiah", winner: false },
                    { title: "Mank", winner: false },
                    { title: "Minari", winner: false },
                    { title: "Promising Young Woman", winner: false },
                    { title: "Sound of Metal", winner: false },
                    { title: "The Trial of the Chicago 7", winner: false }
                ]
            },
            {
                name: "Best Directing",
                persianName: "بهترین کارگردانی",
                nominees: [
                    { name: "Chloé Zhao", title: "Nomadland", winner: true },
                    { name: "Thomas Vinterberg", title: "Another Round", winner: false },
                    { name: "David Fincher", title: "Mank", winner: false },
                    { name: "Lee Isaac Chung", title: "Minari", winner: false },
                    { name: "Emerald Fennell", title: "Promising Young Woman", winner: false }
                ]
            },
            {
                name: "Best Actor in a Leading Role",
                persianName: "بهترین بازیگر نقش اول مرد",
                nominees: [
                    { name: "Anthony Hopkins", title: "The Father", winner: true },
                    { name: "Riz Ahmed", title: "Sound of Metal", winner: false },
                    { name: "Chadwick Boseman", title: "Ma Rainey's Black Bottom", winner: false },
                    { name: "Gary Oldman", title: "Mank", winner: false },
                    { name: "Steven Yeun", title: "Minari", winner: false }
                ]
            },
            {
                name: "Best Actress in a Leading Role",
                persianName: "بهترین بازیگر نقش اول زن",
                nominees: [
                    { name: "Frances McDormand", title: "Nomadland", winner: true },
                    { name: "Viola Davis", title: "Ma Rainey's Black Bottom", winner: false },
                    { name: "Andra Day", title: "The United States vs. Billie Holiday", winner: false },
                    { name: "Vanessa Kirby", title: "Pieces of a Woman", winner: false },
                    { name: "Carey Mulligan", title: "Promising Young Woman", winner: false }
                ]
            },
            {
                name: "Best Actor in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل مرد",
                nominees: [
                    { name: "Daniel Kaluuya", title: "Judas and the Black Messiah", winner: true },
                    { name: "Sacha Baron Cohen", title: "The Trial of the Chicago 7", winner: false },
                    { name: "Leslie Odom Jr.", title: "One Night in Miami...", winner: false },
                    { name: "Paul Raci", title: "Sound of Metal", winner: false },
                    { name: "LaKeith Stanfield", title: "Judas and the Black Messiah", winner: false }
                ]
            },
            {
                name: "Best Actress in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل زن",
                nominees: [
                    { name: "Yuh-jung Youn", title: "Minari", winner: true },
                    { name: "Maria Bakalova", title: "Borat Subsequent Moviefilm", winner: false },
                    { name: "Glenn Close", title: "Hillbilly Elegy", winner: false },
                    { name: "Olivia Colman", title: "The Father", winner: false },
                    { name: "Amanda Seyfried", title: "Mank", winner: false }
                ]
            },
            {
                name: "Best Animated Feature Film",
                persianName: "بهترین انیمیشن بلند",
                nominees: [
                    { title: "Soul", winner: true },
                    { title: "Onward", winner: false },
                    { title: "Over the Moon", winner: false },
                    { title: "A Shaun the Sheep Movie: Farmageddon", winner: false },
                    { title: "Wolfwalkers", winner: false }
                ]
            },
            {
                name: "Best International Feature Film",
                persianName: "بهترین فیلم بین‌المللی",
                nominees: [
                    { title: "Another Round", winner: true },
                    { title: "Better Days", winner: false },
                    { title: "Collective", winner: false },
                    { title: "The Man Who Sold His Skin", winner: false },
                    { title: "Quo Vadis, Aida?", winner: false }
                ]
            },
            {
                name: "Best Original Score",
                persianName: "بهترین موسیقی متن اصلی",
                nominees: [
                    { name: "Trent Reznor, Atticus Ross, Jon Batiste", title: "Soul", winner: true },
                    { name: "Terence Blanchard", title: "Da 5 Bloods", winner: false },
                    { name: "Trent Reznor, Atticus Ross", title: "Mank", winner: false },
                    { name: "Emile Mosseri", title: "Minari", winner: false },
                    { name: "James Newton Howard", title: "News of the World", winner: false }
                ]
            },
            {
                name: "Best Cinematography",
                persianName: "بهترین فیلم‌برداری",
                nominees: [
                    { name: "Erik Messerschmidt", title: "Mank", winner: true },
                    { name: "Sean Bobbitt", title: "Judas and the Black Messiah", winner: false },
                    { name: "Phedon Papamichael", title: "News of the World", winner: false },
                    { name: "Joshua James Richards", title: "Nomadland", winner: false },
                    { name: "Pariusz Wolski", title: "News of the World", winner: false }
                ]
            }
        ]
    },
    2020: {
        ceremony: 92,
        categories: [
            {
                name: "Best Picture",
                persianName: "بهترین فیلم",
                nominees: [
                    { title: "Parasite", winner: true },
                    { title: "Ford v Ferrari", winner: false },
                    { title: "The Irishman", winner: false },
                    { title: "Jojo Rabbit", winner: false },
                    { title: "Joker", winner: false },
                    { title: "Little Women", winner: false },
                    { title: "Marriage Story", winner: false },
                    { title: "1917", winner: false },
                    { title: "Once Upon a Time in Hollywood", winner: false }
                ]
            },
            {
                name: "Best Directing",
                persianName: "بهترین کارگردانی",
                nominees: [
                    { name: "Bong Joon-ho", title: "Parasite", winner: true },
                    { name: "Martin Scorsese", title: "The Irishman", winner: false },
                    { name: "Todd Phillips", title: "Joker", winner: false },
                    { name: "Sam Mendes", title: "1917", winner: false },
                    { name: "Quentin Tarantino", title: "Once Upon a Time in Hollywood", winner: false }
                ]
            },
            {
                name: "Best Actor in a Leading Role",
                persianName: "بهترین بازیگر نقش اول مرد",
                nominees: [
                    { name: "Joaquin Phoenix", title: "Joker", winner: true },
                    { name: "Antonio Banderas", title: "Pain and Glory", winner: false },
                    { name: "Leonardo DiCaprio", title: "Once Upon a Time in Hollywood", winner: false },
                    { name: "Adam Driver", title: "Marriage Story", winner: false },
                    { name: "Jonathan Pryce", title: "The Two Popes", winner: false }
                ]
            },
            {
                name: "Best Actress in a Leading Role",
                persianName: "بهترین بازیگر نقش اول زن",
                nominees: [
                    { name: "Renée Zellweger", title: "Judy", winner: true },
                    { name: "Cynthia Erivo", title: "Harriet", winner: false },
                    { name: "Scarlett Johansson", title: "Marriage Story", winner: false },
                    { name: "Saoirse Ronan", title: "Little Women", winner: false },
                    { name: "Charlize Theron", title: "Bombshell", winner: false }
                ]
            },
            {
                name: "Best Actor in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل مرد",
                nominees: [
                    { name: "Brad Pitt", title: "Once Upon a Time in Hollywood", winner: true },
                    { name: "Tom Hanks", title: "A Beautiful Day in the Neighborhood", winner: false },
                    { name: "Anthony Hopkins", title: "The Two Popes", winner: false },
                    { name: "Al Pacino", title: "The Irishman", winner: false },
                    { name: "Joe Pesci", title: "The Irishman", winner: false }
                ]
            },
            {
                name: "Best Actress in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل زن",
                nominees: [
                    { name: "Laura Dern", title: "Marriage Story", winner: true },
                    { name: "Kathy Bates", title: "Richard Jewell", winner: false },
                    { name: "Scarlett Johansson", title: "Jojo Rabbit", winner: false },
                    { name: "Florence Pugh", title: "Little Women", winner: false },
                    { name: "Margot Robbie", title: "Bombshell", winner: false }
                ]
            },
            {
                name: "Best Animated Feature Film",
                persianName: "بهترین انیمیشن بلند",
                nominees: [
                    { title: "Toy Story 4", winner: true },
                    { title: "How to Train Your Dragon: The Hidden World", winner: false },
                    { title: "I Lost My Body", winner: false },
                    { title: "Klaus", winner: false },
                    { title: "Missing Link", winner: false }
                ]
            },
            {
                name: "Best International Feature Film",
                persianName: "بهترین فیلم بین‌المللی",
                nominees: [
                    { title: "Parasite", winner: true },
                    { title: "Corpus Christi", winner: false },
                    { title: "Honeyland", winner: false },
                    { title: "Les Misérables", winner: false },
                    { title: "Pain and Glory", winner: false }
                ]
            },
            {
                name: "Best Original Score",
                persianName: "بهترین موسیقی متن اصلی",
                nominees: [
                    { name: "Hildur Guðnadóttir", title: "Joker", winner: true },
                    { name: "Alexandre Desplat", title: "Little Women", winner: false },
                    { name: "Randy Newman", title: "Marriage Story", winner: false },
                    { name: "Thomas Newman", title: "1917", winner: false },
                    { name: "John Williams", title: "Star Wars: The Rise of Skywalker", winner: false }
                ]
            },
            {
                name: "Best Cinematography",
                persianName: "بهترین فیلم‌برداری",
                nominees: [
                    { name: "Roger Deakins", title: "1917", winner: true },
                    { name: "Rodrigo Prieto", title: "The Irishman", winner: false },
                    { name: "Lawrence Sher", title: "Joker", winner: false },
                    { name: "Jarin Blaschke", title: "The Lighthouse", winner: false },
                    { name: "Robert Richardson", title: "Once Upon a Time in Hollywood", winner: false }
                ]
            }
        ]
    },
    2019: {
        ceremony: 91,
        categories: [
            {
                name: "Best Picture",
                persianName: "بهترین فیلم",
                nominees: [
                    { title: "Green Book", winner: true },
                    { title: "Black Panther", winner: false },
                    { title: "BlacKkKlansman", winner: false },
                    { title: "Bohemian Rhapsody", winner: false },
                    { title: "The Favourite", winner: false },
                    { title: "Roma", winner: false },
                    { title: "A Star Is Born", winner: false },
                    { title: "Vice", winner: false }
                ]
            },
            {
                name: "Best Directing",
                persianName: "بهترین کارگردانی",
                nominees: [
                    { name: "Alfonso Cuarón", title: "Roma", winner: true },
                    { name: "Spike Lee", title: "BlacKkKlansman", winner: false },
                    { name: "Paweł Pawlikowski", title: "Cold War", winner: false },
                    { name: "Yorgos Lanthimos", title: "The Favourite", winner: false },
                    { name: "Adam McKay", title: "Vice", winner: false }
                ]
            },
            {
                name: "Best Actor in a Leading Role",
                persianName: "بهترین بازیگر نقش اول مرد",
                nominees: [
                    { name: "Rami Malek", title: "Bohemian Rhapsody", winner: true },
                    { name: "Christian Bale", title: "Vice", winner: false },
                    { name: "Bradley Cooper", title: "A Star Is Born", winner: false },
                    { name: "Willem Dafoe", title: "At Eternity's Gate", winner: false },
                    { name: "Viggo Mortensen", title: "Green Book", winner: false }
                ]
            },
            {
                name: "Best Actress in a Leading Role",
                persianName: "بهترین بازیگر نقش اول زن",
                nominees: [
                    { name: "Olivia Colman", title: "The Favourite", winner: true },
                    { name: "Yalitza Aparicio", title: "Roma", winner: false },
                    { name: "Glenn Close", title: "The Wife", winner: false },
                    { name: "Lady Gaga", title: "A Star Is Born", winner: false },
                    { name: "Melissa McCarthy", title: "Can You Ever Forgive Me?", winner: false }
                ]
            },
            {
                name: "Best Actor in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل مرد",
                nominees: [
                    { name: "Mahershala Ali", title: "Green Book", winner: true },
                    { name: "Adam Driver", title: "BlacKkKlansman", winner: false },
                    { name: "Sam Elliott", title: "A Star Is Born", winner: false },
                    { name: "Richard E. Grant", title: "Can You Ever Forgive Me?", winner: false },
                    { name: "Sam Rockwell", title: "Vice", winner: false }
                ]
            },
            {
                name: "Best Actress in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل زن",
                nominees: [
                    { name: "Regina King", title: "If Beale Street Could Talk", winner: true },
                    { name: "Amy Adams", title: "Vice", winner: false },
                    { name: "Marina de Tavira", title: "Roma", winner: false },
                    { name: "Emma Stone", title: "The Favourite", winner: false },
                    { name: "Rachel Weisz", title: "The Favourite", winner: false }
                ]
            },
            {
                name: "Best Animated Feature Film",
                persianName: "بهترین انیمیشن بلند",
                nominees: [
                    { title: "Spider-Man: Into the Spider-Verse", winner: true },
                    { title: "Incredibles 2", winner: false },
                    { title: "Isle of Dogs", winner: false },
                    { title: "Mirai", winner: false },
                    { title: "Ralph Breaks the Internet", winner: false }
                ]
            },
            {
                name: "Best International Feature Film",
                persianName: "بهترین فیلم بین‌المللی",
                nominees: [
                    { title: "Roma", winner: true },
                    { title: "Capernaum", winner: false },
                    { title: "Cold War", winner: false },
                    { title: "Never Look Away", winner: false },
                    { title: "Shoplifters", winner: false }
                ]
            },
            {
                name: "Best Original Score",
                persianName: "بهترین موسیقی متن اصلی",
                nominees: [
                    { name: "Ludwig Göransson", title: "Black Panther", winner: true },
                    { name: "Terence Blanchard", title: "BlacKkKlansman", winner: false },
                    { name: "Nicholas Britell", title: "If Beale Street Could Talk", winner: false },
                    { name: "Alexandre Desplat", title: "Isle of Dogs", winner: false },
                    { name: "Marc Shaiman", title: "Mary Poppins Returns", winner: false }
                ]
            },
            {
                name: "Best Cinematography",
                persianName: "بهترین فیلم‌برداری",
                nominees: [
                    { name: "Alfonso Cuarón", title: "Roma", winner: true },
                    { name: "Łukasz Żal", title: "Cold War", winner: false },
                    { name: "Robbie Ryan", title: "The Favourite", winner: false },
                    { name: "Caleb Deschanel", title: "Never Look Away", winner: false },
                    { name: "Matthew Libatique", title: "A Star Is Born", winner: false }
                ]
            }
        ]
    },
    2018: {
        ceremony: 90,
        categories: [
            {
                name: "Best Picture",
                persianName: "بهترین فیلم",
                nominees: [
                    { title: "The Shape of Water", winner: true },
                    { title: "Call Me by Your Name", winner: false },
                    { title: "Darkest Hour", winner: false },
                    { title: "Dunkirk", winner: false },
                    { title: "Get Out", winner: false },
                    { title: "Lady Bird", winner: false },
                    { title: "Phantom Thread", winner: false },
                    { title: "The Post", winner: false },
                    { title: "Three Billboards Outside Ebbing, Missouri", winner: false }
                ]
            },
            {
                name: "Best Directing",
                persianName: "بهترین کارگردانی",
                nominees: [
                    { name: "Guillermo del Toro", title: "The Shape of Water", winner: true },
                    { name: "Christopher Nolan", title: "Dunkirk", winner: false },
                    { name: "Jordan Peele", title: "Get Out", winner: false },
                    { name: "Greta Gerwig", title: "Lady Bird", winner: false },
                    { name: "Paul Thomas Anderson", title: "Phantom Thread", winner: false }
                ]
            },
            {
                name: "Best Actor in a Leading Role",
                persianName: "بهترین بازیگر نقش اول مرد",
                nominees: [
                    { name: "Gary Oldman", title: "Darkest Hour", winner: true },
                    { name: "Timothée Chalamet", title: "Call Me by Your Name", winner: false },
                    { name: "Daniel Day-Lewis", title: "Phantom Thread", winner: false },
                    { name: "Daniel Kaluuya", title: "Get Out", winner: false },
                    { name: "Denzel Washington", title: "Roman J. Israel, Esq.", winner: false }
                ]
            },
            {
                name: "Best Actress in a Leading Role",
                persianName: "بهترین بازیگر نقش اول زن",
                nominees: [
                    { name: "Frances McDormand", title: "Three Billboards Outside Ebbing, Missouri", winner: true },
                    { name: "Sally Hawkins", title: "The Shape of Water", winner: false },
                    { name: "Margot Robbie", title: "I, Tonya", winner: false },
                    { name: "Saoirse Ronan", title: "Lady Bird", winner: false },
                    { name: "Meryl Streep", title: "The Post", winner: false }
                ]
            },
            {
                name: "Best Actor in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل مرد",
                nominees: [
                    { name: "Sam Rockwell", title: "Three Billboards Outside Ebbing, Missouri", winner: true },
                    { name: "Willem Dafoe", title: "The Florida Project", winner: false },
                    { name: "Woody Harrelson", title: "Three Billboards Outside Ebbing, Missouri", winner: false },
                    { name: "Richard Jenkins", title: "The Shape of Water", winner: false },
                    { name: "Christopher Plummer", title: "All the Money in the World", winner: false }
                ]
            },
            {
                name: "Best Actress in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل زن",
                nominees: [
                    { name: "Allison Janney", title: "I, Tonya", winner: true },
                    { name: "Mary J. Blige", title: "Mudbound", winner: false },
                    { name: "Lesley Manville", title: "Phantom Thread", winner: false },
                    { name: "Laurie Metcalf", title: "Lady Bird", winner: false },
                    { name: "Octavia Spencer", title: "The Shape of Water", winner: false }
                ]
            },
            {
                name: "Best Animated Feature Film",
                persianName: "بهترین انیمیشن بلند",
                nominees: [
                    { title: "Coco", winner: true },
                    { title: "The Boss Baby", winner: false },
                    { title: "The Breadwinner", winner: false },
                    { title: "Ferdinand", winner: false },
                    { title: "Loving Vincent", winner: false }
                ]
            },
            {
                name: "Best International Feature Film",
                persianName: "بهترین فیلم بین‌المللی",
                nominees: [
                    { title: "A Fantastic Woman", winner: true },
                    { title: "The Insult", winner: false },
                    { title: "Loveless", winner: false },
                    { title: "On Body and Soul", winner: false },
                    { title: "The Square", winner: false }
                ]
            },
            {
                name: "Best Original Score",
                persianName: "بهترین موسیقی متن اصلی",
                nominees: [
                    { name: "Alexandre Desplat", title: "The Shape of Water", winner: true },
                    { name: "Hans Zimmer", title: "Dunkirk", winner: false },
                    { name: "Jonny Greenwood", title: "Phantom Thread", winner: false },
                    { name: "John Williams", title: "Star Wars: The Last Jedi", winner: false },
                    { name: "Carter Burwell", title: "Three Billboards Outside Ebbing, Missouri", winner: false }
                ]
            },
            {
                name: "Best Cinematography",
                persianName: "بهترین فیلم‌برداری",
                nominees: [
                    { name: "Roger Deakins", title: "Blade Runner 2049", winner: true },
                    { name: "Bruno Delbonnel", title: "Darkest Hour", winner: false },
                    { name: "Hoyte van Hoytema", title: "Dunkirk", winner: false },
                    { name: "Dan Laustsen", title: "The Shape of Water", winner: false },
                    { name: "Rachel Morrison", title: "Mudbound", winner: false }
                ]
            }
        ]
    },
    2017: {
        ceremony: 89,
        categories: [
            {
                name: "Best Picture",
                persianName: "بهترین فیلم",
                nominees: [
                    { title: "Moonlight", winner: true },
                    { title: "Arrival", winner: false },
                    { title: "Fences", winner: false },
                    { title: "Hacksaw Ridge", winner: false },
                    { title: "Hell or High Water", winner: false },
                    { title: "Hidden Figures", winner: false },
                    { title: "La La Land", winner: false },
                    { title: "Lion", winner: false },
                    { title: "Manchester by the Sea", winner: false }
                ]
            },
            {
                name: "Best Directing",
                persianName: "بهترین کارگردانی",
                nominees: [
                    { name: "Damien Chazelle", title: "La La Land", winner: true },
                    { name: "Denis Villeneuve", title: "Arrival", winner: false },
                    { name: "Mel Gibson", title: "Hacksaw Ridge", winner: false },
                    { name: "Kenneth Lonergan", title: "Manchester by the Sea", winner: false },
                    { name: "Barry Jenkins", title: "Moonlight", winner: false }
                ]
            },
            {
                name: "Best Actor in a Leading Role",
                persianName: "بهترین بازیگر نقش اول مرد",
                nominees: [
                    { name: "Casey Affleck", title: "Manchester by the Sea", winner: true },
                    { name: "Andrew Garfield", title: "Hacksaw Ridge", winner: false },
                    { name: "Ryan Gosling", title: "La La Land", winner: false },
                    { name: "Viggo Mortensen", title: "Captain Fantastic", winner: false },
                    { name: "Denzel Washington", title: "Fences", winner: false }
                ]
            },
            {
                name: "Best Actress in a Leading Role",
                persianName: "بهترین بازیگر نقش اول زن",
                nominees: [
                    { name: "Emma Stone", title: "La La Land", winner: true },
                    { name: "Isabelle Huppert", title: "Elle", winner: false },
                    { name: "Ruth Negga", title: "Loving", winner: false },
                    { name: "Natalie Portman", title: "Jackie", winner: false },
                    { name: "Meryl Streep", title: "Florence Foster Jenkins", winner: false }
                ]
            },
            {
                name: "Best Actor in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل مرد",
                nominees: [
                    { name: "Mahershala Ali", title: "Moonlight", winner: true },
                    { name: "Jeff Bridges", title: "Hell or High Water", winner: false },
                    { name: "Lucas Hedges", title: "Manchester by the Sea", winner: false },
                    { name: "Dev Patel", title: "Lion", winner: false },
                    { name: "Michael Shannon", title: "Nocturnal Animals", winner: false }
                ]
            },
            {
                name: "Best Actress in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل زن",
                nominees: [
                    { name: "Viola Davis", title: "Fences", winner: true },
                    { name: "Naomie Harris", title: "Moonlight", winner: false },
                    { name: "Nicole Kidman", title: "Lion", winner: false },
                    { name: "Octavia Spencer", title: "Hidden Figures", winner: false },
                    { name: "Michelle Williams", title: "Manchester by the Sea", winner: false }
                ]
            },
            {
                name: "Best Animated Feature Film",
                persianName: "بهترین انیمیشن بلند",
                nominees: [
                    { title: "Zootopia", winner: true },
                    { title: "Kubo and the Two Strings", winner: false },
                    { title: "Moana", winner: false },
                    { title: "My Life as a Zucchini", winner: false },
                    { title: "The Red Turtle", winner: false }
                ]
            },
            {
                name: "Best International Feature Film",
                persianName: "بهترین فیلم بین‌المللی",
                nominees: [
                    { title: "The Salesman", winner: true },
                    { title: "Land of Mine", winner: false },
                    { title: "A Man Called Ove", winner: false },
                    { title: "Tanna", winner: false },
                    { title: "Toni Erdmann", winner: false }
                ]
            },
            {
                name: "Best Original Score",
                persianName: "بهترین موسیقی متن اصلی",
                nominees: [
                    { name: "Justin Hurwitz", title: "La La Land", winner: true },
                    { name: "Mica Levi", title: "Jackie", winner: false },
                    { name: "Dustin O'Halloran, Hauschka", title: "Lion", winner: false },
                    { name: "Nicholas Britell", title: "Moonlight", winner: false },
                    { name: "Thomas Newman", title: "Passengers", winner: false }
                ]
            },
            {
                name: "Best Cinematography",
                persianName: "بهترین فیلم‌برداری",
                nominees: [
                    { name: "Linus Sandgren", title: "La La Land", winner: true },
                    { name: "Bradford Young", title: "Arrival", winner: false },
                    { name: "James Laxton", title: "Moonlight", winner: false },
                    { name: "Rodrigo Prieto", title: "Silence", winner: false },
                    { name: "Giles Nuttgens", title: "Hell or High Water", winner: false }
                ]
            }
        ]
    },
    2016: {
        ceremony: 88,
        categories: [
            {
                name: "Best Picture",
                persianName: "بهترین فیلم",
                nominees: [
                    { title: "Spotlight", winner: true },
                    { title: "The Big Short", winner: false },
                    { title: "Bridge of Spies", winner: false },
                    { title: "Brooklyn", winner: false },
                    { title: "Mad Max: Fury Road", winner: false },
                    { title: "The Martian", winner: false },
                    { title: "The Revenant", winner: false },
                    { title: "Room", winner: false }
                ]
            },
            {
                name: "Best Directing",
                persianName: "بهترین کارگردانی",
                nominees: [
                    { name: "Alejandro G. Iñárritu", title: "The Revenant", winner: true },
                    { name: "Adam McKay", title: "The Big Short", winner: false },
                    { name: "George Miller", title: "Mad Max: Fury Road", winner: false },
                    { name: "Lenny Abrahamson", title: "Room", winner: false },
                    { name: "Tom McCarthy", title: "Spotlight", winner: false }
                ]
            },
            {
                name: "Best Actor in a Leading Role",
                persianName: "بهترین بازیگر نقش اول مرد",
                nominees: [
                    { name: "Leonardo DiCaprio", title: "The Revenant", winner: true },
                    { name: "Bryan Cranston", title: "Trumbo", winner: false },
                    { name: "Matt Damon", title: "The Martian", winner: false },
                    { name: "Michael Fassbender", title: "Steve Jobs", winner: false },
                    { name: "Eddie Redmayne", title: "The Danish Girl", winner: false }
                ]
            },
            {
                name: "Best Actress in a Leading Role",
                persianName: "بهترین بازیگر نقش اول زن",
                nominees: [
                    { name: "Brie Larson", title: "Room", winner: true },
                    { name: "Cate Blanchett", title: "Carol", winner: false },
                    { name: "Jennifer Lawrence", title: "Joy", winner: false },
                    { name: "Charlotte Rampling", title: "45 Years", winner: false },
                    { name: "Saoirse Ronan", title: "Brooklyn", winner: false }
                ]
            },
            {
                name: "Best Actor in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل مرد",
                nominees: [
                    { name: "Mark Rylance", title: "Bridge of Spies", winner: true },
                    { name: "Christian Bale", title: "The Big Short", winner: false },
                    { name: "Tom Hardy", title: "The Revenant", winner: false },
                    { name: "Mark Ruffalo", title: "Spotlight", winner: false },
                    { name: "Sylvester Stallone", title: "Creed", winner: false }
                ]
            },
            {
                name: "Best Actress in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل زن",
                nominees: [
                    { name: "Alicia Vikander", title: "The Danish Girl", winner: true },
                    { name: "Jennifer Jason Leigh", title: "The Hateful Eight", winner: false },
                    { name: "Rooney Mara", title: "Carol", winner: false },
                    { name: "Rachel McAdams", title: "Spotlight", winner: false },
                    { name: "Kate Winslet", title: "Steve Jobs", winner: false }
                ]
            },
            {
                name: "Best Animated Feature Film",
                persianName: "بهترین انیمیشن بلند",
                nominees: [
                    { title: "Inside Out", winner: true },
                    { title: "Anomalisa", winner: false },
                    { title: "Boy and the World", winner: false },
                    { title: "Shaun the Sheep Movie", winner: false },
                    { title: "When Marnie Was There", winner: false }
                ]
            },
            {
                name: "Best International Feature Film",
                persianName: "بهترین فیلم بین‌المللی",
                nominees: [
                    { title: "Son of Saul", winner: true },
                    { title: "Embrace of the Serpent", winner: false },
                    { title: "Mustang", winner: false },
                    { title: "Theeb", winner: false },
                    { title: "A War", winner: false }
                ]
            },
            {
                name: "Best Original Score",
                persianName: "بهترین موسیقی متن اصلی",
                nominees: [
                    { name: "Ennio Morricone", title: "The Hateful Eight", winner: true },
                    { name: "Thomas Newman", title: "Bridge of Spies", winner: false },
                    { name: "Carter Burwell", title: "Carol", winner: false },
                    { name: "Jóhann Jóhannsson", title: "Sicario", winner: false },
                    { name: "John Williams", title: "Star Wars: The Force Awakens", winner: false }
                ]
            },
            {
                name: "Best Cinematography",
                persianName: "بهترین فیلم‌برداری",
                nominees: [
                    { name: "Emmanuel Lubezki", title: "The Revenant", winner: true },
                    { name: "Edward Lachman", title: "Carol", winner: false },
                    { name: "Robert Richardson", title: "The Hateful Eight", winner: false },
                    { name: "John Seale", title: "Mad Max: Fury Road", winner: false },
                    { name: "Roger Deakins", title: "Sicario", winner: false }
                ]
            }
        ]
    },
    2015: {
        ceremony: 87,
        categories: [
            {
                name: "Best Picture",
                persianName: "بهترین فیلم",
                nominees: [
                    { title: "Birdman", winner: true },
                    { title: "American Sniper", winner: false },
                    { title: "Boyhood", winner: false },
                    { title: "The Grand Budapest Hotel", winner: false },
                    { title: "The Imitation Game", winner: false },
                    { title: "Selma", winner: false },
                    { title: "The Theory of Everything", winner: false },
                    { title: "Whiplash", winner: false }
                ]
            },
            {
                name: "Best Directing",
                persianName: "بهترین کارگردانی",
                nominees: [
                    { name: "Alejandro G. Iñárritu", title: "Birdman", winner: true },
                    { name: "Richard Linklater", title: "Boyhood", winner: false },
                    { name: "Bennett Miller", title: "Foxcatcher", winner: false },
                    { name: "Wes Anderson", title: "The Grand Budapest Hotel", winner: false },
                    { name: "Morten Tyldum", title: "The Imitation Game", winner: false }
                ]
            },
            {
                name: "Best Actor in a Leading Role",
                persianName: "بهترین بازیگر نقش اول مرد",
                nominees: [
                    { name: "Eddie Redmayne", title: "The Theory of Everything", winner: true },
                    { name: "Steve Carell", title: "Foxcatcher", winner: false },
                    { name: "Bradley Cooper", title: "American Sniper", winner: false },
                    { name: "Benedict Cumberbatch", title: "The Imitation Game", winner: false },
                    { name: "Michael Keaton", title: "Birdman", winner: false }
                ]
            },
            {
                name: "Best Actress in a Leading Role",
                persianName: "بهترین بازیگر نقش اول زن",
                nominees: [
                    { name: "Julianne Moore", title: "Still Alice", winner: true },
                    { name: "Marion Cotillard", title: "Two Days, One Night", winner: false },
                    { name: "Felicity Jones", title: "The Theory of Everything", winner: false },
                    { name: "Rosamund Pike", title: "Gone Girl", winner: false },
                    { name: "Reese Witherspoon", title: "Wild", winner: false }
                ]
            },
            {
                name: "Best Actor in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل مرد",
                nominees: [
                    { name: "J.K. Simmons", title: "Whiplash", winner: true },
                    { name: "Robert Duvall", title: "The Judge", winner: false },
                    { name: "Ethan Hawke", title: "Boyhood", winner: false },
                    { name: "Edward Norton", title: "Birdman", winner: false },
                    { name: "Mark Ruffalo", title: "Foxcatcher", winner: false }
                ]
            },
            {
                name: "Best Actress in a Supporting Role",
                persianName: "بهترین بازیگر نقش مکمل زن",
                nominees: [
                    { name: "Patricia Arquette", title: "Boyhood", winner: true },
                    { name: "Laura Dern", title: "Wild", winner: false },
                    { name: "Keira Knightley", title: "The Imitation Game", winner: false },
                    { name: "Emma Stone", title: "Birdman", winner: false },
                    { name: "Meryl Streep", title: "Into the Woods", winner: false }
                ]
            },
            {
                name: "Best Animated Feature Film",
                persianName: "بهترین انیمیشن بلند",
                nominees: [
                    { title: "Big Hero 6", winner: true },
                    { title: "The Boxtrolls", winner: false },
                    { title: "How to Train Your Dragon 2", winner: false },
                    { title: "Song of the Sea", winner: false },
                    { title: "The Tale of the Princess Kaguya", winner: false }
                ]
            },
            {
                name: "Best International Feature Film",
                persianName: "بهترین فیلم بین‌المللی",
                nominees: [
                    { title: "Ida", winner: true },
                    { title: "Leviathan", winner: false },
                    { title: "Tangerines", winner: false },
                    { title: "Timbuktu", winner: false },
                    { title: "Wild Tales", winner: false }
                ]
            },
            {
                name: "Best Original Score",
                persianName: "بهترین موسیقی متن اصلی",
                nominees: [
                    { name: "Alexandre Desplat", title: "The Grand Budapest Hotel", winner: true },
                    { name: "Jóhann Jóhannsson", title: "Theory of Everything", winner: false },
                    { name: "Hans Zimmer", title: "Interstellar", winner: false },
                    { name: "Gary Yershon", title: "Mr. Turner", winner: false },
                    { name: "Alexandre Desplat", title: "The Imitation Game", winner: false }
                ]
            },
            {
                name: "Best Cinematography",
                persianName: "بهترین فیلم‌برداری",
                nominees: [
                    { name: "Emmanuel Lubezki", title: "Birdman", winner: true },
                    { name: "Robert Yeoman", title: "The Grand Budapest Hotel", winner: false },
                    { name: "Lukasz Zal", title: "Ida", winner: false },
                    { name: "Dick Pope", title: "Mr. Turner", winner: false },
                    { name: "Roger Deakins", title: "Unbroken", winner: false }
                ]
            }
        ]
    }
};

const BP_WINNERS = {
    2014: "12 Years a Slave",
    2013: "Argo",
    2012: "The Artist",
    2011: "The King's Speech",
    2010: "The Hurt Locker",
    2009: "Slumdog Millionaire",
    2008: "No Country for Old Men",
    2007: "The Departed",
    2006: "Crash",
    2005: "Million Dollar Baby",
    2004: "The Lord of the Rings: The Return of the King",
    2003: "Chicago",
    2002: "A Beautiful Mind",
    2001: "Gladiator",
    2000: "American Beauty",
    1999: "Shakespeare in Love",
    1998: "Titanic",
    1997: "The English Patient",
    1996: "Braveheart",
    1995: "Forrest Gump",
    1994: "Schindler's List",
    1993: "Unforgiven",
    1992: "The Silence of the Lambs",
    1991: "Dances with Wolves",
    1990: "Driving Miss Daisy",
    1989: "Rain Man",
    1988: "The Last Emperor",
    1987: "Platoon",
    1986: "Out of Africa",
    1985: "Amadeus",
    1984: "Terms of Endearment",
    1983: "Gandhi",
    1982: "Chariots of Fire",
    1981: "Ordinary People",
    1980: "Kramer vs. Kramer",
    1979: "The Deer Hunter",
    1978: "Annie Hall",
    1977: "Rocky",
    1976: "One Flew Over the Cuckoo's Nest",
    1975: "The Godfather Part II",
    1974: "The Sting",
    1973: "The Godfather",
    1972: "The French Connection",
    1971: "Patton",
    1970: "Midnight Cowboy",
    1969: "Oliver!",
    1968: "In the Heat of the Night",
    1967: "A Man for All Seasons",
    1966: "The Sound of Music",
    1965: "My Fair Lady",
    1964: "Tom Jones",
    1963: "Lawrence of Arabia",
    1962: "West Side Story",
    1961: "The Apartment",
    1960: "Ben-Hur",
    1959: "Gigi",
    1958: "The Bridge on the River Kwai",
    1957: "Around the World in 80 Days",
    1956: "Marty",
    1955: "On the Waterfront",
    1954: "From Here to Eternity",
    1953: "The Greatest Show on Earth",
    1952: "An American in Paris",
    1951: "All About Eve",
    1950: "All the King's Men",
    1949: "Hamlet",
    1948: "Hamlet",
    1947: "Gentleman's Agreement",
    1946: "The Best Years of Our Lives",
    1945: "The Lost Weekend",
    1944: "Going My Way",
    1943: "Casablanca",
    1942: "Mrs. Miniver",
    1941: "How Green Was My Valley",
    1940: "Rebecca",
    1939: "Gone with the Wind",
    1938: "You Can't Take It with You",
    1937: "The Life of Emile Zola",
    1936: "The Great Ziegfeld",
    1935: "Mutiny on the Bounty",
    1934: "It Happened One Night",
    1933: "Cavalcade",
    1932: "Grand Hotel",
    1931: "Cimarron",
    1930: "All Quiet on the Western Front",
    1929: "The Broadway Melody",
    1928: "Wings"
};

const DIR_WINNERS = {
    2014: { name: "Alfonso Cuarón", title: "Gravity" },
    2013: { name: "Ang Lee", title: "Life of Pi" },
    2012: { name: "Michel Hazanavicius", title: "The Artist" },
    2011: { name: "Tom Hooper", title: "The King's Speech" },
    2010: { name: "Kathryn Bigelow", title: "The Hurt Locker" },
    2009: { name: "Danny Boyle", title: "Slumdog Millionaire" },
    2008: { name: "Joel Coen & Ethan Coen", title: "No Country for Old Men" },
    2007: { name: "Martin Scorsese", title: "The Departed" },
    2006: { name: "Ang Lee", title: "Brokeback Mountain" },
    2005: { name: "Clint Eastwood", title: "Million Dollar Baby" },
    2004: { name: "Peter Jackson", title: "The Lord of the Rings: The Return of the King" },
    2003: { name: "Roman Polanski", title: "The Pianist" },
    2002: { name: "Ron Howard", title: "A Beautiful Mind" },
    2001: { name: "Steven Soderbergh", title: "Traffic" },
    2000: { name: "Sam Mendes", title: "American Beauty" },
    1999: { name: "Steven Spielberg", title: "Saving Private Ryan" },
    1998: { name: "James Cameron", title: "Titanic" },
    1997: { name: "Anthony Minghella", title: "The English Patient" },
    1996: { name: "Mel Gibson", title: "Braveheart" },
    1995: { name: "Robert Zemeckis", title: "Forrest Gump" },
    1994: { name: "Steven Spielberg", title: "Schindler's List" },
    1993: { name: "Clint Eastwood", title: "Unforgiven" },
    1992: { name: "Jonathan Demme", title: "The Silence of the Lambs" },
    1991: { name: "Kevin Costner", title: "Dances with Wolves" },
    1990: { name: "Oliver Stone", title: "Born on the Fourth of July" },
    1989: { name: "Barry Levinson", title: "Rain Man" },
    1988: { name: "Bernardo Bertolucci", title: "The Last Emperor" },
    1987: { name: "Oliver Stone", title: "Platoon" },
    1986: { name: "Sydney Pollack", title: "Out of Africa" },
    1985: { name: "Milos Forman", title: "Amadeus" },
    1984: { name: "James L. Brooks", title: "Terms of Endearment" },
    1983: { name: "Richard Attenborough", title: "Gandhi" },
    1982: { name: "Warren Beatty", title: "Reds" },
    1981: { name: "Robert Redford", title: "Ordinary People" },
    1980: { name: "Robert Benton", title: "Kramer vs. Kramer" }
};

const ACTOR_WINNERS = {
    2014: { name: "Matthew McConaughey", title: "Dallas Buyers Club" },
    2013: { name: "Daniel Day-Lewis", title: "Lincoln" },
    2012: { name: "Jean Dujardin", title: "The Artist" },
    2011: { name: "Colin Firth", title: "The King's Speech" },
    2010: { name: "Jeff Bridges", title: "Crazy Heart" },
    2009: { name: "Sean Penn", title: "Milk" },
    2008: { name: "Daniel Day-Lewis", title: "There Will Be Blood" },
    2007: { name: "Forest Whitaker", title: "The Last King of Scotland" },
    2006: { name: "Philip Seymour Hoffman", title: "Capote" },
    2005: { name: "Jamie Foxx", title: "Ray" },
    2004: { name: "Sean Penn", title: "Mystic River" },
    2003: { name: "Adrien Brody", title: "The Pianist" },
    2002: { name: "Denzel Washington", title: "Training Day" },
    2001: { name: "Russell Crowe", title: "Gladiator" },
    2000: { name: "Kevin Spacey", title: "American Beauty" },
    1999: { name: "Roberto Benigni", title: "Life Is Beautiful" },
    1998: { name: "Jack Nicholson", title: "As Good as It Gets" },
    1997: { name: "Geoffrey Rush", title: "Shine" },
    1996: { name: "Nicolas Cage", title: "Leaving Las Vegas" },
    1995: { name: "Tom Hanks", title: "Forrest Gump" },
    1994: { name: "Tom Hanks", title: "Philadelphia" },
    1993: { name: "Al Pacino", title: "Scent of a Woman" },
    1992: { name: "Anthony Hopkins", title: "The Silence of the Lambs" },
    1991: { name: "Jeremy Irons", title: "Reversal of Fortune" },
    1990: { name: "Daniel Day-Lewis", title: "My Left Foot" },
    1989: { name: "Dustin Hoffman", title: "Rain Man" },
    1988: { name: "Michael Douglas", title: "Wall Street" },
    1987: { name: "Paul Newman", title: "The Color of Money" },
    1986: { name: "William Hurt", title: "Kiss of the Spider Woman" },
    1985: { name: "F. Murray Abraham", title: "Amadeus" },
    1984: { name: "Robert Duvall", title: "Tender Mercies" },
    1983: { name: "Ben Kingsley", title: "Gandhi" },
    1982: { name: "Henry Fonda", title: "On Golden Pond" },
    1981: { name: "Robert De Niro", title: "Raging Bull" },
    1980: { name: "Dustin Hoffman", title: "Kramer vs. Kramer" }
};

const ACTRESS_WINNERS = {
    2014: { name: "Cate Blanchett", title: "Blue Jasmine" },
    2013: { name: "Jennifer Lawrence", title: "Silver Linings Playbook" },
    2012: { name: "Meryl Streep", title: "The Iron Lady" },
    2011: { name: "Natalie Portman", title: "Black Swan" },
    2010: { name: "Sandra Bullock", title: "The Blind Side" },
    2009: { name: "Kate Winslet", title: "The Reader" },
    2008: { name: "Marion Cotillard", title: "La Vie en Rose" },
    2007: { name: "Helen Mirren", title: "The Queen" },
    2006: { name: "Reese Witherspoon", title: "Walk the Line" },
    2005: { name: "Hilary Swank", title: "Million Dollar Baby" },
    2004: { name: "Charlize Theron", title: "Monster" },
    2003: { name: "Nicole Kidman", title: "The Hours" },
    2002: { name: "Halle Berry", title: "Monster's Ball" },
    2001: { name: "Julia Roberts", title: "Erin Brockovich" },
    2000: { name: "Hilary Swank", title: "Boys Don't Cry" },
    1999: { name: "Gwyneth Paltrow", title: "Shakespeare in Love" },
    1998: { name: "Helen Hunt", title: "As Good as It Gets" },
    1997: { name: "Frances McDormand", title: "Fargo" },
    1996: { name: "Susan Sarandon", title: "Dead Man Walking" },
    1995: { name: "Jessica Lange", title: "Blue Sky" },
    1994: { name: "Holly Hunter", title: "The Piano" },
    1993: { name: "Emma Thompson", title: "Howards End" },
    1992: { name: "Jodie Foster", title: "The Silence of the Lambs" },
    1991: { name: "Kathy Bates", title: "Misery" },
    1990: { name: "Jessica Tandy", title: "Driving Miss Daisy" },
    1989: { name: "Jodie Foster", title: "The Accused" },
    1988: { name: "Cher", title: "Moonstruck" },
    1987: { name: "Marlee Matlin", title: "Children of a Lesser God" },
    1986: { name: "Geraldine Page", title: "The Trip to Bountiful" },
    1985: { name: "Sally Field", title: "Places in the Heart" },
    1984: { name: "Shirley MacLaine", title: "Terms of Endearment" },
    1983: { name: "Meryl Streep", title: "Sophie's Choice" },
    1982: { name: "Katharine Hepburn", title: "On Golden Pond" },
    1981: { name: "Sissy Spacek", title: "Coal Miner's Daughter" },
    1980: { name: "Sally Field", title: "Norma Rae" }
};

// سال‌های ۱۹۸۰ تا ۲۰۱۴ که فقط برنده‌ها (بدون کاندیداهای دیگر) ثبت شده‌اند
// با داده‌های بالا ترکیب می‌شوند تا OSCAR_DATA نهایی ساخته شود.
export function buildOscarData() {
  const data = JSON.parse(JSON.stringify(OSCAR_DATA))

  for (const year in BP_WINNERS) {
    if (!data[year]) {
      const ceremonyNum = 98 - (2026 - parseInt(year))
      data[year] = {
        ceremony: ceremonyNum,
        categories: [
          {
            name: 'Best Picture',
            persianName: 'بهترین فیلم',
            nominees: [{ title: BP_WINNERS[year], winner: true }],
          },
        ],
      }
    }
  }

  for (let y = 1980; y <= 2014; y++) {
    if (data[y]) {
      if (DIR_WINNERS[y]) {
        data[y].categories.push({
          name: 'Best Directing',
          persianName: 'بهترین کارگردانی',
          nominees: [{ name: DIR_WINNERS[y].name, title: DIR_WINNERS[y].title, winner: true }],
        })
      }
      if (ACTOR_WINNERS[y]) {
        data[y].categories.push({
          name: 'Best Actor in a Leading Role',
          persianName: 'بهترین بازیگر نقش اول مرد',
          nominees: [{ name: ACTOR_WINNERS[y].name, title: ACTOR_WINNERS[y].title, winner: true }],
        })
      }
      if (ACTRESS_WINNERS[y]) {
        data[y].categories.push({
          name: 'Best Actress in a Leading Role',
          persianName: 'بهترین بازیگر نقش اول زن',
          nominees: [{ name: ACTRESS_WINNERS[y].name, title: ACTRESS_WINNERS[y].title, winner: true }],
        })
      }
    }
  }

  return data
}
