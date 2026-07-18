/**
 * Property family 2: internal vs on-chain reconciliation.
 *
 * A reconciler can fail three ways: missing discrepancies, inventing them,
 * or mis-signing deltas so operators correct in the wrong direction. For
 * any generated history, a chain view derived from that same history must
 * reconcile clean, and injecting perturbations must produce a report naming
 * exactly the perturbed (account, asset) pairs with the injected deltas.
 */
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  balanceKey,
  balancesFromLog,
  chainViewFromLog,
  isReconciled,
  reconcile,
  withChainOverrides,
} from '../src/index.js';
import {
  accountArb,
  assetArb,
  nonZeroAmountArb,
  transactionLogArb,
} from '../src/testing/index.js';

/** Mirrors the report's locale-independent code-unit ordering. */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Distinct (account, asset) targets, each with a nonzero balance delta. */
const perturbationsArb = fc.uniqueArray(
  fc.tuple(accountArb, assetArb, nonZeroAmountArb),
  {
    minLength: 1,
    maxLength: 3,
    selector: ([account, asset]) => balanceKey(account, asset.id),
  },
);

describe('property: reconciliation', () => {
  // chainViewFromLog is the same fold as balancesFromLog, so this clean
  // case only pins down "identical inputs produce an empty report". The
  // detection guarantees come from the perturbation property below.
  it('a chain view derived from the same log reconciles clean', () => {
    fc.assert(
      fc.property(transactionLogArb, (log) => {
        const report = reconcile(balancesFromLog(log), chainViewFromLog(log));
        expect(isReconciled(report)).toBe(true);
        expect(report.discrepancies).toEqual([]);
      }),
    );
  });

  it('perturbing the chain view reports exactly the perturbed pairs and deltas', () => {
    fc.assert(
      fc.property(transactionLogArb, perturbationsArb, (log, perturbations) => {
        const internal = balancesFromLog(log);
        const view = chainViewFromLog(log);
        const overrides = new Map(
          perturbations.map(([account, asset, delta]) => {
            const key = balanceKey(account, asset.id);
            return [key, (view.get(key) ?? 0n) + delta] as const;
          }),
        );
        const report = reconcile(internal, withChainOverrides(view, overrides));

        const expected = perturbations
          .map(([account, asset, delta]) => {
            const before = view.get(balanceKey(account, asset.id)) ?? 0n;
            return {
              account,
              asset: asset.id,
              internal: before,
              onChain: before + delta,
              delta,
            };
          })
          .sort(
            (a, b) =>
              compareStrings(a.account, b.account) ||
              compareStrings(a.asset, b.asset),
          );
        expect(report.discrepancies).toEqual(expected);
      }),
    );
  });
});
