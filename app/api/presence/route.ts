import { getSessionUser, parseCookie, SESSION_COOKIE } from '@/lib/app-auth';
import { configurationError, getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ONLINE_WINDOW_MS = 3 * 60 * 1000;

export async function POST(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: configurationError() }, { status: 503 });
  const currentUser = await getSessionUser(db, request);
  const token = parseCookie(request, SESSION_COOKIE);
  if (!currentUser || !token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { error } = await db
    .from('sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', token);
  if (error) return Response.json({ error: 'Chưa thể cập nhật trạng thái.' }, { status: 503 });
  return Response.json({ ok: true });
}

export async function GET(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: configurationError() }, { status: 503 });
  const currentUser = await getSessionUser(db, request);
  if (!currentUser || currentUser.role !== 'admin')
    return Response.json({ error: 'Chỉ Admin được xem trạng thái trực tuyến.' }, { status: 403 });

  const since = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
  const { data: sessions, error } = await db
    .from('sessions')
    .select('user_id')
    .gt('expires_at', new Date().toISOString())
    .gte('last_seen_at', since);
  if (error) return Response.json({ error: 'Chưa thể tải trạng thái trực tuyến.' }, { status: 503 });

  const userIds = [...new Set((sessions ?? []).map((session) => session.user_id))];
  const { data: users, error: usersError } = userIds.length
    ? await db.from('users').select('id, name, phone, role').in('id', userIds).neq('role', 'admin').order('name')
    : { data: [], error: null };
  if (usersError) return Response.json({ error: 'Chưa thể tải trạng thái trực tuyến.' }, { status: 503 });
  return Response.json({
    online: (users ?? []).map((user) => ({ id: user.id, name: user.name, phone: user.phone, role: user.role })),
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
