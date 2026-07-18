import { describe, it } from 'vitest';
import * as fc from 'fast-check';

// M0 smoke property: proves the vitest + fast-check wiring end to end.
// bigint arbitraries run under the seed plumbing in setup.ts; if this were
// to fail it would print a seed and a shrunk counterexample in CI logs
// (verified by hand-forcing a failure). Real ledger properties land in M2.
describe('smoke: property wiring', () => {
  it('bigint addition is commutative and associative', () => {
    fc.assert(
      fc.property(fc.bigInt(), fc.bigInt(), fc.bigInt(), (a, b, c) => {
        return a + b === b + a && a + (b + c) === a + b + c;
      }),
    );
  });
});
