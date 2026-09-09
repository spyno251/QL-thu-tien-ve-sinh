import { DEFAULT_PASSWORD, getSessionUser, hashPassword } from '@/lib/app-auth';
import { configurationError, getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type User = {
  id: string;
  phone: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
  mustChangePassword: boolean;
};
type StoredUser = User & { password: string };
type Region = { id: string; name: string; defaultFee: number };
type Block = { id: string; regionId: string; name: string };
type Apartment = {
  id: string;
  blockId: string;
  code: string;
  owner: string;
  monthlyFee: number | null;
};
type Payment = {
  id: string;
  apartmentId: string;
  collectorId: string;
  month: string;
  paidAt: string;
  amount: number;
};
type AppSettings = {
  appName: string;
  subtitle: string;
  logoUrl: string;
  theme: 'teal' | 'blue' | 'indigo' | 'amber' | 'rose';
};
type AppState = {
  users: User[];
  regions: Region[];
  blocks: Block[];
  apartments: Apartment[];
  payments: Payment[];
  settings: AppSettings;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function GET(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return json({ error: configurationError() }, 503);
  try {
    const currentUser = await getSessionUser(db, request);
    if (!currentUser) return json({ error: 'Unauthorized' }, 401);
    return json(visibleState(await readState(), currentUser));
  } catch {
    return json({ error: 'Chưa thể kết nối Supabase.' }, 503);
  }
}

export async function POST(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return json({ error: configurationError() }, 503);
  try {
    const currentUser = await getSessionUser(db, request);
    if (!currentUser) return json({ error: 'Unauthorized' }, 401);
    if (currentUser.mustChangePassword)
      return json({ error: 'Password change required' }, 403);
    const payload = (await request.json()) as { state?: AppState };
    if (!payload.state) return json({ error: 'Missing state' }, 400);
    const existing = await readState();
    const nextState =
      currentUser.role === 'admin'
        ? payload.state
        : {
            ...existing,
            payments: normalizeStaffPayments(
              existing.payments,
              payload.state.payments,
              currentUser.id,
            ),
          };
    await saveState(nextState);
    return json({
      ok: true,
      state: visibleState(await readState(), currentUser),
    });
  } catch {
    return json({ error: 'Chưa thể lưu dữ liệu.' }, 503);
  }
}

function visibleState(
  state: AppState,
  currentUser: { id: string; role: 'admin' | 'staff' },
) {
  if (currentUser.role === 'admin') return state;
  return {
    ...state,
    users: state.users.map((user) => ({
      ...user,
      phone: user.id === currentUser.id ? user.phone : '',
      email: user.id === currentUser.id ? user.email : '',
    })),
  };
}

function normalizeStaffPayments(
  existing: Payment[],
  incoming: Payment[],
  currentUserId: string,
) {
  const existingById = new Map(
    existing.map((payment) => [payment.id, payment]),
  );
  const incomingIds = new Set(incoming.map((payment) => payment.id));
  const kept = existing.filter(
    (payment) =>
      incomingIds.has(payment.id) || payment.collectorId !== currentUserId,
  );
  const additions = incoming
    .filter((payment) => !existingById.has(payment.id))
    .map((payment) => ({ ...payment, collectorId: currentUserId }));
  return [...additions, ...kept];
}

async function readState(): Promise<AppState> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error(configurationError());
  const [
    usersResult,
    regionsResult,
    blocksResult,
    apartmentsResult,
    paymentsResult,
    settingsResult,
  ] = await Promise.all([
    db
      .from('users')
      .select('id, phone, password, email, name, role, must_change_password')
      .order('name'),
    db.from('regions').select('id, name, default_fee').order('name'),
    db.from('blocks').select('id, region_id, name').order('name'),
    db
      .from('apartments')
      .select('id, block_id, code, owner, monthly_fee')
      .order('code'),
    db
      .from('payments')
      .select('id, apartment_id, collector_id, month, paid_at, amount')
      .order('paid_at', { ascending: false }),
    db.from('app_settings').select('app_name, subtitle, logo_url, theme').eq('id', 'default').maybeSingle(),
  ]);
  if (
    usersResult.error ||
    regionsResult.error ||
    blocksResult.error ||
    apartmentsResult.error ||
    paymentsResult.error || settingsResult.error
  )
    throw new Error('Read failed');
  return {
    users: (usersResult.data ?? []).map((item) => ({
      id: item.id,
      phone: item.phone,
      email: item.email,
      name: item.name,
      role: item.role as User['role'],
      mustChangePassword: Boolean(item.must_change_password),
    })),
    regions: (regionsResult.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      defaultFee: item.default_fee,
    })),
    blocks: (blocksResult.data ?? []).map((item) => ({
      id: item.id,
      regionId: item.region_id,
      name: item.name,
    })),
    apartments: (apartmentsResult.data ?? []).map((item) => ({
      id: item.id,
      blockId: item.block_id,
      code: item.code,
      owner: item.owner,
      monthlyFee: item.monthly_fee,
    })),
    payments: (paymentsResult.data ?? []).map((item) => ({
      id: item.id,
      apartmentId: item.apartment_id,
      collectorId: item.collector_id,
      month: item.month,
      paidAt: item.paid_at,
      amount: item.amount,
    })),
    settings: {
      appName: settingsResult.data?.app_name ?? 'Thu tiền vệ sinh',
      subtitle:
        settingsResult.data?.subtitle ??
        'Quản lý thu tiền vệ sinh theo từng căn hộ',
      logoUrl: settingsResult.data?.logo_url ?? '',
      theme: (settingsResult.data?.theme ?? 'teal') as AppSettings['theme'],
    },
  };
}

