alter table public.apartments
add column phone text not null default '';

alter table public.payments
add column method text not null default 'cash'
check (method in ('cash', 'transfer'));
