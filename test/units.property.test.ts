/**
 * Property family 4 — rounding and precision with high-decimal assets.
 *
 * Real-world failure guarded: a display-layer conversion that detours
 * through IEEE-754 floats. Above 2^53 minor units — less than one whole ETH
 * in wei — doubles silently round, so a customer's 1.000000000000000001 ETH
 * formats back as 1 ETH and reconciliation can no longer tell real breaks
 * from its own noise (docs/adr/0002). Conversion must round-trip exactly at
 * every scale and reject sub-minor-unit input rather than round it.
 */
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { formatAmount, LedgerError, parseAmount } from '../src/index.js';
import { amountArb, FIXTURE_ASSETS } from '../src/testing/index.js';

const decimalsArb = fc.constantFrom(
  0,
  ...FIXTURE_ASSETS.map((a) => a.decimals),
);

describe('property: exact display-unit conversion', () => {
  it('parse(format(x)) === x for every amount at every asset scale', () => {
    fc.assert(
      fc.property(amountArb, decimalsArb, (amount, decimals) => {
        expect(parseAmount(formatAmount(amount, decimals), decimals)).toBe(
          amount,
        );
      }),
    );
  });

  it('summing many dust amounts stays exact through conversion', () => {
    fc.assert(
      fc.property(
        fc.array(amountArb, { minLength: 1, maxLength: 50 }),
        decimalsArb,
        (amounts, decimals) => {
          const roundTripped = amounts.map((amount) =>
            parseAmount(formatAmount(amount, decimals), decimals),
          );
          const total = amounts.reduce((sum, amount) => sum + amount, 0n);
          const roundTrippedTotal = roundTripped.reduce(
            (sum, amount) => sum + amount,
            0n,
          );
          expect(roundTrippedTotal).toBe(total);
        },
      ),
    );
  });

  it('input below the minor unit is rejected, never silently rounded', () => {
    fc.assert(
      fc.property(amountArb, decimalsArb, (amount, decimals) => {
        // One digit more precision than the asset supports, sign preserved.
        const sign = amount < 0n ? '-' : '';
        const whole = formatAmount(amount < 0n ? -amount : amount, decimals);
        const integerPart = whole.split('.')[0] ?? whole;
        const tooPrecise = `${sign}${integerPart}.${'0'.repeat(decimals)}1`;
        let caught: unknown;
        try {
          parseAmount(tooPrecise, decimals);
        } catch (error) {
          caught = error;
        }
        expect(
          caught,
          'parseAmount accepted sub-minor-unit input',
        ).toBeInstanceOf(LedgerError);
        expect((caught as LedgerError).code).toBe('BAD_AMOUNT');
      }),
    );
  });
});
