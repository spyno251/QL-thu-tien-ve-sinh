import assert from 'node:assert/strict';
import {
  calculateDebtBalance,
  collectionBalanceThroughMonth,
  confirmedSettlementsForCollectionMonth,
  debtBalanceLabel,
  findLegacyDebtCorrections,
  paymentsForCollectionMonth,
} from '../lib/debt-balance.js';

const legacySettlement = {
  id: 'settlement-la-dang',
  staffName: 'Là Đặng',
  amount: 17_950_000,
  status: 'confirmed',
  submittedAt: '2026-10-10T06:32:00.000Z',
  confirmedAt: '2026-10-10T06:34:00.000Z',
};

const legacyConfirmation = {
  recordId: 'settlement-la-dang',
  action: 'Đã xác nhận nộp công nợ',
  details: { staffName: 'Là Đặng', amount: 18_000_000 },
  createdAt: '2026-10-10T06:34:00.000Z',
};

assert.deepEqual(
  findLegacyDebtCorrections([legacySettlement], [legacyConfirmation]),
  [{ id: 'settlement-la-dang', amount: 18_000_000 }],
);

const correctedSettlement = { ...legacySettlement, amount: 18_000_000 };
assert.equal(calculateDebtBalance(17_950_000, [correctedSettlement]), -50_000);
assert.equal(debtBalanceLabel(-50_000), 'Dư có');

const settlementsByMonth = [
  { id: 'sep', amount: 21_150_000, status: 'confirmed', collectionMonth: '2026-09' },
  { id: 'oct', amount: 1_900_000, status: 'confirmed', collectionMonth: '2026-10' },
  { id: 'pending', amount: 500_000, status: 'pending', collectionMonth: '2026-10' },
];
assert.deepEqual(
  confirmedSettlementsForCollectionMonth(settlementsByMonth, '2026-10').map((item) => item.id),
  ['oct'],
);
assert.deepEqual(confirmedSettlementsForCollectionMonth(settlementsByMonth, ''), []);

const paymentsByMonth = [
  { id: 'payment-sep', month: '2026-09', amount: 21_150_000 },
  { id: 'payment-oct', month: '2026-10', amount: 5_500_000 },
];
assert.deepEqual(
  paymentsForCollectionMonth(paymentsByMonth, '2026-09').map((item) => item.id),
  ['payment-sep'],
);
assert.deepEqual(
  paymentsForCollectionMonth(paymentsByMonth, '2026-10').map((item) => item.id),
  ['payment-oct'],
);

const rollingPayments = [
  { collectorId: 'la-dang', month: '2026-09', amount: 21_150_000 },
  { collectorId: 'la-dang', month: '2026-10', amount: 5_500_000 },
  { collectorId: 'cao-minh-hieu', month: '2026-09', amount: 41_050_000 },
  { collectorId: 'cao-minh-hieu', month: '2026-10', amount: 27_950_000 },
];
const rollingSettlements = [
  { staffId: 'la-dang', amount: 21_150_000, status: 'confirmed', collectionMonth: '2026-09' },
];
assert.equal(
  collectionBalanceThroughMonth(rollingPayments, rollingSettlements, 'la-dang', '2026-09'),
  0,
);
assert.equal(
  collectionBalanceThroughMonth(rollingPayments, rollingSettlements, 'la-dang', '2026-10'),
  5_500_000,
);
assert.equal(
  collectionBalanceThroughMonth(rollingPayments, rollingSettlements, 'cao-minh-hieu', '2026-10'),
  69_000_000,
);

// A legacy audit record without the original record id is recovered only when
// its staff and confirmation time point to one unambiguous settlement.
assert.deepEqual(
  findLegacyDebtCorrections(
    [legacySettlement],
    [{ ...legacyConfirmation, recordId: 'legacy-record-id' }],
  ),
  [{ id: 'settlement-la-dang', amount: 18_000_000 }],
);

assert.deepEqual(
  findLegacyDebtCorrections(
    [legacySettlement, { ...legacySettlement, id: 'another', confirmedAt: '2026-10-10T06:35:00.000Z' }],
    [{ ...legacyConfirmation, recordId: 'legacy-record-id' }],
  ),
  [],
);

console.log('Debt balance tests passed.');
