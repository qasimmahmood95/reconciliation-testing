/**
 * Reconciliation: compare internal double-entry balances against an
 * on-chain view and report every (account, asset) whose balances differ.
 * Pure, total, and deterministic: the report is sorted by balance key, so
 * two runs over the same inputs — in any iteration order — are deeply equal.
 */
import type { Balances } from './types.js';
import { parseBalanceKey } from './types.js';

export interface Discrepancy {
  readonly account: string;
  readonly asset: string;
  /** Internal ledger balance, minor units (0n if absent). */
  readonly internal: bigint;
  /** On-chain balance, minor units (0n if absent). */
  readonly onChain: bigint;
  /** onChain - internal; never 0n in a report. */
  readonly delta: bigint;
}

export interface ReconciliationReport {
  /** Number of (account, asset) pairs present on either side that matched. */
  readonly matched: number;
  /** Sorted by (account, asset); empty means fully reconciled. */
  readonly discrepancies: readonly Discrepancy[];
}

/** True when the report shows a fully reconciled state. */
export function isReconciled(report: ReconciliationReport): boolean {
  return report.discrepancies.length === 0;
}

/**
 * Compares the union of keys on both sides; a key missing from one side is
 * a zero balance there. Zero-balance entries therefore never produce a
 * discrepancy against a missing entry.
 */
export function reconcile(
  internal: Balances,
  onChain: Balances,
): ReconciliationReport {
  const keys = [...new Set([...internal.keys(), ...onChain.keys()])].sort();
  const discrepancies: Discrepancy[] = [];
  let matched = 0;
  for (const key of keys) {
    const internalBalance = internal.get(key) ?? 0n;
    const onChainBalance = onChain.get(key) ?? 0n;
    if (internalBalance === onChainBalance) {
      matched += 1;
      continue;
    }
    const { account, asset } = parseBalanceKey(key);
    discrepancies.push({
      account,
      asset,
      internal: internalBalance,
      onChain: onChainBalance,
      delta: onChainBalance - internalBalance,
    });
  }
  return { matched, discrepancies };
}
