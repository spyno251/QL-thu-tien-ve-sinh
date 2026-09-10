alter table public.payments
drop constraint if exists payments_month_check;

alter table public.payments
add constraint payments_month_check
check (month ~ '^\d{4}-(0[1-9]|1[0-2])$');
