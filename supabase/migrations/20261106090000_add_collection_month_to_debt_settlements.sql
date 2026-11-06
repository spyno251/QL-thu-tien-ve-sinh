alter table public.debt_settlements
add column if not exists collection_month text;

alter table public.debt_settlements
drop constraint if exists debt_settlements_collection_month_check;

alter table public.debt_settlements
add constraint debt_settlements_collection_month_check
check (collection_month is null or collection_month ~ '^\\d{4}-(0[1-9]|1[0-2])$');

create index if not exists debt_settlements_collection_month_idx
on public.debt_settlements(collection_month);
