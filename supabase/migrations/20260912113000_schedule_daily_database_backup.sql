create extension if not exists pg_cron with schema extensions;

create or replace function public.create_automatic_daily_backup()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  backup_day date := timezone('Asia/Bangkok', now())::date;
begin
  if not exists (
    select 1
      from public.app_settings
     where id = 'default' and auto_backup_enabled
  ) then
    return;
  end if;

  if exists (
    select 1
      from public.app_backups
     where backup_date = backup_day and source = 'automatic'
  ) then
    return;
  end if;

  insert into public.app_backups (id, backup_date, source, snapshot)
  values (
    gen_random_uuid()::text,
    backup_day,
    'automatic',
    jsonb_build_object(
      'users', coalesce((select jsonb_agg(to_jsonb(item)) from public.users item), '[]'::jsonb),
      'regions', coalesce((select jsonb_agg(to_jsonb(item)) from public.regions item), '[]'::jsonb),
      'blocks', coalesce((select jsonb_agg(to_jsonb(item)) from public.blocks item), '[]'::jsonb),
      'apartments', coalesce((select jsonb_agg(to_jsonb(item)) from public.apartments item), '[]'::jsonb),
      'payments', coalesce((select jsonb_agg(to_jsonb(item)) from public.payments item), '[]'::jsonb),
      'debtSettlements', coalesce((select jsonb_agg(to_jsonb(item)) from public.debt_settlements item), '[]'::jsonb),
      'settings', coalesce((select jsonb_agg(to_jsonb(item)) from public.app_settings item), '[]'::jsonb)
    )
  );
end;
$function$;

select cron.unschedule(jobid)
  from cron.job
 where jobname = 'automatic-daily-app-backup';

select cron.schedule(
  'automatic-daily-app-backup',
  '0 17 * * *',
  'select public.create_automatic_daily_backup();'
);
