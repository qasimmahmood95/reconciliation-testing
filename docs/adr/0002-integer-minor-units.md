# ADR 0002 — Integer minor units; floats are banned for money

Status: accepted · Date: 2026-07-18

## Context

Custody assets use high decimal scales: BTC has 8 decimals (satoshis), ETH
has 18 (wei). IEEE-754 doubles — TypeScript's `number` — cannot represent
this domain:

- Decimal fractions are inexact: `0.1 + 0.2 !== 0.3`.
- Integers are only safe up to 2^53 − 1 ≈ 9.007e15. One ETH is 1e18 wei;
  even a _single_ whole-ETH balance overflows safe-integer range, silently.
- Rounding drift compounds: summing many dust amounts in floats produces a
  total that is close, but wrong — and reconciliation is exactly the business
  of noticing small wrong totals.

A reconciliation library whose arithmetic can be off by one unit cannot tell
a real discrepancy from its own noise.

## Decision

All amounts are `bigint` in the asset's smallest unit (satoshis, wei).
`number` must never hold a monetary amount, at any layer — not in the
library, not in fixtures, not in test generators. Conversion between display
strings ("1.5 BTC") and minor units happens only at the edges via exact
decimal string parsing/formatting; any input that does not land exactly on a
minor unit is rejected, never rounded silently.

## Consequences

- Arithmetic is exact and total-order comparable; balances sum associatively
  and commutatively, which the order-independence properties rely on.
- No fractional intermediate values exist in core logic; anything that needs
  sub-unit precision is a design smell and is rejected.
- Property generators draw `bigint` amounts spanning the full domain,
  including values far beyond 2^53 — precisely where a smuggled-in float
  breaks. The planted defect `defect/rounding-conversion` demonstrates this.
- JSON serialization needs care (`bigint` has no native JSON form); the
  library keeps serialization out of scope rather than compromise on the
  amount type.
