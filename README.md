# npsp-migration-readiness-scanner

A **Salesforce nonprofit migration scanner**: an `sf` CLI plugin that runs your **NPSP migration
readiness** check, scores your **NPSP to Nonprofit Cloud assessment** from 0-100, and writes a
blocker-by-blocker Markdown report - so "how bad will our migration be" has an actual number
attached instead of a guess from a discovery call.

NPSP has been frozen since March 2023 with no announced retirement date, and new nonprofit orgs
are now provisioned into Nonprofit Cloud by default ([Salesforce Ben](https://www.salesforceben.com/the-state-of-salesforce-nonprofit-offerings-in-2026/)). Every NPSP org will eventually face this decision, and every one of them carries its own
**nonprofit cloud migration risk** profile - a small nonprofit with a clean data model faces a very
different migration than one with fifteen years of custom Apex bolted onto Opportunity triggers.
This tool doesn't make the decision for you - it tells you what your specific org's migration
actually touches, quantitatively, before you commit to a timeline or a budget.

**Not a Salesforce product, not officially affiliated with or endorsed by Salesforce.** Independent
tool built by [Clear Concise Consulting](https://www.clearconciseconsulting.com) out of repeated
NPSP migration scoping work.

## What "migration-ready" means

The scanner runs seven read-only checks against your org and combines them into one weighted score.
None of them write, update, or delete data - they're describe calls, aggregate SOQL, and Tooling
API queries.

| Check | Weight | What it looks for |
|---|---|---|
| Legacy Household model | 20 | Records still in the pre-2016 `npsp__Household__c` object - a prerequisite migration in its own right |
| Unmanaged Apex triggers | 20 | Custom (non-NPSP-managed) triggers on Opportunity, Contact, Account, Recurring Donation, Allocation, Payment - code nobody else will port for you |
| Customizable Rollups (CRLP) | 15 | Active `npsp__Rollup__mdt` records - NPSP-specific reporting logic with no confirmed 1:1 successor yet |
| Recurring Donation volume | 15 | Active RD2 records - each one needs a documented path to GiftCommitment/GiftCommitmentSchedule |
| Unused custom fields | 10 | Custom fields at 0% population - scope inflation with no data-migration value |
| GAU Allocation volume | 10 | Allocation record count - proxy for GiftDesignation remapping effort |
| Affiliation/Relationship dependence | 10 | Usage of `npe5__Affiliation__c` / `npsp__Relationship__c` - the field map's least mature area, so heavy usage here is the least predictable risk |

A **high score** means low migration risk: the org is close to a clean cutover. A **low score**
means real design work ahead - see the [sample report](samples/sample-report.md) for what a 38/100
with 11 blockers actually looks like in practice.

**The weights are a documented starting point, not a certified formula.** See
[src/lib/scoring.ts](src/lib/scoring.ts) - the comments explain the reasoning behind each weight.
If you think a weight is wrong for how these risks actually play out in real migrations, open an
issue; we'd rather argue about it in the open than ship a black box.

For the field-level detail behind any of these checks, see the companion
[NPSP field mapping reference](https://github.com/clear-concise-carmona/npsp-to-nonprofit-cloud-field-map).

## Installation

Requires [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`) already
installed.

```bash
sf plugins install npsp-migration-readiness-scanner
```

Or, to build from source:

```bash
git clone https://github.com/clear-concise-carmona/npsp-migration-readiness-scanner.git
cd npsp-migration-readiness-scanner
npm install
npm run build
sf plugins link .
```

## Running your first scan

```bash
sf org login web --alias my-npsp-org   # if you haven't already authenticated
sf npsp scan --target-org my-npsp-org
```

This writes `npsp-migration-readiness-report.md` in your current directory. Point it elsewhere with
`--output-file`:

```bash
sf npsp scan --target-org my-npsp-org --output-file reports/2026-09-scan.md
```

### Record-level checks (optional, requires Apex deploy)

The CLI plugin's checks all run from outside the org. Two additional record-level checks - Household/
Affiliation mismatch detection and RD2 record-level anomalies - require deploying a small batch Apex
class first, since they need to inspect individual records at scale rather than aggregate counts:

```bash
sf project deploy start --source-dir apex --target-org my-npsp-org
sf apex run --target-org my-npsp-org --file apex/run-batch.apex   # or trigger it from Setup > Apex Classes
```

See [apex/MigrationReadinessBatch.cls](apex/MigrationReadinessBatch.cls) for exactly what it checks
and writes. It only ever inserts into `Migration_Readiness_Finding__c`, a scratch object that ships
with this repo's metadata - it never touches NPSP or standard object data.

## Reading your score and blocker list

- **Score 80-100:** Low risk. Mostly documentation and validation work.
- **Score 55-79:** Moderate risk. Budget real discovery time before committing to a date.
- **Score 30-54:** High risk. Meaningful custom-code and data-model dependencies exist.
- **Score below 30:** Very high risk. Plan this as a multi-phase project.

Every blocker in the report has a severity (`critical` / `high` / `medium` / `low`), a plain-English
explanation of what was found, and a specific recommendation - not just "this might be a problem."
Treat the sorted blocker list as your NPSP migration checklist: work down it by severity rather than
by whatever surfaces first in a discovery call.

## Sample report

See [samples/sample-report.md](samples/sample-report.md) for a full example: a fabricated demo org
scoring 38/100 with 11 blockers, showing every section of the report format.

## Roadmap

- [ ] JSON and CSV output formats (currently Markdown only)
- [ ] `--compare` flag to diff two scans over time and show whether remediation work is moving the
      score
- [ ] Optional GitHub Action to run the scan on a schedule against a sandbox and open an issue on
      score regression
- [ ] Expand record-level Apex checks beyond the current Household/Affiliation mismatch check

Contributions toward any of these are welcome - see [CONTRIBUTING.md](CONTRIBUTING.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports with a redacted example of the check that
misfired are especially useful - every check here is written against documented NPSP/Nonprofit
Cloud behavior, but real orgs are messier than documentation.

## About

Built by [Jeremy Carmona](https://www.clearconciseconsulting.com/about), a 13x certified Salesforce
Architect and founder of [Clear Concise Consulting](https://www.clearconciseconsulting.com), a
Salesforce consultancy for nonprofit, healthcare, and enterprise organizations.

**See your org's migration-readiness score before you commit to a migration timeline.** Run the
scanner, and if you want a second read on the results - [get a free 30-minute migration-readiness
review](https://www.clearconciseconsulting.com/contact).

## License

[MIT](LICENSE).
