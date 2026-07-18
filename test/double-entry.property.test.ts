/**
 * Property family 1: the double-entry invariant.
 *
 * A booking path that writes one-sided entries (a credit without its debit)
 * silently mints or burns assets, and the books can still look plausible
 * account by account. These properties check that any transaction the
 * generators can express either balances per asset or is rejected with
 * UNBALANCED. There is no third state.
 */
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  isBalanced,
  LedgerError,
  sumByAsset,
  validateTransaction,
  type Transaction,
} from '../src/index.js';
import {
  transactionPostingsArb,
  unbalancedPostingsArb,
} from '../src/testing/index.js';

describe('property: double entry', () => {
  it('every generated transaction balances: postings sum to zero per asset', () => {
    fc.assert(
      fc.property(transactionPostingsArb, (postings) => {
        const tx: Transaction = { id: 'tx-under-test', postings };
        expect(isBalanced(tx)).toBe(true);
        expect(validateTransaction(tx)).toBe(tx);
        for (const sum of sumByAsset(postings).values()) {
          expect(sum).toBe(0n);
        }
      }),
    );
  });

  it('every unbalanced posting set is rejected with code UNBALANCED', () => {
    fc.assert(
      fc.property(unbalancedPostingsArb, (postings) => {
        const tx: Transaction = { id: 'tx-under-test', postings };
        expect(isBalanced(tx)).toBe(false);
        let caught: unknown;
        try {
          validateTransaction(tx);
        } catch (error) {
          caught = error;
        }
        expect(
          caught,
          'validateTransaction accepted an unbalanced tx',
        ).toBeInstanceOf(LedgerError);
        expect((caught as LedgerError).code).toBe('UNBALANCED');
      }),
    );
  });

  it('the empty posting set is rejected, never treated as balanced-by-vacuity', () => {
    const tx: Transaction = { id: 'tx-empty', postings: [] };
    expect(() => validateTransaction(tx)).toThrow(/EMPTY_POSTINGS/);
  });
});
