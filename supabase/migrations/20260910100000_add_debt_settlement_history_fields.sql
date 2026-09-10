alter table public.debt_settlements
add column if not exists debt_at_submission integer not null default 0
check (debt_at_submission >= 0),
add column if not exists method text not null default 'cash'
check (method in ('cash', 'transfer'));
