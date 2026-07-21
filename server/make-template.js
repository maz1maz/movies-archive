// Generate a ready-to-fill Excel template in the project root (for quick download)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ws = XLSX.utils.aoa_to_sheet([
  [
    'Title',
    'Shelf',
    'Row',
    'Format',
    'Watched',
    'Director',
    'Cast',
    'Year',
    'Genre',
    'Rating',
    'Runtime',
    'Country',
    'Studio',
    'MPA Rating',
    'Synopsis',
    'Poster URL',
    'Original Title',
  ],
  [
    'Example: The Godfather',
    'A',
    '3',
    '4K UHD',
    'No',
    'Francis Ford Coppola',
    'Marlon Brando, Al Pacino',
    '1972',
    'Crime, Drama',
    '9.2',
    '175',
    'USA',
    'Paramount Pictures',
    'R',
    'Story of the Corleone crime family',
    'https://example.com/poster.jpg',
    'The Godfather',
  ],
])
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Films')
const out = path.join(__dirname, '..', 'film-archive-template.xlsx')
XLSX.writeFile(wb, out)
console.log('Template created:', out)
