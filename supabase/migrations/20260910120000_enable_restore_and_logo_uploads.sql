alter table public.app_backups
drop constraint if exists app_backups_backup_date_key;

alter table public.app_backups
drop constraint if exists app_backups_source_check;

alter table public.app_backups
add constraint app_backups_source_check
check (source in ('automatic', 'manual'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-assets',
  'app-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
