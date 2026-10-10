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
type Region = { id: string; name: string; defaultFee: number; isActive: boolean };
type Block = { id: string; regionId: string; name: string; isActive: boolean };
type Apartment = {
  id: string;
  blockId: string;
  code: string;
  owner: string;
  phone: string;
  note: string;
  monthlyFee: number | null;
  isActive: boolean;
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
  debtAtSubmission: number;
  method: 'cash' | 'transfer';
  submittedAt: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
  status: 'pending' | 'confirmed';
};
type UiPreferences = {
  primaryColor: string;
  backgroundColor: string;
  headerAlignment: 'left' | 'center';
  fontScale: 'small' | 'normal' | 'large';
  density: 'compact' | 'comfortable' | 'spacious';
  tableStyle: 'plain' | 'striped' | 'tinted';
  cornerStyle: 'sharp' | 'soft' | 'rounded';
  cardStyle: 'flat' | 'bordered' | 'soft';
  showSubtitle: boolean;
  fontFamily: 'sans' | 'serif' | 'mono';
  fontSize: number;
  headerBackgroundColor: string;
  headerTextColor: string;
  tableHeaderBackgroundColor: string;
  tableHeaderTextColor: string;
  tableBorderColor: string;
  apartmentInfoBackgroundColor: string;
  tableTextAlign: 'left' | 'center' | 'right';
  mainMenuOrder: string[];
  mainMenuLabels: Record<string, string>;
  mainMenuBackgroundColor: string;
  mainMenuTextColor: string;
  mainMenuActiveBackgroundColor: string;
  mainMenuActiveTextColor: string;
  mainMenuSize: 'small' | 'normal' | 'large';
  mainMenuDisplay: 'scroll' | 'wrap';
  maintenanceEnabled: boolean;
  maintenanceMessage: string;
  maintenanceBackgroundColor: string;
  maintenanceTextColor: string;
  invoice: InvoicePreferences;
};
type InvoicePreferences = {
  showAppName: boolean;
  showApartment: boolean;
  showOwner: boolean;
  showPeriod: boolean;
  showPaidAt: boolean;
  showCollector: boolean;
  showAmount: boolean;
  showMethod: boolean;
  showNote: boolean;
  footer: string;
};
const defaultUiPreferences: UiPreferences = {
  primaryColor: '#007563', backgroundColor: '#f4fbfa', headerAlignment: 'left', fontScale: 'normal', density: 'comfortable', tableStyle: 'tinted', cornerStyle: 'soft', cardStyle: 'bordered', showSubtitle: true,
  fontFamily: 'sans', fontSize: 16, headerBackgroundColor: '#f4fbfa', headerTextColor: '#102a30', tableHeaderBackgroundColor: '#007563', tableHeaderTextColor: '#ffffff', tableBorderColor: '#bdd9d5', apartmentInfoBackgroundColor: '#d9ece3', tableTextAlign: 'left', mainMenuOrder: ['collect', 'account', 'stats', 'users', 'areas', 'debts', 'access-history', 'settings'], mainMenuLabels: {}, mainMenuBackgroundColor: '#eaf6f3', mainMenuTextColor: '#102a30', mainMenuActiveBackgroundColor: '#007563', mainMenuActiveTextColor: '#ffffff', mainMenuSize: 'normal', mainMenuDisplay: 'scroll', maintenanceEnabled: false, maintenanceMessage: 'App đang bảo trì để nâng cấp hệ thống, vui lòng quay lại sau.', maintenanceBackgroundColor: '#f4fbfa', maintenanceTextColor: '#102a30',
  invoice: { showAppName: true, showApartment: true, showOwner: true, showPeriod: true, showPaidAt: true, showCollector: true, showAmount: true, showMethod: true, showNote: true, footer: 'Cảm ơn quý khách đã thanh toán.' },
};
const themeColors = { teal: '#007563', blue: '#1d5fd1', indigo: '#5d42c6', amber: '#b35d00', rose: '#b8325a' } as const;
type AppSettings = {
  appName: string;
  subtitle: string;
  logoUrl: string;
  theme: 'teal' | 'blue' | 'indigo' | 'amber' | 'rose';
  showAdminInStats: boolean;
  autoBackupEnabled: boolean;
  uiPreferences: UiPreferences;
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
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
  });
}

