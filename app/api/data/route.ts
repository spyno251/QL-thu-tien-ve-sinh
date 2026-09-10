import { DEFAULT_PASSWORD, getSessionUser, hashPassword } from '@/lib/app-auth';
import { configurationError, getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type User = {
  id: string;
  phone: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'staff';
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
  phone: string;
  note: string;
  monthlyFee: number | null;
};
type Payment = {
  id: string;
  apartmentId: string;
  collectorId: string;
  month: string;
  paidAt: string;
  amount: number;
  note: string;
  method: 'cash' | 'transfer';
};
type DebtSettlement = {
  id: string;
  staffId: string;
  amount: number;
  submittedAt: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
  status: 'pending' | 'confirmed';
};
type AppSettings = {
  appName: string;
  subtitle: string;
  logoUrl: string;
  theme: 'teal' | 'blue' | 'indigo' | 'amber' | 'rose';
  showAdminInStats: boolean;
};
type AppState = {
  users: User[];
  regions: Region[];
  blocks: Block[];
  apartments: Apartment[];
  payments: Payment[];
  debtSettlements: DebtSettlement[];
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
    const payload = (await request.json()) as {
      state?: AppState;
      action?: string;
      payment?: Partial<Payment>;
      paymentId?: string;
      note?: string;
      amount?: number;
      settlementId?: string;
    };
    if (payload.action === 'record-payment') {
      const payment = payload.payment;
      if (
        !payment?.apartmentId ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(payment.month)) ||
        !Number.isInteger(payment.amount) ||
        Number(payment.amount) <= 0
      )
        return json({ error: 'Dữ liệu thanh toán không hợp lệ.' }, 400);
      const { error } = await db.from('payments').insert({
        id: crypto.randomUUID(),
        apartment_id: payment.apartmentId,
        collector_id: currentUser.id,
        month: payment.month,
        paid_at: new Date().toISOString(),
        amount: payment.amount,
        note: String(payment.note ?? '').trim(),
        method: payment.method === 'transfer' ? 'transfer' : 'cash',
      });
      if (error?.code === '23505')
        return json({ error: 'Căn hộ này đã được thu trong kỳ này.' }, 409);
      if (error) throw error;
      return json({
        ok: true,
        state: visibleState(await readState(), currentUser),
      });
    }
    if (payload.action === 'cancel-payment') {
      if (currentUser.role === 'staff')
        return json({ error: 'Chỉ Quản trị hoặc Admin được hủy khoản thu.' }, 403);
      const paymentId = String(payload.paymentId ?? '');
      if (!paymentId) return json({ error: 'Thiếu mã giao dịch.' }, 400);
      const { error } = await db.from('payments').delete().eq('id', paymentId);
      if (error) throw error;
      return json({
        ok: true,
        state: visibleState(await readState(), currentUser),
      });
    }
    if (payload.action === 'update-payment-note') {
      const paymentId = String(payload.paymentId ?? '');
      if (!paymentId) return json({ error: 'Thiếu mã giao dịch.' }, 400);
      let update = db
        .from('payments')
        .update({ note: String(payload.note ?? '').trim() })
        .eq('id', paymentId);
      if (currentUser.role === 'staff')
        update = update.eq('collector_id', currentUser.id);
      const { error } = await update;
      if (error) throw error;
      return json({
        ok: true,
        state: visibleState(await readState(), currentUser),
      });
    }
    if (payload.action === 'submit-debt-settlement') {
      if (currentUser.role !== 'staff')
        return json({ error: 'Chỉ nhân viên mới có thể gửi yêu cầu trả tiền.' }, 403);
      const amount = Number(payload.amount);
      if (!Number.isInteger(amount) || amount <= 0)
        return json({ error: 'Số tiền nộp không hợp lệ.' }, 400);
      const [paymentsResult, settlementsResult] = await Promise.all([
        db.from('payments').select('amount').eq('collector_id', currentUser.id),
        db
          .from('debt_settlements')
          .select('amount, status')
          .eq('staff_id', currentUser.id),
      ]);
      if (paymentsResult.error || settlementsResult.error) throw new Error('Read failed');
      const totalCollected = (paymentsResult.data ?? []).reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );
      const totalSettled = (settlementsResult.data ?? []).reduce(
        (sum, settlement) => sum + settlement.amount,
        0,
      );
      if (amount > totalCollected - totalSettled)
        return json({ error: 'Số tiền nộp vượt quá công nợ hiện có.' }, 400);
      const { error } = await db.from('debt_settlements').insert({
        id: crypto.randomUUID(),
        staff_id: currentUser.id,
        amount,
        submitted_at: new Date().toISOString(),
        status: 'pending',
      });
      if (error) throw error;
      return json({
        ok: true,
        state: visibleState(await readState(), currentUser),
      });
    }
    if (payload.action === 'confirm-debt-settlement') {
      if (currentUser.role === 'staff')
        return json({ error: 'Chỉ Quản trị hoặc Admin được xác nhận.' }, 403);
      const settlementId = String(payload.settlementId ?? '');
      if (!settlementId) return json({ error: 'Thiếu mã yêu cầu.' }, 400);
      const { data, error } = await db
        .from('debt_settlements')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: currentUser.id,
        })
        .eq('id', settlementId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'Yêu cầu đã được xử lý.' }, 409);
      return json({
        ok: true,
        state: visibleState(await readState(), currentUser),
      });
    }
    if (!payload.state) return json({ error: 'Missing state' }, 400);
    const existing = await readState();
    const nextState =
      currentUser.role !== 'staff'
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
  currentUser: { id: string; role: 'admin' | 'manager' | 'staff' },
) {
  if (currentUser.role !== 'staff') return state;
  return {
    ...state,
    debtSettlements: state.debtSettlements.filter(
      (settlement) => settlement.staffId === currentUser.id,
    ),
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
  const additions = incoming
    .filter((payment) => !existingById.has(payment.id))
    .map((payment) => ({ ...payment, collectorId: currentUserId }));
  // Staff may add a payment, but existing payments are immutable for them.
  return [...additions, ...existing];
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
    debtSettlementsResult,
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
      .select('id, block_id, code, owner, phone, note, monthly_fee')
      .order('code'),
    db
      .from('payments')
      .select('id, apartment_id, collector_id, month, paid_at, amount, note, method')
      .order('paid_at', { ascending: false }),
    db
      .from('debt_settlements')
      .select('id, staff_id, amount, submitted_at, confirmed_at, confirmed_by, status')
      .order('submitted_at', { ascending: false }),
    db
      .from('app_settings')
      .select('app_name, subtitle, logo_url, theme, show_admin_in_stats')
      .eq('id', 'default')
      .maybeSingle(),
  ]);
  if (
    usersResult.error ||
    regionsResult.error ||
    blocksResult.error ||
    apartmentsResult.error ||
    paymentsResult.error ||
    debtSettlementsResult.error ||
    settingsResult.error
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
      phone: item.phone,
      note: item.note,
      monthlyFee: item.monthly_fee,
    })),
    payments: (paymentsResult.data ?? []).map((item) => ({
      id: item.id,
      apartmentId: item.apartment_id,
      collectorId: item.collector_id,
      month: item.month,
      paidAt: item.paid_at,
      amount: item.amount,
      note: item.note,
      method: item.method as Payment['method'],
    })),
    debtSettlements: (debtSettlementsResult.data ?? []).map((item) => ({
      id: item.id,
      staffId: item.staff_id,
      amount: item.amount,
      submittedAt: item.submitted_at,
      confirmedAt: item.confirmed_at,
      confirmedBy: item.confirmed_by,
      status: item.status as DebtSettlement['status'],
    })),
    settings: {
      appName: settingsResult.data?.app_name ?? 'Thu tiền vệ sinh',
      subtitle:
        settingsResult.data?.subtitle ??
        'Quản lý thu tiền vệ sinh theo từng căn hộ',
      logoUrl: settingsResult.data?.logo_url ?? '',
      theme: (settingsResult.data?.theme ?? 'teal') as AppSettings['theme'],
      showAdminInStats: Boolean(settingsResult.data?.show_admin_in_stats),
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

  fail((await db.from('debt_settlements').delete().not('id', 'is', null)).error);
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
              phone: item.phone,
              note: item.note,
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
              note: item.note,
              method: item.method,
            })),
          )
      ).error,
    );
  if (state.debtSettlements.length)
    fail(
      (
        await db.from('debt_settlements').insert(
          state.debtSettlements.map((item) => ({
            id: item.id,
            staff_id: item.staffId,
            amount: item.amount,
            submitted_at: item.submittedAt,
            confirmed_at: item.confirmedAt,
            confirmed_by: item.confirmedBy,
            status: item.status,
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
        show_admin_in_stats: state.settings.showAdminInStats,
      })
    ).error,
  );
}
