/**
 * Property family 3: idempotent replay of transaction logs.
 *
 * Feed consumers crash and resume mid-stream, so under at-least-once
 * delivery the same transaction can arrive twice; counting it twice doubles
 * balances. The opposite failure is dedup keyed on content instead of id,
 * where two legitimate transactions with the same postings (same client,
 * same sweep amount, seconds apart) collapse into one. Replay must dedupe
 * by transaction id and by nothing else.
 */
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  balanceKey,
  balancesFromLog,
  type Balances,
  type Transaction,
} from '../src/index.js';
import {
  transactionLogArb,
  twinTransactionLogArb,
} from '../src/testing/index.js';

/**
 * Reference model: a naive posting fold with no dedup at all. Valid for
 * logs whose ids are already unique, which the generators guarantee.
 */
function modelBalances(log: readonly Transaction[]): Balances {
  const balances = new Map<string, bigint>();
  for (const tx of log) {
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

describe('property: idempotent replay', () => {
  it('re-delivering the whole log changes nothing', () => {
    fc.assert(
      fc.property(transactionLogArb, (log) => {
        expect(balancesFromLog([...log, ...log])).toEqual(balancesFromLog(log));
      }),
    );
  });

  it('re-delivering any contiguous slice at any point changes nothing', () => {
    fc.assert(
      fc.property(
        transactionLogArb,
        fc.nat({ max: 1000 }),
        fc.nat({ max: 1000 }),
        (log, startSeed, endSeed) => {
          const start = log.length === 0 ? 0 : startSeed % log.length;
          const end = start + (endSeed % (log.length - start + 1));
          const replayed = [...log, ...log.slice(start, end)];
          expect(balancesFromLog(replayed)).toEqual(balancesFromLog(log));
        },
      ),
    );
  });

  it('dedup keys on transaction id ONLY: identical-posting twins both apply', () => {
    fc.assert(
      fc.property(twinTransactionLogArb, (log) => {
        // The generator guarantees two distinct ids with identical postings;
        // the naive no-dedup model is the ground truth for unique-id logs.
        expect(balancesFromLog(log)).toEqual(modelBalances(log));
      }),
    );
  });
});
