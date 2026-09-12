create table public.transaction_backups (
  id text primary key default gen_random_uuid()::text,
  entity_type text not null check (entity_type in ('payment', 'debt_settlement')),
  operation text not null check (operation in ('insert', 'update', 'delete')),
  record_id text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index transaction_backups_created_at_idx
  on public.transaction_backups(created_at desc);

create index transaction_backups_record_idx
  on public.transaction_backups(entity_type, record_id, created_at desc);

alter table public.transaction_backups enable row level security;
revoke all on public.transaction_backups from anon, authenticated;

create or replace function public.backup_transaction_change()
returns trigger
language plpgsql
as $function$
begin
  insert into public.transaction_backups (
    entity_type,
    operation,
    record_id,
    before_data,
    after_data
  )
  values (
    case tg_table_name
      when 'payments' then 'payment'
      when 'debt_settlements' then 'debt_settlement'
    end,
    lower(tg_op),
    case when tg_op = 'DELETE' then old.id else new.id end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

create trigger payments_transaction_backup
after insert or update or delete on public.payments
for each row execute function public.backup_transaction_change();

create trigger debt_settlements_transaction_backup
after insert or update or delete on public.debt_settlements
for each row execute function public.backup_transaction_change();
