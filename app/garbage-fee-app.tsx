'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Plus,
  Phone,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
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
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
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
      email: 'admin@thutienrac.local',
      name: 'Quản trị',
      role: 'admin',
      mustChangePassword: false,
    },
    {
      id: 'u-lan',
      phone: '0909000002',
      email: 'lan@thutienrac.local',
      name: 'Nhân viên Lan',
      role: 'staff',
      mustChangePassword: true,
    },
    {
      id: 'u-minh',
      phone: '0909000003',
      email: 'minh@thutienrac.local',
      name: 'Nhân viên Minh',
      role: 'staff',
      mustChangePassword: true,
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
    {
      id: 'apt-a101',
      blockId: 'b-a1',
      code: 'A1-101',
      owner: 'Cô Hoa',
      phone: '',
      note: '',
      monthlyFee: null,
    },
    {
      id: 'apt-a102',
      blockId: 'b-a1',
      code: 'A1-102',
      owner: 'Anh Nam',
      phone: '',
      note: '',
      monthlyFee: null,
    },
    {
      id: 'apt-a201',
      blockId: 'b-a2',
      code: 'A2-201',
      owner: 'Chị Mai',
      phone: '',
      note: '',
      monthlyFee: 70000,
    },
    {
      id: 'apt-b101',
      blockId: 'b-b1',
      code: 'B1-101',
      owner: 'Chú Bình',
      phone: '',
      note: '',
      monthlyFee: null,
    },
  ],
  payments: [
    {
      id: 'p-sample-1',
      apartmentId: 'apt-a101',
      collectorId: 'u-lan',
      month: monthNow,
      paidAt: new Date().toISOString(),
      amount: 50000,
      note: '',
      method: 'cash',
    },
  ],
  settings: {
    appName: 'Thu tiền vệ sinh',
    subtitle: 'Quản lý thu tiền vệ sinh theo từng căn hộ',
    logoUrl: '',
    theme: 'teal',
  },
};

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
});

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(value));
}

function parseAmount(value: string, fallback: number) {
  const amount = Number(value.replaceAll('.', '').replaceAll(',', ''));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : fallback;
}

function formatNumber(value: number) {
  return number.format(Math.round(value));
}

function formatAmountInput(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? formatNumber(Number(digits)) : '';
}

function getBlockDefaultFee(
  blockId: string,
  regions: Region[],
  blocks: Block[],
) {
  const block = blocks.find((item) => item.id === blockId);
  return regions.find((item) => item.id === block?.regionId)?.defaultFee ?? 0;
}

