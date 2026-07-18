# Milestone plan

One PR per milestone. Each milestone ends with: code-review subagent pass on
the diff → PR → verification subagent run from a clean checkout. CI must stay
under 5 minutes throughout.

## M0 — Scaffold

Goal: a repo where `npm ci && npm run lint && npm run typecheck && npm test`
passes in CI, with the decision record in place before any ledger code exists.

Deliverables:

- `package.json` (strict ESM, Node LTS engines), `tsconfig.json`
  (`strict: true`, `noUncheckedIndexedAccess: true`), vitest + fast-check,
  eslint + prettier configs.
- GitHub Actions workflow: lint → typecheck → test, on push + PR, on all
  branches (so `defect/*` runs are visible later).
- One trivial smoke property (e.g. bigint addition is commutative) proving
  fast-check output — including seed and counterexample formatting — appears
  in CI logs the way we want.
- ADRs: `0001-property-based-testing.md`, `0002-integer-minor-units.md`.
- LICENSE (MIT), .gitignore, .editorconfig.

Exit criteria: green CI in well under 5 minutes; ADRs reviewed; smoke property
demonstrably shrinks when forced to fail locally.

## M1 — Ledger core

Goal: the smallest library surface the properties need — nothing more.

Deliverables (all pure, all `bigint` minor units):

- `types.ts`: `Asset` (id + decimals), `AccountId`, `Posting`
  (account, asset, amount), `Transaction` (id, postings), branded types where
  they prevent unit mix-ups.
- `ledger.ts`: transaction validation (postings sum to zero per asset,
  rejects empty/duplicate ids), balance derivation from a transaction log
  (fold, no mutation).
- `log.ts`: append-only transaction log with **cursor pagination** (the
  pagination exists because M3 plants an off-by-one in it).
- `units.ts`: conversion between display units and minor units (parse/format;
  exists because M3 plants a rounding defect in it).
- `chain.ts`: mock on-chain balance source — deterministic fixture-backed
  balances per (account, asset).
- `reconcile.ts`: internal balances vs on-chain source → typed reconciliation
  report (matched / mismatched with delta).
- `src/testing/arbitraries.ts`: fast-check arbitraries for assets, amounts
  (biased toward boundaries: 0, 1, max supply, dust), balanced transactions,
  transaction logs, and "chain views" derived from logs — built to shrink well.

Example-based tests only in this milestone (a handful, illustrative);
properties land in M2 so their diff is readable on its own.

Exit criteria: library builds, examples pass, no feature present that M2's
properties don't consume.

## M2 — Property suite

Goal: the five property families, each documented in-test with the real-world
failure it guards against.

1. **Double-entry invariant** — for any generated valid transaction, postings
   sum to zero per asset; for any generated _unbalanced_ posting set, the
   ledger rejects it.
2. **Internal vs on-chain reconciliation** — for any log, reconciling against
   the chain view derived from that same log reports zero mismatches; for any
   injected perturbation of the chain view, reconciliation reports exactly the
   perturbed (account, asset) pairs with the correct delta.
3. **Idempotent replay** — replaying any transaction log (whole, or any
   prefix re-applied, or duplicated delivery of any suffix) yields identical
   balances: `apply(log) === apply(log ++ log-with-dedup)`.
4. **Rounding/precision** — round-trip `parse(format(x)) === x` for all minor
   unit amounts across assets with 8 (sats) and 18 (wei) decimals; sums of
   many dust amounts stay exact; conversion never silently truncates.
5. **Order independence** — balances and reconciliation reports are invariant
   under any permutation of transaction arrival order (commutative fold);
   pagination cursor walks of the log in different page sizes all reconstruct
   the same log.

Also: fixed CI seed + `numRuns` tuned to keep CI < 5 min; failure output
verified to include seed, path, and shrunk counterexample.

Exit criteria: all properties green on `main`; each property demonstrably
fails (with clean shrinking) when its guarded code is hand-broken locally.

## M3 — Planted-defect branches

Goal: three long-lived `defect/*` branches, each one commit on top of `main`,
each caught by exactly one property with a minimal shrunk counterexample in CI.

| Branch                       | Planted bug                                                                                                                                               | Caught by                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `defect/rounding-conversion` | `units.ts` converts display→minor units via `Number` (float) before `BigInt`, losing precision above 2^53 / on 18-decimal assets                          | Property 4 (round-trip), shrunk to the smallest amount that loses a wei                                                |
| `defect/cursor-off-by-one`   | `log.ts` pagination uses `>=` instead of `>` on the cursor (or drops the boundary element on exact page-size fills), duplicating/skipping one transaction | Property 5 (pagination reconstruction) and/or Property 2 (reconciliation delta), shrunk to a 1-transaction discrepancy |
| `defect/replay-dedup`        | replay dedup keys on `(account, amount)` instead of transaction id, so two legitimate identical-amount transactions dedupe                                | Property 3 (idempotent replay), shrunk to two minimal twin transactions                                                |

Process per branch: plant bug → verification subagent confirms, from clean
checkout, that the suite fails on the **intended** property with a shrunk
counterexample (and nothing else fails) → push branch → capture the failing
CI run URL + counterexample snippet for the README.

Exit criteria: three red CI runs, each with a crisp minimal counterexample;
`main` still green.

## M4 — README + polish

Goal: the repo reads as a portfolio piece in one scroll.

Deliverables:

- README: thesis (why property-based for reconciliation), the five
  properties in plain English, **the money shot** — shrunk-counterexample CI
  output from each defect branch, quoted inline and linked to the live
  failing runs — how to run locally, ADR links, honest scope statement
  (library, fictional custody context).
- CI badge, repo description/topics.
- Final pass: verification subagent re-runs everything (main green, all three
  defect branches red on the intended property).

Exit criteria: a reviewer landing cold on the README sees the counterexample
within one screen and can reproduce it in two commands.

## Out of scope (cut by the feature test)

Multi-asset conversion rates/FX, fees, authorization/signing, persistence,
concurrency primitives beyond order-independence properties, any service
layer, benchmarking.
