import { configurationError, getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function bangkokDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: configurationError() }, { status: 503 });

  try {
    const { data: settings, error: settingsError } = await db
      .from('app_settings')
      .select('auto_backup_enabled')
      .eq('id', 'default')
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings?.auto_backup_enabled)
      return Response.json({ ok: true, skipped: 'disabled' });

    const backupDate = bangkokDate();
    const { data: existing, error: existingError } = await db
      .from('app_backups')
      .select('id')
      .eq('backup_date', backupDate)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return Response.json({ ok: true, skipped: 'already-created' });

    const [users, regions, blocks, apartments, payments, settlements, appSettings] =
      await Promise.all([
        db.from('users').select('*'),
        db.from('regions').select('*'),
        db.from('blocks').select('*'),
        db.from('apartments').select('*'),
        db.from('payments').select('*'),
        db.from('debt_settlements').select('*'),
        db.from('app_settings').select('*'),
      ]);
    const result = [users, regions, blocks, apartments, payments, settlements, appSettings];
    if (result.some((item) => item.error)) throw new Error('Snapshot read failed');

    const { error: insertError } = await db.from('app_backups').insert({
      id: crypto.randomUUID(),
      backup_date: backupDate,
      source: 'automatic',
      snapshot: {
        users: users.data,
        regions: regions.data,
        blocks: blocks.data,
        apartments: apartments.data,
        payments: payments.data,
        debtSettlements: settlements.data,
        settings: appSettings.data,
      },
    });
    if (insertError?.code === '23505')
      return Response.json({ ok: true, skipped: 'already-created' });
    if (insertError) throw insertError;
    return Response.json({ ok: true, backupDate });
  } catch {
    return Response.json({ error: 'Không thể tạo sao lưu tự động.' }, { status: 503 });
  }
}