export default function GarbageFeeApp() {
  const [state, setState] = useState<AppState>(initialState);
  const commitQueue = useRef(Promise.resolve());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginPhone, setLoginPhone] = useState('0909000001');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [remember, setRemember] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [, setSyncStatus] = useState<
    'loading' | 'synced' | 'saving' | 'local'
  >('loading');
  const [selectedMonth, setSelectedMonth] = useState(monthNow);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedBlock, setSelectedBlock] = useState('all');
  const [query, setQuery] = useState('');
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({});
  const [draftPaymentNotes, setDraftPaymentNotes] = useState<Record<string, string>>({});
  const [draftPaymentMethods, setDraftPaymentMethods] = useState<
    Record<string, Payment['method']>
  >({});
  const [newRegion, setNewRegion] = useState({
    name: '',
    defaultFee: '300.000',
  });
  const [newBlock, setNewBlock] = useState({ regionId: 'r-a', name: '' });
  const [newApartment, setNewApartment] = useState({
    blockId: 'b-a1',
    code: '',
    owner: '',
    phone: '',
    monthlyFee: '300.000',
  });
  const [quickSetup, setQuickSetup] = useState({
    prefix: 'Vạn phúc',
    suffix1: 'Galaxy',
    regionStart: '1',
    regionEnd: '8',
    suffix2: 'Căn',
    apartmentStart: '1',
    apartmentEnd: '40',
    defaultFee: '300.000',
  });
  const [quickSetupMessage, setQuickSetupMessage] = useState('');
  const [newUser, setNewUser] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'staff' as Role,
  });

  const loadState = async () => {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error('Unable to load shared data');
    const data = (await response.json()) as AppState;
    setState(data);
    setSyncStatus('synced');
    if (data.regions[0])
      setNewBlock((item) => ({ ...item, regionId: data.regions[0].id }));
    if (data.blocks[0]) {
      const blockId = data.blocks[0].id;
      setNewApartment((item) => ({
        ...item,
        blockId,
        monthlyFee: formatNumber(
          getBlockDefaultFee(blockId, data.regions, data.blocks),
        ),
      }));
    }
  };

  useEffect(() => {
    let active = true;
    fetch('/api/auth')
      .then(async (response) => {
        const payload = (await response.json()) as {
          user?: User;
          setupRequired?: boolean;
        };
        if (payload.setupRequired) {
          setSetupRequired(true);
          return null;
        }
        return response.ok ? (payload.user ?? null) : null;
      })
      .then(async (user) => {
        if (!active || !user) return;
        setCurrentUser(user);
        await loadState();
      })
      .catch(() => setSyncStatus('local'))
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const commit = async (nextState: AppState) => {
    setState(nextState);
    setSyncStatus('saving');

    commitQueue.current = commitQueue.current.then(async () => {
      try {
        const response = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: nextState }),
        });
        if (response.status === 401) {
          setCurrentUser(null);
          setLoginError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
          throw new Error('Session expired');
        }
        if (!response.ok) throw new Error('Unable to save');
        const payload = (await response.json()) as { state?: AppState };
        if (payload.state) setState(payload.state);
        setSyncStatus('synced');
      } catch {
        setSyncStatus('local');
      }
    });
    await commitQueue.current;
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
      const matchesRegion =
        selectedRegion === 'all' || selectedRegion === regionId;
      const matchesBlock =
        selectedBlock === 'all' || selectedBlock === apartment.blockId;
      const text = `${apartment.code} ${apartment.owner}`.toLowerCase();
      return (
        matchesRegion && matchesBlock && text.includes(query.toLowerCase())
      );
    })
    .sort((a, b) => a.code.localeCompare(b.code, 'vi'));

  const currentMonthPayments = state.payments.filter(
    (item) => item.month === selectedMonth,
  );
  const paidApartmentIds = new Set(
    currentMonthPayments.map((item) => item.apartmentId),
  );
  const totalDue = state.apartments.reduce(
    (sum, item) => sum + getFee(item, lookups),
    0,
  );
  const totalPaid = currentMonthPayments.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const myTotal = currentMonthPayments
    .filter((item) => item.collectorId === currentUser?.id)
    .reduce((sum, item) => sum + item.amount, 0);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthLoading(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          phone: loginPhone,
          password: loginPassword,
          remember,
        }),
      });
      const payload = (await response.json()) as {
        user?: User;
        error?: string;
      };
      if (!response.ok || !payload.user)
        throw new Error(payload.error ?? 'Đăng nhập thất bại.');
      setCurrentUser(payload.user);
      setLoginError('');
      await loadState();
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : 'Không thể đăng nhập.',
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const recordPayment = (apartment: Apartment) => {
    if (!currentUser) return;
    const defaultAmount = getFee(apartment, lookups);
    const amount = parseAmount(draftAmounts[apartment.id] ?? '', defaultAmount);
    const nextPayments = state.payments.filter(
      (item) =>
        !(item.apartmentId === apartment.id && item.month === selectedMonth),
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
          note: draftPaymentNotes[apartment.id]?.trim() ?? '',
          method: draftPaymentMethods[apartment.id] ?? 'cash',
        },
        ...nextPayments,
      ],
    };
    void commit(nextState);
    setDraftPaymentNotes((current) => {
      const { [apartment.id]: _removed, ...remaining } = current;
      return remaining;
    });
    setDraftPaymentMethods((current) => {
      const { [apartment.id]: _removed, ...remaining } = current;
      return remaining;
    });
  };

  const updatePayment = (paymentId: string, updates: Partial<Payment>) => {
    void commit({
      ...state,
      payments: state.payments.map((payment) =>
        payment.id === paymentId ? { ...payment, ...updates } : payment,
      ),
    });
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
          uncollected: Math.max(
            0,
            state.apartments.length - paidApartmentIds.size,
          ),
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
          typeof payload.apartmentCode === 'string'
            ? payload.apartmentCode.trim()
            : '';
        if (!apartmentCode) throw new Error('apartmentCode is required');

        const apartment = state.apartments.find(
          (item) => item.code.toLowerCase() === apartmentCode.toLowerCase(),
        );
        if (!apartment) throw new Error('Apartment not found');

        const existing = state.payments.find(
          (item) =>
            item.apartmentId === apartment.id && item.month === selectedMonth,
        );
        if (existing)
          throw new Error('Apartment is already paid for this month');

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
          note: '',
          method: 'cash',
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
      regions: state.regions.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
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
    setNewRegion({ name: '', defaultFee: '300.000' });
    void commit({ ...state, regions: [...state.regions, item] });
  };

  const addQuickSetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const regionStart = Number.parseInt(quickSetup.regionStart, 10);
    const regionEnd = Number.parseInt(quickSetup.regionEnd, 10);
    const apartmentStart = Number.parseInt(quickSetup.apartmentStart, 10);
    const apartmentEnd = Number.parseInt(quickSetup.apartmentEnd, 10);
    const prefix = quickSetup.prefix.trim();
    const suffix1 = quickSetup.suffix1.trim();
    const suffix2 = quickSetup.suffix2.trim();
    const defaultFee = parseAmount(quickSetup.defaultFee, 300000);

    if (
      !suffix1 ||
      !suffix2 ||
      !Number.isInteger(regionStart) ||
      !Number.isInteger(regionEnd) ||
      !Number.isInteger(apartmentStart) ||
      !Number.isInteger(apartmentEnd) ||
      regionStart < 1 ||
      regionEnd < regionStart ||
      apartmentStart < 1 ||
      apartmentEnd < apartmentStart
    ) {
      setQuickSetupMessage('Vui lòng kiểm tra lại các khoảng số đã nhập.');
      return;
    }

    const regionCount = regionEnd - regionStart + 1;
    const apartmentCount = apartmentEnd - apartmentStart + 1;
    if (regionCount * apartmentCount > 1000) {
      setQuickSetupMessage('Tối đa 1.000 căn mỗi lần thêm nhanh.');
      return;
    }

    const existingNames = new Set(
      state.regions.map((region) => region.name.trim().toLowerCase()),
    );
    const regions = [...state.regions];
    const blocks = [...state.blocks];
    const apartments = [...state.apartments];
    let addedRegions = 0;
    let addedApartments = 0;
    const padWidth = Math.max(2, String(apartmentEnd).length);

    for (let regionNumber = regionStart; regionNumber <= regionEnd; regionNumber += 1) {
      const regionName = [prefix, suffix1, String(regionNumber)]
        .filter(Boolean)
        .join(' ');
      if (existingNames.has(regionName.toLowerCase())) continue;
      const regionId = uid('region');
      const blockId = uid('block');
      regions.push({ id: regionId, name: regionName, defaultFee });
      blocks.push({ id: blockId, regionId, name: '' });
      addedRegions += 1;
      for (let apartmentNumber = apartmentStart; apartmentNumber <= apartmentEnd; apartmentNumber += 1) {
        apartments.push({
          id: uid('apt'),
          blockId,
          code: `${suffix2} ${String(apartmentNumber).padStart(padWidth, '0')}`,
          owner: '',
          phone: '',
          note: '',
          monthlyFee: defaultFee,
        });
        addedApartments += 1;
      }
    }

    if (!addedRegions) {
      setQuickSetupMessage('Các khu trong khoảng này đã tồn tại.');
      return;
    }
    await commit({ ...state, regions, blocks, apartments });
    setQuickSetupMessage(
      `Đã thêm ${addedRegions} khu và ${addedApartments} căn hộ với giá ${formatNumber(defaultFee)} đ/căn/tháng.`,
    );
  };

  const deleteRegion = (id: string) => {
    const blockIds = state.blocks
      .filter((item) => item.regionId === id)
      .map((item) => item.id);
    const apartmentIds = state.apartments
      .filter((item) => blockIds.includes(item.blockId))
      .map((item) => item.id);
    void commit({
      ...state,
      regions: state.regions.filter((item) => item.id !== id),
      blocks: state.blocks.filter((item) => item.regionId !== id),
      apartments: state.apartments.filter(
        (item) => !blockIds.includes(item.blockId),
      ),
      payments: state.payments.filter(
        (item) => !apartmentIds.includes(item.apartmentId),
      ),
    });
  };

  const addBlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newBlock.name.trim() || !newBlock.regionId) return;
    void commit({
      ...state,
      blocks: [
        ...state.blocks,
        {
          id: uid('block'),
          regionId: newBlock.regionId,
          name: newBlock.name.trim(),
        },
      ],
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
      payments: state.payments.filter(
        (item) => !apartmentIds.includes(item.apartmentId),
      ),
    });
  };

  const updateBlock = (id: string, patch: Partial<Block>) => {
    void commit({
      ...state,
      blocks: state.blocks.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  };

  const addApartment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newApartment.blockId || !newApartment.code.trim()) return;
    const monthlyFee = parseAmount(
      newApartment.monthlyFee,
      getBlockDefaultFee(newApartment.blockId, state.regions, state.blocks),
    );
    void commit({
      ...state,
      apartments: [
        ...state.apartments,
        {
          id: uid('apt'),
          blockId: newApartment.blockId,
          code: newApartment.code.trim(),
          owner: newApartment.owner.trim(),
          phone: newApartment.phone.trim(),
          note: '',
          monthlyFee,
        },
      ],
    });
    setNewApartment({
      ...newApartment,
      code: '',
      owner: '',
      phone: '',
      monthlyFee: formatNumber(
        getBlockDefaultFee(newApartment.blockId, state.regions, state.blocks),
      ),
    });
  };

  const updateApartment = (id: string, patch: Partial<Apartment>) => {
    void commit({
      ...state,
      apartments: state.apartments.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
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
    if (!newUser.name.trim() || !newUser.phone.trim() || !newUser.email.trim())
      return;
    void commit({
      ...state,
      users: [
        ...state.users,
        {
          id: uid('user'),
          name: newUser.name.trim(),
          phone: newUser.phone.trim(),
          email: newUser.email.trim().toLowerCase(),
          role: newUser.role,
          mustChangePassword: true,
        },
      ],
    });
    setNewUser({ name: '', phone: '', email: '', role: 'staff' });
  };

  const updateUser = (id: string, patch: Partial<User>) => {
    void commit({
      ...state,
      users: state.users.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
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

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError('');
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'forgot-password',
        phone: loginPhone,
        email: forgotEmail,
      }),
    });
    if (!response.ok) {
      setLoginError('Chưa thể xử lý yêu cầu. Vui lòng thử lại.');
      return;
    }
    setForgotMessage(
      'Nếu số điện thoại và email khớp, mật khẩu đã được đưa về 123456. Hãy đăng nhập và đổi mật khẩu mới.',
    );
  };

  const handleLogout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    setCurrentUser(null);
    setShowChangePassword(false);
    setShowAccountInfo(false);
  };

  const resetUserPassword = async (userId: string) => {
    if (!window.confirm('Đặt mật khẩu nhân viên này về 123456?')) return;
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'admin-reset', userId }),
    });
    if (!response.ok) return;
    setState((current) => ({
      ...current,
      users: current.users.map((user) =>
        user.id === userId ? { ...user, mustChangePassword: true } : user,
      ),
    }));
  };

  if (currentUser && (currentUser.mustChangePassword || showChangePassword)) {
    return (
      <PasswordChangeScreen
        user={currentUser}
        required={currentUser.mustChangePassword}
        onCancel={() => setShowChangePassword(false)}
        onChanged={(user) => {
          setCurrentUser(user);
          setShowChangePassword(false);
        }}
      />
    );
  }

  if (setupRequired) {
    return (
      <AdminSetupScreen
        onComplete={(user) => {
          setCurrentUser(user);
          setSetupRequired(false);
          void loadState();
        }}
      />
    );
  }

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d9f0ef_0,#f4f7f4_31%,#f8fafc_68%)] px-4 py-8 text-foreground">
        <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden items-center justify-center lg:flex">
            <img
              src="/app-icon.png"
              alt="Thu tiền vệ sinh"
              className="size-40 object-contain"
            />
          </div>

          <div className="rounded-lg border bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {forgotMode ? 'Quên mật khẩu' : 'Đăng nhập'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {forgotMode
                    ? 'Nhập đúng số điện thoại và email đã đăng ký.'
                    : 'Dùng số điện thoại làm ID đăng nhập.'}
                </p>
              </div>
              {forgotMode ? (
                <Mail className="size-9 rounded-lg bg-primary/10 p-2 text-primary" />
              ) : (
                <KeyRound className="size-9 rounded-lg bg-primary/10 p-2 text-primary" />
              )}
            </div>

            {forgotMode ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <Field label="Số điện thoại">
                  <Input
                    value={loginPhone}
                    inputMode="tel"
                    onChange={(event) => setLoginPhone(event.target.value)}
                    required
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={forgotEmail}
                    onChange={(event) => setForgotEmail(event.target.value)}
                    required
                  />
                </Field>
                {forgotMessage && (
                  <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
                    {forgotMessage}
                  </p>
                )}
                {loginError && (
                  <p className="text-sm font-medium text-destructive">
                    {loginError}
                  </p>
                )}
                <Button type="submit" className="w-full" size="lg">
                  <RotateCcw className="size-4" />
                  Đặt lại mật khẩu
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setForgotMode(false);
                    setForgotMessage('');
                    setLoginError('');
                  }}
                >
                  Quay lại đăng nhập
                </Button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <Field label="Số điện thoại">
                  <Input
                    value={loginPhone}
                    inputMode="tel"
                    onChange={(event) => setLoginPhone(event.target.value)}
                    required
                  />
                </Field>
                <Field label="Mật khẩu">
                  <Input
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    required
                  />
                </Field>
                {loginError && (
                  <p className="text-sm font-medium text-destructive">
                    {loginError}
                  </p>
                )}
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <Checkbox checked={remember} onCheckedChange={setRemember} />
                  Nhớ mật khẩu
                </label>
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={authLoading}
                >
                  <Lock className="size-4" />
                  {authLoading ? 'Đang kiểm tra...' : 'Vào app'}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  onClick={() => {
                    setForgotMode(true);
                    setForgotMessage('');
                    setLoginError('');
                  }}
                >
                  Quên mật khẩu?
                </Button>
              </form>
            )}

          </div>
        </section>
      </main>
    );
  }

  const isAdmin = currentUser.role === 'admin';
  const accountPayments = state.payments
    .filter((payment) => payment.collectorId === currentUser.id)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const accountTotal = accountPayments.reduce(
    (total, payment) => total + payment.amount,
    0,
  );

  return (
    <main className={`min-h-screen bg-background text-foreground theme-${state.settings.theme}`}>
      <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center overflow-hidden rounded-lg bg-primary/10">
              <img
                src={state.settings.logoUrl || '/app-icon.png'}
                alt=""
                className="size-10 object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{state.settings.appName}</h1>
              <p className="text-sm text-muted-foreground">
                {currentUser.name} · {currentUser.role === 'admin' ? 'Admin' : 'Nhân viên'}
              </p>
              {state.settings.subtitle && (
                <p className="max-w-[18rem] truncate text-xs text-muted-foreground/80">
                  {state.settings.subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAccountInfo(true)}
            >
              <UserRound className="size-4" />
              Thông tin tài khoản
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowChangePassword(true)}
            >
              <KeyRound className="size-4" />
              Đổi mật khẩu
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleLogout()}
            >
              <LogOut className="size-4" />
              Đăng xuất
            </Button>
          </div>
        </div>
      </header>

      <AccountInformationDialog
        open={showAccountInfo}
        onOpenChange={setShowAccountInfo}
        user={currentUser}
        payments={accountPayments}
        apartments={state.apartments}
        blocks={state.blocks}
        regions={state.regions}
        total={accountTotal}
      />

      <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4 sm:py-5">
        <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Metric
            label="Tổng căn hộ"
            value={formatNumber(state.apartments.length)}
            icon={Building2}
          />
          <Metric
            label="Đã thu"
            value={`${formatNumber(paidApartmentIds.size)}/${formatNumber(state.apartments.length)}`}
            icon={ReceiptText}
          />
          <Metric
            label="Tổng tháng"
            value={money.format(totalPaid)}
            icon={CircleDollarSign}
          />
          <Metric
            label="Tôi đã thu"
            value={money.format(myTotal)}
            icon={UserRound}
          />
        </section>

        <Tabs defaultValue="collect" className="mt-5">
          <TabsList className="h-11 w-full max-w-none justify-start gap-1 overflow-x-auto bg-primary/10 p-1 sm:h-10 sm:w-fit sm:max-w-full">
            <TabsTrigger
              value="collect"
              className="min-h-9 flex-none whitespace-nowrap px-2 py-1.5 text-sm font-semibold text-foreground/75 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm sm:flex-1 sm:px-3 sm:text-base"
            >
              Thu tháng
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="min-h-9 flex-none whitespace-nowrap px-2 py-1.5 text-sm font-semibold text-foreground/75 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm sm:flex-1 sm:px-3 sm:text-base"
            >
              Thống kê
            </TabsTrigger>
            <TabsTrigger
              value="areas"
              className="min-h-9 flex-none whitespace-nowrap px-2 py-1.5 text-sm font-semibold text-foreground/75 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm sm:flex-1 sm:px-3 sm:text-base"
            >
              Khu vực
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="min-h-9 flex-none whitespace-nowrap px-2 py-1.5 text-sm font-semibold text-foreground/75 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm sm:flex-1 sm:px-3 sm:text-base"
            >
              Nhân viên
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger
                value="settings"
                className="min-h-9 flex-none whitespace-nowrap px-2 py-1.5 text-sm font-semibold text-foreground/75 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm sm:flex-1 sm:px-3 sm:text-base"
              >
                Tùy chỉnh
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="collect" className="mt-4">
            <section className="min-w-0 rounded-lg border bg-card p-2 sm:p-4">
              <div className="mb-3 grid grid-cols-2 gap-2 [&>div:first-child]:col-span-2 [&>div:last-child]:col-span-2 lg:grid-cols-[190px_170px_170px_minmax(220px,1fr)] lg:[&>div:first-child]:col-span-1 lg:[&>div:last-child]:col-span-1">
                <Field label="Kỳ thu">
                  <MonthYearSelect
                    value={selectedMonth}
                    onChange={setSelectedMonth}
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

              <Table className="min-w-[640px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/4 border-r">Căn hộ</TableHead>
                    <TableHead className="w-1/4 border-r">Nội dung</TableHead>
                    <TableHead className="w-1/4 border-r">Giá trị</TableHead>
                    <TableHead className="w-1/4">Thanh toán</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleApartments.map((apartment) => {
                    const block = lookups.blocks.get(apartment.blockId);
                    const region = block
                      ? lookups.regions.get(block.regionId)
                      : null;
                    const payment = currentMonthPayments.find(
                      (item) => item.apartmentId === apartment.id,
                    );
                    const collector = payment
                      ? lookups.users.get(payment.collectorId)
                      : null;
                    const defaultFee = getFee(apartment, lookups);
                    return (
                      <TableRow
                        key={apartment.id}
                        className="align-top border-b-2 border-primary/35"
                      >
                        <TableCell className="w-1/4 border-r bg-primary/10 p-0 align-top">
                          <div className="grid min-h-[168px] grid-rows-[40px_44px_44px_40px] divide-y">
                            <div className="flex items-center gap-1.5 px-3 font-medium">
                            <span>{apartment.code}</span>
                            {apartment.phone && (
                              <a
                                href={`tel:${apartment.phone}`}
                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                                aria-label={`Gọi ${apartment.owner || apartment.code}`}
                                title={`Gọi ${apartment.phone}`}
                              >
                                <Phone className="size-4" />
                              </a>
                            )}
                            </div>
                            <div className="flex items-center px-2">
                            <Input
                              className="h-8 w-full text-sm"
                              defaultValue={apartment.owner}
                              placeholder="Chủ hộ"
                              onBlur={(event) => {
                                const owner = event.target.value.trim();
                                if (owner !== apartment.owner) {
                                  updateApartment(apartment.id, { owner });
                                }
                              }}
                            />
                            </div>
                            <div className="flex items-center px-2">
                              <Input
                              className="h-8 w-full text-sm"
                              defaultValue={apartment.phone}
                              inputMode="tel"
                              placeholder="SĐT"
                              onBlur={(event) => {
                                const phone = event.target.value.trim();
                                if (phone !== apartment.phone) {
                                  updateApartment(apartment.id, { phone });
                                }
                              }}
                            />
                            </div>
                            <div className="flex items-center px-3 text-xs text-muted-foreground">
                            {region?.name ?? '-'} / {block?.name ?? '-'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="w-1/4 border-r p-0 align-top">
                          <div className="grid min-h-[168px] grid-rows-[40px_40px_48px_40px] divide-y">
                            <div className="flex h-10 items-center px-3 text-sm font-medium">
                              Số tiền
                            </div>
                            <div className="flex h-10 items-center px-3 text-sm font-medium">
                              Trạng thái
                            </div>
                            <div className="flex h-12 items-center px-3 text-sm font-medium">
                              Người thu
                            </div>
                            <div className="flex h-10 items-center px-3 text-sm font-medium">
                              Ghi chú
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="w-1/4 border-r p-0 align-top">
                          <div className="grid min-h-[168px] grid-rows-[40px_40px_48px_40px] divide-y">
                            <div className="flex h-10 items-center px-2">
                          {payment ? (
                            money.format(payment.amount)
                          ) : (
                            <Input
                              className="h-8 w-full"
                              inputMode="numeric"
                              value={
                                draftAmounts[apartment.id] ??
                                formatNumber(defaultFee)
                              }
                              onChange={(event) =>
                                setDraftAmounts({
                                  ...draftAmounts,
                                  [apartment.id]: formatAmountInput(
                                    event.target.value,
                                  ),
                                })
                              }
                            />
                          )}
                            </div>
                            <div className="flex h-10 items-center px-2">
                          <Badge variant={payment ? 'default' : 'outline'}>
                            {payment ? 'Đã thu' : 'Chưa thu'}
                          </Badge>
                            </div>
                            <div className="flex h-12 items-center px-2">
                          {payment ? (
                            <div>
                              <div>
                                {collector?.name ?? payment.collectorId}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(payment.paidAt)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                            </div>
                            <div className="flex h-10 items-center px-2">
                          {payment ? (
                            <Input
                              className="h-8 w-full"
                              defaultValue={payment.note}
                              placeholder="Ghi chú"
                              onBlur={(event) => {
                                const note = event.target.value.trim();
                                if (note !== payment.note) {
                                  updatePayment(payment.id, { note });
                                }
                              }}
                            />
                          ) : (
                            <Input
                              className="h-8 w-full"
                              placeholder="Ví dụ: khách hẹn lại"
                              value={draftPaymentNotes[apartment.id] ?? ''}
                              onChange={(event) =>
                                setDraftPaymentNotes({
                                  ...draftPaymentNotes,
                                  [apartment.id]: event.target.value,
                                })
                              }
                            />
                          )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="w-1/4 p-0 align-top">
                          <div className="grid min-h-[168px] grid-rows-[40px_40px_1fr] divide-y">
                            <div className="flex items-center px-3 text-sm font-medium">
                              Thanh toán
                            </div>
                            <div className="flex items-center px-2">
                              {payment ? (
                            <span className="text-sm">
                              {payment.method === 'transfer'
                                ? 'Chuyển khoản'
                                : 'Tiền mặt'}
                            </span>
                          ) : (
                            <NativeSelect
                              className="h-8 w-full"
                              value={draftPaymentMethods[apartment.id] ?? 'cash'}
                              onChange={(event) =>
                                setDraftPaymentMethods({
                                  ...draftPaymentMethods,
                                  [apartment.id]: event.target.value as Payment['method'],
                                })
                              }
                            >
                              <NativeSelectOption value="cash">Tiền mặt</NativeSelectOption>
                              <NativeSelectOption value="transfer">Chuyển khoản</NativeSelectOption>
                            </NativeSelect>
                          )}
                            </div>
                            <div className="p-2">
                            {payment &&
                            (isAdmin ||
                              payment.collectorId === currentUser.id) ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-full min-h-16 w-full text-base font-semibold"
                              onClick={() => cancelPayment(payment.id)}
                            >
                              Hủy
                            </Button>
                          ) : !payment ? (
                            <Button
                              type="button"
                              className="h-full min-h-16 w-full text-lg font-bold"
                              onClick={() => recordPayment(apartment)}
                            >
                              Thu tiền
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Đã ghi nhận
                            </span>
                          )}
                            </div>
                          </div>
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
                quickSetup={quickSetup}
                setQuickSetup={setQuickSetup}
                addQuickSetup={addQuickSetup}
                quickSetupMessage={quickSetupMessage}
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
                resetUserPassword={resetUserPassword}
              />
            ) : (
              <Restricted />
            )}
          </TabsContent>
          {isAdmin && (
            <TabsContent value="settings" className="mt-4">
              <CustomizationPanel
                settings={state.settings}
                onSave={(settings) => void commit({ ...state, settings })}
              />
            </TabsContent>
          )}
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

function AdminSetupScreen({
  onComplete,
}: {
  onComplete: (user: User) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup-admin', ...form }),
      });
      const payload = (await response.json()) as {
        user?: User;
        error?: string;
      };
      if (!response.ok || !payload.user)
        throw new Error(payload.error ?? 'Không thể tạo admin.');
      onComplete(payload.user);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Không thể tạo admin.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#d9f0ef_0,#f4f7f4_31%,#f8fafc_68%)] px-4 py-8 text-foreground">
      <section className="w-full max-w-md rounded-lg border bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="mb-5 flex items-center gap-3">
          <ShieldCheck className="size-10 rounded-lg bg-primary/10 p-2 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Thiết lập admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tạo tài khoản quản trị đầu tiên cho ứng dụng.
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Tên admin">
            <Input
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
            />
          </Field>
          <Field label="Số điện thoại">
            <Input
              inputMode="tel"
              value={form.phone}
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
              required
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              required
            />
          </Field>
          <Field label="Mật khẩu">
            <Input
              type="password"
              minLength={6}
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              required
            />
          </Field>
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={saving}>
            <ShieldCheck className="size-4" />
            {saving ? 'Đang thiết lập...' : 'Tạo tài khoản admin'}
          </Button>
        </form>
      </section>
    </main>
  );
}

function PasswordChangeScreen({
  user,
  required,
  onCancel,
  onChanged,
}: {
  user: User;
  required: boolean;
  onCancel: () => void;
  onChanged: (user: User) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Hai lần nhập mật khẩu mới chưa khớp.');
      return;
    }
    setSaving(true);
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'change-password',
        currentPassword,
        newPassword,
      }),
    });
    const payload = (await response.json()) as { user?: User; error?: string };
    setSaving(false);
    if (!response.ok || !payload.user) {
      setError(payload.error ?? 'Chưa thể đổi mật khẩu.');
      return;
    }
    onChanged(payload.user);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#d9f0ef_0,#f4f7f4_31%,#f8fafc_68%)] px-4 py-8 text-foreground">
      <section className="w-full max-w-md rounded-lg border bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="mb-5 flex items-center gap-3">
          <ShieldCheck className="size-10 rounded-lg bg-primary/10 p-2 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">
              {required ? 'Tạo mật khẩu mới' : 'Đổi mật khẩu'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {required
                ? 'Bạn cần đổi mật khẩu trước khi vào ứng dụng.'
                : user.name}
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Mật khẩu hiện tại">
            <Input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </Field>
          <Field label="Mật khẩu mới">
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={6}
              required
            />
          </Field>
          <Field label="Nhập lại mật khẩu mới">
            <Input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={6}
              required
            />
          </Field>
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={saving}>
            <ShieldCheck className="size-4" />
            {saving ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
          </Button>
          {!required && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={onCancel}
            >
              Quay lại
            </Button>
          )}
        </form>
      </section>
    </main>
  );
}

function MonthYearSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedMonth = value.slice(5, 7);
  const selectedYear = value.slice(0, 4);
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: 21 },
    (_, index) => currentYear - 10 + index,
  );

  const update = (month: string, year: string) => onChange(`${year}-${month}`);

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <NativeSelect
        aria-label="Tháng"
        className="w-full"
        value={selectedMonth}
        onChange={(event) => update(event.target.value, selectedYear)}
      >
        {Array.from({ length: 12 }, (_, index) => {
          const month = String(index + 1).padStart(2, '0');
          return (
            <NativeSelectOption key={month} value={month}>
              {month}
            </NativeSelectOption>
          );
        })}
      </NativeSelect>
      <NativeSelect
        aria-label="Năm"
        className="w-full"
        value={selectedYear}
        onChange={(event) => update(selectedMonth, event.target.value)}
      >
        {years.map((year) => (
          <NativeSelectOption key={year} value={String(year)}>
            {year}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function AccountInformationDialog({
  open,
  onOpenChange,
  user,
  payments,
  apartments,
  blocks,
  regions,
  total,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  payments: Payment[];
  apartments: Apartment[];
  blocks: Block[];
  regions: Region[];
  total: number;
}) {
  const apartmentById = new Map(apartments.map((item) => [item.id, item]));
  const blockById = new Map(blocks.map((item) => [item.id, item]));
  const regionById = new Map(regions.map((item) => [item.id, item]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[calc(100%-1rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Thông tin tài khoản</DialogTitle>
          <DialogDescription>
            Thông tin cá nhân và các khoản thu do bạn thực hiện.
          </DialogDescription>
        </DialogHeader>

        <section className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Họ tên</p>
            <p className="mt-1 font-semibold">{user.name}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Vai trò</p>
            <p className="mt-1 font-semibold">
              {user.role === 'admin' ? 'Admin' : 'Nhân viên'}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Số điện thoại</p>
            <p className="mt-1 font-semibold">{user.phone || '-'}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="mt-1 break-all font-semibold">{user.email || '-'}</p>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Chi tiết đã thu</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {payments.length} căn đã thu
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Tổng tiền</p>
              <p className="font-semibold tabular-nums text-primary">
                {money.format(total)}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Căn hộ</TableHead>
                  <TableHead>Khu vực</TableHead>
                  <TableHead>Kỳ thu</TableHead>
                  <TableHead>Ngày thu</TableHead>
                  <TableHead>Số tiền</TableHead>
                  <TableHead>Thanh toán</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const apartment = apartmentById.get(payment.apartmentId);
                  const block = apartment
                    ? blockById.get(apartment.blockId)
                    : null;
                  const region = block
                    ? regionById.get(block.regionId)
                    : null;
                  return (
                    <TableRow key={payment.id}>
                      <TableCell>{apartment?.code ?? '-'}</TableCell>
                      <TableCell>
                        {region?.name ?? '-'} / {block?.name ?? '-'}
                      </TableCell>
                      <TableCell>
                        {payment.month.slice(5, 7)}/{payment.month.slice(0, 4)}
                      </TableCell>
                      <TableCell>{formatDate(payment.paidAt)}</TableCell>
                      <TableCell>{money.format(payment.amount)}</TableCell>
                      <TableCell>
                        {payment.method === 'transfer'
                          ? 'Chuyển khoản'
                          : 'Tiền mặt'}
                      </TableCell>
                      <TableCell>{payment.note || '-'}</TableCell>
                    </TableRow>
                  );
                })}
                {!payments.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Chưa có khoản thu nào.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </DialogContent>
    </Dialog>
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
    <div className="min-w-0 rounded-lg border bg-card p-2.5 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-1 break-words text-lg font-semibold tabular-nums sm:text-2xl">
        {value}
      </p>
    </div>
  );
}

function CustomizationPanel({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...draft,
        appName: draft.appName.trim() || 'Thu tiền vệ sinh',
        subtitle: draft.subtitle.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-3 sm:p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Tùy chỉnh ứng dụng</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Chỉ Admin có thể thay đổi nội dung nhận diện và màu giao diện. Thay đổi sẽ áp dụng cho tất cả tài khoản.
        </p>
      </div>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Tên ứng dụng">
          <Input
            value={draft.appName}
            onChange={(event) =>
              setDraft((current) => ({ ...current, appName: event.target.value }))
            }
            placeholder="Thu tiền vệ sinh"
            maxLength={50}
            required
          />
        </Field>
        <Field label="Dòng mô tả dưới tiêu đề">
          <Input
            value={draft.subtitle}
            onChange={(event) =>
              setDraft((current) => ({ ...current, subtitle: event.target.value }))
            }
            placeholder="Quản lý thu tiền vệ sinh theo từng căn hộ"
            maxLength={100}
          />
        </Field>
        <Field label="Logo URL (không bắt buộc)">
          <Input
            value={draft.logoUrl}
            onChange={(event) =>
              setDraft((current) => ({ ...current, logoUrl: event.target.value }))
            }
            placeholder="https://.../logo.png"
            inputMode="url"
          />
        </Field>
        <Field label="Màu giao diện">
          <NativeSelect
            className="w-full"
            value={draft.theme}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                theme: event.target.value as AppSettings['theme'],
              }))
            }
          >
            <NativeSelectOption value="teal">Xanh ngọc</NativeSelectOption>
            <NativeSelectOption value="blue">Xanh dương</NativeSelectOption>
            <NativeSelectOption value="indigo">Chàm</NativeSelectOption>
            <NativeSelectOption value="amber">Vàng hổ phách</NativeSelectOption>
            <NativeSelectOption value="rose">Hồng đỏ</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Button type="submit" className="sm:col-span-2" disabled={saving}>
          {saving ? 'Đang lưu...' : 'Lưu tùy chỉnh'}
        </Button>
      </form>
    </section>
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
  lookups: {
    regions: Map<string, Region>;
    blocks: Map<string, Block>;
    users: Map<string, User>;
  };
}) {
  const [selectedCollectorId, setSelectedCollectorId] = useState<string | null>(
    null,
  );
  const payments = state.payments.filter((item) => item.month === month);
  const byUser = state.users.map((user) => {
    const userPayments = payments.filter(
      (item) => item.collectorId === user.id,
    );
    return {
      user,
      count: userPayments.length,
      total: userPayments.reduce((sum, item) => sum + item.amount, 0),
    };
  });
  const selectedUser = state.users.find((user) => user.id === selectedCollectorId);
  const selectedPayments = payments.filter(
    (payment) => payment.collectorId === selectedCollectorId,
  );

  return (
    <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold">
          Tổng hợp tháng {month.slice(5, 7)}/{month.slice(0, 4)}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric
            label="Dự kiến"
            value={money.format(totalDue)}
            icon={CalendarDays}
          />
          <Metric
            label="Đã thu"
            value={money.format(totalPaid)}
            icon={CircleDollarSign}
          />
        </div>
        <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
          Riêng {currentUser.name}:{' '}
          {money.format(
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
              <TableHead>Chi tiết</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byUser.map(({ user, count, total }) => (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{formatNumber(count)}</TableCell>
                <TableCell>{money.format(total)}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCollectorId(user.id)}
                  >
                    Chi tiết
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedUser && (
        <div className="rounded-lg border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">
              Chi tiết thu: {selectedUser.name}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCollectorId(null)}
            >
              Đóng
            </Button>
          </div>
          {selectedPayments.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Căn hộ</TableHead>
                  <TableHead>Ngày thu</TableHead>
                  <TableHead>Số tiền</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  <TableHead>Thanh toán</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPayments.map((payment) => {
                  const apartment = state.apartments.find(
                    (item) => item.id === payment.apartmentId,
                  );
                  return (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {apartment?.code ?? payment.apartmentId}
                      </TableCell>
                      <TableCell>{formatDate(payment.paidAt)}</TableCell>
                      <TableCell>{money.format(payment.amount)}</TableCell>
                      <TableCell>{payment.note || '-'}</TableCell>
                      <TableCell>
                        {payment.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nhân viên này chưa thu căn nào trong kỳ đã chọn.
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg border bg-card p-4 lg:col-span-2">
        <h2 className="mb-3 text-base font-semibold">Lịch sử thu gần đây</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Căn hộ</TableHead>
              <TableHead>Người thu</TableHead>
              <TableHead>Ghi chú</TableHead>
              <TableHead>Thanh toán</TableHead>
              <TableHead>Ngày thu</TableHead>
              <TableHead>Số tiền</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.payments.slice(0, 12).map((payment) => {
              const apartment = state.apartments.find(
                (item) => item.id === payment.apartmentId,
              );
              const collector = lookups.users.get(payment.collectorId);
              return (
                <TableRow key={payment.id}>
                  <TableCell>
                    {apartment?.code ?? payment.apartmentId}
                  </TableCell>
                  <TableCell>
                    {collector?.name ?? payment.collectorId}
                  </TableCell>
                  <TableCell>{payment.note || '-'}</TableCell>
                  <TableCell>
                    {payment.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
                  </TableCell>
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
  newApartment: {
    blockId: string;
    code: string;
    owner: string;
    phone: string;
    monthlyFee: string;
  };
  setNewApartment: (value: {
    blockId: string;
    code: string;
    owner: string;
    phone: string;
    monthlyFee: string;
  }) => void;
  addApartment: (event: FormEvent<HTMLFormElement>) => void;
  updateApartment: (id: string, patch: Partial<Apartment>) => void;
  deleteApartment: (id: string) => void;
  quickSetup: {
    prefix: string;
    suffix1: string;
    regionStart: string;
    regionEnd: string;
    suffix2: string;
    apartmentStart: string;
    apartmentEnd: string;
    defaultFee: string;
  };
  setQuickSetup: (value: {
    prefix: string;
    suffix1: string;
    regionStart: string;
    regionEnd: string;
    suffix2: string;
    apartmentStart: string;
    apartmentEnd: string;
    defaultFee: string;
  }) => void;
  addQuickSetup: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  quickSetupMessage: string;
}) {
  const { state } = props;
  const regionName = (id: string) =>
    state.regions.find((item) => item.id === id)?.name ?? '-';
  const blockLabel = (block: Block) =>
    block.name ? `${regionName(block.regionId)} / ${block.name}` : regionName(block.regionId);
  const defaultFeeForBlock = (blockId: string) =>
    getBlockDefaultFee(blockId, state.regions, state.blocks);

  return (
    <section className="grid gap-3 xl:grid-cols-3">
      <div className="rounded-lg border border-primary/25 bg-primary/5 p-2.5 sm:p-4 xl:col-span-3">
        <div className="mb-3">
          <h2 className="text-base font-semibold">Thêm nhanh khu và căn hộ</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ví dụ: Vạn phúc + Galaxy 1 đến 8, mỗi khu có Căn 01 đến 40. Tên chủ hộ có thể bổ sung sau.
          </p>
        </div>
        <form onSubmit={props.addQuickSetup} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tiền tố (không bắt buộc)">
            <Input
              value={props.quickSetup.prefix}
              onChange={(event) =>
                props.setQuickSetup({ ...props.quickSetup, prefix: event.target.value })
              }
              placeholder="Vạn phúc"
            />
          </Field>
          <Field label="Hậu tố 1 / tên khu">
            <Input
              value={props.quickSetup.suffix1}
              onChange={(event) =>
                props.setQuickSetup({ ...props.quickSetup, suffix1: event.target.value })
              }
              placeholder="Galaxy"
              required
            />
          </Field>
          <Field label="Khu từ - đến">
            <div className="grid grid-cols-2 gap-2">
              <Input
                inputMode="numeric"
                aria-label="Khu bắt đầu"
                value={props.quickSetup.regionStart}
                onChange={(event) =>
                  props.setQuickSetup({ ...props.quickSetup, regionStart: event.target.value })
                }
                placeholder="1"
              />
              <Input
                inputMode="numeric"
                aria-label="Khu kết thúc"
                value={props.quickSetup.regionEnd}
                onChange={(event) =>
                  props.setQuickSetup({ ...props.quickSetup, regionEnd: event.target.value })
                }
                placeholder="8"
              />
            </div>
          </Field>
          <Field label="Hậu tố 2">
            <Input
              value={props.quickSetup.suffix2}
              onChange={(event) =>
                props.setQuickSetup({ ...props.quickSetup, suffix2: event.target.value })
              }
              placeholder="Căn"
              required
            />
          </Field>
          <Field label="Giá mặc định / căn">
            <Input
              inputMode="numeric"
              value={props.quickSetup.defaultFee}
              onChange={(event) =>
                props.setQuickSetup({
                  ...props.quickSetup,
                  defaultFee: formatAmountInput(event.target.value),
                })
              }
              placeholder="300.000"
            />
          </Field>
          <Field label="Căn từ - đến">
            <div className="grid grid-cols-2 gap-2">
              <Input
                inputMode="numeric"
                aria-label="Căn bắt đầu"
                value={props.quickSetup.apartmentStart}
                onChange={(event) =>
                  props.setQuickSetup({ ...props.quickSetup, apartmentStart: event.target.value })
                }
                placeholder="1"
              />
              <Input
                inputMode="numeric"
                aria-label="Căn kết thúc"
                value={props.quickSetup.apartmentEnd}
                onChange={(event) =>
                  props.setQuickSetup({ ...props.quickSetup, apartmentEnd: event.target.value })
                }
                placeholder="40"
              />
            </div>
          </Field>
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <Button type="submit" className="w-full sm:w-auto">
              <Plus className="size-4" />
              Tạo hàng loạt
            </Button>
          </div>
        </form>
        {props.quickSetupMessage && (
          <p className="mt-3 rounded-md bg-background/80 p-2 text-sm text-primary">
            {props.quickSetupMessage}
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-card p-2.5 sm:p-4">
        <h2 className="mb-2 text-base font-semibold">Khu vực</h2>
        <form
          onSubmit={props.addRegion}
          className="mb-2 grid grid-cols-[minmax(0,1fr)_96px_auto] gap-1.5 sm:grid-cols-[1fr_130px_auto]"
        >
          <Input
            className="h-9 min-w-0"
            placeholder="Tên khu vực"
            value={props.newRegion.name}
            onChange={(event) =>
              props.setNewRegion({
                ...props.newRegion,
                name: event.target.value,
              })
            }
          />
          <Input
            className="h-9 min-w-0"
            inputMode="numeric"
            value={props.newRegion.defaultFee}
            onChange={(event) =>
              props.setNewRegion({
                ...props.newRegion,
                defaultFee: formatAmountInput(event.target.value),
              })
            }
          />
          <Button type="submit" className="h-9 px-2.5 sm:px-4">
            <Plus className="size-4" />
            Thêm
          </Button>
        </form>
        <div className="space-y-1.5">
          {state.regions.map((region) => (
            <div
              key={region.id}
              className="grid grid-cols-[minmax(0,1fr)_96px_38px] gap-1.5 rounded-md border p-1.5 sm:grid-cols-[1fr_130px_38px]"
            >
              <Input
                className="h-8 min-w-0"
                value={region.name}
                onChange={(event) =>
                  props.updateRegion(region.id, { name: event.target.value })
                }
              />
              <Input
                className="h-8 min-w-0"
                inputMode="numeric"
                value={formatNumber(region.defaultFee)}
                onChange={(event) =>
                  props.updateRegion(region.id, {
                    defaultFee: parseAmount(
                      formatAmountInput(event.target.value),
                      region.defaultFee,
                    ),
                  })
                }
              />
              <IconButton
                label="Xóa khu vực"
                onClick={() => props.deleteRegion(region.id)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-2.5 sm:p-4">
        <h2 className="mb-2 text-base font-semibold">Dãy</h2>
        <form
          onSubmit={props.addBlock}
          className="mb-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5"
        >
          <NativeSelect
            className="h-9 min-w-0"
            value={props.newBlock.regionId}
            onChange={(event) =>
              props.setNewBlock({
                ...props.newBlock,
                regionId: event.target.value,
              })
            }
          >
            {state.regions.map((region) => (
              <NativeSelectOption key={region.id} value={region.id}>
                {region.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Input
            className="h-9 min-w-0"
            placeholder="Tên dãy"
            value={props.newBlock.name}
            onChange={(event) =>
              props.setNewBlock({ ...props.newBlock, name: event.target.value })
            }
          />
          <Button type="submit" className="h-9 px-2.5 sm:px-4">
            <Plus className="size-4" />
            Thêm
          </Button>
        </form>
        <div className="space-y-1.5">
          {state.blocks.filter((block) => block.name.trim()).map((block) => (
            <div
              key={block.id}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_38px] gap-1.5 rounded-md border p-1.5"
            >
              <NativeSelect
                className="h-8 min-w-0"
                value={block.regionId}
                onChange={(event) =>
                  props.updateBlock(block.id, { regionId: event.target.value })
                }
              >
                {state.regions.map((region) => (
                  <NativeSelectOption key={region.id} value={region.id}>
                    {region.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Input
                className="h-8 min-w-0"
                value={block.name}
                onChange={(event) =>
                  props.updateBlock(block.id, { name: event.target.value })
                }
              />
              <IconButton
                label="Xóa dãy"
                onClick={() => props.deleteBlock(block.id)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-2.5 sm:p-4">
        <h2 className="mb-2 text-base font-semibold">Căn hộ</h2>
        <form onSubmit={props.addApartment} className="mb-2 grid gap-1.5">
          <div className="grid gap-1.5 sm:grid-cols-[minmax(150px,1fr)_minmax(54px,0.8fr)_minmax(0,1fr)_88px_auto]">
            <NativeSelect
              className="h-9 min-w-0"
              value={props.newApartment.blockId}
              onChange={(event) =>
                props.setNewApartment({
                  ...props.newApartment,
                  blockId: event.target.value,
                  monthlyFee: formatNumber(
                    defaultFeeForBlock(event.target.value),
                  ),
                })
              }
            >
              {state.blocks.map((block) => (
                <NativeSelectOption key={block.id} value={block.id}>
                  {blockLabel(block)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Input
              className="h-9 min-w-0"
              placeholder="Căn"
              value={props.newApartment.code}
              onChange={(event) =>
                props.setNewApartment({
                  ...props.newApartment,
                  code: event.target.value,
                })
              }
            />
            <div className="space-y-1.5">
              <Input
                className="h-9 min-w-0"
                placeholder="Chủ hộ"
                value={props.newApartment.owner}
                onChange={(event) =>
                  props.setNewApartment({
                    ...props.newApartment,
                    owner: event.target.value,
                  })
                }
              />
              <Input
                className="h-9 min-w-0"
                placeholder="SĐT"
                inputMode="tel"
                value={props.newApartment.phone}
                onChange={(event) =>
                  props.setNewApartment({
                    ...props.newApartment,
                    phone: event.target.value,
                  })
                }
              />
            </div>
            <Input
              className="h-9 min-w-0"
              placeholder="Giá"
              inputMode="numeric"
              value={props.newApartment.monthlyFee}
              onChange={(event) =>
                props.setNewApartment({
                  ...props.newApartment,
                  monthlyFee: formatAmountInput(event.target.value),
                })
              }
            />
            <Button type="submit" className="h-9 px-2.5 sm:px-4">
              <Plus className="size-4" />
              Thêm
            </Button>
          </div>
        </form>
        <div className="max-h-[420px] space-y-1.5 overflow-auto pr-1">
          {state.apartments.map((apartment) => (
            <div
              key={apartment.id}
              className="grid gap-1.5 rounded-md border p-1.5 sm:grid-cols-[minmax(150px,1fr)_minmax(54px,0.8fr)_minmax(0,1fr)_88px_32px]"
            >
              <NativeSelect
                className="h-8 min-w-0"
                value={apartment.blockId}
                onChange={(event) =>
                  props.updateApartment(apartment.id, {
                    blockId: event.target.value,
                  })
                }
              >
                {state.blocks.map((block) => (
                  <NativeSelectOption key={block.id} value={block.id}>
                    {blockLabel(block)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Input
                className="h-8 min-w-0"
                value={apartment.code}
                onChange={(event) =>
                  props.updateApartment(apartment.id, {
                    code: event.target.value,
                  })
                }
              />
              <div className="space-y-1.5">
                <Input
                  className="h-8 min-w-0"
                  value={apartment.owner}
                  placeholder="Chủ hộ"
                  onChange={(event) =>
                    props.updateApartment(apartment.id, {
                      owner: event.target.value,
                    })
                  }
                />
                <Input
                  className="h-8 min-w-0"
                  placeholder="SĐT"
                  inputMode="tel"
                  value={apartment.phone}
                  onChange={(event) =>
                    props.updateApartment(apartment.id, {
                      phone: event.target.value,
                    })
                  }
                />
              </div>
              <Input
                className="h-8 min-w-0"
                value={
                  apartment.monthlyFee
                    ? formatNumber(apartment.monthlyFee)
                    : formatNumber(defaultFeeForBlock(apartment.blockId))
                }
                placeholder="Giá"
                onChange={(event) =>
                  props.updateApartment(apartment.id, {
                    monthlyFee: parseAmount(
                      formatAmountInput(event.target.value),
                      defaultFeeForBlock(apartment.blockId),
                    ),
                  })
                }
              />
              <IconButton
                label="Xóa căn hộ"
                onClick={() => props.deleteApartment(apartment.id)}
              />
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
  newUser: { name: string; phone: string; email: string; role: Role };
  setNewUser: (value: {
    name: string;
    phone: string;
    email: string;
    role: Role;
  }) => void;
  addUser: (event: FormEvent<HTMLFormElement>) => void;
  updateUser: (id: string, patch: Partial<User>) => void;
  deleteUser: (id: string) => void;
  resetUserPassword: (id: string) => void;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-base font-semibold">Tài khoản truy cập</h2>
      <form
        onSubmit={props.addUser}
        className="mb-4 grid gap-2 lg:grid-cols-[1fr_150px_1fr_130px_auto]"
      >
        <Input
          placeholder="Tên nhân viên"
          value={props.newUser.name}
          onChange={(event) =>
            props.setNewUser({ ...props.newUser, name: event.target.value })
          }
        />
        <Input
          placeholder="Số điện thoại"
          inputMode="tel"
          value={props.newUser.phone}
          onChange={(event) =>
            props.setNewUser({ ...props.newUser, phone: event.target.value })
          }
        />
        <Input
          type="email"
          placeholder="Email khôi phục"
          value={props.newUser.email}
          onChange={(event) =>
            props.setNewUser({ ...props.newUser, email: event.target.value })
          }
          required
        />
        <NativeSelect
          className="w-full"
          value={props.newUser.role}
          onChange={(event) =>
            props.setNewUser({
              ...props.newUser,
              role: event.target.value as Role,
            })
          }
        >
          <NativeSelectOption value="staff">Nhân viên</NativeSelectOption>
          <NativeSelectOption value="admin">Admin</NativeSelectOption>
        </NativeSelect>
        <Button type="submit">
          <Plus className="size-4" />
          Thêm
        </Button>
      </form>

      <div className="mb-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
        Tài khoản mới có mật khẩu mặc định{' '}
        <span className="font-semibold text-foreground">123456</span> và phải
        đổi mật khẩu khi đăng nhập lần đầu.
      </div>

      <div className="overflow-x-auto">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tên</TableHead>
            <TableHead>ID điện thoại</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Vai trò</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <Input
                  value={user.name}
                  onChange={(event) =>
                    props.updateUser(user.id, { name: event.target.value })
                  }
                />
              </TableCell>
              <TableCell>
                <Input
                  value={user.phone}
                  inputMode="tel"
                  onChange={(event) =>
                    props.updateUser(user.id, { phone: event.target.value })
                  }
                />
              </TableCell>
              <TableCell>
                <Input
                  type="email"
                  value={user.email}
                  placeholder="Chưa có email"
                  onChange={(event) =>
                    props.updateUser(user.id, { email: event.target.value })
                  }
                />
              </TableCell>
              <TableCell>
                <NativeSelect
                  className="w-full"
                  value={user.role}
                  onChange={(event) =>
                    props.updateUser(user.id, {
                      role: event.target.value as Role,
                    })
                  }
                >
                  <NativeSelectOption value="staff">
                    Nhân viên
                  </NativeSelectOption>
                  <NativeSelectOption value="admin">Admin</NativeSelectOption>
                </NativeSelect>
              </TableCell>
              <TableCell>
                <Badge
                  variant={user.mustChangePassword ? 'outline' : 'secondary'}
                >
                  {user.mustChangePassword
                    ? 'Chờ đổi mật khẩu'
                    : 'Đã kích hoạt'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {user.role === 'staff' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Đặt lại mật khẩu"
                      title="Đặt lại mật khẩu về 123456"
                      onClick={() => props.resetUserPassword(user.id)}
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                  )}
                  <IconButton
                    label="Xóa tài khoản"
                    disabled={user.id === props.currentUserId}
                    onClick={() => props.deleteUser(user.id)}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        </Table>
      </div>
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
      className="h-8 w-8 rounded-md"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
