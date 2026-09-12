alter table public.sessions
add column if not exists impersonated_by text references public.users(id) on delete set null;

create index if not exists sessions_impersonated_by_idx
  on public.sessions(impersonated_by)
  where impersonated_by is not null;
