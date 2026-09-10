alter table public.app_settings
add column if not exists ui_preferences jsonb not null default '{}'::jsonb;
