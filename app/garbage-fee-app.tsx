'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Role = 'admin' | 'staff';

type User = {
  id: string;
  phone: string;
  password: string;
  name: string;
  role: Role;
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

type AppState = {
  users: User[];
  regions: Region[];
  blocks: Block[];
  apartments: Apartment[];
  payments: Payment[];
};

type WebMCPDocument = Document & {
  modelContext?: {
    registerTool: (
      tool: {
        name: string;
        title: string;
        description: string;
        inputSchema: object;
        annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
        execute: (input: unknown) => unknown | Promise<unknown>;
      },
      options: { signal: AbortSignal },
    ) => void | Promise<void>;
  };
};

const monthNow = new Date().toISOString().slice(0, 7);

const initialState: AppState = {
  users: [
    {
      id: 'u-admin',
      phone: '0909000001',
      password: 'admin123',
      name: 'Quản trị',
      role: 'admin',
    },
    {
      id: 'u-lan',
      phone: '0909000002',
      password: '123456',
      name: 'Nhân viên Lan',
      role: 'staff',
    },
    {
      id: 'u-minh',
      phone: '0909000003',
      password: '123456',
      name: 'Nhân viên Minh',
      role: 'staff',
    },
  ],
  regions: [
    { id: 'r-a', name: 'Khu A', defaultFee: 50000 },
    { id: 'r-b', name: 'Khu B', defaultFee: 60000 },
  ],
  blocks: [
    { id: 'b-a1', regionId: 'r-a', name: 'Dãy A1' },
    { id: 'b-a2', regionId: 'r-a', name: 'Dãy A2' },
    { id: 'b-b1', regionId: 'r-b', name: 'Dãy B1' },
  ],
  apartments: [
    { id: 'apt-a101', blockId: 'b-a1', code: 'A1-101', owner: 'Cô Hoa', monthlyFee: null },
    { id: 'apt-a102', blockId: 'b-a1', code: 'A1-102', owner: 'Anh Nam', monthlyFee: null },
    { id: 'apt-a201', blockId: 'b-a2', code: 'A2-201', owner: 'Chị Mai', monthlyFee: 70000 },
    { id: 'apt-b101', blockId: 'b-b1', code: 'B1-101', owner: 'Chú Bình', monthlyFee: null },
  ],
  payments: [
    {
      id: 'p-sample-1',
      apartmentId: 'apt-a101',
      collectorId: 'u-lan',
      month: monthNow,
      paidAt: new Date().toISOString(),
      amount: 50000,
    },
  ],
};

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function parseAmount(value: string, fallback: number) {
  const amount = Number(value.replaceAll('.', '').replaceAll(',', ''));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : fallback;
}

export default function GarbageFeeApp() {
  const [state, setState] = useState<AppState>(initialState);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginPhone, setLoginPhone] = useState('0909000001');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [loginError, setLoginError] = useState('');
  const [syncStatus, setSyncStatus] = useState<'loading' | 'synced' | 'saving' | 'local'>(
    'loading',
  );
  const [selectedMonth, setSelectedMonth] = useState(monthNow);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedBlock, setSelectedBlock] = useState('all');
  const [query, setQuery] = useState('');
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({});
  const [newRegion, setNewRegion] = useState({ name: '', defaultFee: '50000' });
  const [newBlock, setNewBlock] = useState({ regionId: 'r-a', name: '' });
  const [newApartment, setNewApartment] = useState({
    blockId: 'b-a1',
    code: '',
    owner: '',
    monthlyFee: '',
  });
  const [newUser, setNewUser] = useState({
    name: '',
    phone: '',
    password: '123456',
    role: 'staff' as Role,
  });

  useEffect(() => {
    let active = true;
    fetch('/api/data')
      .then((response) => {
        if (!response.ok) throw new Error('No shared database');
        return response.json() as Promise<AppState>;
      })
      .then((data) => {
        if (!active) return;
        setState(data);
        setSyncStatus('synced');
        if (data.regions[0]) setNewBlock((item) => ({ ...item, regionId: data.regions[0].id }));
        if (data.blocks[0]) setNewApartment((item) => ({ ...item, blockId: data.blocks[0].id }));
      })
      .catch(() => {
        if (active) setSyncStatus('local');
      });
    return () => {
      active = false;
    };
  }, []);

  const commit = async (nextState: AppState) => {
    setState(nextState);
    setSyncStatus('saving');

    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: nextState }),
      });
      if (!response.ok) throw new Error('Unable to save');
      const payload = (await response.json()) as { state?: AppState };
      if (payload.state) setState(payload.state);
      setSyncStatus('synced');
    } catch {
      setSyncStatus('local');
    }
  };

  const lookups = useMemo(() => {
    const regions = new Map(state.regions.map((item) => [item.id, item]));
    const blocks = new Map(state.blocks.map((item) => [item.id, item]));
    const users = new Map(state.users.map((item) => [item.id, item]));
    return { regions, blocks, users };
  }, [state]);

  const filteredBlocks = state.blocks.filter(
    (block) => selectedRegion === 'all' || block.regionId === selectedRegion,
  );

  const visibleApartments = state.apartments
    .filter((apartment) => {
      const block = lookups.blocks.get(apartment.blockId);
      const regionId = block?.regionId ?? '';
      const matchesRegion = selectedRegion === 'all' || selectedRegion === regionId;
      const matchesBlock = selectedBlock === 'all' || selectedBlock === apartment.blockId;
      const text = `${apartment.code} ${apartment.owner}`.toLowerCase();
      return matchesRegion && matchesBlock && text.includes(query.toLowerCase());
    })
    .sort((a, b) => a.code.localeCompare(b.code, 'vi'));

  const currentMonthPayments = state.payments.filter((item) => item.month === selectedMonth);
  const paidApartmentIds = new Set(currentMonthPayments.map((item) => item.apartmentId));
  const totalDue = state.apartments.reduce((sum, item) => sum + getFee(item, lookups), 0);
  const totalPaid = currentMonthPayments.reduce((sum, item) => sum + item.amount, 0);
  const myTotal = currentMonthPayments
    .filter((item) => item.collectorId === currentUser?.id)
    .reduce((sum, item) => sum + item.amount, 0);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const user = state.users.find(
      (item) => item.phone === loginPhone.trim() && item.password === loginPassword,
    );
    if (!user) {
      setLoginError('Số điện thoại hoặc mật khẩu chưa đúng.');
      return;
    }
    setLoginError('');
    setCurrentUser(user);
  };

  const recordPayment = (apartment: Apartment) => {
    if (!currentUser) return;
    const defaultAmount = getFee(apartment, lookups);
    const amount = parseAmount(draftAmounts[apartment.id] ?? '', defaultAmount);
    const nextPayments = state.payments.filter(
      (item) => !(item.apartmentId === apartment.id && item.month === selectedMonth),
    );
    const nextState = {
      ...state,
      payments: [
        {
          id: uid('pay'),
          apartmentId: apartment.id,
          collectorId: currentUser.id,
          month: selectedMonth,
          paidAt: new Date().toISOString(),
          amount,
        },
        ...nextPayments,
      ],
    };
    void commit(nextState);
  };

  const cancelPayment = (paymentId: string) => {
    void commit({
      ...state,
      payments: state.payments.filter((item) => item.id !== paymentId),
    });
  };

  useEffect(() => {
    const context = (document as WebMCPDocument).modelContext;
    if (!context?.registerTool || !currentUser) return;

    const lifecycle = new AbortController();
    const reportError = (error: unknown) => {
      console.error('WebMCP registration failed', error);
    };

    const register = (tool: Parameters<typeof context.registerTool>[0]) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(reportError);
      } catch (error) {
        reportError(error);
      }
    };

    register({
      name: 'read_month_collection_summary',
      title: 'Read collection summary',
      description:
        'Read the current month summary for apartments, collected payments, total amount, and active user.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        return {
          month: selectedMonth,
          user: currentUser.name,
          apartments: state.apartments.length,
          collected: paidApartmentIds.size,
          uncollected: Math.max(0, state.apartments.length - paidApartmentIds.size),
          totalPaid,
          myTotal,
        };
      },
    });

    register({
      name: 'record_apartment_payment',
      title: 'Record apartment payment',
      description:
        'Record one payment by apartment code for the selected month and attribute it to the signed-in user.',
      inputSchema: {
        type: 'object',
        properties: {
          apartmentCode: { type: 'string' },
          amount: { type: 'number', minimum: 1 },
        },
        required: ['apartmentCode'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const payload = input as { apartmentCode?: unknown; amount?: unknown };
        const apartmentCode =
          typeof payload.apartmentCode === 'string' ? payload.apartmentCode.trim() : '';
        if (!apartmentCode) throw new Error('apartmentCode is required');

        const apartment = state.apartments.find(
          (item) => item.code.toLowerCase() === apartmentCode.toLowerCase(),
        );
        if (!apartment) throw new Error('Apartment not found');

        const existing = state.payments.find(
          (item) => item.apartmentId === apartment.id && item.month === selectedMonth,
        );
        if (existing) throw new Error('Apartment is already paid for this month');

        const amount =
          typeof payload.amount === 'number' && Number.isFinite(payload.amount)
            ? Math.round(payload.amount)
            : getFee(apartment, lookups);
        const payment: Payment = {
          id: uid('pay'),
          apartmentId: apartment.id,
          collectorId: currentUser.id,
          month: selectedMonth,
          paidAt: new Date().toISOString(),
          amount,
        };
        await commit({ ...state, payments: [payment, ...state.payments] });
        return {
          status: 'recorded',
          apartmentCode: apartment.code,
          month: selectedMonth,
          amount,
          collector: currentUser.name,
        };
      },
    });

    return () => lifecycle.abort();
  }, [
    currentUser,
    lookups,
    myTotal,
    paidApartmentIds.size,
    selectedMonth,
    state,
    totalPaid,
  ]);

  const updateRegion = (id: string, patch: Partial<Region>) => {
    void commit({
      ...state,
      regions: state.regions.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  const addRegion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newRegion.name.trim()) return;
    const item = {
      id: uid('region'),
      name: newRegion.name.trim(),
      defaultFee: parseAmount(newRegion.defaultFee, 50000),
    };
    setNewRegion({ name: '', defaultFee: '50000' });
    void commit({ ...state, regions: [...state.regions, item] });
  };

  const deleteRegion = (id: string) => {
    const blockIds = state.blocks.filter((item) => item.regionId === id).map((item) => item.id);
    const apartmentIds = state.apartments
      .filter((item) => blockIds.includes(item.blockId))
      .map((item) => item.id);
    void commit({
      ...state,
      regions: state.regions.filter((item) => item.id !== id),
      blocks: state.blocks.filter((item) => item.regionId !== id),
      apartments: state.apartments.filter((item) => !blockIds.includes(item.blockId)),
      payments: state.payments.filter((item) => !apartmentIds.includes(item.apartmentId)),
    });
  };

  const addBlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newBlock.name.trim() || !newBlock.regionId) return;
    void commit({
      ...state,
      blocks: [...state.blocks, { id: uid('block'), regionId: newBlock.regionId, name: newBlock.name.trim() }],
    });
    setNewBlock({ ...newBlock, name: '' });
  };

  const deleteBlock = (id: string) => {
    const apartmentIds = state.apartments
      .filter((item) => item.blockId === id)
      .map((item) => item.id);
    void commit({
      ...state,
      blocks: state.blocks.filter((item) => item.id !== id),
      apartments: state.apartments.filter((item) => item.blockId !== id),
      payments: state.payments.filter((item) => !apartmentIds.includes(item.apartmentId)),
    });
  };

  const updateBlock = (id: string, patch: Partial<Block>) => {
    void commit({
      ...state,
      blocks: state.blocks.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  const addApartment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newApartment.blockId || !newApartment.code.trim()) return;
    const monthlyFee = newApartment.monthlyFee.trim()
      ? parseAmount(newApartment.monthlyFee, 0)
      : null;
    void commit({
      ...state,
      apartments: [
        ...state.apartments,
        {
          id: uid('apt'),
          blockId: newApartment.blockId,
          code: newApartment.code.trim(),
          owner: newApartment.owner.trim(),
          monthlyFee,
        },
      ],
    });
    setNewApartment({ ...newApartment, code: '', owner: '', monthlyFee: '' });
  };

  const updateApartment = (id: string, patch: Partial<Apartment>) => {
    void commit({
      ...state,
      apartments: state.apartments.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  const deleteApartment = (id: string) => {
    void commit({
      ...state,
      apartments: state.apartments.filter((item) => item.id !== id),
      payments: state.payments.filter((item) => item.apartmentId !== id),
    });
  };

  const addUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newUser.name.trim() || !newUser.phone.trim() || !newUser.password) return;
    void commit({
      ...state,
      users: [
        ...state.users,
        {
          id: uid('user'),
          name: newUser.name.trim(),
          phone: newUser.phone.trim(),
          password: newUser.password,
          role: newUser.role,
        },
      ],
    });
    setNewUser({ name: '', phone: '', password: '123456', role: 'staff' });
  };

  const updateUser = (id: string, patch: Partial<User>) => {
    void commit({
      ...state,
      users: state.users.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  const deleteUser = (id: string) => {
    if (id === currentUser?.id) return;
    void commit({
      ...state,
      users: state.users.filter((item) => item.id !== id),
      payments: state.payments.filter((item) => item.collectorId !== id),
    });
  };

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d9f0ef_0,#f4f7f4_31%,#f8fafc_68%)] px-4 py-8 text-foreground">
        <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1 text-sm font-medium text-muted-foreground shadow-sm">
              <ReceiptText className="size-4 text-primary" />
              Quản lý thu tiền rác
            </div>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
                Theo dõi từng căn hộ đã thu, ai thu, thu ngày nào.
              </h1>
              <p className="max-w-xl text-base leading-7 text-slate-600">
                Admin tạo tài khoản bằng số điện thoại và mật khẩu. Nhân viên
                dùng chung dữ liệu, mỗi lần thu đều ghi lại căn hộ, tháng, ngày,
                số tiền và người thu.
              </p>
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              <Metric label="Căn hộ mẫu" value={String(state.apartments.length)} icon={Building2} />
              <Metric label="Đã thu tháng này" value={String(paidApartmentIds.size)} icon={ReceiptText} />
              <Metric label="Nhân viên" value={String(state.users.length - 1)} icon={UsersRound} />
            </div>
          </div>

          <form
            onSubmit={handleLogin}
            className="rounded-lg border bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)]"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Đăng nhập</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Dùng số điện thoại làm ID đăng nhập.
                </p>
              </div>
              <KeyRound className="size-9 rounded-lg bg-primary/10 p-2 text-primary" />
            </div>

            <div className="space-y-4">
              <Field label="Số điện thoại">
                <Input
                  value={loginPhone}
                  inputMode="tel"
                  onChange={(event) => setLoginPhone(event.target.value)}
                />
              </Field>
              <Field label="Mật khẩu">
                <Input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                />
              </Field>
              {loginError && <p className="text-sm font-medium text-destructive">{loginError}</p>}
              <Button type="submit" className="w-full" size="lg">
                <Lock className="size-4" />
                Vào app
              </Button>
            </div>

            <div className="mt-5 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Tài khoản thử</p>
              <p>Admin: 0909000001 / admin123</p>
              <p>Nhân viên: 0909000002 / 123456</p>
            </div>
          </form>
        </section>
      </main>
    );
  }

  const isAdmin = currentUser.role === 'admin';
  const syncText =
    syncStatus === 'synced'
      ? 'Đã đồng bộ'
      : syncStatus === 'saving'
        ? 'Đang lưu'
        : syncStatus === 'loading'
          ? 'Đang tải'
          : 'Chế độ dữ liệu mẫu';

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ReceiptText className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Thu tiền rác</h1>
              <p className="text-sm text-muted-foreground">
                {currentUser.name} · {currentUser.role === 'admin' ? 'Admin' : 'Nhân viên'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={syncStatus === 'local' ? 'destructive' : 'secondary'}>{syncText}</Badge>
            <Button type="button" variant="outline" onClick={() => setCurrentUser(null)}>
              <LogOut className="size-4" />
              Đăng xuất
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5">
        <section className="grid gap-3 md:grid-cols-4">
          <Metric label="Tổng căn hộ" value={String(state.apartments.length)} icon={Building2} />
          <Metric label="Đã thu" value={`${paidApartmentIds.size}/${state.apartments.length}`} icon={ReceiptText} />
          <Metric label="Tổng tháng" value={money.format(totalPaid)} icon={CircleDollarSign} />
          <Metric label="Tôi đã thu" value={money.format(myTotal)} icon={UserRound} />
        </section>

        <Tabs defaultValue="collect" className="mt-5">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="collect">Thu tháng</TabsTrigger>
            <TabsTrigger value="stats">Thống kê</TabsTrigger>
            <TabsTrigger value="areas">Khu vực</TabsTrigger>
            <TabsTrigger value="users">Nhân viên</TabsTrigger>
          </TabsList>

          <TabsContent value="collect" className="mt-4">
            <section className="rounded-lg border bg-card p-4">
              <div className="mb-4 grid gap-3 lg:grid-cols-[150px_170px_170px_minmax(220px,1fr)]">
                <Field label="Tháng">
                  <Input
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                  />
                </Field>
                <Field label="Khu vực">
                  <NativeSelect
                    className="w-full"
                    value={selectedRegion}
                    onChange={(event) => {
                      setSelectedRegion(event.target.value);
                      setSelectedBlock('all');
                    }}
                  >
                    <NativeSelectOption value="all">Tất cả</NativeSelectOption>
                    {state.regions.map((region) => (
                      <NativeSelectOption key={region.id} value={region.id}>
                        {region.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Dãy">
                  <NativeSelect
                    className="w-full"
                    value={selectedBlock}
                    onChange={(event) => setSelectedBlock(event.target.value)}
                  >
                    <NativeSelectOption value="all">Tất cả</NativeSelectOption>
                    {filteredBlocks.map((block) => (
                      <NativeSelectOption key={block.id} value={block.id}>
                        {block.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Tìm căn hộ">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="Số căn hộ hoặc tên chủ hộ"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                </Field>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Căn hộ</TableHead>
                    <TableHead>Khu/Dãy</TableHead>
                    <TableHead>Số tiền</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Người thu</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleApartments.map((apartment) => {
                    const block = lookups.blocks.get(apartment.blockId);
                    const region = block ? lookups.regions.get(block.regionId) : null;
                    const payment = currentMonthPayments.find(
                      (item) => item.apartmentId === apartment.id,
                    );
                    const collector = payment ? lookups.users.get(payment.collectorId) : null;
                    const defaultFee = getFee(apartment, lookups);
                    return (
                      <TableRow key={apartment.id}>
                        <TableCell>
                          <div className="font-medium">{apartment.code}</div>
                          <div className="text-sm text-muted-foreground">{apartment.owner || 'Chưa có tên'}</div>
                        </TableCell>
                        <TableCell>{region?.name ?? '-'} / {block?.name ?? '-'}</TableCell>
                        <TableCell>
                          {payment ? (
                            money.format(payment.amount)
                          ) : (
                            <Input
                              className="w-32"
                              inputMode="numeric"
                              value={draftAmounts[apartment.id] ?? String(defaultFee)}
                              onChange={(event) =>
                                setDraftAmounts({
                                  ...draftAmounts,
                                  [apartment.id]: event.target.value,
                                })
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={payment ? 'default' : 'outline'}>
                            {payment ? 'Đã thu' : 'Chưa thu'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {payment ? (
                            <div>
                              <div>{collector?.name ?? payment.collectorId}</div>
                              <div className="text-xs text-muted-foreground">{formatDate(payment.paidAt)}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {payment ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => cancelPayment(payment.id)}
                            >
                              Hủy
                            </Button>
                          ) : (
                            <Button type="button" size="sm" onClick={() => recordPayment(apartment)}>
                              Thu
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </section>
          </TabsContent>

          <TabsContent value="stats" className="mt-4">
            <StatsView
              state={state}
              month={selectedMonth}
              currentUser={currentUser}
              totalDue={totalDue}
              totalPaid={totalPaid}
              lookups={lookups}
            />
          </TabsContent>

          <TabsContent value="areas" className="mt-4">
            {isAdmin ? (
              <AdminAreas
                state={state}
                newRegion={newRegion}
                setNewRegion={setNewRegion}
                addRegion={addRegion}
                updateRegion={updateRegion}
                deleteRegion={deleteRegion}
                newBlock={newBlock}
                setNewBlock={setNewBlock}
                addBlock={addBlock}
                updateBlock={updateBlock}
                deleteBlock={deleteBlock}
                newApartment={newApartment}
                setNewApartment={setNewApartment}
                addApartment={addApartment}
                updateApartment={updateApartment}
                deleteApartment={deleteApartment}
              />
            ) : (
              <Restricted />
            )}
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            {isAdmin ? (
              <AdminUsers
                users={state.users}
                currentUserId={currentUser.id}
                newUser={newUser}
                setNewUser={setNewUser}
                addUser={addUser}
                updateUser={updateUser}
                deleteUser={deleteUser}
              />
            ) : (
              <Restricted />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function getFee(
  apartment: Apartment,
  lookups: {
    regions: Map<string, Region>;
    blocks: Map<string, Block>;
  },
) {
  if (apartment.monthlyFee) return apartment.monthlyFee;
  const block = lookups.blocks.get(apartment.blockId);
  const region = block ? lookups.regions.get(block.regionId) : null;
  return region?.defaultFee ?? 0;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-2 min-h-8 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Restricted() {
  return (
    <section className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
      Chỉ tài khoản admin được thêm, sửa hoặc xóa dữ liệu quản lý.
    </section>
  );
}

function StatsView({
  state,
  month,
  currentUser,
  totalDue,
  totalPaid,
  lookups,
}: {
  state: AppState;
  month: string;
  currentUser: User;
  totalDue: number;
  totalPaid: number;
  lookups: { regions: Map<string, Region>; blocks: Map<string, Block>; users: Map<string, User> };
}) {
  const payments = state.payments.filter((item) => item.month === month);
  const byUser = state.users.map((user) => {
    const userPayments = payments.filter((item) => item.collectorId === user.id);
    return {
      user,
      count: userPayments.length,
      total: userPayments.reduce((sum, item) => sum + item.amount, 0),
    };
  });

  return (
    <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold">Tổng hợp tháng {month}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Dự kiến" value={money.format(totalDue)} icon={CalendarDays} />
          <Metric label="Đã thu" value={money.format(totalPaid)} icon={CircleDollarSign} />
        </div>
        <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
          Riêng {currentUser.name}: {money.format(
            payments
              .filter((item) => item.collectorId === currentUser.id)
              .reduce((sum, item) => sum + item.amount, 0),
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold">Theo nhân viên</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nhân viên</TableHead>
              <TableHead>Số căn</TableHead>
              <TableHead>Tổng tiền</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byUser.map(({ user, count, total }) => (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{count}</TableCell>
                <TableCell>{money.format(total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border bg-card p-4 lg:col-span-2">
        <h2 className="mb-3 text-base font-semibold">Lịch sử thu gần đây</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Căn hộ</TableHead>
              <TableHead>Người thu</TableHead>
              <TableHead>Ngày thu</TableHead>
              <TableHead>Số tiền</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.payments.slice(0, 12).map((payment) => {
              const apartment = state.apartments.find((item) => item.id === payment.apartmentId);
              const collector = lookups.users.get(payment.collectorId);
              return (
                <TableRow key={payment.id}>
                  <TableCell>{apartment?.code ?? payment.apartmentId}</TableCell>
                  <TableCell>{collector?.name ?? payment.collectorId}</TableCell>
                  <TableCell>{formatDate(payment.paidAt)}</TableCell>
                  <TableCell>{money.format(payment.amount)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function AdminAreas(props: {
  state: AppState;
  newRegion: { name: string; defaultFee: string };
  setNewRegion: (value: { name: string; defaultFee: string }) => void;
  addRegion: (event: FormEvent<HTMLFormElement>) => void;
  updateRegion: (id: string, patch: Partial<Region>) => void;
  deleteRegion: (id: string) => void;
  newBlock: { regionId: string; name: string };
  setNewBlock: (value: { regionId: string; name: string }) => void;
  addBlock: (event: FormEvent<HTMLFormElement>) => void;
  updateBlock: (id: string, patch: Partial<Block>) => void;
  deleteBlock: (id: string) => void;
  newApartment: { blockId: string; code: string; owner: string; monthlyFee: string };
  setNewApartment: (value: { blockId: string; code: string; owner: string; monthlyFee: string }) => void;
  addApartment: (event: FormEvent<HTMLFormElement>) => void;
  updateApartment: (id: string, patch: Partial<Apartment>) => void;
  deleteApartment: (id: string) => void;
}) {
  const { state } = props;
  const regionName = (id: string) => state.regions.find((item) => item.id === id)?.name ?? '-';

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold">Khu vực</h2>
        <form onSubmit={props.addRegion} className="mb-4 grid gap-2 sm:grid-cols-[1fr_130px_auto]">
          <Input
            placeholder="Tên khu vực"
            value={props.newRegion.name}
            onChange={(event) => props.setNewRegion({ ...props.newRegion, name: event.target.value })}
          />
          <Input
            inputMode="numeric"
            value={props.newRegion.defaultFee}
            onChange={(event) => props.setNewRegion({ ...props.newRegion, defaultFee: event.target.value })}
          />
          <Button type="submit">
            <Plus className="size-4" />
            Thêm
          </Button>
        </form>
        <div className="space-y-2">
          {state.regions.map((region) => (
            <div key={region.id} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_130px_auto]">
              <Input
                value={region.name}
                onChange={(event) => props.updateRegion(region.id, { name: event.target.value })}
              />
              <Input
                inputMode="numeric"
                value={String(region.defaultFee)}
                onChange={(event) =>
                  props.updateRegion(region.id, {
                    defaultFee: parseAmount(event.target.value, region.defaultFee),
                  })
                }
              />
              <IconButton label="Xóa khu vực" onClick={() => props.deleteRegion(region.id)} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold">Dãy</h2>
        <form onSubmit={props.addBlock} className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <NativeSelect
            className="w-full"
            value={props.newBlock.regionId}
            onChange={(event) => props.setNewBlock({ ...props.newBlock, regionId: event.target.value })}
          >
            {state.regions.map((region) => (
              <NativeSelectOption key={region.id} value={region.id}>
                {region.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Input
            placeholder="Tên dãy"
            value={props.newBlock.name}
            onChange={(event) => props.setNewBlock({ ...props.newBlock, name: event.target.value })}
          />
          <Button type="submit">
            <Plus className="size-4" />
            Thêm
          </Button>
        </form>
        <div className="space-y-2">
          {state.blocks.map((block) => (
            <div key={block.id} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1fr_auto]">
              <NativeSelect
                className="w-full"
                value={block.regionId}
                onChange={(event) => props.updateBlock(block.id, { regionId: event.target.value })}
              >
                {state.regions.map((region) => (
                  <NativeSelectOption key={region.id} value={region.id}>
                    {region.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Input
                value={block.name}
                onChange={(event) => props.updateBlock(block.id, { name: event.target.value })}
              />
              <IconButton label="Xóa dãy" onClick={() => props.deleteBlock(block.id)} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold">Căn hộ</h2>
        <form onSubmit={props.addApartment} className="mb-4 grid gap-2">
          <NativeSelect
            className="w-full"
            value={props.newApartment.blockId}
            onChange={(event) =>
              props.setNewApartment({ ...props.newApartment, blockId: event.target.value })
            }
          >
            {state.blocks.map((block) => (
              <NativeSelectOption key={block.id} value={block.id}>
                {regionName(block.regionId)} / {block.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              placeholder="Số căn"
              value={props.newApartment.code}
              onChange={(event) =>
                props.setNewApartment({ ...props.newApartment, code: event.target.value })
              }
            />
            <Input
              placeholder="Chủ hộ"
              value={props.newApartment.owner}
              onChange={(event) =>
                props.setNewApartment({ ...props.newApartment, owner: event.target.value })
              }
            />
            <Input
              placeholder="Tiền riêng"
              inputMode="numeric"
              value={props.newApartment.monthlyFee}
              onChange={(event) =>
                props.setNewApartment({ ...props.newApartment, monthlyFee: event.target.value })
              }
            />
          </div>
          <Button type="submit">
            <Plus className="size-4" />
            Thêm căn hộ
          </Button>
        </form>
        <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
          {state.apartments.map((apartment) => (
            <div key={apartment.id} className="grid gap-2 rounded-lg border p-2">
              <NativeSelect
                className="w-full"
                value={apartment.blockId}
                onChange={(event) => props.updateApartment(apartment.id, { blockId: event.target.value })}
              >
                {state.blocks.map((block) => (
                  <NativeSelectOption key={block.id} value={block.id}>
                    {regionName(block.regionId)} / {block.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_110px_auto]">
                <Input
                  value={apartment.code}
                  onChange={(event) => props.updateApartment(apartment.id, { code: event.target.value })}
                />
                <Input
                  value={apartment.owner}
                  onChange={(event) => props.updateApartment(apartment.id, { owner: event.target.value })}
                />
                <Input
                  value={apartment.monthlyFee ? String(apartment.monthlyFee) : ''}
                  placeholder="Mặc định"
                  onChange={(event) =>
                    props.updateApartment(apartment.id, {
                      monthlyFee: event.target.value
                        ? parseAmount(event.target.value, apartment.monthlyFee ?? 0)
                        : null,
                    })
                  }
                />
                <IconButton label="Xóa căn hộ" onClick={() => props.deleteApartment(apartment.id)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AdminUsers(props: {
  users: User[];
  currentUserId: string;
  newUser: { name: string; phone: string; password: string; role: Role };
  setNewUser: (value: { name: string; phone: string; password: string; role: Role }) => void;
  addUser: (event: FormEvent<HTMLFormElement>) => void;
  updateUser: (id: string, patch: Partial<User>) => void;
  deleteUser: (id: string) => void;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-base font-semibold">Tài khoản truy cập</h2>
      <form onSubmit={props.addUser} className="mb-4 grid gap-2 lg:grid-cols-[1fr_150px_150px_130px_auto]">
        <Input
          placeholder="Tên nhân viên"
          value={props.newUser.name}
          onChange={(event) => props.setNewUser({ ...props.newUser, name: event.target.value })}
        />
        <Input
          placeholder="Số điện thoại"
          inputMode="tel"
          value={props.newUser.phone}
          onChange={(event) => props.setNewUser({ ...props.newUser, phone: event.target.value })}
        />
        <Input
          placeholder="Mật khẩu"
          value={props.newUser.password}
          onChange={(event) => props.setNewUser({ ...props.newUser, password: event.target.value })}
        />
        <NativeSelect
          className="w-full"
          value={props.newUser.role}
          onChange={(event) => props.setNewUser({ ...props.newUser, role: event.target.value as Role })}
        >
          <NativeSelectOption value="staff">Nhân viên</NativeSelectOption>
          <NativeSelectOption value="admin">Admin</NativeSelectOption>
        </NativeSelect>
        <Button type="submit">
          <Plus className="size-4" />
          Thêm
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tên</TableHead>
            <TableHead>ID điện thoại</TableHead>
            <TableHead>Mật khẩu</TableHead>
            <TableHead>Vai trò</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <Input
                  value={user.name}
                  onChange={(event) => props.updateUser(user.id, { name: event.target.value })}
                />
              </TableCell>
              <TableCell>
                <Input
                  value={user.phone}
                  inputMode="tel"
                  onChange={(event) => props.updateUser(user.id, { phone: event.target.value })}
                />
              </TableCell>
              <TableCell>
                <Input
                  value={user.password}
                  onChange={(event) => props.updateUser(user.id, { password: event.target.value })}
                />
              </TableCell>
              <TableCell>
                <NativeSelect
                  className="w-full"
                  value={user.role}
                  onChange={(event) => props.updateUser(user.id, { role: event.target.value as Role })}
                >
                  <NativeSelectOption value="staff">Nhân viên</NativeSelectOption>
                  <NativeSelectOption value="admin">Admin</NativeSelectOption>
                </NativeSelect>
              </TableCell>
              <TableCell>
                <IconButton
                  label="Xóa tài khoản"
                  disabled={user.id === props.currentUserId}
                  onClick={() => props.deleteUser(user.id)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="destructive"
      size="icon"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
