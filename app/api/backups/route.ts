import { getSessionUser } from '@/lib/app-auth';
import { configurationError, getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type BackupSource = 'automatic' | 'manual';
type Snapshot = Record<string, unknown>;
const MAX_BACKUPS = 10;

function bangkokDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function asRows(value: unknown) {
  return Array.isArray(value) ? value : [];
}

async function pruneBackups() {
  const db = getSupabaseAdmin();
  if (!db) throw new Error(configurationError());
  const { data, error } = await db
    .from('app_backups')
    .select('id')
    .order('created_at', { ascending: false })
    .range(MAX_BACKUPS, 10000);
  if (error) throw error;
  const ids = (data ?? []).map((backup) => backup.id);
  if (!ids.length) return;
  const { error: deleteError } = await db.from('app_backups').delete().in('id', ids);
  if (deleteError) throw deleteError;
}

async function createBackup(source: BackupSource) {
  const db = getSupabaseAdmin();
  if (!db) throw new Error(configurationError());
  const backupDate = bangkokDate();
  if (source === 'automatic') {
    const { data: existing, error } = await db
      .from('app_backups').select('id').eq('backup_date', backupDate)
      .eq('source', 'automatic').maybeSingle();
    if (error) throw error;
    if (existing) return { backupDate, skipped: true };
  }

  const [users, regions, blocks, apartments, payments, settlements, appSettings] = await Promise.all([
    db.from('users').select('*'), db.from('regions').select('*'),
    db.from('blocks').select('*'), db.from('apartments').select('*'),
    db.from('payments').select('*'), db.from('debt_settlements').select('*'),
    db.from('app_settings').select('*'),
  ]);
  const result = [users, regions, blocks, apartments, payments, settlements, appSettings];
  if (result.some((item) => item.error)) throw new Error('Snapshot read failed');
  const { error } = await db.from('app_backups').insert({
    id: crypto.randomUUID(), backup_date: backupDate, source,
    snapshot: {
      users: users.data, regions: regions.data, blocks: blocks.data,
      apartments: apartments.data, payments: payments.data,
      debtSettlements: settlements.data, settings: appSettings.data,
    },
  });
  if (error) throw error;
  await pruneBackups();
  return { backupDate, skipped: false };
}

async function restoreBackup(snapshot: Snapshot) {
  const db = getSupabaseAdmin();
  if (!db) throw new Error(configurationError());
  const users = asRows(snapshot.users);
  const regions = asRows(snapshot.regions);
  const blocks = asRows(snapshot.blocks);
  const apartments = asRows(snapshot.apartments);
  const payments = asRows(snapshot.payments);
  const settlements = asRows(snapshot.debtSettlements);
  const settings = asRows(snapshot.settings);
  if (!users.length || !settings.length) throw new Error('Snapshot invalid');
  const fail = (error: { message: string } | null) => { if (error) throw error; };

  fail((await db.from('debt_settlements').delete().not('id', 'is', null)).error);
  fail((await db.from('payments').delete().not('id', 'is', null)).error);
  fail((await db.from('apartments').delete().not('id', 'is', null)).error);
  fail((await db.from('blocks').delete().not('id', 'is', null)).error);
  fail((await db.from('regions').delete().not('id', 'is', null)).error);
  const { data: existingUsers, error: usersError } = await db.from('users').select('id');
  if (usersError) throw usersError;
  const snapshotIds = new Set(users.map((user) => String((user as { id?: unknown }).id ?? '')));
  const removedIds = (existingUsers ?? []).map((user) => user.id).filter((id) => !snapshotIds.has(id));
  if (removedIds.length) fail((await db.from('users').delete().in('id', removedIds)).error);

  fail((await db.from('users').upsert(users)).error);
  if (regions.length) fail((await db.from('regions').insert(regions)).error);
  if (blocks.length) fail((await db.from('blocks').insert(blocks)).error);
  if (apartments.length) fail((await db.from('apartments').insert(apartments)).error);
  if (payments.length) fail((await db.from('payments').insert(payments)).error);
  if (settlements.length) fail((await db.from('debt_settlements').insert(settlements)).error);
  fail((await db.from('app_settings').upsert(settings)).error);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = getSupabaseAdmin();
    if (!db) throw new Error(configurationError());
    const { data: settings, error } = await db.from('app_settings')
      .select('auto_backup_enabled').eq('id', 'default').maybeSingle();
    if (error) throw error;
    if (!settings?.auto_backup_enabled) return Response.json({ ok: true, skipped: 'disabled' });
    return Response.json({ ok: true, ...(await createBackup('automatic')) });
  } catch {
    return Response.json({ error: 'Không thể tạo sao lưu tự động.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: configurationError() }, { status: 503 });
  const user = await getSessionUser(db, request);
  if (!user || user.role !== 'admin')
    return Response.json({ error: 'Chỉ Admin được quản lý sao lưu.' }, { status: 403 });
  try {
    const body = (await request.json()) as { action?: string; backupId?: string };
    if (body.action === 'list') {
      const { data, error } = await db.from('app_backups')
        .select('id, backup_date, source, created_at, snapshot')
        .order('created_at', { ascending: false })
        .limit(MAX_BACKUPS);
      if (error) throw error;
      const backups = (data ?? []).map((backup) => {
        const snapshot = (backup.snapshot ?? {}) as Snapshot;
        return {
          id: backup.id, backupDate: backup.backup_date, source: backup.source,
          createdAt: backup.created_at,
          counts: {
            users: asRows(snapshot.users).length,
            apartments: asRows(snapshot.apartments).length,
            payments: asRows(snapshot.payments).length,
            settlements: asRows(snapshot.debtSettlements).length,
          },
        };
      });
      return Response.json({ backups });
    }
    if (body.action === 'create') return Response.json({ ok: true, ...(await createBackup('manual')) });
    if (body.action === 'restore') {
      const backupId = String(body.backupId ?? '');
      if (!backupId) return Response.json({ error: 'Thiếu điểm sao lưu.' }, { status: 400 });
      const { data: backup, error } = await db.from('app_backups')
        .select('snapshot').eq('id', backupId).maybeSingle();
      if (error) throw error;
      if (!backup) return Response.json({ error: 'Không tìm thấy điểm sao lưu.' }, { status: 404 });
      await restoreBackup(backup.snapshot as Snapshot);
      return Response.json({ ok: true });
    }
    if (body.action === 'delete') {
      const backupId = String(body.backupId ?? '');
      if (!backupId) return Response.json({ error: 'Thiếu mã điểm sao lưu.' }, { status: 400 });
      const { error } = await db.from('app_backups').delete().eq('id', backupId);
      if (error) throw error;
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 400 });
  } catch {
    return Response.json({ error: 'Không thể xử lý sao lưu.' }, { status: 503 });
  }
}
