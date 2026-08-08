// احراز هویت ساده مبتنی بر سشن (بدون وابستگی خارجی).
// - رمزها با PBKDF2 (Web Crypto) هش می‌شن، هیچ‌وقت خام ذخیره نمی‌شن.
// - توکن سشن یک رشته‌ی تصادفی امن هست که در جدول sessions (D1) ذخیره می‌شه
//   و در یک کوکی HttpOnly برای مرورگر ست می‌شه. چون توکن سمت سرور چک می‌شه،
//   نیازی به JWT_SECRET یا وابستگی خارجی نیست.

const SESSION_TTL_DAYS = 30
const PBKDF2_ITERATIONS = 150000

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  return bytes.buffer
}

function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return bufToHex(bytes.buffer)
}

export async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBuf(saltHex) : crypto.getRandomValues(new Uint8Array(16)).buffer
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  )
  return { hash: bufToHex(bits), salt: bufToHex(salt) }
}

export async function verifyPassword(password, saltHex, expectedHashHex) {
  const { hash } = await hashPassword(password, saltHex)
  // مقایسه‌ی زمان‌ثابت برای جلوگیری از timing attack
  if (hash.length !== expectedHashHex.length) return false
  let diff = 0
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expectedHashHex.charCodeAt(i)
  return diff === 0
}

export function parseCookies(request) {
  const header = request.headers.get("Cookie") || ""
  const out = {}
  for (const part of header.split(";")) {
    const idx = part.indexOf("=")
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

export function sessionCookieHeader(token, { clear = false } = {}) {
  const maxAge = clear ? 0 : SESSION_TTL_DAYS * 24 * 60 * 60
  const value = clear ? "" : token
  return `cf_session=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

export async function createSession(db, userId) {
  const token = randomHex(32)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  await db
    .prepare("INSERT INTO sessions (token, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)")
    .bind(token, userId, now.toISOString(), expiresAt.toISOString())
    .run()
  return token
}

export async function destroySession(db, token) {
  if (!token) return
  await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run()
}

// برمی‌گردونه: { id, username, role } یا null اگه سشن معتبر نباشه/منقضی شده باشه
export async function getSessionUser(db, request) {
  const cookies = parseCookies(request)
  const token = cookies["cf_session"]
  if (!token) return null
  const row = await db
    .prepare(
      `SELECT u.id as id, u.username as username, u.role as role, s.expiresAt as expiresAt
       FROM sessions s JOIN users u ON u.id = s.userId
       WHERE s.token = ?`
    )
    .bind(token)
    .first()
  if (!row) return null
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    await destroySession(db, token)
    return null
  }
  return { id: row.id, username: row.username, role: row.role }
}

export function requireAuthResponse(json, corsHeaders) {
  return json({ error: "برای این کار باید وارد شوید" }, 401, corsHeaders)
}

export function requireAdminResponse(json, corsHeaders) {
  return json({ error: "این عملیات فقط برای ادمین مجاز است" }, 403, corsHeaders)
}
