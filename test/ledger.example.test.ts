/**
 * Example-based tests: illustrative documentation of the library surface.
 * The real guarantees are the M2 property suite; these exist so a reader
 * can see concrete numbers flow through the API.
 */
import { describe, expect, it } from 'vitest';
import {
  appendTransaction,
  balancesFromLog,
  balanceKey,
  chainViewFromLog,
  emptyLog,
  formatAmount,
  isReconciled,
  LedgerError,
  parseAmount,
  readAll,
  readPage,
  reconcile,
  validateTransaction,
  withChainOverrides,
  type Transaction,
} from '../src/index.js';

// 1.5 BTC moves from the omnibus hot wallet to a client, 0.001 BTC fee.
const deposit: Transaction = {
  id: 'tx-deposit',
  postings: [
    { account: 'hot-wallet', asset: 'BTC', amount: -150_100_000n },
    { account: 'client-a', asset: 'BTC', amount: 150_000_000n },
    { account: 'fees', asset: 'BTC', amount: 100_000n },
  ],
};

describe('double entry', () => {
  it('accepts a balanced transaction', () => {
    expect(validateTransaction(deposit)).toBe(deposit);
  });

  it('rejects an unbalanced transaction with code UNBALANCED', () => {
    const unbalanced: Transaction = {
      id: 'tx-bad',
      postings: [{ account: 'client-a', asset: 'BTC', amount: 1n }],
    };
    expect(() => validateTransaction(unbalanced)).toThrow(LedgerError);
    expect(() => validateTransaction(unbalanced)).toThrow(/UNBALANCED/);
  });
});

describe('balances', () => {
  it('folds a log into per-(account, asset) balances', () => {
    const balances = balancesFromLog([deposit]);
    expect(balances.get(balanceKey('client-a', 'BTC'))).toBe(150_000_000n);
    expect(balances.get(balanceKey('hot-wallet', 'BTC'))).toBe(-150_100_000n);
  });

  it('ignores duplicate delivery of the same transaction id', () => {
    expect(balancesFromLog([deposit, deposit])).toEqual(
      balancesFromLog([deposit]),
    );
  });
});

describe('transaction log pagination', () => {
  const log = [1n, 2n, 3n, 4n, 5n].map((amount, index) => ({
    id: `tx-${String(index + 1)}`,
    postings: [
      { account: 'client-a', asset: 'ETH', amount },
      { account: 'hot-wallet', asset: 'ETH', amount: -amount },
    ],
  }));

  it('walks the log in pages without loss or duplication', () => {
    expect(readAll(log, 2)).toEqual(log);
  });

  it('signals exhaustion with a null cursor', () => {
    const page = readPage(log, 4, 2);
    expect(page.transactions).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it('append rejects a duplicate transaction id', () => {
    const appended = appendTransaction(emptyLog, deposit);
    expect(() => appendTransaction(appended, deposit)).toThrow(/DUPLICATE_TX/);
  });
});

describe('display-unit conversion', () => {
  it('parses and formats whole-ETH amounts beyond 2^53 exactly', () => {
    const oneEth = parseAmount('1', 18);
    expect(oneEth).toBe(1_000_000_000_000_000_000n);
    expect(formatAmount(oneEth + 1n, 18)).toBe('1.000000000000000001');
  });

  it('rejects sub-minor-unit input instead of rounding', () => {
    expect(() => parseAmount('0.123456789', 8)).toThrow(/BAD_AMOUNT/);
  });
});

describe('reconciliation', () => {
  it('reports clean against a chain view derived from the same log', () => {
    const report = reconcile(
      balancesFromLog([deposit]),
      chainViewFromLog([deposit]),
    );
    expect(isReconciled(report)).toBe(true);
    expect(report.matched).toBe(3);
  });

  it('reports exactly the injected discrepancy with its delta', () => {
    const onChain = withChainOverrides(
      chainViewFromLog([deposit]),
      new Map([[balanceKey('client-a', 'BTC'), 149_999_999n]]),
    );
    const report = reconcile(balancesFromLog([deposit]), onChain);
    expect(report.discrepancies).toEqual([
      {
        account: 'client-a',
        asset: 'BTC',
        internal: 150_000_000n,
        onChain: 149_999_999n,
        delta: -1n,
      },
    ]);
  });
});
