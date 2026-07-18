# CLAUDE.md — reconciliation-testing

Public portfolio repository for a Senior SDET in digital-asset custody.

**Thesis:** ledger reconciliation is a correctness problem best attacked with
property-based testing. This repo is the public showcase: a small double-entry
ledger library with a property suite that catches subtle, realistic defects and
shrinks them to minimal counterexamples.

## What this is — and is not

- A **TypeScript library + fixtures**: accounts, postings, balances, an
  append-only transaction log, and a mock "on-chain" balance source for a
  fictional custody context.
- **NOT a service.** No HTTP, no database, no real chain access, no network
  I/O of any kind in the library or tests.
- **Feature test:** if a feature does not serve a property test, cut it.
  When in doubt, leave it out.

## Hard rules

1. **Integer minor units only.** All amounts are `bigint` in the asset's
   smallest unit (satoshis, wei). Floating point is banned for money —
   `number` must never hold an amount. Rationale in
   `docs/adr/0002-integer-minor-units.md`. Lint enforcement where practical.
2. **Double-entry always.** Every transaction's postings sum to zero per
   asset. This is both a library invariant and property #1 of the test suite.
3. **Determinism.** Library code is pure/deterministic: no `Date.now()`,
   `Math.random()`, or ambient state in core logic. Randomness lives only in
   fast-check generators; time, if needed, is an explicit input.
4. **Every property failure must shrink.** Arbitraries are built so
   fast-check can shrink to a minimal counterexample — that CI output is the
   centrepiece of the repo. Prefer model-based/structured arbitraries over
   raw byte soup.

## Conventions

- **Language/runtime:** TypeScript, `"strict": true`, ESM (`"type": "module"`),
  Node LTS.
- **Testing:** vitest + fast-check. Property tests live beside example tests;
  properties are the primary suite, examples are illustrative only.
- **Style:** eslint + prettier, enforced in CI.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`,
  `chore:`, `ci:`). Small, reviewable commits.
- **PRs:** one PR per milestone (see `docs/PLAN.md`). No drive-by scope.
- **ADRs:** `docs/adr/NNNN-title.md`, short (one page). Required ADRs:
  - `0001-property-based-testing.md` — why property-based over example-based
    for reconciliation.
  - `0002-integer-minor-units.md` — why integer minor units; why floats are
    banned.
- **CI:** GitHub Actions, total wall time under 5 minutes. Tune fast-check
  `numRuns` to fit the budget; use a fixed seed in CI for reproducibility and
  print the seed + counterexample on failure.

## Planted-defect branches

Long-lived branches named `defect/<slug>`, each carrying exactly one subtle,
realistic bug on top of `main`. Each branch's CI run is **expected to fail**
with a property violation and a shrunk minimal counterexample. `main`'s README
links to those failing runs — the counterexample in CI output is the money
shot. Never merge defect branches; rebase them if `main` moves.

## Agent workflow (subagents)

- **Code-review subagent** — before opening each milestone PR, run a code
  review of the full diff (correctness, invariant coverage, convention
  adherence). Address findings before the PR goes up.
- **Verification subagent** — after each milestone lands and after defect
  branches are (re)based: from a **clean checkout**, install, lint, build,
  and run the full suite on `main` (must pass), then on each `defect/*`
  branch confirm the suite **fails on the intended property** and that
  fast-check reports a shrunk counterexample. A defect branch that passes,
  or fails on the wrong property, is a bug in the defect branch.

## Commands (once M0 lands)

```
npm ci            # install
npm run lint      # eslint + prettier check
npm run typecheck # tsc --noEmit
npm test          # vitest run (properties + examples)
npm run build     # tsc emit (library build)
```

## Layout (target)

```
src/            ledger library (types, ledger, log, reconcile, mock chain source)
src/testing/    fast-check arbitraries + fixtures (published for reuse in tests)
test/           property + example suites
docs/adr/       architecture decision records
docs/PLAN.md    milestone plan
.github/        CI workflows
```
