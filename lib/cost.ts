// lib/cost.ts
// Cost-saving model — proposal §20, brief §24.

export const COST_CONSTANTS = {
  technicianVisitAed: 150,
  reverseLogisticsAed: 80,
  replacementDeliveryAed: 100,
  openBoxDepreciationRate: 0.2, // 20% loss when a sealed unit is opened
};

/**
 * Estimated cost avoided per case when the AI's conservative recommendation
 * prevents an unnecessary replacement (which would have triggered tech visit
 * + reverse logistics + new delivery + open-box depreciation).
 */
export function avoidedCostPerCase(productValueAed: number): number {
  const openBoxLoss = productValueAed * COST_CONSTANTS.openBoxDepreciationRate;
  return (
    COST_CONSTANTS.technicianVisitAed +
    COST_CONSTANTS.reverseLogisticsAed +
    COST_CONSTANTS.replacementDeliveryAed +
    openBoxLoss
  );
}

export function projectedMonthlySaving(
  preventedReturnsPerMonth: number,
  avgProductValueAed: number
): number {
  return preventedReturnsPerMonth * avoidedCostPerCase(avgProductValueAed);
}

// Recommendations that, when chosen, are considered "prevented an unnecessary
// replacement" for cost-saving purposes.
export const COST_SAVING_RECOMMENDATIONS = new Set([
  "reject_request",
  "request_more_evidence",
  "remote_troubleshooting",
  "send_technician",
  "escalate_manager",
]);
