export const DEFAULT_PASSWORD = '123456';
export const SESSION_COOKIE = 'garbage_fee_session';
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 120_000;

export type SessionUser = {
  id: string;
  phone: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
  mustChangePassword: boolean;
};

type StoredUser = SessionUser & { password: string };

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string) {
  if (!stored.startsWith('pbkdf2$')) return password === stored;
  const [, iterationsValue, saltValue, hashValue] = stored.split('$');
  const iterations = Number(iterationsValue);
  if (!iterations || !saltValue || !hashValue) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: base64ToBytes(saltValue), iterations },
    key,
    256,
  );
  const actual = new Uint8Array(bits);
  const expected = base64ToBytes(hashValue);
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1) mismatch |= actual[index] ^ expected[index];
  return mismatch === 0;
}

export function parseCookie(request: Request, name: string) {
  const cookie = request.headers.get('cookie') ?? '';
  for (const part of cookie.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

export async function getSessionUser(db: D1Database, request: Request) {
  const token = parseCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const user = await db
    .prepare(
      `SELECT users.id, users.phone, users.password, users.email, users.name, users.role,
        users.must_change_password AS mustChangePassword
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ? AND sessions.expires_at > ?`,
    )
    .bind(token, new Date().toISOString())
    .first<StoredUser>();
  return user ?? null;
}

export async function createSession(db: D1Database, userId: string) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, userId, expiresAt.toISOString())
    .run();
  return {
    token,
    cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expiresAt.toUTCString()}`,
  };
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function safeUser(user: StoredUser | SessionUser): SessionUser {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}
