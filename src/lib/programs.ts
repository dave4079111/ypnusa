import type { LoanProgram } from "./types";

export const PROGRAM_LIST: LoanProgram[] = ["FHA", "VA", "DSCR", "HELOC", "REFI", "JUMBO"];

const PROGRAM_LOOKUP = new Set(PROGRAM_LIST);

export function coerceLoanProgram(value: unknown): LoanProgram | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.toUpperCase() as LoanProgram;
  return PROGRAM_LOOKUP.has(normalized) ? normalized : undefined;
}
