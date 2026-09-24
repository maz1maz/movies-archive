import { parseFilmRow } from './filmsDb.js'

// هشدار خطای سرور از طریق تلگرام — اگه TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID
// (هر دو wrangler secret) ست نشده باشن، بی‌سروصدا رد می‌شه. برای گرفتن این دوتا:
//   ۱) با @BotFather تو تلگرام یه بات بساز، توکنش رو بگیر (TELEGRAM_BOT_TOKEN)
//   ۲) به بات پیام بده، بعد https://api.telegram.org/bot<TOKEN>/getUpdates رو باز کن
//      و chat.id رو از جواب JSON بردار (TELEGRAM_CHAT_ID)
export async function notifyServerError(env, message) {
  const token = env.TELEGRAM_BOT_TOKEN
  const chatId = env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `🎬 Cinefilm Archive — خطای سرور:\n${message}`,
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => {})
}


// هر روز ساعت ۴ بامداد UTC (یه ساعت بعد از enrichment) کل جدول films رو به‌صورت
// JSON در KV ذخیره می‌کنه؛ کلید بر اساس تاریخ ساخته می‌شه (backup:YYYY-MM-DD) تا
// تاریخچه‌ی روزانه حفظ بشه. بکاپ‌های قدیمی‌تر از ۳۰ روز خودکار پاک می‌شن تا فضای
// KV پر نشه. یه کلید ثابت "backup:latest" هم برای دسترسی سریع نگه داشته می‌شه.
//
// علاوه بر KV (که هر دو رو Cloudflare نگه می‌داره)، یه کپی هم رو GitHub push
// می‌شه (backups/latest-backup.json تو همون repo) تا اگه یه روز خود اکانت
// Cloudflare مشکل پیدا کرد (هک/تعلیق/حذف اشتباه)، یه نسخه‌ی کاملاً جدا هم
// وجود داشته باشه. این بخش نیاز به GITHUB_BACKUP_TOKEN داره (wrangler secret)؛
// اگه ست نشده باشه، فقط رد می‌شه و بکاپ KV طبق معمول انجام می‌شه.
export async function runDailyBackup(env) {
  const db = env.DB
  const result = await db
    .prepare(`SELECT * FROM films ORDER BY (CASE WHEN LOWER(title) LIKE 'the %' THEN SUBSTR(title, 5) ELSE title END) COLLATE NOCASE ASC`)
    .all()
  const films = (result.results || []).map(parseFilmRow)
  const payload = JSON.stringify({ backedUpAt: new Date().toISOString(), count: films.length, films })

  const dateKey = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  // KV محدودیت ۲۵ مگابایتی داره؛ دیتای films دیگه از این حد رد شده، پس قبل از
  // ذخیره gzip می‌کنیم. GET /api/backups/:date موقع خوندن decompress می‌کنه.
  const compressed = await gzipText(payload)
  await env.BACKUPS.put(`backup:${dateKey}`, compressed)
  await env.BACKUPS.put('backup:latest', compressed)

  // پاکسازی بکاپ‌های قدیمی‌تر از ۳۰ روز
  const list = await env.BACKUPS.list({ prefix: 'backup:' })
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  for (const key of list.keys) {
    const m = key.name.match(/^backup:(\d{4}-\d{2}-\d{2})$/)
    if (!m) continue
    const keyDate = new Date(m[1] + 'T00:00:00Z').getTime()
    if (keyDate < cutoff) {
      await env.BACKUPS.delete(key.name)
    }
  }

  console.log(`Daily backup: saved ${films.length} films as backup:${dateKey} (${compressed.byteLength} bytes gzipped)`)

  try {
    await pushBackupToGitHub(env, compressed, dateKey)
  } catch (e) {
    console.log(`GitHub backup skipped/failed: ${e.message}`)
  }
}


// gzip یه رشته و برگردوندن Uint8Array — برای دور زدن محدودیت ۲۵ مگابایتی KV
// و کوچیک نگه‌داشتن فایل قبل از push به GitHub.
export async function gzipText(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}


// عکس gzipText — یه Uint8Array/ArrayBuffer فشرده رو به رشته‌ی اصلی برمی‌گردونه.
export async function gunzipToText(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(stream).text()
}


// بکاپ روزانه (فشرده‌شده با gzip) رو به‌صورت یه فایل ثابت
// (backups/latest-backup.json.gz) تو repo خود پروژه commit می‌کنه — هر بار
// overwrite می‌شه، تا تاریخچه‌ی git بی‌جهت پر نشه. چون فایل چند مگابایته و
// GitHub Contents API فقط تا ۱ مگابایت جواب می‌ده، از Git Data API
// (blob → tree → commit → update ref) استفاده می‌کنیم که تا ۱۰۰ مگابایت رو
// پشتیبانی می‌کنه. اگه GITHUB_BACKUP_TOKEN ست نشده باشه، بی‌سروصدا رد می‌شه.
export async function pushBackupToGitHub(env, compressedBytes, dateKey) {
  const token = env.GITHUB_BACKUP_TOKEN
  if (!token) return
  const owner = env.GITHUB_BACKUP_OWNER || 'maz1maz'
  const repo = env.GITHUB_BACKUP_REPO || 'movies-archive'
  const branch = env.GITHUB_BACKUP_BRANCH || 'main'
  const filePath = 'backups/latest-backup.json.gz'
  const api = `https://api.github.com/repos/${owner}/${repo}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'CinefilmArchive-Backup/1.0',
  }
  const gh = async (path, opts = {}) => {
    const res = await fetch(`${api}${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`GitHub API ${opts.method || 'GET'} ${path} -> ${res.status}: ${errText.slice(0, 300)}`)
    }
    return res.json()
  }

  // 1) sha آخرین commit روی برنچ
  const ref = await gh(`/git/refs/heads/${branch}`)
  const latestCommitSha = ref.object.sha

  // 2) sha درخت (tree) پایه‌ی همون commit
  const latestCommit = await gh(`/git/commits/${latestCommitSha}`)
  const baseTreeSha = latestCommit.tree.sha

  // 3) آپلود محتوای فایل به‌عنوان blob (بدون محدودیت ۱ مگابایتی Contents API)
  const blob = await gh(`/git/blobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: uint8ToBase64(compressedBytes), encoding: 'base64' }),
  })

  // 4) ساخت tree جدید که فقط همین فایل رو نسبت به base tree عوض می‌کنه
  const tree = await gh(`/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: [{ path: filePath, mode: '100644', type: 'blob', sha: blob.sha }],
    }),
  })

  // 5) ساخت commit جدید روی همون tree
  const commit = await gh(`/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Daily backup ${dateKey}`,
      tree: tree.sha,
      parents: [latestCommitSha],
    }),
  })

  // 6) هدایت برنچ به commit جدید
  await gh(`/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha }),
  })

  console.log(`GitHub backup: pushed ${filePath} (${dateKey}, ${compressedBytes.byteLength} bytes)`)
}


// base64 encode یه Uint8Array بزرگ بدون خطای call-stack (chunk-by-chunk،
// چون String.fromCharCode.apply روی آرایه‌های چندمگابایتی کرش می‌کنه)
export function uint8ToBase64(bytes) {
  const CHUNK = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}
