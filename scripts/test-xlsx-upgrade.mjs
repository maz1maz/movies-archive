// Temporary verification script for xlsx 0.18.5 -> 0.20.3 upgrade.
// Exercises every XLSX API used by server/index.js, server/worker.js and
// server/make-template.js. Safe to delete after the upgrade is validated.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
let failures = 0

function check(name, fn) {
  try {
    fn()
    console.log('PASS:', name)
  } catch (err) {
    failures++
    console.error('FAIL:', name, '-', err.message)
  }
}

// 1. server/index.js import endpoint: read(buffer) + sheet_to_json
check('XLSX.read(buffer) + utils.sheet_to_json on my-films.xlsx', () => {
  const buf = fs.readFileSync(path.join(root, 'my-films.xlsx'))
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  if (!Array.isArray(rows) || !rows.length) throw new Error('no rows parsed')
  console.log('   parsed', rows.length, 'rows; first title:', rows[0].Title ?? rows[0].title ?? '(none)')
})

// 2. server/index.js template/export: aoa_to_sheet + book_new + write(buffer)
check('XLSX.utils.aoa_to_sheet/json_to_sheet + write(type:buffer)', () => {
  const ws = XLSX.utils.aoa_to_sheet([['Title', 'Shelf'], ['Example', 'A']])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Films')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: false })
  if (!Buffer.isBuffer(buf) || buf.length < 100) throw new Error('bad buffer output')

  const ws2 = XLSX.utils.json_to_sheet([{ Title: 'X', Shelf: 'B' }])
  const wb2 = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb2, ws2, 'Film Archive')
  const buf2 = XLSX.write(wb2, { type: 'buffer', bookType: 'xlsx', compression: false })
  if (!Buffer.isBuffer(buf2) || buf2.length < 100) throw new Error('bad json_to_sheet output')
})

// 3. server/worker.js: write(type:array) + read(type:array)
check('XLSX.write(type:array) + XLSX.read(type:array) roundtrip', () => {
  const ws = XLSX.utils.aoa_to_sheet([['Title'], ['Roundtrip']])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Films')
  const arr = XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: false })
  const wb2 = XLSX.read(arr, { type: 'array' })
  const rows = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { defval: '' })
  if (rows.length !== 1 || rows[0].Title !== 'Roundtrip') throw new Error('roundtrip mismatch: ' + JSON.stringify(rows))
})

// 4. server/make-template.js: set_fs + writeFile + readFile
check('XLSX.set_fs(fs) + writeFile + readFile roundtrip', () => {
  XLSX.set_fs(fs)
  const tmp = path.join(root, '.tmp-xlsx-upgrade-test.xlsx')
  const ws = XLSX.utils.aoa_to_sheet([['Title'], ['DiskWrite']])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Films')
  XLSX.writeFile(wb, tmp)
  const back = XLSX.readFile(tmp)
  const rows = XLSX.utils.sheet_to_json(back.Sheets[back.SheetNames[0]], { defval: '' })
  fs.unlinkSync(tmp)
  if (rows.length !== 1 || rows[0].Title !== 'DiskWrite') throw new Error('disk roundtrip mismatch')
})

if (failures) {
  console.error(`\n${failures} test(s) FAILED`)
  process.exit(1)
}
console.log('\nAll xlsx 0.20.3 API tests passed')
