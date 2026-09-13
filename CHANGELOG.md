# Changelog

## 1.0.0 - 2026-09-13

Initial public release.

- `sf npsp scan` command - runs seven weighted readiness checks and writes a Markdown report.
- Checks: legacy Household model, unmanaged Apex triggers, unused custom fields, active
  Customizable Rollups, Recurring Donation volume, GAU Allocation volume, Affiliation/Relationship
  dependence.
- `apex/MigrationReadinessBatch.cls` - optional record-level companion batch class for
  Household/Affiliation mismatch detection, with matching test class and
  `Migration_Readiness_Finding__c` custom object metadata.
- Sample report at `samples/sample-report.md`.
