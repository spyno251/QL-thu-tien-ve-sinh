import { env } from 'cloudflare:workers';

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
  password: string;
  name: string;
  role: 'admin' | 'staff';
};

type Region = {
  id: string;
  name: string;
  defaultFee: number;
};

type Block = {
  id: string;
  regionId: string;
  name: string;
};

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
    {
      id: 'u-admin',
      phone: '0909000001',
      password: 'admin123',
      name: 'Quan tri',
      role: 'admin',
    },
    {
      id: 'u-lan',
      phone: '0909000002',
      password: '123456',
      name: 'Nhan vien Lan',
      role: 'staff',
    },
    {
      id: 'u-minh',
      phone: '0909000003',
      password: '123456',
      name: 'Nhan vien Minh',
      role: 'staff',
    },
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
    {
      id: 'apt-a101',
      blockId: 'b-a1',
      code: 'A1-101',
      owner: 'Co Hoa',
      monthlyFee: null,
    },
    {
      id: 'apt-a102',
      blockId: 'b-a1',
      code: 'A1-102',
      owner: 'Anh Nam',
      monthlyFee: null,
    },
    {
      id: 'apt-a201',
      blockId: 'b-a2',
      code: 'A2-201',
      owner: 'Chi Mai',
      monthlyFee: 70000,
    },
    {
      id: 'apt-b101',
      blockId: 'b-b1',
      code: 'B1-101',
      owner: 'Chu Binh',
      monthlyFee: null,
    },
  ],
  payments: [
    {
      id: 'p-sample-1',
      apartmentId: 'apt-a101',
      collectorId: 'u-lan',
      month: currentMonth,
      paidAt: new Date().toISOString(),
      amount: 50000,
    },
  ],
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function getBinding(): D1Database | null {
  return (env as unknown as { DB?: D1Database }).DB ?? null;
}

export async function GET() {
  const db = getBinding();
  if (!db) return json({ error: 'DB binding is unavailable' }, 503);

  await seedIfEmpty(db);
  return json(await readState(db));
}

export async function POST(request: Request) {
  const db = getBinding();
  if (!db) return json({ error: 'DB binding is unavailable' }, 503);

  const payload = (await request.json()) as { state?: AppState };
  if (!payload.state) return json({ error: 'Missing state' }, 400);

  await saveState(db, payload.state);
  return json({ ok: true, state: await readState(db) });
}

async function seedIfEmpty(db: D1Database) {
  const row = await db
    .prepare('SELECT COUNT(*) AS total FROM users')
    .first<{ total: number }>();
  if ((row?.total ?? 0) > 0) return;
  await saveState(db, seedState);
}

async function readState(db: D1Database): Promise<AppState> {
  const [userRows, regionRows, blockRows, apartmentRows, paymentRows] =
    await Promise.all([
      db
        .prepare('SELECT id, phone, password, name, role FROM users ORDER BY role, name')
        .all<User>(),
      db
        .prepare('SELECT id, name, default_fee AS defaultFee FROM regions ORDER BY name')
        .all<Region>(),
      db
        .prepare('SELECT id, region_id AS regionId, name FROM blocks ORDER BY name')
        .all<Block>(),
      db
        .prepare(
          'SELECT id, block_id AS blockId, code, owner, monthly_fee AS monthlyFee FROM apartments ORDER BY code',
        )
        .all<Apartment>(),
      db
        .prepare(
          'SELECT id, apartment_id AS apartmentId, collector_id AS collectorId, month, paid_at AS paidAt, amount FROM payments ORDER BY paid_at DESC',
        )
        .all<Payment>(),
    ]);

  return {
    users: userRows.results,
    regions: regionRows.results,
    blocks: blockRows.results,
    apartments: apartmentRows.results,
    payments: paymentRows.results,
  };
}

async function saveState(db: D1Database, state: AppState) {
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM payments'),
    db.prepare('DELETE FROM apartments'),
    db.prepare('DELETE FROM blocks'),
    db.prepare('DELETE FROM regions'),
    db.prepare('DELETE FROM users'),
    ...state.users.map((item) =>
      db
        .prepare('INSERT INTO users (id, phone, password, name, role) VALUES (?, ?, ?, ?, ?)')
        .bind(item.id, item.phone, item.password, item.name, item.role),
    ),
    ...state.regions.map((item) =>
      db
        .prepare('INSERT INTO regions (id, name, default_fee) VALUES (?, ?, ?)')
        .bind(item.id, item.name, item.defaultFee),
    ),
    ...state.blocks.map((item) =>
      db
        .prepare('INSERT INTO blocks (id, region_id, name) VALUES (?, ?, ?)')
        .bind(item.id, item.regionId, item.name),
    ),
    ...state.apartments.map((item) =>
      db
        .prepare(
          'INSERT INTO apartments (id, block_id, code, owner, monthly_fee) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(item.id, item.blockId, item.code, item.owner, item.monthlyFee),
    ),
    ...state.payments.map((item) =>
      db
        .prepare(
          'INSERT INTO payments (id, apartment_id, collector_id, month, paid_at, amount) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(
          item.id,
          item.apartmentId,
          item.collectorId,
          item.month,
          item.paidAt,
          item.amount,
        ),
    ),
  ];

  await db.batch(statements);
}
