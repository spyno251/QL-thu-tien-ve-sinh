import assert from 'node:assert/strict';
import {
  calculateDebtBalance,
  debtBalanceLabel,
  findLegacyDebtCorrections,
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
