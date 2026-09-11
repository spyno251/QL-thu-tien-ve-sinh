-- The collection periods were mixed. Keep master data, but start payment and
-- debt accounting again from a clean, consistent monthly ledger.
delete from public.debt_settlements;
delete from public.payments;
