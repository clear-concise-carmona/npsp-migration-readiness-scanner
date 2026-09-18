# Changelog

## 0.1.0 - 2026-09-18

First tagged public release.

This release was renumbered from 1.0.0 to 0.1.0 before any tag or GitHub Release existed.
The `1.0.0` in the initial commit message and in `package.json` was never published, never
tagged, and never installable. 0.1.0 is a more accurate description of a tool that has not
been published to a registry and has not been run against a broad range of production NPSP
orgs.

- `sf npsp scan` command - runs seven weighted readiness checks and writes a Markdown report.
- Checks: legacy Household model, unmanaged Apex triggers, unused custom fields, active
  Customizable Rollups, Recurring Donation volume, GAU Allocation volume, Affiliation/Relationship
  dependence.
- `apex/MigrationReadinessBatch.cls` - optional record-level companion batch class for
  Household/Affiliation mismatch detection, with matching test class and
  `Migration_Readiness_Finding__c` custom object metadata.
- Sample report at `samples/sample-report.md`.
- Installed from source only. This package is not published to npm, and
  `sf plugins install npsp-migration-readiness-scanner` does not work.
- `SECURITY.md` covering reporting, org write scope, and report handling.