async function saveState(state: AppState) {
  const db = getSupabaseAdmin();
  if (!db) throw new Error(configurationError());
  const { data: storedRows, error: storedError } = await db
    .from('users')
    .select('id, password');
  if (storedError) throw storedError;
  const passwordById = new Map(
    (storedRows ?? []).map((item) => [item.id, item.password]),
  );
  const userIds = new Set(state.users.map((user) => user.id));
  const removedUserIds = (storedRows ?? [])
    .filter((user) => !userIds.has(user.id))
    .map((user) => user.id);
  const fail = (error: { message: string } | null) => {
    if (error) throw error;
  };

  fail((await db.from('payments').delete().not('id', 'is', null)).error);
  fail((await db.from('apartments').delete().not('id', 'is', null)).error);
  fail((await db.from('blocks').delete().not('id', 'is', null)).error);
  fail((await db.from('regions').delete().not('id', 'is', null)).error);
  if (removedUserIds.length)
    fail((await db.from('users').delete().in('id', removedUserIds)).error);
  const users = await Promise.all(
    state.users.map(async (user) => ({
      id: user.id,
      phone: user.phone,
      email: user.email,
      name: user.name,
      role: user.role,
      must_change_password: user.mustChangePassword,
      password:
        passwordById.get(user.id) ?? (await hashPassword(DEFAULT_PASSWORD)),
    })),
  );
  if (users.length) fail((await db.from('users').upsert(users)).error);
  if (state.regions.length)
    fail(
      (
        await db
          .from('regions')
          .insert(
            state.regions.map((item) => ({
              id: item.id,
              name: item.name,
              default_fee: item.defaultFee,
            })),
          )
      ).error,
    );
  if (state.blocks.length)
    fail(
      (
        await db
          .from('blocks')
          .insert(
            state.blocks.map((item) => ({
              id: item.id,
              region_id: item.regionId,
              name: item.name,
            })),
          )
      ).error,
    );
  if (state.apartments.length)
    fail(
      (
        await db
          .from('apartments')
          .insert(
            state.apartments.map((item) => ({
              id: item.id,
              block_id: item.blockId,
              code: item.code,
              owner: item.owner,
              monthly_fee: item.monthlyFee,
            })),
          )
      ).error,
    );
  if (state.payments.length)
    fail(
      (
        await db
          .from('payments')
          .insert(
            state.payments.map((item) => ({
              id: item.id,
              apartment_id: item.apartmentId,
              collector_id: item.collectorId,
              month: item.month,
              paid_at: item.paidAt,
              amount: item.amount,
            })),
          )
      ).error,
    );
  fail(
    (
      await db.from('app_settings').upsert({
        id: 'default',
        app_name: state.settings.appName,
        subtitle: state.settings.subtitle,
        logo_url: state.settings.logoUrl,
        theme: state.settings.theme,
      })
    ).error,
  );
}