function normalizeUiPreferences(value: unknown, theme: AppSettings['theme'] = 'teal'): UiPreferences {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const invoiceSource = source.invoice && typeof source.invoice === 'object'
    ? source.invoice as Record<string, unknown>
    : {};
  const pick = <T extends string>(key: string, options: readonly T[], fallback: T) =>
    typeof source[key] === 'string' && options.includes(source[key] as T) ? source[key] as T : fallback;
  const color = (key: string, fallback: string) =>
    typeof source[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(source[key] as string) ? source[key] as string : fallback;
  const mainMenuValues = ['collect', 'account', 'stats', 'users', 'areas', 'debts', 'access-history', 'settings'];
  const rawOrder = Array.isArray(source.mainMenuOrder)
    ? source.mainMenuOrder.filter((item): item is string => typeof item === 'string' && mainMenuValues.includes(item))
    : [];
  const mainMenuOrder = [...new Set([...rawOrder, ...mainMenuValues])];
  const rawLabels = source.mainMenuLabels && typeof source.mainMenuLabels === 'object'
    ? source.mainMenuLabels as Record<string, unknown>
    : {};
  const mainMenuLabels = Object.fromEntries(
    mainMenuValues.flatMap((key) =>
      typeof rawLabels[key] === 'string' ? [[key, rawLabels[key].slice(0, 24)]] : [],
    ),
  );
  return {
    primaryColor: color('primaryColor', themeColors[theme]), backgroundColor: color('backgroundColor', defaultUiPreferences.backgroundColor),
    headerAlignment: pick('headerAlignment', ['left', 'center'], defaultUiPreferences.headerAlignment),
    fontScale: pick('fontScale', ['small', 'normal', 'large'], defaultUiPreferences.fontScale),
    density: pick('density', ['compact', 'comfortable', 'spacious'], defaultUiPreferences.density),
    tableStyle: pick('tableStyle', ['plain', 'striped', 'tinted'], defaultUiPreferences.tableStyle),
    cornerStyle: pick('cornerStyle', ['sharp', 'soft', 'rounded'], defaultUiPreferences.cornerStyle),
    cardStyle: pick('cardStyle', ['flat', 'bordered', 'soft'], defaultUiPreferences.cardStyle),
    showSubtitle: typeof source.showSubtitle === 'boolean' ? source.showSubtitle : defaultUiPreferences.showSubtitle,
    fontFamily: pick('fontFamily', ['sans', 'serif', 'mono'], defaultUiPreferences.fontFamily),
    fontSize: typeof source.fontSize === 'number' && source.fontSize >= 12 && source.fontSize <= 20 ? source.fontSize : defaultUiPreferences.fontSize,
    headerBackgroundColor: color('headerBackgroundColor', defaultUiPreferences.headerBackgroundColor),
    headerTextColor: color('headerTextColor', defaultUiPreferences.headerTextColor),
    tableHeaderBackgroundColor: color('tableHeaderBackgroundColor', defaultUiPreferences.tableHeaderBackgroundColor),
    tableHeaderTextColor: color('tableHeaderTextColor', defaultUiPreferences.tableHeaderTextColor),
    tableBorderColor: color('tableBorderColor', defaultUiPreferences.tableBorderColor),
    apartmentInfoBackgroundColor: color('apartmentInfoBackgroundColor', defaultUiPreferences.apartmentInfoBackgroundColor),
    tableTextAlign: pick('tableTextAlign', ['left', 'center', 'right'], defaultUiPreferences.tableTextAlign),
    mainMenuOrder,
    mainMenuLabels,
    mainMenuBackgroundColor: color('mainMenuBackgroundColor', defaultUiPreferences.mainMenuBackgroundColor),
    mainMenuTextColor: color('mainMenuTextColor', defaultUiPreferences.mainMenuTextColor),
    mainMenuActiveBackgroundColor: color('mainMenuActiveBackgroundColor', defaultUiPreferences.mainMenuActiveBackgroundColor),
    mainMenuActiveTextColor: color('mainMenuActiveTextColor', defaultUiPreferences.mainMenuActiveTextColor),
    mainMenuSize: pick('mainMenuSize', ['small', 'normal', 'large'], defaultUiPreferences.mainMenuSize),
    mainMenuDisplay: pick('mainMenuDisplay', ['scroll', 'wrap'], defaultUiPreferences.mainMenuDisplay),
    maintenanceEnabled: typeof source.maintenanceEnabled === 'boolean' ? source.maintenanceEnabled : defaultUiPreferences.maintenanceEnabled,
    maintenanceMessage: typeof source.maintenanceMessage === 'string' ? source.maintenanceMessage.slice(0, 180) : defaultUiPreferences.maintenanceMessage,
    maintenanceBackgroundColor: color('maintenanceBackgroundColor', defaultUiPreferences.maintenanceBackgroundColor),
    maintenanceTextColor: color('maintenanceTextColor', defaultUiPreferences.maintenanceTextColor),
    invoice: {
      showAppName: typeof invoiceSource.showAppName === 'boolean' ? invoiceSource.showAppName : defaultUiPreferences.invoice.showAppName,
      showApartment: typeof invoiceSource.showApartment === 'boolean' ? invoiceSource.showApartment : defaultUiPreferences.invoice.showApartment,
      showOwner: typeof invoiceSource.showOwner === 'boolean' ? invoiceSource.showOwner : defaultUiPreferences.invoice.showOwner,
      showPeriod: typeof invoiceSource.showPeriod === 'boolean' ? invoiceSource.showPeriod : defaultUiPreferences.invoice.showPeriod,
      showPaidAt: typeof invoiceSource.showPaidAt === 'boolean' ? invoiceSource.showPaidAt : defaultUiPreferences.invoice.showPaidAt,
      showCollector: typeof invoiceSource.showCollector === 'boolean' ? invoiceSource.showCollector : defaultUiPreferences.invoice.showCollector,
      showAmount: typeof invoiceSource.showAmount === 'boolean' ? invoiceSource.showAmount : defaultUiPreferences.invoice.showAmount,
      showMethod: typeof invoiceSource.showMethod === 'boolean' ? invoiceSource.showMethod : defaultUiPreferences.invoice.showMethod,
      showNote: typeof invoiceSource.showNote === 'boolean' ? invoiceSource.showNote : defaultUiPreferences.invoice.showNote,
      footer: typeof invoiceSource.footer === 'string' ? invoiceSource.footer.slice(0, 240) : defaultUiPreferences.invoice.footer,
    },
  };
}

async function recordChange(
  actorId: string,
  recordType: string,
  recordId: string,
  action: string,
  details: Record<string, unknown>,
) {
  const db = getSupabaseAdmin();
  if (!db) return;
  // Audit logging must not undo a successfully saved business transaction.
  const { error } = await db.from('record_changes').insert({
    actor_id: actorId,
    record_type: recordType,
    record_id: recordId,
    action,
    details,
  });
  if (error) console.error('Unable to record change history', error);
}

async function paymentAuditDetails(payment: Pick<Payment, 'apartmentId' | 'amount' | 'method'>) {
  const fallback = { amount: payment.amount, method: payment.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt' };
  const db = getSupabaseAdmin();
  if (!db) return fallback;
  try {
    const { data: apartment } = await db
      .from('apartments')
      .select('code, block_id')
      .eq('id', payment.apartmentId)
      .maybeSingle();
    const { data: block } = apartment
      ? await db.from('blocks').select('region_id').eq('id', apartment.block_id).maybeSingle()
      : { data: null };
    const { data: region } = block
      ? await db.from('regions').select('name').eq('id', block.region_id).maybeSingle()
      : { data: null };
    return {
      apartmentCode: apartment?.code ?? null,
      regionName: region?.name ?? null,
      ...fallback,
    };
  } catch {
    return fallback;
  }
}

async function debtSettlementAuditDetails(settlement: Pick<DebtSettlement, 'staffId' | 'amount' | 'method'>) {
  const fallback = {
    amount: settlement.amount,
    method: settlement.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt',
  };
  const db = getSupabaseAdmin();
  if (!db) return fallback;
  try {
    const { data: staff } = await db.from('users').select('name').eq('id', settlement.staffId).maybeSingle();
    return { staffName: staff?.name ?? null, ...fallback };
  } catch {
    return fallback;
  }
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
    if (currentUser.mustChangePassword && !currentUser.impersonatedBy)
      return json({ error: 'Password change required' }, 403);
    const payload = (await request.json()) as {
      state?: AppState;
      action?: string;
      payment?: Partial<Payment>;
      paymentId?: string;
      note?: string;
      amount?: number;
      method?: 'cash' | 'transfer';
      paidAt?: string;
      settlementId?: string;
    };
    const managerMayManage = async (userId: string) => {
      if (currentUser.role === 'admin') return true;
      if (currentUser.role !== 'manager') return false;
      const { data, error } = await db
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data?.role === 'staff';
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
      const { data: insertedPayment, error } = await db.from('payments').insert({
        id: crypto.randomUUID(),
        apartment_id: payment.apartmentId,
        collector_id: currentUser.id,
        month: payment.month,
        paid_at: new Date().toISOString(),
        amount: payment.amount,
        note: String(payment.note ?? '').trim(),
        method: payment.method === 'transfer' ? 'transfer' : 'cash',
      }).select('id, apartment_id, collector_id, month, paid_at, amount, note, method').maybeSingle();
      if (error?.code === '23505')
        return json({ error: 'Căn hộ này đã được thu trong kỳ này.' }, 409);
      if (error) throw error;
      if (!insertedPayment)
        return json({ error: 'Chưa thể xác nhận khoản thu vừa ghi.' }, 503);
      await recordChange(
        currentUser.id,
        'payment',
        insertedPayment.id,
        'Đã ghi nhận thu tiền',
        await paymentAuditDetails({
          apartmentId: payment.apartmentId,
          amount: Number(payment.amount),
          method: payment.method === 'transfer' ? 'transfer' : 'cash',
        }),
      );
      return json({
        ok: true,
        payment: {
          id: insertedPayment.id,
          apartmentId: insertedPayment.apartment_id,
          collectorId: insertedPayment.collector_id,
          month: insertedPayment.month,
          paidAt: insertedPayment.paid_at,
          amount: insertedPayment.amount,
          note: insertedPayment.note,
          method: insertedPayment.method,
        },
      });
    }
    if (payload.action === 'cancel-payment') {
      const paymentId = String(payload.paymentId ?? '');
      if (!paymentId) return json({ error: 'Thiếu mã giao dịch.' }, 400);
      const { data: payment, error: paymentError } = await db
        .from('payments')
        .select('collector_id, apartment_id, amount, method')
        .eq('id', paymentId)
        .maybeSingle();
      if (paymentError) throw paymentError;
      if (!payment) return json({ error: 'Không tìm thấy giao dịch.' }, 404);
      const mayDelete =
        currentUser.id === payment.collector_id ||
        (await managerMayManage(payment.collector_id));
      if (!mayDelete)
        return json({ error: 'Bạn chỉ được xóa khoản thu của chính mình.' }, 403);
      const { error } = await db.from('payments').delete().eq('id', paymentId);
      if (error) throw error;
      await recordChange(
        currentUser.id,
        'payment',
        paymentId,
        'Đã hủy khoản thu',
        await paymentAuditDetails({
          apartmentId: payment.apartment_id,
          amount: payment.amount,
          method: payment.method as Payment['method'],
        }),
      );
      return json({
        ok: true,
        paymentId,
      });
    }
    if (payload.action === 'update-payment') {
      const paymentId = String(payload.paymentId ?? '');
      const amount = Number(payload.amount);
      const paidDate = String(payload.paidAt ?? '');
      const method = payload.method === 'transfer' ? 'transfer' : payload.method === 'cash' ? 'cash' : null;
      if (!paymentId || !Number.isInteger(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(paidDate) || !method)
        return json({ error: 'Thông tin khoản thu không hợp lệ.' }, 400);
      const paidAt = new Date(`${paidDate}T12:00:00+07:00`);
      if (Number.isNaN(paidAt.getTime()))
        return json({ error: 'Ngày thu không hợp lệ.' }, 400);
      const { data: payment, error: paymentError } = await db
        .from('payments')
        .select('collector_id, apartment_id')
        .eq('id', paymentId)
        .maybeSingle();
      if (paymentError) throw paymentError;
      if (!payment) return json({ error: 'Không tìm thấy giao dịch.' }, 404);
      if (payment.collector_id !== currentUser.id)
        return json({ error: 'Bạn chỉ được sửa khoản thu của chính mình.' }, 403);
      const { data: updatedPayment, error } = await db
        .from('payments')
        .update({ amount, paid_at: paidAt.toISOString(), method })
        .eq('id', paymentId)
        .select('id, apartment_id, collector_id, month, paid_at, amount, note, method')
        .maybeSingle();
      if (error) throw error;
      if (!updatedPayment) return json({ error: 'Chưa thể cập nhật khoản thu.' }, 503);
      await recordChange(
        currentUser.id,
        'payment',
        paymentId,
        'Đã sửa khoản thu',
        {
          ...(await paymentAuditDetails({
            apartmentId: payment.apartment_id,
            amount,
            method,
          })),
          paidDate,
        },
      );
      return json({
        ok: true,
        payment: {
          id: updatedPayment.id,
          apartmentId: updatedPayment.apartment_id,
          collectorId: updatedPayment.collector_id,
          month: updatedPayment.month,
          paidAt: updatedPayment.paid_at,
          amount: updatedPayment.amount,
          note: updatedPayment.note,
          method: updatedPayment.method,
        },
      });
    }
    if (payload.action === 'update-payment-note') {
      const paymentId = String(payload.paymentId ?? '');
      if (!paymentId) return json({ error: 'Thiếu mã giao dịch.' }, 400);
      const { data: payment, error: paymentError } = await db
        .from('payments')
        .select('collector_id')
        .eq('id', paymentId)
        .maybeSingle();
      if (paymentError) throw paymentError;
      if (!payment) return json({ error: 'Không tìm thấy giao dịch.' }, 404);
      if (currentUser.role === 'staff' && payment.collector_id !== currentUser.id)
        return json({ error: 'Bạn chỉ được sửa ghi chú khoản thu của mình.' }, 403);
      if (currentUser.role === 'manager' && !(await managerMayManage(payment.collector_id)))
        return json({ error: 'Quản trị chỉ được sửa khoản thu của Nhân viên.' }, 403);
      const { error } = await db
        .from('payments')
        .update({ note: String(payload.note ?? '').trim() })
        .eq('id', paymentId);
      if (error) throw error;
      await recordChange(currentUser.id, 'payment', paymentId, 'Đã cập nhật ghi chú', {
        note: String(payload.note ?? '').trim(),
      });
      return json({ ok: true, paymentId, note: String(payload.note ?? '').trim() });
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
      const confirmedSettled = (settlementsResult.data ?? [])
        .filter((settlement) => settlement.status === 'confirmed')
        .reduce(
          (sum, settlement) => sum + settlement.amount,
          0,
        );
      const debtAtSubmission = totalCollected - confirmedSettled;
      const settlementId = crypto.randomUUID();
      const submittedAt = new Date().toISOString();
      const { data: insertedSettlement, error } = await db.from('debt_settlements').insert({
        id: settlementId,
        staff_id: currentUser.id,
        amount,
        debt_at_submission: debtAtSubmission,
        method: payload.method === 'transfer' ? 'transfer' : 'cash',
        submitted_at: submittedAt,
        status: 'pending',
      }).select('id, staff_id, amount, debt_at_submission, method, submitted_at, confirmed_at, confirmed_by, status').maybeSingle();
      if (error) throw error;
      if (!insertedSettlement) return json({ error: 'Chưa thể xác nhận yêu cầu vừa gửi.' }, 503);
      await recordChange(
        currentUser.id,
        'debt_settlement',
        settlementId,
        'Đã gửi yêu cầu nộp công nợ',
        await debtSettlementAuditDetails({
          staffId: currentUser.id,
          amount,
          method: payload.method === 'transfer' ? 'transfer' : 'cash',
        }),
      );
      return json({
        ok: true,
        settlement: {
          id: insertedSettlement.id,
          staffId: insertedSettlement.staff_id,
          amount: insertedSettlement.amount,
          debtAtSubmission: insertedSettlement.debt_at_submission,
          method: insertedSettlement.method,
          submittedAt: insertedSettlement.submitted_at,
          confirmedAt: insertedSettlement.confirmed_at,
          confirmedBy: insertedSettlement.confirmed_by,
          status: insertedSettlement.status,
        },
      });
    }
    if (payload.action === 'confirm-debt-settlement') {
      if (currentUser.role === 'staff')
        return json({ error: 'Chỉ Quản trị hoặc Admin được xác nhận.' }, 403);
      const settlementId = String(payload.settlementId ?? '');
      if (!settlementId) return json({ error: 'Thiếu mã yêu cầu.' }, 400);
      const { data: settlement, error: settlementError } = await db
        .from('debt_settlements')
        .select('staff_id, amount, method')
        .eq('id', settlementId)
        .maybeSingle();
      if (settlementError) throw settlementError;
      if (!settlement) return json({ error: 'Không tìm thấy giao dịch.' }, 404);
      if (!(await managerMayManage(settlement.staff_id)))
        return json({ error: 'Quản trị chỉ được xác nhận công nợ của Nhân viên.' }, 403);
      const confirmedAt = new Date().toISOString();
      const { data, error } = await db
        .from('debt_settlements')
        .update({
          status: 'confirmed',
          confirmed_at: confirmedAt,
          confirmed_by: currentUser.id,
        })
        .eq('id', settlementId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'Yêu cầu đã được xử lý.' }, 409);
      const [paymentsResult, settlementsResult] = await Promise.all([
        db.from('payments').select('amount').eq('collector_id', settlement.staff_id),
        db
          .from('debt_settlements')
          .select('amount, status')
          .eq('staff_id', settlement.staff_id),
      ]);
      if (paymentsResult.error || settlementsResult.error)
        throw new Error('Read failed');
      const balanceAfter =
        (paymentsResult.data ?? []).reduce(
          (sum, payment) => sum + payment.amount,
          0,
        ) -
        (settlementsResult.data ?? [])
          .filter((item) => item.status === 'confirmed')
          .reduce((sum, item) => sum + item.amount, 0);
      await recordChange(
        currentUser.id,
        'debt_settlement',
        settlementId,
        'Đã xác nhận nộp công nợ',
        {
          ...(await debtSettlementAuditDetails({
            staffId: settlement.staff_id,
            amount: settlement.amount,
            method: settlement.method as DebtSettlement['method'],
          })),
          balanceAfter,
        },
      );
      return json({ ok: true, settlementId, confirmedAt, confirmedBy: currentUser.id });
    }
    if (payload.action === 'update-debt-settlement') {
      if (currentUser.role === 'staff')
        return json({ error: 'Chỉ Quản trị hoặc Admin được sửa công nợ.' }, 403);
      const settlementId = String(payload.settlementId ?? '');
      const amount = Number(payload.amount);
      if (!settlementId || !Number.isInteger(amount) || amount <= 0)
        return json({ error: 'Dữ liệu công nợ không hợp lệ.' }, 400);
      const { data: settlement, error: settlementError } = await db
        .from('debt_settlements')
        .select('id, staff_id, status')
        .eq('id', settlementId)
        .maybeSingle();
      if (settlementError) throw settlementError;
      if (!settlement) return json({ error: 'Không tìm thấy giao dịch.' }, 404);
      if (!(await managerMayManage(settlement.staff_id)))
        return json({ error: 'Quản trị chỉ được sửa công nợ của Nhân viên.' }, 403);
      const [paymentsResult, settlementsResult] = await Promise.all([
        db.from('payments').select('amount').eq('collector_id', settlement.staff_id),
        db
          .from('debt_settlements')
          .select('id, amount, status')
          .eq('staff_id', settlement.staff_id),
      ]);
      if (paymentsResult.error || settlementsResult.error) throw new Error('Read failed');
      const totalCollected = (paymentsResult.data ?? []).reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );
      const otherSettlements = (settlementsResult.data ?? []).filter(
        (item) => item.id !== settlementId,
      );
      const otherConfirmed = otherSettlements
        .filter((item) => item.status === 'confirmed')
        .reduce((sum, item) => sum + item.amount, 0);
      const { error } = await db
        .from('debt_settlements')
        .update({
          amount,
          method: payload.method === 'transfer' ? 'transfer' : 'cash',
          debt_at_submission: totalCollected - otherConfirmed,
        })
        .eq('id', settlementId);
      if (error) throw error;
      await recordChange(
        currentUser.id,
        'debt_settlement',
        settlementId,
        'Đã cập nhật công nợ',
        await debtSettlementAuditDetails({
          staffId: settlement.staff_id,
          amount,
          method: payload.method === 'transfer' ? 'transfer' : 'cash',
        }),
      );
      return json({ ok: true, settlementId, amount, method: payload.method === 'transfer' ? 'transfer' : 'cash' });
    }
    if (payload.action === 'delete-debt-settlement') {
      if (currentUser.role === 'staff')
        return json({ error: 'Chỉ Quản trị hoặc Admin được xóa công nợ.' }, 403);
      const settlementId = String(payload.settlementId ?? '');
      if (!settlementId) return json({ error: 'Thiếu mã giao dịch.' }, 400);
      const { data: settlement, error: settlementError } = await db
        .from('debt_settlements')
        .select('staff_id, amount, method')
        .eq('id', settlementId)
        .maybeSingle();
      if (settlementError) throw settlementError;
      if (!settlement) return json({ error: 'Không tìm thấy giao dịch.' }, 404);
      if (!(await managerMayManage(settlement.staff_id)))
        return json({ error: 'Quản trị chỉ được xóa công nợ của Nhân viên.' }, 403);
      const { error } = await db.from('debt_settlements').delete().eq('id', settlementId);
      if (error) throw error;
      await recordChange(
        currentUser.id,
        'debt_settlement',
        settlementId,
        'Đã xóa yêu cầu công nợ',
        await debtSettlementAuditDetails({
          staffId: settlement.staff_id,
          amount: settlement.amount,
          method: settlement.method as DebtSettlement['method'],
        }),
      );
      return json({ ok: true, settlementId });
    }
    if (!payload.state) return json({ error: 'Missing state' }, 400);
    const existing = await readState();
    const incomingState =
      currentUser.role === 'manager'
        ? {
            ...payload.state,
            users: mergeHiddenAdminUsers(existing.users, payload.state.users),
          }
        : payload.state;
    if (
      currentUser.role === 'manager' &&
      !managerMayApplyUserChanges(existing.users, incomingState.users)
    )
      return json(
        { error: 'Quản trị chỉ được sửa hoặc xóa tài khoản Nhân viên.' },
        403,
      );
    if (
      currentUser.role === 'manager' &&
      JSON.stringify(incomingState.settings) !== JSON.stringify(existing.settings)
    )
      return json({ error: 'Chỉ Admin được thay đổi chế độ sao lưu tự động.' }, 403);
    // Payment records are append-only outside their dedicated API actions. This
    // prevents an unrelated apartment/profile edit from overwriting a newer
    // collection that another account just recorded.
    const protectedPayments = existing.payments;
    const nextState =
      currentUser.role !== 'staff'
        ? { ...incomingState, payments: protectedPayments }
        : { ...existing, payments: protectedPayments };
    await saveState(nextState);
    await recordChange(currentUser.id, 'app_state', 'shared', 'Đã cập nhật dữ liệu quản trị', {
      soKhuVuc: nextState.regions.length,
      soCanHo: nextState.apartments.length,
      soTaiKhoan: nextState.users.length,
    });
    return json({ ok: true });
  } catch {
    return json({ error: 'Chưa thể lưu dữ liệu.' }, 503);
  }
}

