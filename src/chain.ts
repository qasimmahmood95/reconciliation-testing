/**
 * Mock "on-chain" balance source for the fictional custody context. There is
 * no real chain access anywhere in this repo (CLAUDE.md); a chain view is
 * just a deterministic fixture: balances per (account, asset), exactly the
 * shape a node/indexer snapshot would be flattened into.
 */
import type { Balances, Transaction } from './types.js';
import { balancesFromLog } from './ledger.js';

/**
 * The chain view a perfectly synced chain would report for a log: identical
 * to internal balances. Properties reconcile against this baseline and
 * against perturbations of it (property 2).
 */
export function chainViewFromLog(log: Iterable<Transaction>): Balances {
  return balancesFromLog(log);
}

/**
 * A chain view with explicit overrides, used by tests to inject
 * discrepancies. An override of 0n removes the balance (chains report
 * nothing for an empty balance, and reconciliation must treat missing and
 * zero identically).
 */
export function withChainOverrides(
  view: Balances,
  overrides: ReadonlyMap<string, bigint>,
): Balances {
  const out = new Map(view);
  for (const [key, balance] of overrides) {
    if (balance === 0n) {
      out.delete(key);
    } else {
      out.set(key, balance);
    }
  }
  return out;
}
