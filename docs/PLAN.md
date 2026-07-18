# Milestone plan

One PR per milestone. Each milestone ends with a code review of the full
diff, then the PR, then a verification run from a clean checkout. CI must
stay under 5 minutes throughout.

## M0: scaffold

Goal: a repo where `npm ci && npm run lint && npm run typecheck && npm test`
passes in CI, with the decision records in place before any ledger code
exists.

Deliverables:

- `package.json` (strict ESM, Node LTS engines), `tsconfig.json`
  (`strict: true`, `noUncheckedIndexedAccess: true`), vitest and fast-check,
  eslint and prettier configs.
- GitHub Actions workflow running lint, typecheck and tests on every branch
  push, so `defect/*` runs are visible later.
- One trivial smoke property proving that fast-check output, including the
  seed and counterexample formatting, appears in CI logs as intended.
- ADRs: `0001-property-based-testing.md`, `0002-integer-minor-units.md`.
- LICENSE (MIT), .gitignore, .editorconfig.

Exit criteria: green CI well under 5 minutes; ADRs reviewed; the smoke
property demonstrably shrinks when forced to fail locally.

## M1: ledger core

Goal: the smallest library surface the properties need and nothing more.

Deliverables (all pure, all `bigint` minor units):

- `types.ts`: `Asset` (id plus decimals), `Posting` (account, asset,
  amount), `Transaction` (id, postings).
- `ledger.ts`: transaction validation (postings sum to zero per asset,
  empty postings rejected), balance derivation from a transaction log as a
  fold without mutation.
- `log.ts`: append-only transaction log with cursor pagination. The
  pagination exists because M3 plants an off-by-one in it.
- `units.ts`: conversion between display units and minor units (parse and
  format). Exists because M3 plants a rounding defect in it.
- `chain.ts`: mock on-chain balance source, a deterministic fixture of
  balances per (account, asset).
- `reconcile.ts`: internal balances vs on-chain source, producing a typed
  report of matches and mismatches with deltas.
- `src/testing/arbitraries.ts`: fast-check arbitraries for assets, amounts
  (biased toward boundaries: zero, dust, values past 2^53), balanced
  transactions, transaction logs, and chain views derived from logs, all
  written with shrink quality in mind.

Example-based tests only in this milestone (a handful, illustrative).
Properties land in M2 so their diff is readable on its own.

Exit criteria: library builds, examples pass, no feature present that M2's
properties do not consume.

## M2: property suite

Goal: five property families, each documented in-test with the failure it
guards against.

1. Double entry: any generated transaction balances per asset; any
   generated unbalanced posting set is rejected.
2. Reconciliation: for any log, reconciling against the chain view derived
   from that same log reports zero mismatches; injected perturbations are
   reported exactly, with the correct (account, asset) pairs and deltas.
3. Idempotent replay: replaying the whole log or any slice of it yields
   identical balances; dedup keys on transaction id only.
4. Precision: `parse(format(x)) === x` across 8-decimal and 18-decimal
   assets; sums of many dust amounts stay exact; conversion never rounds.
5. Ordering: balances and reconciliation reports are invariant under
   permutation of arrival order; pagination walks at every page size
   reconstruct the same log.

Also: fixed CI seed, `numRuns` set within the 5-minute budget, and failure
output verified to include seed, path and shrunk counterexample.

Exit criteria: all properties green on `main`; each property demonstrably
fails, with clean shrinking, when its guarded code is deliberately broken
locally.

## M3: planted-defect branches

Goal: three long-lived `defect/*` branches, each one commit on top of
`main`, each caught by the intended property with a shrunk counterexample
in CI.

| Branch                       | Planted bug                                                                                                     | Caught by                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `defect/rounding-conversion` | `units.ts` converts via `Number` (float) before `BigInt`, losing precision above 2^53                           | Property 4, shrunk to the smallest amount that loses a unit |
| `defect/cursor-off-by-one`   | `log.ts` pagination advances the cursor past the boundary element, skipping one transaction per page            | Property 5, shrunk to a one-transaction discrepancy         |
| `defect/replay-dedup`        | replay dedup keys on posting content instead of transaction id, so two legitimate identical transactions dedupe | Property 3, shrunk to two minimal twin transactions         |

Process per branch: plant the bug, verify from a clean checkout that the
suite fails on the intended property (and nothing else) with a shrunk
counterexample, push the branch, capture the failing CI run URL and the
counterexample for the README.

Exit criteria: three red CI runs, each with a small counterexample; `main`
still green.

## M4: README and polish

Goal: the repo reads clearly in one pass.

Deliverables:

- README: why property-based testing fits reconciliation, the five
  properties in plain English, the shrunk-counterexample output from each
  defect branch quoted inline and linked to the failing runs, how to run
  locally, ADR links, and an honest statement of scope.
- CI badge, repo description and topics.
- Final verification pass: `main` green, all three defect branches red on
  the intended property.

Exit criteria: a reader landing cold on the README sees a counterexample
within one screen and can reproduce it in two commands.

## Out of scope

Conversion rates and FX, fees, authorization and signing, persistence, any
real concurrency, any service layer, benchmarking. A feature that no
property consumes gets cut.
