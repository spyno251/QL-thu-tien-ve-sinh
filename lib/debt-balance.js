export function calculateDebtBalance(totalCollected, settlements) {
  const confirmedAmount = settlements
    .filter((settlement) => settlement.status === 'confirmed')
    .reduce((sum, settlement) => sum + Number(settlement.amount || 0), 0);
  return Number(totalCollected || 0) - confirmedAmount;
}

export function debtBalanceLabel(balance) {
  return balance < 0 ? 'Dư có' : 'Còn nợ';
}

function validPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function auditAmount(change) {
  if (change.action !== 'Đã xác nhận nộp công nợ') return null;
  const amount = Number(change.details?.amount);
  return validPositiveInteger(amount) ? amount : null;
}

function closestLegacyMatch(settlement, settlements, changes) {
  const confirmedAt = Date.parse(settlement.confirmedAt || settlement.submittedAt || '');
  if (!Number.isFinite(confirmedAt) || !settlement.staffName) return null;
  const candidates = changes.filter((change) => {
    const amount = auditAmount(change);
    const createdAt = Date.parse(change.createdAt || '');
    return amount !== null &&
      amount > settlement.amount &&
      change.details?.staffName === settlement.staffName &&
      Number.isFinite(createdAt) &&
      Math.abs(createdAt - confirmedAt) <= 15 * 60 * 1000;
  });
  if (candidates.length !== 1) return null;
  const [candidate] = candidates;
  const matchingSettlements = settlements.filter((possibleSettlement) => {
    const possibleConfirmedAt = Date.parse(
      possibleSettlement.confirmedAt || possibleSettlement.submittedAt || '',
    );
    const amount = auditAmount(candidate);
    return possibleSettlement.status === 'confirmed' &&
      amount !== null &&
      amount > possibleSettlement.amount &&
      possibleSettlement.staffName === candidate.details?.staffName &&
      Number.isFinite(possibleConfirmedAt) &&
      Math.abs(Date.parse(candidate.createdAt || '') - possibleConfirmedAt) <= 15 * 60 * 1000;
  });
  return matchingSettlements.length === 1 ? candidate : null;
}

/**
 * Finds legacy confirmed settlements whose original confirmation audit records
 * prove a larger deposited amount. The time/name fallback is intentionally
 * accepted only when it identifies one settlement unambiguously.
 */
export function findLegacyDebtCorrections(settlements, changes) {
  return settlements.flatMap((settlement) => {
    if (settlement.status !== 'confirmed') return [];
    const direct = changes
      .filter((change) => change.recordId === settlement.id)
      .map((change) => ({ change, amount: auditAmount(change) }))
      .filter((item) => item.amount !== null)
      .sort((left, right) => right.amount - left.amount)[0];
    const matched = direct?.change ?? closestLegacyMatch(settlement, settlements, changes);
    const amount = direct?.amount ?? (matched ? auditAmount(matched) : null);
    return amount !== null && amount > settlement.amount
      ? [{ id: settlement.id, amount }]
      : [];
  });
}
