/**
 * Transaction validation and balance derivation. Pure functions only: the
 * fold never mutates its inputs, and replaying a log is idempotent because
 * transactions deduplicate on their globally unique id.
 */
import type { Balances, Posting, Transaction } from './types.js';
import { balanceKey, LedgerError } from './types.js';

/** Per-asset sum of posting amounts, in minor units. */
export function sumByAsset(
  postings: readonly Posting[],
): ReadonlyMap<string, bigint> {
  const sums = new Map<string, bigint>();
  for (const posting of postings) {
    sums.set(posting.asset, (sums.get(posting.asset) ?? 0n) + posting.amount);
  }
  return sums;
}

/** Double-entry check (CLAUDE.md rule 2): every asset's postings sum to zero. */
export function isBalanced(tx: Transaction): boolean {
  for (const sum of sumByAsset(tx.postings).values()) {
    if (sum !== 0n) return false;
  }
  return true;
}

/**
 * Validates a transaction for entry into a ledger. Throws LedgerError with
 * code EMPTY_POSTINGS or UNBALANCED; returns the transaction unchanged so
 * call sites can pipeline it.
 */
export function validateTransaction(tx: Transaction): Transaction {
  if (tx.postings.length === 0) {
    throw new LedgerError(
      'EMPTY_POSTINGS',
      `transaction ${tx.id} has no postings`,
    );
  }
  for (const [asset, sum] of sumByAsset(tx.postings)) {
    if (sum !== 0n) {
      throw new LedgerError(
        'UNBALANCED',
        `transaction ${tx.id} does not balance for ${asset}: sum is ${String(sum)}`,
      );
    }
  }
  return tx;
}

/**
 * Folds a transaction log into balances.
 *
 * - Every transaction is validated (double entry) before it is applied.
 * - Duplicate deliveries are dropped by transaction id — and only by id:
 *   two distinct transactions with identical postings are both applied.
 *   This is what makes replay idempotent (property 3).
 * - Addition of minor units is commutative and associative, so the result
 *   is independent of the order transactions arrive in (property 5).
 *
 * Zero balances are pruned so that "no entry" and "balance 0n" are the same
 * observable state regardless of the path taken to reach them.
 */
export function balancesFromLog(log: Iterable<Transaction>): Balances {
  const balances = new Map<string, bigint>();
  const seen = new Set<string>();
  for (const tx of log) {
    if (seen.has(tx.id)) continue;
    seen.add(tx.id);
    validateTransaction(tx);
    for (const posting of tx.postings) {
      const key = balanceKey(posting.account, posting.asset);
      const next = (balances.get(key) ?? 0n) + posting.amount;
      if (next === 0n) {
        balances.delete(key);
      } else {
        balances.set(key, next);
      }
    }
  }
  return balances;
}
