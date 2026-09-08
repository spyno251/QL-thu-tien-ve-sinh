import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  phone: text('phone').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
});

export const regions = sqliteTable('regions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  defaultFee: integer('default_fee').notNull(),
});

export const blocks = sqliteTable('blocks', {
  id: text('id').primaryKey(),
  regionId: text('region_id')
    .notNull()
    .references(() => regions.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
});

export const apartments = sqliteTable('apartments', {
  id: text('id').primaryKey(),
  blockId: text('block_id')
    .notNull()
    .references(() => blocks.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  owner: text('owner').notNull(),
  monthlyFee: integer('monthly_fee'),
});

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  apartmentId: text('apartment_id')
    .notNull()
    .references(() => apartments.id, { onDelete: 'cascade' }),
  collectorId: text('collector_id')
    .notNull()
    .references(() => users.id),
  month: text('month').notNull(),
  paidAt: text('paid_at').notNull(),
  amount: integer('amount').notNull(),
});
