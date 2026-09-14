alter table public.sessions
  add column if not exists last_seen_at timestamptz not null default now();

create index if not exists sessions_last_seen_at_idx
  on public.sessions(last_seen_at desc);

create table public.record_changes (
  id uuid primary key default gen_random_uuid(),
  actor_id text references public.users(id) on delete set null,
  record_type text not null,
  record_id text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index record_changes_actor_created_at_idx
  on public.record_changes(actor_id, created_at desc);
create index record_changes_record_created_at_idx
  on public.record_changes(record_type, record_id, created_at desc);

alter table public.record_changes enable row level security;
revoke all on public.record_changes from anon, authenticated;
