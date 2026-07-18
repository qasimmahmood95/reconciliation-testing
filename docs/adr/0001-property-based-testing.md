# ADR 0001 — Property-based testing over example-based for reconciliation

Status: accepted · Date: 2026-07-18

## Context

Ledger reconciliation compares two views of the same money — internal
double-entry balances and an external ("on-chain") balance source — and must
be correct over an enormous input space: any set of accounts, any mix of
assets with different decimal scales, any transaction history, delivered in
any order, possibly more than once. Real reconciliation bugs (rounding on
conversion, off-by-one pagination, bad dedup keys) live in corners no
example-writer thinks to enumerate: exact page-size boundaries, amounts just
above 2^53, twin transactions with identical amounts.

Example-based tests encode _known_ failure modes. Reconciliation defects are,
almost by definition, the unknown ones — a hand-picked fixture proves the
happy path, not the invariant.

## Decision

Properties are the primary test suite. Each core guarantee is written as an
invariant over generated inputs (fast-check): postings sum to zero, replay is
idempotent, reconciliation is order-independent and detects exactly the
injected discrepancies, unit round-trips are exact. Example tests remain only
as illustration and documentation.

Arbitraries are structured (model-based: balanced transactions, logs, chain
views derived from logs) rather than raw random bytes, so that every failure
shrinks to a minimal, human-readable counterexample. CI pins the seed for
reproducibility.

## Consequences

- A failure is a _minimal counterexample_, not a stack trace in a 500-line
  fixture — the shrunk output is small enough to paste into a bug report.
- Generator code is a first-class deliverable (`src/testing/`), reviewed with
  the same care as the library.
- Runs are randomized; CI fixes the seed and prints it so any red run can be
  replayed exactly.
- Some effort goes into keeping generators shrink-friendly; we accept that
  cost — it is the showcase.
