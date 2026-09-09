create table public.app_settings (
  id text primary key,
  app_name text not null default 'Thu tiền vệ sinh',
  subtitle text not null default 'Quản lý thu tiền vệ sinh theo từng căn hộ',
  logo_url text not null default '',
  theme text not null default 'teal' check (theme in ('teal', 'blue', 'indigo', 'amber', 'rose'))
);

insert into public.app_settings (id) values ('default');

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
