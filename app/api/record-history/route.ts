import { getSessionUser } from '@/lib/app-auth';
import { configurationError, getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: configurationError() }, { status: 503 });
  const currentUser = await getSessionUser(db, request);
  if (!currentUser || currentUser.role !== 'admin')
    return Response.json({ error: 'Chỉ Admin được xem lịch sử thay đổi.' }, { status: 403 });

  const actorId = new URL(request.url).searchParams.get('actorId');
  if (!actorId) return Response.json({ error: 'Thiếu tài khoản cần xem.' }, { status: 400 });
  const { data: changes, error } = await db
    .from('record_changes')
    .select('id, record_type, record_id, action, details, created_at')
    .eq('actor_id', actorId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return Response.json({ error: 'Chưa thể tải lịch sử thay đổi.' }, { status: 503 });
  return Response.json({ changes: changes ?? [] }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
