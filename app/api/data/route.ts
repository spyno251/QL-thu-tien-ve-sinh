import { env } from 'cloudflare:workers';
import { DEFAULT_PASSWORD, getSessionUser, hashPassword } from '@/lib/app-auth';

export const dynamic = 'force-dynamic';

type AppState = {
  users: User[];
  regions: Region[];
  blocks: Block[];
  apartments: Apartment[];
  payments: Payment[];
};

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

const currentMonth = new Date().toISOString().slice(0, 7);

const seedState: AppState = {
  users: [
    { id: 'u-admin', phone: '0909000001', email: 'admin@thutienrac.local', name: 'Quan tri', role: 'admin', mustChangePassword: false },
    { id: 'u-lan', phone: '0909000002', email: 'lan@thutienrac.local', name: 'Nhan vien Lan', role: 'staff', mustChangePassword: true },
    { id: 'u-minh', phone: '0909000003', email: 'minh@thutienrac.local', name: 'Nhan vien Minh', role: 'staff', mustChangePassword: true },
  ],
  regions: [
    { id: 'r-a', name: 'Khu A', defaultFee: 50000 },
    { id: 'r-b', name: 'Khu B', defaultFee: 60000 },
  ],
  blocks: [
    { id: 'b-a1', regionId: 'r-a', name: 'Day A1' },
    { id: 'b-a2', regionId: 'r-a', name: 'Day A2' },
    { id: 'b-b1', regionId: 'r-b', name: 'Day B1' },
  ],
  apartments: [
    { id: 'apt-a101', blockId: 'b-a1', code: 'A1-101', owner: 'Co Hoa', monthlyFee: null },
    { id: 'apt-a102', blockId: 'b-a1', code: 'A1-102', owner: 'Anh Nam', monthlyFee: null },
    { id: 'apt-a201', blockId: 'b-a2', code: 'A2-201', owner: 'Chi Mai', monthlyFee: 70000 },
    { id: 'apt-b101', blockId: 'b-b1', code: 'B1-101', owner: 'Chu Binh', monthlyFee: null },
  ],
  payments: [
    { id: 'p-sample-1', apartmentId: 'apt-a101', collectorId: 'u-lan', month: currentMonth, paidAt: new Date().toISOString(), amount: 50000 },
  ],
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function getBinding(): D1Database | null {
  return (env as unknown as { DB?: D1Database }).DB ?? null;
}

export async function GET(request: Request) {
  const db = getBinding();
  if (!db) return json({ error: 'DB binding is unavailable' }, 503);
  await seedIfEmpty(db);
  const currentUser = await getSessionUser(db, request);
  if (!currentUser) return json({ error: 'Unauthorized' }, 401);
  return json(visibleState(await readState(db), currentUser));
}

export async function POST(request: Request) {
  const db = getBinding();
  if (!db) return json({ error: 'DB binding is unavailable' }, 503);
  await seedIfEmpty(db);
  const currentUser = await getSessionUser(db, request);
  if (!currentUser) return json({ error: 'Unauthorized' }, 401);
  if (currentUser.mustChangePassword) return json({ error: 'Password change required' }, 403);

  const payload = (await request.json()) as { state?: AppState };
  if (!payload.state) return json({ error: 'Missing state' }, 400);

  const existing = await readState(db);
  const nextState = currentUser.role === 'admin'
    ? payload.state
    : {
        ...existing,
        payments: normalizeStaffPayments(existing.payments, payload.state.payments, currentUser.id),
      };

  await saveState(db, nextState);
  return json({ ok: true, state: visibleState(await readState(db), currentUser) });
}

function visibleState(state: AppState, currentUser: { id: string; role: 'admin' | 'staff' }) {
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

function normalizeStaffPayments(existing: Payment[], incoming: Payment[], currentUserId: string) {
  const existingById = new Map(existing.map((payment) => [payment.id, payment]));
  const incomingIds = new Set(incoming.map((payment) => payment.id));
  const kept = existing.filter(
    (payment) => incomingIds.has(payment.id) || payment.collectorId !== currentUserId,
  );
  const additions = incoming
    .filter((payment) => !existingById.has(payment.id))
    .map((payment) => ({ ...payment, collectorId: currentUserId }));
  return [...additions, ...kept];
}

async function seedIfEmpty(db: D1Database) {
  const row = await db.prepare('SELECT COUNT(*) AS total FROM regions').first<{ total: number }>();
  if ((row?.total ?? 0) > 0) return;
  await saveState(db, seedState);
}

async function readStoredUsers(db: D1Database) {
  const rows = await db
    .prepare(
      `SELECT id, phone, password, email, name, role,
        must_change_password AS mustChangePassword
       FROM users ORDER BY role, name`,
    )
    .all<StoredUser>();
  return rows.results;
}

async function readState(db: D1Database): Promise<AppState> {
  const [storedUsers, regionRows, blockRows, apartmentRows, paymentRows] = await Promise.all([
    readStoredUsers(db),
    db.prepare('SELECT id, name, default_fee AS defaultFee FROM regions ORDER BY name').all<Region>(),
    db.prepare('SELECT id, region_id AS regionId, name FROM blocks ORDER BY name').all<Block>(),
    db.prepare('SELECT id, block_id AS blockId, code, owner, monthly_fee AS monthlyFee FROM apartments ORDER BY code').all<Apartment>(),
    db.prepare('SELECT id, apartment_id AS apartmentId, collector_id AS collectorId, month, paid_at AS paidAt, amount FROM payments ORDER BY paid_at DESC').all<Payment>(),
  ]);

  return {
    users: storedUsers.map(({ password: _password, ...user }) => ({
      ...user,
      mustChangePassword: Boolean(user.mustChangePassword),
    })),
    regions: regionRows.results,
    blocks: blockRows.results,
    apartments: apartmentRows.results,
    payments: paymentRows.results,
  };
}

async function saveState(db: D1Database, state: AppState) {
  const storedUsers = await readStoredUsers(db);
  const storedById = new Map(storedUsers.map((user) => [user.id, user]));
  const incomingIds = new Set(state.users.map((user) => user.id));
  const passwordById = new Map<string, string>();
  for (const user of state.users) {
    passwordById.set(user.id, storedById.get(user.id)?.password ?? (await hashPassword(DEFAULT_PASSWORD)));
  }

  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM payments'),
    db.prepare('DELETE FROM apartments'),
    db.prepare('DELETE FROM blocks'),
    db.prepare('DELETE FROM regions'),
    ...storedUsers.filter((user) => !incomingIds.has(user.id)).map((user) =>
      db.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
    ),
    ...state.users.map((user) =>
      db
        .prepare(
          `INSERT INTO users (id, phone, password, email, name, role, must_change_password)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             phone = excluded.phone,
             email = excluded.email,
             name = excluded.name,
             role = excluded.role,
             must_change_password = excluded.must_change_password`,
        )
        .bind(user.id, user.phone, passwordById.get(user.id), user.email, user.name, user.role, user.mustChangePassword ? 1 : 0),
    ),
    ...state.regions.map((item) =>
      db.prepare('INSERT INTO regions (id, name, default_fee) VALUES (?, ?, ?)').bind(item.id, item.name, item.defaultFee),
    ),
    ...state.blocks.map((item) =>
      db.prepare('INSERT INTO blocks (id, region_id, name) VALUES (?, ?, ?)').bind(item.id, item.regionId, item.name),
    ),
    ...state.apartments.map((item) =>
      db.prepare('INSERT INTO apartments (id, block_id, code, owner, monthly_fee) VALUES (?, ?, ?, ?, ?)').bind(item.id, item.blockId, item.code, item.owner, item.monthlyFee),
    ),
    ...state.payments.map((item) =>
      db.prepare('INSERT INTO payments (id, apartment_id, collector_id, month, paid_at, amount) VALUES (?, ?, ?, ?, ?, ?)').bind(item.id, item.apartmentId, item.collectorId, item.month, item.paidAt, item.amount),
    ),
  ];

  await db.batch(statements);
}
