# reconciliation-testing

[![CI](https://github.com/qasimmahmood95/reconciliation-testing/actions/workflows/ci.yml/badge.svg)](https://github.com/qasimmahmood95/reconciliation-testing/actions/workflows/ci.yml)

A small double-entry ledger library for a fictional digital-asset custody
platform, tested with [fast-check](https://fast-check.dev) properties instead
of examples. The point of the repo is the test suite, not the library: three
`defect/*` branches each carry one plausible bug, and CI on each branch fails
on the property written to guard against that class of bug, with the failure
shrunk to a minimal counterexample.

## Why properties instead of examples

A reconciler compares two views of the same money: internal double-entry
balances and an external "on-chain" balance source. The input space is any
set of accounts and assets (8-decimal satoshis, 18-decimal wei), any
transaction history, delivered in any order, possibly more than once. The
bugs that matter live in inputs nobody writes fixtures for: exact page-size
boundaries, amounts past 2^53, two transactions with identical amounts.
Example tests encode failure modes you already know about. Properties state
the invariant and let the generator search for violations.
[ADR-0001](docs/adr/0001-property-based-testing.md) has the longer version.

## The five properties

1. [Double entry](test/double-entry.property.test.ts): every transaction's
   postings sum to zero per asset; anything unbalanced is rejected.
2. [Reconciliation](test/reconciliation.property.test.ts): a chain view
   derived from the same history reconciles clean, and injected
   perturbations are reported exactly (right accounts, right assets, right
   deltas, nothing extra).
3. [Idempotent replay](test/replay.property.test.ts): redelivering any slice
   of the log changes nothing, and dedup keys on transaction id only, so two
   distinct transactions with identical postings both apply.
4. [Precision](test/units.property.test.ts): display/minor-unit conversion
   round-trips exactly at 8 and 18 decimals, including far past
   `Number.MAX_SAFE_INTEGER`. Input below the minor unit is rejected, not
   rounded. Floats never hold money
   ([ADR-0002](docs/adr/0002-integer-minor-units.md), enforced by lint).
5. [Ordering](test/ordering.property.test.ts): balances and reconciliation
   reports are unchanged under any permutation of arrival order, and every
   pagination page size reconstructs the identical log.

## The planted defects

Each `defect/*` branch is `main` plus one commit containing a subtle bug.
CI on those branches is red by design. The seed is pinned in CI
(`FC_SEED=20260718`), so the failures below reproduce byte for byte.

### [`defect/replay-dedup`](https://github.com/qasimmahmood95/reconciliation-testing/tree/defect/replay-dedup): dedup keyed on content instead of id

The planted commit reads like a sensible fix ("the upstream feed regenerates
transaction ids on retry, so dedupe on posting content instead"). The
consequence is that two legitimate transactions with identical postings
collapse into one and the books come up short. Property 3 shrinks the
failure to two twin transfers of one satoshi
([failing run](https://github.com/qasimmahmood95/reconciliation-testing/actions/runs/29642776234)):

```
FAIL  test/replay.property.test.ts
  property: idempotent replay > dedup keys on transaction id ONLY:
  identical-posting twins both apply

Property failed after 1 tests
{ seed: 20260718, ... }
Counterexample: [[
  {"id":"twin-a","postings":[{"account":"hot-wallet","asset":"BTC","amount":-1n},
                             {"account":"treasury","asset":"BTC","amount":1n}]},
  {"id":"twin-b","postings":[{"account":"hot-wallet","asset":"BTC","amount":-1n},
                             {"account":"treasury","asset":"BTC","amount":1n}]}]]
Shrunk 73 time(s)
```

### [`defect/rounding-conversion`](https://github.com/qasimmahmood95/reconciliation-testing/tree/defect/rounding-conversion): a float detour in unit conversion

The planted commit rewrites `parseAmount` to use native number arithmetic.
Every example test still passes because the example amounts sit below 2^53.
Property 4 finds the cliff and shrinks to the smallest amount that loses a
unit
([failing run](https://github.com/qasimmahmood95/reconciliation-testing/actions/runs/29642776224)):

```
FAIL  test/units.property.test.ts
  property: exact display-unit conversion > parse(format(x)) === x
  for every amount at every asset scale

Property failed after 1 tests
{ seed: 20260718, ... }
Counterexample: [-8597948274654235n,6]
Shrunk 36 time(s)
```

A companion property pins the exact boundary: 2^53 + 1 (`9007199254740993n`)
is the first amount the float path corrupts.

### [`defect/cursor-off-by-one`](https://github.com/qasimmahmood95/reconciliation-testing/tree/defect/cursor-off-by-one): pagination skips the boundary row

The planted commit "fixes" a reported duplicate by advancing the
continuation cursor one past the boundary transaction, so each page boundary
drops a row. Property 5 shrinks to a two-transaction log paged one at a time
([failing run](https://github.com/qasimmahmood95/reconciliation-testing/actions/runs/29642776108)):

```
FAIL  test/ordering.property.test.ts
  property: order independence > every page size reconstructs the
  identical log (no loss, no duplication)

Property failed after 4 tests
{ seed: 20260718, ... }
Counterexample: [[{"id":"tx-0", ...},{"id":"tx-1", ...}],1]   // pageSize 1: tx-1 vanishes
Shrunk 23 time(s)
```

## Running it

```bash
npm ci
npm test                     # green on main
git checkout defect/replay-dedup
FC_SEED=20260718 npm test    # red, with the counterexample above
```

`npm run lint`, `npm run typecheck` and `npm run build` complete the
toolchain. A failing run prints its seed; replay it with
`FC_SEED=<seed> npm test`.

## Design notes

Scope is deliberately narrow. This is a library plus fixtures: no HTTP, no
database, no real chain access. The mock chain source is a deterministic
fixture, and every exported function exists because a property consumes it.

All amounts are `bigint` minor units. `number` never holds money anywhere,
including in test generators, and ESLint bans fractional literals,
`parseFloat`, `Date.now` and `Math.random` in library code.

The generators are written for shrink quality. Balanced transactions are
generated as free legs plus a derived counter-posting, so shrinking
preserves the double-entry invariant instead of collapsing into invalid
input. That is why the counterexamples above are minimal valid ledgers.

CI pins the seed and runs in well under the five-minute budget.

## Layout

```
src/            ledger library: types, ledger, log, units, chain, reconcile
src/testing/    fast-check arbitraries and fixtures (exported as ./testing)
test/           property suites plus a few illustrative example tests
docs/adr/       architecture decision records
docs/PLAN.md    the milestone plan this repo was built against
```
