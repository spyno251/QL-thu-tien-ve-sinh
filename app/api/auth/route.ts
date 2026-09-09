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
import { configurationError, getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type StoredUser = {
  id: string;
  phone: string;
  password: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
  mustChangePassword: boolean;
};

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers });
}

async function hasUsers() {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { count, error } = await db
    .from('users')
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function findUser(phone: string) {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from('users')
    .select('id, phone, password, email, name, role, must_change_password')
    .eq('phone', phone)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    phone: data.phone,
    password: data.password,
    email: data.email,
    name: data.name,
    role: data.role,
    mustChangePassword: Boolean(data.must_change_password),
  } as StoredUser;
}

export async function GET(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return json({ error: configurationError() }, 503);
  try {
    if (!(await hasUsers())) return json({ user: null, setupRequired: true });
    const user = await getSessionUser(db, request);
    if (!user) return json({ user: null }, 401);
    return json({ user: safeUser(user) });
  } catch {
    return json({ error: 'Chưa thể kết nối Supabase.' }, 503);
  }
}

export async function POST(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return json({ error: configurationError() }, 503);
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action ?? '');
  try {
    if (action === 'setup-admin') return setupAdmin(body);
    if (action === 'login') return login(request, body);
    if (action === 'logout') return logout(request);
    if (action === 'change-password') return changePassword(request, body);
    if (action === 'forgot-password') return forgotPassword(body);
    if (action === 'admin-reset') return adminReset(request, body);
  } catch {
    return json({ error: 'Chưa thể kết nối Supabase.' }, 503);
  }
  return json({ error: 'Unknown action' }, 400);
}

async function setupAdmin(body: Record<string, unknown>) {
  const db = getSupabaseAdmin();
  if (!db) return json({ error: configurationError() }, 503);
  if (await hasUsers()) return json({ error: 'Admin đã được thiết lập.' }, 409);
  const name = String(body.name ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const email = String(body.email ?? '')
    .trim()
    .toLowerCase();
  const password = String(body.password ?? '');
  if (!name || !phone || !email || password.length < 6) {
    return json(
      { error: 'Nhập đủ tên, số điện thoại, email và mật khẩu từ 6 ký tự.' },
      400,
    );
  }
  const user: StoredUser = {
    id: crypto.randomUUID(),
    name,
    phone,
    email,
    password: await hashPassword(password),
    role: 'admin',
    mustChangePassword: false,
  };
  const { error } = await db.from('users').insert({
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    password: user.password,
    role: user.role,
    must_change_password: false,
  });
  if (error)
    return json(
      {
        error:
          'Không thể tạo admin. Số điện thoại hoặc email có thể đã tồn tại.',
      },
      400,
    );
  const session = await createSession(db, user.id, true);
  return json({ user: safeUser(user) }, 200, { 'Set-Cookie': session.cookie });
}

async function login(request: Request, body: Record<string, unknown>) {
  const db = getSupabaseAdmin();
  if (!db) return json({ error: configurationError() }, 503);
  const user = await findUser(String(body.phone ?? '').trim());
  const password = String(body.password ?? '');
  if (!user || !(await verifyPassword(password, user.password))) {
    return json({ error: 'Số điện thoại hoặc mật khẩu chưa đúng.' }, 401);
  }
  const mustChangePassword =
    Boolean(user.mustChangePassword) ||
    (user.role === 'staff' && password === DEFAULT_PASSWORD);
  await db
    .from('users')
    .update({ must_change_password: mustChangePassword })
    .eq('id', user.id);
  const session = await createSession(db, user.id, body.remember === true);
  return json({ user: safeUser({ ...user, mustChangePassword }) }, 200, {
    'Set-Cookie': session.cookie,
  });
}

async function logout(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return json({ error: configurationError() }, 503);
  const token = parseCookie(request, SESSION_COOKIE);
  if (token) await db.from('sessions').delete().eq('id', token);
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}

async function changePassword(request: Request, body: Record<string, unknown>) {
  const db = getSupabaseAdmin();
  if (!db) return json({ error: configurationError() }, 503);
  const user = await getSessionUser(db, request);
  const currentPassword = String(body.currentPassword ?? '');
  const newPassword = String(body.newPassword ?? '');
  if (!user) return json({ error: 'Phiên đăng nhập đã hết hạn.' }, 401);
  if (!(await verifyPassword(currentPassword, user.password)))
    return json({ error: 'Mật khẩu hiện tại chưa đúng.' }, 400);
  if (newPassword.length < 6 || newPassword === DEFAULT_PASSWORD)
    return json(
      { error: 'Mật khẩu mới cần ít nhất 6 ký tự và không được là 123456.' },
      400,
    );
  await db
    .from('users')
    .update({
      password: await hashPassword(newPassword),
      must_change_password: false,
    })
    .eq('id', user.id);
  return json({ user: safeUser({ ...user, mustChangePassword: false }) });
}

async function forgotPassword(body: Record<string, unknown>) {
  const db = getSupabaseAdmin();
  if (!db) return json({ error: configurationError() }, 503);
  const phone = String(body.phone ?? '').trim();
  const email = String(body.email ?? '')
    .trim()
    .toLowerCase();
  const { data: user } = await db
    .from('users')
    .select('id')
    .eq('phone', phone)
    .eq('email', email)
    .maybeSingle();
  if (user) {
    await db
      .from('users')
      .update({
        password: await hashPassword(DEFAULT_PASSWORD),
        must_change_password: true,
      })
      .eq('id', user.id);
    await db.from('sessions').delete().eq('user_id', user.id);
  }
  return json({ ok: true });
}

async function adminReset(request: Request, body: Record<string, unknown>) {
  const db = getSupabaseAdmin();
  if (!db) return json({ error: configurationError() }, 503);
  const admin = await getSessionUser(db, request);
  const userId = String(body.userId ?? '');
  if (!admin || admin.role !== 'admin')
    return json({ error: 'Chỉ admin được đặt lại mật khẩu.' }, 403);
  const { data: target } = await db
    .from('users')
    .select('id')
    .eq('id', userId)
    .eq('role', 'staff')
    .maybeSingle();
  if (!target) return json({ error: 'Không tìm thấy nhân viên.' }, 404);
  await db
    .from('users')
    .update({
      password: await hashPassword(DEFAULT_PASSWORD),
      must_change_password: true,
    })
    .eq('id', target.id);
  await db.from('sessions').delete().eq('user_id', target.id);
  return json({ ok: true });
}