function mergeHiddenAdminUsers(existing: User[], incoming: User[]) {
  const incomingIds = new Set(incoming.map((user) => user.id));
  return [
    ...incoming,
    ...existing.filter(
      (user) => user.role === 'admin' && !incomingIds.has(user.id),
    ),
  ];
}

function visibleState(
  state: AppState,
  currentUser: { id: string; role: 'admin' | 'manager' | 'staff' },
) {
  const hideAdmin =
    currentUser.role !== 'admin' && !state.settings.showAdminInStats;
  const adminIds = new Set(
    state.users
      .filter((user) => user.role === 'admin')
      .map((user) => user.id),
  );
  const visibleUsers = hideAdmin
    ? state.users.filter((user) => user.role !== 'admin')
    : state.users;
  const visiblePayments = hideAdmin
    ? state.payments.filter((payment) => !adminIds.has(payment.collectorId))
    : state.payments;

  if (currentUser.role !== 'staff') {
    return { ...state, users: visibleUsers, payments: visiblePayments };
  }
  return {
    ...state,
    payments: visiblePayments,
    debtSettlements: state.debtSettlements.filter(
      (settlement) => settlement.staffId === currentUser.id,
    ),
    users: visibleUsers.map((user) => ({
      ...user,
      phone: user.id === currentUser.id ? user.phone : '',
      email: user.id === currentUser.id ? user.email : '',
    })),
  };
}

