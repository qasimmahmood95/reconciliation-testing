/**
 * Property family 5 — ordering and concurrency invariants.
 *
 * Real-world failure guarded: transactions arrive from parallel workers and
 * queues, so arrival order is an accident of scheduling. If balances or
 * reconciliation output depend on it, the same books reconcile clean on one
 * run and break on the next — irreproducible pages at 3am. Likewise, a
 * paginated log read that skips or duplicates a boundary row makes the
 * result depend on page size. Balances, reports, and pagination walks must
 * all be invariant: any permutation, any page size, same answer.
 */
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  balancesFromLog,
  chainViewFromLog,
  readAll,
  reconcile,
  type Transaction,
} from '../src/index.js';
import { transactionLogArb } from '../src/testing/index.js';

/** Deterministic permutation of a log driven by generated sort keys. */
function permute(
  log: readonly Transaction[],
  keys: readonly number[],
): readonly Transaction[] {
  return log
    .map((tx, index) => ({ tx, key: keys[index % keys.length] ?? 0, index }))
    .sort((a, b) => a.key - b.key || a.index - b.index)
    .map((entry) => entry.tx);
}

// minLength 2: a single key cycles into the identity permutation, which
// makes the run vacuous. Two-plus keys keep even shrunk cases meaningful.
const sortKeysArb = fc.array(fc.nat({ max: 1000 }), {
  minLength: 2,
  maxLength: 12,
});

describe('property: order independence', () => {
  it('balances are invariant under permutation of arrival order', () => {
    fc.assert(
      fc.property(transactionLogArb, sortKeysArb, (log, keys) => {
        const shuffled = permute(log, keys);
        expect(balancesFromLog(shuffled)).toEqual(balancesFromLog(log));
      }),
    );
  });

  it('reconciliation reports are deeply equal regardless of arrival order', () => {
    fc.assert(
      fc.property(transactionLogArb, sortKeysArb, (log, keys) => {
        const shuffled = permute(log, keys);
        const view = chainViewFromLog(log);
        expect(reconcile(balancesFromLog(shuffled), view)).toEqual(
          reconcile(balancesFromLog(log), view),
        );
      }),
    );
  });

  it('every page size reconstructs the identical log (no loss, no duplication)', () => {
    fc.assert(
      fc.property(
        transactionLogArb,
        fc.integer({ min: 1, max: 15 }),
        (log, pageSize) => {
          expect(readAll(log, pageSize)).toEqual(log);
        },
      ),
    );
  });
});
