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

Requires [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`) and
Node.js 18 or newer.

**Install from source.** This is the only supported installation method. The package is not
published to npm, so `sf plugins install npsp-migration-readiness-scanner` does not work and
fails with a registry 404. npm installation stays unavailable until the package is
intentionally published, and this section changes when that happens.

```bash
git clone https://github.com/clear-concise-carmona/npsp-migration-readiness-scanner.git
cd npsp-migration-readiness-scanner
npm install
npm run build
sf plugins link .
```

Confirm the link took:

```bash
sf plugins             # npsp-migration-readiness-scanner appears, marked as linked
sf npsp scan --help
```

To remove it later, run `sf plugins unlink .` from the repo directory.

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

## How to validate results

The score is a starting point for a conversation, not a verdict. Before you put a number in
front of a board or a client, confirm it against the org yourself.

1. **Run it in a sandbox first.** Use a sandbox that was refreshed from production recently
   enough that its metadata and record volumes still resemble the real org. Record counts in
   a Developer sandbox are not representative and will skew the volume-based checks.
2. **Re-read the blocker list against Setup.** Every blocker names something specific: an
   object, a trigger, a field, a record count. Open Setup and confirm each one exists and
   that the count is in the right range. A blocker naming something you cannot find is a bug;
   open an issue.
3. **Check the unused-field findings by hand before acting on them.** The check measures
   field population, not field usage. A field at 0% population can still be referenced by a
   Flow, a report type, a validation rule, or Apex. Population rate tells you the field holds
   no data. It does not tell you the field is safe to delete.
4. **Compare the weighted score against the raw subscores.** The score breakdown table shows
   each check's subscore and weight. If one check dominates the result, say so out loud when
   you present the number rather than quoting the composite alone.
5. **Run it twice, a week apart, on an org under active development.** Two runs that disagree
   without an explanation mean something moved that you should understand before planning
   around either result.
6. **Read [src/lib/scoring.ts](src/lib/scoring.ts) before defending a weight.** The weights
   are documented reasoning, not a validated model. If you disagree with one, change it and
   say that you did.

## Limitations

This tool supports technical assessment and review. It does not replace architecture review,
security review, legal advice, compliance determination, or organization-specific
implementation decisions. Review the source, the weights, and the output before relying on a
result.

Specific limits worth knowing before you quote a number:

- **The weights are a documented judgment, not a validated formula.** No statistical model
  backs the 20/20/15/15/10/10/10 split. It reflects how these risks have shown up in scoping
  work, written down so you can argue with it.
- **Seven checks are not the full surface of an NPSP migration.** Reports, dashboards, list
  views, Flows, integrations, managed packages beyond NPSP, and Experience Cloud sites are
  all out of scope for this release. A high score means these seven checks came back clean,
  not that the migration is simple.
- **Field population is measured, not field usage.** See point 3 above.
- **The Apex test class has never run against a live org.** CI compiles and tests the
  TypeScript. It does not deploy Apex, because this repo has no Dev Hub attached. Deploy the
  optional batch class to a sandbox and run its tests before you run it anywhere else.
- **This release has no JSON or CSV output.** Markdown only.
- **Score thresholds are a framing device.** The 80/55/30 bands are there to make the number
  actionable in a conversation. They are not calibrated against migration outcome data,
  because no such public dataset exists.
- **It is not a compliance, security, or certification tool** and makes no claim about any
  standard or program.

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

## Maintenance Status

This is an independently maintained open-source project by Clear Concise Consulting. Issues
and pull requests are welcome. Maintenance is prioritized around correctness, documentation,
security concerns, and compatibility with supported Salesforce tooling. No response-time or
feature-delivery commitment is implied.

Current release: **v0.1.0**, the first tagged release. It builds and its TypeScript tests pass
in CI. It has not been run against a wide range of production NPSP orgs, and it is not
published to a package registry. Treat the output as evidence for a person to review.

Security reports: see [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports with a redacted example of the check that
misfired are especially useful - every check here is written against documented NPSP/Nonprofit
Cloud behavior, but real orgs are messier than documentation.

## About

Built by [Jeremy Carmona](https://www.clearconciseconsulting.com/about), a 13x certified Salesforce
Architect and founder of [Clear Concise Consulting](https://www.clearconciseconsulting.com), a
Salesforce consultancy for nonprofit, healthcare, and enterprise organizations. This scanner comes
out of CCC's [Salesforce nonprofit consulting](https://www.clearconciseconsulting.com/services/salesforce-nonprofit-consulting)
practice - NPSP and Nonprofit Cloud implementation, migration, and data quality work for nonprofits.

**See your org's migration-readiness score before you commit to a migration timeline.** Run the
scanner, and if you want a second read on the results - [get a free 30-minute migration-readiness
review](https://www.clearconciseconsulting.com/contact).

## License

[MIT](LICENSE).
