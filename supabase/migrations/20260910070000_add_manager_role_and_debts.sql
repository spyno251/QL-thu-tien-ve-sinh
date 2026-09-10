alter table public.users
drop constraint if exists users_role_check;

alter table public.users
add constraint users_role_check
check (role in ('admin', 'manager', 'staff'));

alter table public.app_settings
add column if not exists show_admin_in_stats boolean not null default false;

create table public.debt_settlements (
  id text primary key,
  staff_id text not null references public.users(id),
  amount integer not null check (amount > 0),
  submitted_at timestamptz not null,
  confirmed_at timestamptz,
  confirmed_by text references public.users(id),
  status text not null check (status in ('pending', 'confirmed'))
);

create index debt_settlements_staff_id_idx on public.debt_settlements(staff_id);
create index debt_settlements_status_idx on public.debt_settlements(status);

alter table public.debt_settlements enable row level security;
revoke all on public.debt_settlements from anon, authenticated;
