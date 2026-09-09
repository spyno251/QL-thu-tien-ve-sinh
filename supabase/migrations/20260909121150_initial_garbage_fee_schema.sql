create table public.users (
  id text primary key,
  phone text not null unique,
  password text not null,
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin', 'staff')),
  must_change_password boolean not null default false
);

create table public.sessions (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  expires_at timestamptz not null
);
create index sessions_user_id_idx on public.sessions(user_id);

create table public.regions (
  id text primary key,
  name text not null,
  default_fee integer not null check (default_fee > 0)
);

create table public.blocks (
  id text primary key,
  region_id text not null references public.regions(id) on delete cascade,
  name text not null
);

create table public.apartments (
  id text primary key,
  block_id text not null references public.blocks(id) on delete cascade,
  code text not null,
  owner text not null default '',
  monthly_fee integer check (monthly_fee is null or monthly_fee > 0)
);

create table public.payments (
  id text primary key,
  apartment_id text not null references public.apartments(id) on delete cascade,
  collector_id text not null references public.users(id),
  month text not null check (month ~ '^\\d{4}-(0[1-9]|1[0-2])$'),
  paid_at timestamptz not null,
  amount integer not null check (amount > 0),
  unique (apartment_id, month)
);
create index payments_month_idx on public.payments(month);
create index payments_collector_id_idx on public.payments(collector_id);

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.regions enable row level security;
alter table public.blocks enable row level security;
alter table public.apartments enable row level security;
alter table public.payments enable row level security;

revoke all on all tables in schema public from anon, authenticated;