function managerMayApplyUserChanges(existing: User[], incoming: User[]) {
  const incomingById = new Map(incoming.map((user) => [user.id, user]));
  const protectedUsers = existing.filter((user) => user.role !== 'staff');
  if (
    protectedUsers.some((user) => {
      const next = incomingById.get(user.id);
      return !next || !sameUser(user, next);
    })
  )
    return false;
  return incoming.every((user) => {
    const existingUser = existing.find((item) => item.id === user.id);
    return user.role === 'staff' || Boolean(existingUser && sameUser(existingUser, user));
  });
}

function sameUser(left: User, right: User) {
  return (
    left.id === right.id &&
    left.phone === right.phone &&
    left.email === right.email &&
    left.name === right.name &&
    left.role === right.role &&
    left.mustChangePassword === right.mustChangePassword
  );
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
    db.from('regions').select('id, name, default_fee, is_active').order('name'),
    db.from('blocks').select('id, region_id, name, is_active').order('name'),
    db
      .from('apartments')
      .select('id, block_id, code, owner, phone, note, monthly_fee, is_active')
      .order('code'),
    db
      .from('payments')
      .select('id, apartment_id, collector_id, month, paid_at, amount, note, method')
      .order('paid_at', { ascending: false }),
    db
      .from('debt_settlements')
      .select('id, staff_id, amount, debt_at_submission, method, submitted_at, confirmed_at, confirmed_by, status')
      .order('submitted_at', { ascending: false }),
    db
      .from('app_settings')
      .select('app_name, subtitle, logo_url, theme, show_admin_in_stats, auto_backup_enabled, ui_preferences')
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
      isActive: item.is_active,
    })),
    blocks: (blocksResult.data ?? []).map((item) => ({
      id: item.id,
      regionId: item.region_id,
      name: item.name,
      isActive: item.is_active,
    })),
    apartments: (apartmentsResult.data ?? []).map((item) => ({
      id: item.id,
      blockId: item.block_id,
      code: item.code,
      owner: item.owner,
      phone: item.phone,
      note: item.note,
      monthlyFee: item.monthly_fee,
      isActive: item.is_active,
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
      debtAtSubmission: item.debt_at_submission,
      method: item.method as DebtSettlement['method'],
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
      autoBackupEnabled: Boolean(settingsResult.data?.auto_backup_enabled),
      uiPreferences: normalizeUiPreferences(settingsResult.data?.ui_preferences, (settingsResult.data?.theme ?? 'teal') as AppSettings['theme']),
    },
  };
}

