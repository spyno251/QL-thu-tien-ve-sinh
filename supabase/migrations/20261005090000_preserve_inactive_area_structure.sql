-- Keep historical payments intact when an area, row, or apartment is no longer used.
alter table public.regions add column if not exists is_active boolean not null default true;
alter table public.blocks add column if not exists is_active boolean not null default true;
alter table public.apartments add column if not exists is_active boolean not null default true;

create index if not exists regions_active_idx on public.regions (is_active);
create index if not exists blocks_active_idx on public.blocks (is_active);
create index if not exists apartments_active_idx on public.apartments (is_active);
