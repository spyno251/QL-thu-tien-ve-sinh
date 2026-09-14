import { getSessionUser } from '@/lib/app-auth';
import { configurationError, getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: configurationError() }, { status: 503 });

  try {
    const currentUser = await getSessionUser(db, request);
    if (!currentUser || currentUser.role === 'staff') {
      return Response.json({ error: 'Chỉ Admin hoặc Quản trị được xem lịch sử truy cập.' }, { status: 403 });
    }

    const { data: logs, error } = await db
      .from('access_logs')
      .select('id, user_id, action, actor_id, created_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) throw error;

    const ids = [...new Set((logs ?? []).flatMap((log) => [log.user_id, log.actor_id]).filter(Boolean))];
    const { data: users, error: usersError } = ids.length
      ? await db.from('users').select('id, name, role').in('id', ids)
      : { data: [], error: null };
    if (usersError) throw usersError;

    const userById = new Map((users ?? []).map((user) => [user.id, user]));
    return Response.json({
      logs: (logs ?? []).map((log) => ({
        id: log.id,
        action: log.action,
        createdAt: log.created_at,
        user: userById.get(log.user_id) ?? null,
        actor: log.actor_id ? userById.get(log.actor_id) ?? null : null,
      })),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Unable to load access logs', error);
    return Response.json({ error: 'Chưa thể tải lịch sử truy cập.' }, { status: 503 });
  }
}
