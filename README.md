# reconciliation-testing

[![CI](https://github.com/qasimmahmood95/reconciliation-testing/actions/workflows/ci.yml/badge.svg)](https://github.com/qasimmahmood95/reconciliation-testing/actions/workflows/ci.yml)

**Ledger reconciliation is a correctness problem, and property-based testing
is the right weapon for it.** This repo is the demonstration: a small
double-entry ledger library for a fictional digital-asset custody platform,
and a [fast-check](https://fast-check.dev) property suite that catches the
kind of subtle, realistic defects that example-based tests routinely miss —
then shrinks each failure to a minimal counterexample you can read at a
glance.

The proof lives on the [planted-defect branches](#the-money-shot-planted-defects-caught-and-shrunk):
three branches, each carrying one plausible-looking bug, each caught in CI by
exactly the property built to guard it.

## Why properties, not examples

A reconciler compares two views of the same money: internal double-entry
balances and an external "on-chain" balance source. Its input space is any
set of accounts × any assets (8-decimal satoshis, 18-decimal wei) × any
transaction history × any delivery order, possibly delivered more than once.
Real reconciliation bugs live in corners nobody enumerates by hand: exact
page-size boundaries, amounts just past 2^53, two legitimate transactions
with identical amounts. Example tests encode failure modes you already know
about; properties state the invariant and let the generator hunt.
[ADR-0001](docs/adr/0001-property-based-testing.md) makes the full argument.

## The five properties

1. **Double entry** ([test](test/double-entry.property.test.ts)) — every
   transaction's postings sum to zero per asset; anything unbalanced is
   rejected. No path exists that silently mints or burns custody assets.
2. **Reconciliation detects exactly the truth**
   ([test](test/reconciliation.property.test.ts)) — a chain view derived
   from the same history reconciles clean (no false positives), and any
   injected perturbation is reported precisely: right accounts, right
   assets, right deltas, right signs, nothing extra.
3. **Idempotent replay** ([test](test/replay.property.test.ts)) — redelivering
   any slice of the log changes nothing (at-least-once delivery is safe),
   and dedup keys on transaction id _only_: two distinct transactions with
   byte-identical postings both apply.
4. **Exact precision at every scale** ([test](test/units.property.test.ts)) —
   display↔minor-unit conversion round-trips exactly for satoshis and wei,
   including far beyond `Number.MAX_SAFE_INTEGER`; sub-minor-unit input is
   rejected, never rounded. Floats never touch money
   ([ADR-0002](docs/adr/0002-integer-minor-units.md), lint-enforced).
5. **Order independence** ([test](test/ordering.property.test.ts)) — balances
   and reconciliation reports are invariant under any permutation of arrival
   order, and every pagination page size reconstructs the identical log.

## The money shot: planted defects, caught and shrunk

Each `defect/*` branch is `main` plus **one** commit containing a subtle,
realistic bug — the kind that passes review on a tired Friday. CI on those
branches is red by design; the linked runs show fast-check shrinking each
failure to its minimal counterexample. Seed is pinned in CI
(`FC_SEED=20260718`), so every failure below reproduces byte-for-byte.

<!-- COUNTEREXAMPLES -->

## Run it yourself

```bash
npm ci
npm test                                  # green on main
git checkout defect/replay-dedup
FC_SEED=20260718 npm test                 # red, with the counterexample above
```

`npm run lint` / `npm run typecheck` / `npm run build` complete the toolchain.
Any failing run prints its seed; replay it exactly with `FC_SEED=<seed> npm test`.

## Design notes

- **Library + fixtures only.** No HTTP, no database, no real chain access —
  the mock chain source is a deterministic fixture. Every exported function
  exists to serve a property.
- **Integer minor units.** All amounts are `bigint`; `number` never holds
  money anywhere, including test generators. Enforced by ESLint rules
  banning fractional literals, `parseFloat`, `Date.now`, and `Math.random`
  in library code.
- **Shrink-friendly generators.** Balanced transactions are generated as
  free legs plus a _derived_ counter-posting, so shrinking preserves the
  double-entry invariant instead of collapsing into invalid noise; that is
  why the counterexamples above are minimal _valid_ ledgers, not byte soup.
- **Deterministic CI.** Fixed seed, `numRuns` tuned to keep the whole
  workflow well under 5 minutes (it currently runs in seconds).

## Layout

```
src/            ledger library: types, ledger, log, units, chain, reconcile
src/testing/    fast-check arbitraries + fixtures (exported as ./testing)
test/           property suites (primary) + illustrative examples
docs/adr/       architecture decision records
docs/PLAN.md    milestone plan this repo was built against
```
