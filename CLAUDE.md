# CLAUDE.md

Public portfolio repository: a double-entry ledger library with a
property-based test suite (vitest and fast-check) that catches planted,
realistic defects and shrinks them to minimal counterexamples.

## Scope

- A TypeScript library plus fixtures: accounts, postings, balances, an
  append-only transaction log, and a mock on-chain balance source for a
  fictional custody context.
- Not a service. No HTTP, no database, no real chain access, no network I/O
  in the library or tests.
- If a feature does not serve a property test, cut it.

## Hard rules

1. Integer minor units only. All amounts are `bigint` in the asset's
   smallest unit (satoshis, wei). `number` must never hold an amount.
   Rationale in `docs/adr/0002-integer-minor-units.md`. Enforced by lint
   where practical.
2. Double entry always. Every transaction's postings sum to zero per asset.
   This is a library invariant and property 1 of the suite.
3. Determinism. Library code is pure: no `Date.now()`, `Math.random()`, or
   ambient state in core logic. Randomness lives only in fast-check
   generators; time, if ever needed, is an explicit input.
4. Every property failure must shrink to a small counterexample. Prefer
   structured arbitraries over raw random data.

## Conventions

- TypeScript, `"strict": true`, ESM (`"type": "module"`), Node LTS.
- vitest and fast-check. Properties are the primary suite; example tests
  are illustrative only.
- eslint and prettier, enforced in CI.
- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`,
  `ci:`). Small, reviewable commits.
- One PR per milestone (see `docs/PLAN.md`).
- ADRs in `docs/adr/NNNN-title.md`, one page each.
- CI on GitHub Actions, total wall time under 5 minutes, fixed fast-check
  seed for reproducibility, seed and counterexample printed on failure.

## Planted-defect branches

Long-lived branches named `defect/<slug>`, each carrying exactly one subtle
bug on top of `main`. CI on each branch is expected to fail on the intended
property with a shrunk counterexample, and the README on `main` links to
those failing runs. Never merge defect branches; rebase them when `main`
moves.

## Workflow

- Before each milestone PR: review the full diff for correctness, invariant
  coverage and convention adherence, and address findings first.
- After each milestone lands and after defect branches are rebased: from a
  clean checkout, install, lint, build and run the full suite on `main`
  (must pass), then on each `defect/*` branch confirm the suite fails on
  the intended property with a shrunk counterexample. A defect branch that
  passes, or fails on the wrong property, is a bug in the defect branch.

## Commands

```
npm ci            # install
npm run lint      # eslint + prettier check
npm run typecheck # tsc --noEmit
npm test          # vitest run (properties + examples)
npm run build     # tsc emit (library build)
```

## Layout

```
src/            ledger library (types, ledger, log, units, chain, reconcile)
src/testing/    fast-check arbitraries and fixtures
test/           property and example suites
docs/adr/       architecture decision records
docs/PLAN.md    milestone plan
.github/        CI workflows
```
