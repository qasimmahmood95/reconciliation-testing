/**
 * Core ledger types. All monetary amounts are `bigint` in the asset's
 * smallest unit (satoshis, wei). See docs/adr/0002-integer-minor-units.md.
 */

/** An asset supported by the fictional custody platform. */
export interface Asset {
  /** Ticker-style identifier, e.g. "BTC". */
  readonly id: string;
  /** Decimal places between display unit and minor unit (BTC: 8, ETH: 18). */
  readonly decimals: number;
}

/**
 * A single ledger entry: a signed amount of one asset moving through one
 * account. Positive credits the account, negative debits it.
 */
export interface Posting {
  readonly account: string;
  readonly asset: string;
  /** Signed amount in minor units. */
  readonly amount: bigint;
}

/**
 * An atomic group of postings. Valid transactions balance: per asset, the
 * posting amounts sum to zero (double entry, CLAUDE.md rule 2).
 */
export interface Transaction {
  /** Globally unique id; replay deduplication keys on this and only this. */
  readonly id: string;
  readonly postings: readonly Posting[];
}

/**
 * Balances keyed by `balanceKey(account, asset)`. A missing key means a
 * zero balance; consumers must treat absent and 0n identically.
 */
export type Balances = ReadonlyMap<string, bigint>;

/**
 * Canonical map key for an (account, asset) balance. JSON-encoding makes the
 * key collision-free for arbitrary account/asset strings and gives a stable
 * total order for deterministic report output.
 */
export function balanceKey(account: string, asset: string): string {
  return JSON.stringify([account, asset]);
}

/** Inverse of {@link balanceKey}. */
export function parseBalanceKey(key: string): {
  account: string;
  asset: string;
} {
  const parsed: unknown = JSON.parse(key);
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    typeof parsed[0] !== 'string' ||
    typeof parsed[1] !== 'string'
  ) {
    throw new LedgerError(
      'BAD_KEY',
      `not a balance key: ${JSON.stringify(key)}`,
    );
  }
  return { account: parsed[0], asset: parsed[1] };
}

export type LedgerErrorCode =
  | 'BAD_KEY'
  | 'EMPTY_POSTINGS'
  | 'UNBALANCED'
  | 'DUPLICATE_TX'
  | 'BAD_CURSOR'
  | 'BAD_PAGE_SIZE'
  | 'BAD_AMOUNT'
  | 'BAD_DECIMALS';

/** All library failures throw this; `code` is stable, `message` is not. */
export class LedgerError extends Error {
  constructor(
    readonly code: LedgerErrorCode,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = 'LedgerError';
  }
}
