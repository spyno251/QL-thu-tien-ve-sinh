create or replace function public.create_automatic_daily_backup()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  backup_day date := timezone('Asia/Bangkok', now())::date;
  snapshot_data jsonb;
  existing_backup_id text;
  existing_snapshot jsonb;
begin
  if not exists (
    select 1
      from public.app_settings
     where id = 'default' and auto_backup_enabled
  ) then
    return;
  end if;

  perform public.prune_app_backups();

  snapshot_data := jsonb_build_object(
    'users', coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from public.users item), '[]'::jsonb),
    'regions', coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from public.regions item), '[]'::jsonb),
    'blocks', coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from public.blocks item), '[]'::jsonb),
    'apartments', coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from public.apartments item), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from public.payments item), '[]'::jsonb),
    'debtSettlements', coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from public.debt_settlements item), '[]'::jsonb),
    'settings', coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from public.app_settings item), '[]'::jsonb)
  );

  select id, snapshot
    into existing_backup_id, existing_snapshot
    from public.app_backups
   where backup_date = backup_day and source = 'automatic'
   order by created_at desc
   limit 1;

  if existing_backup_id is not null then
    if existing_snapshot = snapshot_data then
      return;
    end if;
    update public.app_backups
       set snapshot = snapshot_data,
           created_at = now()
     where id = existing_backup_id;
    return;
  end if;

  if exists (
    select 1 from public.app_backups order by created_at desc limit 1
  ) and snapshot_data = (
    select snapshot from public.app_backups order by created_at desc limit 1
  ) then
    return;
  end if;

  insert into public.app_backups (id, backup_date, source, snapshot)
  values (gen_random_uuid()::text, backup_day, 'automatic', snapshot_data);
  perform public.prune_app_backups();
end;
$function$;
