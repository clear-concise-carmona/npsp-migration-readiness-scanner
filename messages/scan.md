# summary

Scan an NPSP org and score its Nonprofit Cloud migration readiness.

# description

Runs a set of read-only checks against the target org - legacy Household object usage, unmanaged Apex triggers on NPSP objects, unused custom fields, active Customizable Rollups, Recurring Donation volume, Allocation volume, and Affiliation/Relationship dependence - and combines them into a weighted 0-100 readiness score plus a severity-ranked blocker list.

Nothing in this command writes, updates, or deletes any data in the target org. It only runs describe calls and read-only SOQL/Tooling API queries.

# flags.target-org.summary

Username or alias of the org to scan.

# flags.output-file.summary

Path to write the Markdown report to.

# flags.json.summary

Format output as json.

# examples

- <%= config.bin %> <%= command.id %> --target-org my-npsp-sandbox

- <%= config.bin %> <%= command.id %> --target-org my-npsp-sandbox --output-file reports/2026-09-scan.md
