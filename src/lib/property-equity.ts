export const ILLUSTRATIVE_CASH_OUT_LTV = 0.8;

export interface PropertyEquityInputs {
  estimatedHomeValueUsd: number;
  currentMortgageBalanceUsd: number;
}

export interface PropertyEquitySnapshot {
  estimatedHomeValueUsd: number;
  currentMortgageBalanceUsd: number;
  estimatedEquityUsd: number;
  illustrativeCashOutUsd: number;
  estimatedLtvPct: number;
}

export function calculatePropertyEquity(
  inputs: PropertyEquityInputs,
): PropertyEquitySnapshot {
  const estimatedHomeValueUsd = Math.round(inputs.estimatedHomeValueUsd);
  const currentMortgageBalanceUsd = Math.round(inputs.currentMortgageBalanceUsd);
  const estimatedEquityUsd = estimatedHomeValueUsd - currentMortgageBalanceUsd;
  const illustrativeCashOutUsd = Math.max(
    0,
    Math.floor(
      estimatedHomeValueUsd * ILLUSTRATIVE_CASH_OUT_LTV -
        currentMortgageBalanceUsd,
    ),
  );
  const estimatedLtvPct =
    estimatedHomeValueUsd > 0
      ? Math.round((currentMortgageBalanceUsd / estimatedHomeValueUsd) * 1000) / 10
      : 0;

  return {
    estimatedHomeValueUsd,
    currentMortgageBalanceUsd,
    estimatedEquityUsd,
    illustrativeCashOutUsd,
    estimatedLtvPct,
  };
}
