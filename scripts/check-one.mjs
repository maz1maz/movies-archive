import { execSync } from 'node:child_process'
const NPX_CMD = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const sql = "SELECT id, title, mediaType, driveNumber, closet, row, shelf, copies FROM films WHERE title = 'Blood and Sand' AND year = 1941;"
const quoted = '"' + sql.replace(/"/g, '""') + '"'
const cmd = `${NPX_CMD} wrangler d1 execute movies-archive --remote --json --command ${quoted}`
const out = execSync(cmd, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 50, env: { ...process.env, CI: '1' } })
console.log(out)
