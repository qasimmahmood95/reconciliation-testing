import * as fc from 'fast-check';

// CI pins FC_SEED so failures are reproducible; locally the seed is random.
// fast-check prints the seed and the shrunk counterexample on every failure,
// so a red run can always be replayed with `FC_SEED=<seed> npm test`.
//
// Garbage values fail loudly: a NaN seed would be silently normalized by
// fast-check (irreproducible "reproducible" runs) and numRuns=0 would make
// every property pass vacuously.
function parseIntEnv(name: string, min: number): number | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min) {
    throw new Error(
      `${name} must be an integer >= ${String(min)}, got: "${raw}"`,
    );
  }
  return value;
}

const seed = parseIntEnv('FC_SEED', 0);
const numRuns = parseIntEnv('FC_NUM_RUNS', 1);

fc.configureGlobal({
  ...(seed !== undefined ? { seed } : {}),
  ...(numRuns !== undefined ? { numRuns } : {}),
});
