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

  const history = changes ?? [];
  const apartmentIds = [...new Set(history.flatMap((change) => {
    const details = change.details && typeof change.details === 'object'
      ? change.details as Record<string, unknown>
      : {};
    return typeof details.apartmentId === 'string' ? [details.apartmentId] : [];
  }))];
  if (!apartmentIds.length)
    return Response.json({ changes: history }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });

  const { data: apartments } = await db
    .from('apartments')
    .select('id, code, block_id')
    .in('id', apartmentIds);
  const blockIds = [...new Set((apartments ?? []).map((apartment) => apartment.block_id))];
  const { data: blocks } = blockIds.length
    ? await db.from('blocks').select('id, region_id').in('id', blockIds)
    : { data: [] as { id: string; region_id: string }[] };
  const regionIds = [...new Set((blocks ?? []).map((block) => block.region_id))];
  const { data: regions } = regionIds.length
    ? await db.from('regions').select('id, name').in('id', regionIds)
    : { data: [] as { id: string; name: string }[] };
  const apartmentsById = new Map((apartments ?? []).map((apartment) => [apartment.id, apartment]));
  const blocksById = new Map((blocks ?? []).map((block) => [block.id, block]));
  const regionsById = new Map((regions ?? []).map((region) => [region.id, region]));
  const enriched = history.map((change) => {
    const details = change.details && typeof change.details === 'object'
      ? change.details as Record<string, unknown>
      : {};
    if (typeof details.apartmentCode === 'string' || typeof details.apartmentId !== 'string') return change;
    const apartment = apartmentsById.get(details.apartmentId);
    const block = apartment ? blocksById.get(apartment.block_id) : undefined;
    const region = block ? regionsById.get(block.region_id) : undefined;
    return {
      ...change,
      details: {
        ...details,
        apartmentCode: apartment?.code ?? null,
        regionName: region?.name ?? null,
      },
    };
  });
  return Response.json({ changes: enriched }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
