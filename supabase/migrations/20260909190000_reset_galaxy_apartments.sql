-- Reset only operational collection data. User accounts and app settings remain intact.
delete from public.payments;
delete from public.apartments;
delete from public.blocks;
delete from public.regions;

insert into public.regions (id, name, default_fee)
values
  ('region-galaxy-1', 'Galaxy 1', 300000),
  ('region-galaxy-2', 'Galaxy 2', 300000),
  ('region-galaxy-3', 'Galaxy 3', 300000),
  ('region-galaxy-4', 'Galaxy 4', 300000),
  ('region-galaxy-5', 'Galaxy 5', 300000),
  ('region-galaxy-6', 'Galaxy 6', 300000),
  ('region-galaxy-7', 'Galaxy 7', 300000),
  ('region-galaxy-8', 'Galaxy 8', 300000);

-- Empty-name blocks keep the database relationship while remaining invisible in the Dãy list.
insert into public.blocks (id, region_id, name)
values
  ('block-galaxy-1', 'region-galaxy-1', ''),
  ('block-galaxy-2', 'region-galaxy-2', ''),
  ('block-galaxy-3', 'region-galaxy-3', ''),
  ('block-galaxy-4', 'region-galaxy-4', ''),
  ('block-galaxy-5', 'region-galaxy-5', ''),
  ('block-galaxy-6', 'region-galaxy-6', ''),
  ('block-galaxy-7', 'region-galaxy-7', ''),
  ('block-galaxy-8', 'region-galaxy-8', '');

insert into public.apartments (id, block_id, code, owner, monthly_fee)
select
  format('apartment-galaxy-%s-%s', source.region_number, apartment_number),
  format('block-galaxy-%s', source.region_number),
  format('Căn %s', lpad(apartment_number::text, 2, '0')),
  '',
  300000
from (
  values
    (1, 40),
    (2, 5),
    (3, 58),
    (4, 58),
    (5, 58),
    (6, 58),
    (8, 40)
) as source(region_number, apartment_total)
cross join lateral generate_series(1, source.apartment_total) as apartment_number;
