import { env } from 'cloudflare:workers';
import {
  clearSessionCookie,
  createSession,
  DEFAULT_PASSWORD,
  getSessionUser,
  hashPassword,
  parseCookie,
  safeUser,
  SESSION_COOKIE,
  verifyPassword,
} from '@/lib/app-auth';

export const dynamic = 'force-dynamic';

type StoredUser = {
  id: string;
  phone: string;
  password: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
  mustChangePassword: boolean;
};

function getBinding(): D1Database | null {
  return (env as unknown as { DB?: D1Database }).DB ?? null;
}

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers });
}

export async function GET(request: Request) {
  const db = getBinding();
  if (!db) return json({ error: 'DB binding is unavailable' }, 503);
  await ensureAuthUsers(db);
  const user = await getSessionUser(db, request);
  if (!user) return json({ user: null }, 401);
  return json({ user: safeUser(user) });
}

export async function POST(request: Request) {
  const db = getBinding();
  if (!db) return json({ error: 'DB binding is unavailable' }, 503);
  await ensureAuthUsers(db);
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action ?? '');

  if (action === 'login') return login(db, body);
  if (action === 'logout') return logout(db, request);
  if (action === 'change-password') return changePassword(db, request, body);
  if (action === 'forgot-password') return forgotPassword(db, body);
  if (action === 'admin-reset') return adminReset(db, request, body);
  return json({ error: 'Unknown action' }, 400);
}

async function ensureAuthUsers(db: D1Database) {
  const row = await db.prepare('SELECT COUNT(*) AS total FROM users').first<{ total: number }>();
  if ((row?.total ?? 0) === 0) {
    const defaultHash = await hashPassword(DEFAULT_PASSWORD);
    await db.batch([
      db
        .prepare('INSERT INTO users (id, phone, password, email, name, role, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind('u-admin', '0909000001', await hashPassword('admin123'), 'admin@thutienrac.local', 'Quan tri', 'admin', 0),
      db
        .prepare('INSERT INTO users (id, phone, password, email, name, role, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind('u-lan', '0909000002', defaultHash, 'lan@thutienrac.local', 'Nhan vien Lan', 'staff', 1),
      db
        .prepare('INSERT INTO users (id, phone, password, email, name, role, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind('u-minh', '0909000003', defaultHash, 'minh@thutienrac.local', 'Nhan vien Minh', 'staff', 1),
    ]);
    return;
  }
  await db.batch([
    db.prepare("UPDATE users SET email = 'admin@thutienrac.local' WHERE id = 'u-admin' AND email = ''"),
    db.prepare("UPDATE users SET email = 'lan@thutienrac.local' WHERE id = 'u-lan' AND email = ''"),
    db.prepare("UPDATE users SET email = 'minh@thutienrac.local' WHERE id = 'u-minh' AND email = ''"),
  ]);
}

async function login(db: D1Database, body: Record<string, unknown>) {
  const phone = String(body.phone ?? '').trim();
  const password = String(body.password ?? '');
  const user = await db
    .prepare(
      `SELECT id, phone, password, email, name, role,
        must_change_password AS mustChangePassword
       FROM users WHERE phone = ?`,
    )
    .bind(phone)
    .first<StoredUser>();
  if (!user || !(await verifyPassword(password, user.password))) {
    return json({ error: 'Số điện thoại hoặc mật khẩu chưa đúng.' }, 401);
  }

  const mustChangePassword =
    Boolean(user.mustChangePassword) || (user.role === 'staff' && password === DEFAULT_PASSWORD);
  const passwordHash = user.password.startsWith('pbkdf2$')
    ? user.password
    : await hashPassword(password);
  await db
    .prepare('UPDATE users SET password = ?, must_change_password = ? WHERE id = ?')
    .bind(passwordHash, mustChangePassword ? 1 : 0, user.id)
    .run();
  const session = await createSession(db, user.id);
  return json(
    { user: safeUser({ ...user, password: passwordHash, mustChangePassword }) },
    200,
    { 'Set-Cookie': session.cookie },
  );
}

async function logout(db: D1Database, request: Request) {
  const token = parseCookie(request, SESSION_COOKIE);
  if (token) await db.prepare('DELETE FROM sessions WHERE id = ?').bind(token).run();
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}

async function changePassword(db: D1Database, request: Request, body: Record<string, unknown>) {
  const user = await getSessionUser(db, request);
  if (!user) return json({ error: 'Phiên đăng nhập đã hết hạn.' }, 401);
  const currentPassword = String(body.currentPassword ?? '');
  const newPassword = String(body.newPassword ?? '');
  if (!(await verifyPassword(currentPassword, user.password))) {
    return json({ error: 'Mật khẩu hiện tại chưa đúng.' }, 400);
  }
  if (newPassword.length < 6 || newPassword === DEFAULT_PASSWORD) {
    return json({ error: 'Mật khẩu mới cần ít nhất 6 ký tự và không được là 123456.' }, 400);
  }
  await db
    .prepare('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?')
    .bind(await hashPassword(newPassword), user.id)
    .run();
  return json({ user: safeUser({ ...user, mustChangePassword: false }) });
}

async function forgotPassword(db: D1Database, body: Record<string, unknown>) {
  const phone = String(body.phone ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  if (phone && email) {
    const user = await db
      .prepare('SELECT id FROM users WHERE phone = ? AND lower(email) = ?')
      .bind(phone, email)
      .first<{ id: string }>();
    if (user) {
      await db.batch([
        db
          .prepare('UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?')
          .bind(await hashPassword(DEFAULT_PASSWORD), user.id),
        db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
      ]);
    }
  }
  return json({ ok: true });
}

async function adminReset(db: D1Database, request: Request, body: Record<string, unknown>) {
  const admin = await getSessionUser(db, request);
  if (!admin || admin.role !== 'admin') {
    return json({ error: 'Chỉ admin được đặt lại mật khẩu.' }, 403);
  }
  const userId = String(body.userId ?? '');
  const target = await db
    .prepare("SELECT id FROM users WHERE id = ? AND role = 'staff'")
    .bind(userId)
    .first<{ id: string }>();
  if (!target) return json({ error: 'Không tìm thấy nhân viên.' }, 404);
  await db.batch([
    db
      .prepare('UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?')
      .bind(await hashPassword(DEFAULT_PASSWORD), target.id),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(target.id),
  ]);
  return json({ ok: true });
}
