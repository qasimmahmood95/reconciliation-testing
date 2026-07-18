/**
 * fast-check arbitraries and fixtures for the ledger domain: structured
 * generators built so that property failures shrink to small, readable
 * counterexamples (docs/adr/0001).
 *
 * Balanced transactions are generated as free legs plus a derived
 * counter-posting, so shrinking the legs always preserves the double-entry
 * invariant instead of producing invalid input.
 */
import * as fc from 'fast-check';
import type { Asset, Posting, Transaction } from '../types.js';

/** The fictional custody platform's asset list, high-decimal on purpose. */
export const FIXTURE_ASSETS: readonly Asset[] = [
  { id: 'BTC', decimals: 8 },
  { id: 'ETH', decimals: 18 },
  { id: 'USDC', decimals: 6 },
];

export const assetArb: fc.Arbitrary<Asset> = fc.constantFrom(...FIXTURE_ASSETS);

/**
 * Small closed account pool so generated histories reuse accounts; overlap
 * between transactions is what makes reconciliation and balance folding
 * non-trivial.
 */
export const ACCOUNT_POOL: readonly string[] = [
  'treasury',
  'hot-wallet',
  'cold-vault',
  'client-a',
  'client-b',
  'fees',
];

export const accountArb: fc.Arbitrary<string> = fc.constantFrom(
  ...ACCOUNT_POOL,
);

/** Bound chosen to exceed 2^53 by orders of magnitude: ~1000 ETH in wei. */
export const MAX_AMOUNT = 10n ** 21n;

/**
 * Signed minor-unit amount. Weighted toward the interesting boundaries:
 * zero, dust, and values beyond Number.MAX_SAFE_INTEGER where any smuggled
 * float arithmetic breaks.
 */
export const amountArb: fc.Arbitrary<bigint> = fc.oneof(
  { weight: 3, arbitrary: fc.bigInt({ min: -MAX_AMOUNT, max: MAX_AMOUNT }) },
  {
    weight: 1,
    arbitrary: fc.constantFrom(
      0n,
      1n,
      -1n,
      2n ** 53n - 1n, // Number.MAX_SAFE_INTEGER
      2n ** 53n + 1n, // first bigint a double cannot represent
      10n ** 18n, // one whole ETH in wei
    ),
  },
);

/** Strictly nonzero variant, for perturbations that must change something. */
export const nonZeroAmountArb: fc.Arbitrary<bigint> = amountArb.map((amount) =>
  amount >= 0n ? amount + 1n : amount,
);

/**
 * Balanced postings in a single asset: 1..3 free legs plus one derived
 * counter-posting, so the per-asset sum is zero by construction.
 */
export function balancedPostingsArb(
  asset: Asset,
): fc.Arbitrary<readonly Posting[]> {
  return fc
    .tuple(
      fc.array(fc.tuple(accountArb, amountArb), { minLength: 1, maxLength: 3 }),
      accountArb,
    )
    .map(([legs, counterAccount]) => {
      const postings = legs.map(([account, amount]) => ({
        account,
        asset: asset.id,
        amount,
      }));
      const sum = postings.reduce(
        (total, posting) => total + posting.amount,
        0n,
      );
      return [
        ...postings,
        { account: counterAccount, asset: asset.id, amount: -sum },
      ];
    });
}

/** Unordered pairs of distinct fixture assets. */
const ASSET_PAIRS: readonly (readonly [Asset, Asset])[] =
  FIXTURE_ASSETS.flatMap((a, i) =>
    FIXTURE_ASSETS.slice(i + 1).map((b) => [a, b] as const),
  );

/**
 * Balanced postings spanning 1..2 assets. Built with fc.oneof over the
 * fixed asset combinations instead of .chain(), which would weaken
 * shrinking (shrinking a chained source regenerates the target).
 */
export const transactionPostingsArb: fc.Arbitrary<readonly Posting[]> =
  fc.oneof(
    {
      weight: 2,
      arbitrary: fc.oneof(
        ...FIXTURE_ASSETS.map((asset) => balancedPostingsArb(asset)),
      ),
    },
    {
      weight: 1,
      arbitrary: fc.oneof(
        ...ASSET_PAIRS.map(([a, b]) =>
          fc
            .tuple(balancedPostingsArb(a), balancedPostingsArb(b))
            .map(([first, second]) => [...first, ...second]),
        ),
      ),
    },
  );

/**
 * A transaction log: balanced transactions with unique ids assigned by
 * position. Shrinking drops or simplifies transactions; ids stay unique.
 */
export const transactionLogArb: fc.Arbitrary<readonly Transaction[]> = fc
  .array(transactionPostingsArb, { minLength: 0, maxLength: 12 })
  .map((bodies) =>
    bodies.map((postings, index) => ({ id: `tx-${String(index)}`, postings })),
  );

/**
 * Postings that provably violate double entry: a balanced set with one
 * posting nudged by a nonzero delta, so exactly one asset sums to that
 * delta instead of zero. Shrinks toward the two-posting, delta-1n case
 * (two postings is the generator's minimum: one leg plus its counter).
 */
export const unbalancedPostingsArb: fc.Arbitrary<readonly Posting[]> = fc
  .tuple(transactionPostingsArb, fc.nat({ max: 1000 }), nonZeroAmountArb)
  .map(([postings, indexSeed, delta]) => {
    const index = indexSeed % postings.length;
    return postings.map((posting, i) =>
      i === index ? { ...posting, amount: posting.amount + delta } : posting,
    );
  });

/**
 * A log guaranteed to contain at least one pair of "twins": two distinct
 * transaction ids carrying identical postings. Both must be applied; only
 * redelivery of the same id is dropped. Random amount collisions are far
 * too rare to cover this within a CI numRuns budget, and a content-keyed
 * dedup bug (defect/replay-dedup) fails exactly here.
 */
export const twinTransactionLogArb: fc.Arbitrary<readonly Transaction[]> = fc
  .tuple(transactionLogArb, transactionPostingsArb, fc.nat({ max: 1000 }))
  .map(([log, twinPostings, positionSeed]) => {
    const twins: readonly Transaction[] = [
      { id: 'twin-a', postings: twinPostings },
      { id: 'twin-b', postings: twinPostings },
    ];
    const index = positionSeed % (log.length + 1);
    return [...log.slice(0, index), ...twins, ...log.slice(index)];
  });
