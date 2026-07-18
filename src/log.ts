/**
 * Append-only transaction log with cursor pagination. The log is a plain
 * readonly array; append returns a new array. Pagination exists because
 * downstream reconciliation jobs read the log in pages — and because an
 * off-by-one here is a classic, quietly catastrophic reconciliation bug
 * (property 5 guards it; see docs/PLAN.md, M3).
 */
import type { Transaction } from './types.js';
import { LedgerError } from './types.js';
import { validateTransaction } from './ledger.js';

export type TransactionLog = readonly Transaction[];

/** Empty starting log. */
export const emptyLog: TransactionLog = [];

/**
 * Appends a validated transaction. Rejects an id already present in the log
 * (append is the write path; duplicate *delivery* is instead tolerated at
 * read/replay time by balancesFromLog).
 */
export function appendTransaction(
  log: TransactionLog,
  tx: Transaction,
): TransactionLog {
  validateTransaction(tx);
  if (log.some((existing) => existing.id === tx.id)) {
    throw new LedgerError(
      'DUPLICATE_TX',
      `transaction id already in log: ${tx.id}`,
    );
  }
  return [...log, tx];
}

/** One page of a cursor walk over the log. */
export interface Page {
  readonly transactions: readonly Transaction[];
  /** Cursor for the next page, or null when the log is exhausted. */
  readonly nextCursor: number | null;
}

/**
 * Reads one page of at most `pageSize` transactions starting at `cursor`
 * (0 = start of log). A page is exhausted only when the cursor reaches the
 * end of the log; every transaction appears in exactly one page.
 */
export function readPage(
  log: TransactionLog,
  cursor: number,
  pageSize: number,
): Page {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new LedgerError(
      'BAD_PAGE_SIZE',
      `pageSize must be >= 1, got ${String(pageSize)}`,
    );
  }
  if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > log.length) {
    throw new LedgerError(
      'BAD_CURSOR',
      `cursor out of range: ${String(cursor)}`,
    );
  }
  const end = Math.min(cursor + pageSize, log.length);
  return {
    transactions: log.slice(cursor, end),
    nextCursor: end < log.length ? end : null,
  };
}

/**
 * Reconstructs the whole log by walking pages of `pageSize`. For a correct
 * pagination implementation this equals the log itself for every page size —
 * which is exactly property 5's pagination invariant.
 */
export function readAll(log: TransactionLog, pageSize: number): TransactionLog {
  const out: Transaction[] = [];
  let cursor: number | null = 0;
  while (cursor !== null) {
    const page: Page = readPage(log, cursor, pageSize);
    out.push(...page.transactions);
    cursor = page.nextCursor;
  }
  return out;
}
