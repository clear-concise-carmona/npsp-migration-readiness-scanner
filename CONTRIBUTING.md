# Contributing

## Adding or changing a check

Checks live in [src/lib/scoring.ts](src/lib/scoring.ts). Each one is a small async function that:

1. Queries the org via [src/lib/queries.ts](src/lib/queries.ts) (add a new query function there if
   you need new data - keep query logic out of scoring.ts).
2. Returns a `CheckResult`: a 0-100 subscore, its weight, and a list of `Blocker`s.

If you're adding a genuinely new check (not tuning an existing one):

- Add its weight to the `WEIGHTS` object and make sure all weights still sum to 100.
- Explain in a comment why the weight is what it is. "Because it felt right" is an acceptable
  starting point but say so explicitly rather than implying it's been validated against real
  migrations.
- Add a corresponding row to the README's "What migration-ready means" table.
- Add a test under `test/` exercising both the "found something" and "found nothing" path.

If you're changing an existing weight or scoring curve, explain in the PR description what
real-world case motivated the change - ideally with a redacted example.

## Adding a record-level Apex check

Record-level checks (things that need to inspect individual records, not aggregate counts) go in
[apex/MigrationReadinessBatch.cls](apex/MigrationReadinessBatch.cls), writing findings to
`Migration_Readiness_Finding__c`. Every new finding type needs:

- A matching test method in `MigrationReadinessBatchTest.cls` covering both the positive and
  negative case (see the existing two tests for the pattern).
- A mention in `src/lib/scoring.ts`'s doc comment for whichever check is meant to pick it up.

## Code style

TypeScript, strict mode, no `any` beyond what `jsforce`/`@salesforce/core` types force on you.
Match the existing file structure: `queries.ts` never scores anything, `scoring.ts` never runs raw
SOQL, `report.ts` never queries the org.

## Reporting a false positive / false negative

Open an issue with:

- The check name (from the `checkId` column in a generated report).
- What you expected vs. what you got.
- If possible, a redacted description of the org state that triggered it (field names and object
  names are fine to share; record data is not).

## Tests

```bash
npm install
npm run build
npm test
```

Apex tests run separately, in a scratch org or sandbox:

```bash
sf project deploy start --source-dir apex --target-org my-test-org
sf apex run test --target-org my-test-org --class-names MigrationReadinessBatchTest --result-format human
```
