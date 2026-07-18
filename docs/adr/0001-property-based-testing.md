# ADR 0001: property-based testing over example-based for reconciliation

Status: accepted. Date: 2026-07-18.

## Context

Ledger reconciliation compares two views of the same money, internal
double-entry balances and an external ("on-chain") balance source, and must
be correct over a very large input space: any set of accounts, any mix of
assets with different decimal scales, any transaction history, delivered in
any order, possibly more than once. Realistic reconciliation bugs (rounding
on conversion, off-by-one pagination, bad dedup keys) tend to sit in inputs
nobody enumerates by hand: exact page-size boundaries, amounts just above
2^53, twin transactions with identical amounts.

Example-based tests encode known failure modes. A hand-picked fixture proves
the happy path, not the invariant.

## Decision

Properties are the primary test suite. Each core guarantee is written as an
invariant over generated inputs (fast-check): postings sum to zero, replay
is idempotent, reconciliation is order-independent and detects exactly the
injected discrepancies, unit round-trips are exact. Example tests remain
only as illustration.

Arbitraries are structured (balanced transactions, logs, chain views derived
from logs) rather than raw random bytes, so that failures shrink to small,
readable counterexamples. CI pins the seed for reproducibility.

## Consequences

- A failure is a minimal counterexample rather than a diff buried in a large
  fixture, small enough to paste into a bug report.
- Generator code lives in `src/testing/` and is reviewed with the same care
  as the library.
- Runs are randomized; CI fixes the seed and prints it so any red run can be
  replayed exactly.
- Keeping generators shrink-friendly takes deliberate effort, which we
  accept.
