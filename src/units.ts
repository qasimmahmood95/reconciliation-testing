/**
 * Exact conversion between display-unit decimal strings ("1.5" BTC) and
 * minor-unit amounts (150000000n satoshis). String/bigint arithmetic only —
 * a float anywhere in this path is the bug this repo exists to catch
 * (docs/adr/0002-integer-minor-units.md; defect/rounding-conversion).
 */
import { LedgerError } from './types.js';

const DISPLAY_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;

function checkDecimals(decimals: number): void {
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 30) {
    throw new LedgerError(
      'BAD_DECIMALS',
      `decimals must be 0..30, got ${String(decimals)}`,
    );
  }
}

/**
 * Parses a display-unit decimal string into minor units, exactly.
 * Rejects — never rounds — input with more fractional digits than the asset
 * has decimals, and rejects anything that is not a plain decimal number.
 */
export function parseAmount(text: string, decimals: number): bigint {
  checkDecimals(decimals);
  const match = DISPLAY_PATTERN.exec(text);
  if (!match) {
    throw new LedgerError(
      'BAD_AMOUNT',
      `not a decimal amount: ${JSON.stringify(text)}`,
    );
  }
  const [, sign, whole = '', fraction = ''] = match;
  if (fraction.length > decimals) {
    throw new LedgerError(
      'BAD_AMOUNT',
      `${JSON.stringify(text)} has ${String(fraction.length)} fractional digits; asset supports ${String(decimals)}`,
    );
  }
  const minor =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, '0') || '0');
  return sign === '-' ? -minor : minor;
}

/**
 * Formats minor units as a display-unit decimal string with trailing zeros
 * trimmed ("1.5", not "1.50000000"). Round-trips exactly:
 * parseAmount(formatAmount(x, d), d) === x for all x (property 4).
 */
export function formatAmount(amount: bigint, decimals: number): string {
  checkDecimals(decimals);
  const sign = amount < 0n ? '-' : '';
  const magnitude = amount < 0n ? -amount : amount;
  const scale = 10n ** BigInt(decimals);
  const whole = magnitude / scale;
  const fraction = (magnitude % scale)
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');
  return fraction === ''
    ? `${sign}${String(whole)}`
    : `${sign}${String(whole)}.${fraction}`;
}
