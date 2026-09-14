create table public.access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  action text not null check (action in ('login', 'logout', 'support_login')),
  actor_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index access_logs_created_at_idx on public.access_logs(created_at desc);
create index access_logs_user_id_idx on public.access_logs(user_id, created_at desc);

alter table public.access_logs enable row level security;
revoke all on public.access_logs from anon, authenticated;
