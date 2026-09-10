alter table public.app_settings
add column if not exists auto_backup_enabled boolean not null default false;

create table public.app_backups (
  id text primary key,
  backup_date date not null unique,
  source text not null check (source in ('automatic')),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index app_backups_created_at_idx on public.app_backups(created_at desc);

alter table public.app_backups enable row level security;
revoke all on public.app_backups from anon, authenticated;