async function saveState(state: AppState) {
  const db = getSupabaseAdmin();
  if (!db) throw new Error(configurationError());
  const [usersResult, regionsResult, blocksResult, apartmentsResult] =
    await Promise.all([
      db.from('users').select('id, phone, password, email, name, role, must_change_password'),
      db.from('regions').select('id, name, default_fee, is_active'),
      db.from('blocks').select('id, region_id, name, is_active'),
      db.from('apartments').select('id, block_id, code, owner, phone, note, monthly_fee, is_active'),
    ]);
  if (
    usersResult.error ||
    regionsResult.error ||
    blocksResult.error ||
    apartmentsResult.error
  )
    throw new Error('Read failed');
  const storedRows = usersResult.data ?? [];
  const passwordById = new Map(
    storedRows.map((item) => [item.id, item.password]),
  );
  const usersById = new Map(storedRows.map((item) => [item.id, item]));
  const regionsById = new Map((regionsResult.data ?? []).map((item) => [item.id, item]));
  const blocksById = new Map((blocksResult.data ?? []).map((item) => [item.id, item]));
  const apartmentsById = new Map((apartmentsResult.data ?? []).map((item) => [item.id, item]));
  const userIds = new Set(state.users.map((user) => user.id));
  const removedUserIds = storedRows
    .filter((user) => !userIds.has(user.id))
    .map((user) => user.id);
  const fail = (error: { message: string } | null) => {
    if (error) throw error;
  };

  // Area records are deliberately never deleted here: payments reference them.
  if (removedUserIds.length) {
    fail(
      (
        await db
          .from('debt_settlements')
          .delete()
          .in('staff_id', removedUserIds)
      ).error,
    );
    fail(
      (
        await db.from('payments').delete().in('collector_id', removedUserIds)
      ).error,
    );
    fail((await db.from('users').delete().in('id', removedUserIds)).error);
  }
  const users = await Promise.all(
    state.users.filter((user) => {
      const stored = usersById.get(user.id);
      return !stored ||
        stored.phone !== user.phone ||
        stored.email !== user.email ||
        stored.name !== user.name ||
        stored.role !== user.role ||
        Boolean(stored.must_change_password) !== user.mustChangePassword;
    }).map(async (user) => ({
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
  const regions = state.regions
    .filter((item) => {
      const stored = regionsById.get(item.id);
      return !stored || stored.name !== item.name || stored.default_fee !== item.defaultFee || Boolean(stored.is_active) !== item.isActive;
    })
    .map((item) => ({ id: item.id, name: item.name, default_fee: item.defaultFee, is_active: item.isActive }));
  if (regions.length)
    fail(
      (
        await db
          .from('regions')
          .upsert(regions)
      ).error,
    );
  const blocks = state.blocks
    .filter((item) => {
      const stored = blocksById.get(item.id);
      return !stored || stored.region_id !== item.regionId || stored.name !== item.name || Boolean(stored.is_active) !== item.isActive;
    })
    .map((item) => ({ id: item.id, region_id: item.regionId, name: item.name, is_active: item.isActive }));
  if (blocks.length)
    fail(
      (
        await db
          .from('blocks')
          .upsert(blocks)
      ).error,
    );
  const apartments = state.apartments
    .filter((item) => {
      const stored = apartmentsById.get(item.id);
      return !stored ||
        stored.block_id !== item.blockId ||
        stored.code !== item.code ||
        stored.owner !== item.owner ||
        stored.phone !== item.phone ||
        stored.note !== item.note ||
        stored.monthly_fee !== item.monthlyFee || Boolean(stored.is_active) !== item.isActive;
    })
    .map((item) => ({
      id: item.id,
      block_id: item.blockId,
      code: item.code,
      owner: item.owner,
      phone: item.phone,
      note: item.note,
      monthly_fee: item.monthlyFee,
      is_active: item.isActive,
    }));
  if (apartments.length)
    fail(
      (
        await db
          .from('apartments')
          .upsert(apartments)
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
        auto_backup_enabled: state.settings.autoBackupEnabled,
        ui_preferences: normalizeUiPreferences(state.settings.uiPreferences),
      })
    ).error,
  );
}
