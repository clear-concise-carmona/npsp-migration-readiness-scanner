# Security Policy

## Reporting a problem

Open an issue at
[github.com/clear-concise-carmona/npsp-migration-readiness-scanner/issues](https://github.com/clear-concise-carmona/npsp-migration-readiness-scanner/issues).

Do not include org IDs, usernames, session IDs, auth URLs, connected app secrets, real record
data, or a full unredacted report in a public issue. If the problem cannot be described
without that detail, open an issue saying only that you have a security report, and follow up
through the [contact page](https://www.clearconciseconsulting.com/contact).

There is no bug bounty and no committed response time. See the Maintenance Status section of
the [README](README.md#maintenance-status).

## Supported versions

Fixes go to the most recent tagged release.

| Version | Supported |
|---|---|
| 0.1.0 | Yes |

## What this tool does to your org

**The `sf npsp scan` command is read-only against the target org.** Every call it makes is a
`describe` call, an aggregate SOQL query, or a Tooling API query. See
[src/lib/queries.ts](src/lib/queries.ts). It does not insert, update, or delete Salesforce
records.

It writes one file on your own machine: the Markdown report, at
`npsp-migration-readiness-report.md` by default, or wherever `--output-file` points.

**The optional Apex component does write records.** `apex/MigrationReadinessBatch.cls` inserts
`Migration_Readiness_Finding__c` records, a custom object shipped in this repo's own metadata.
It does not write to NPSP objects or to standard objects. Deploying it is a separate, explicit
step. Skipping it costs you two record-level checks and nothing else.

## Handling the report

A generated report can name custom fields, triggers, and record counts from your org. Treat it
as internal material. Do not commit one to a public repository, and redact it before attaching
it to a public issue. The default output filename is already listed in `.gitignore`.

## Credentials

This plugin uses the authentication the Salesforce CLI already holds for the target org. It
does not read, store, log, or transmit credentials of its own.

Never commit auth files, `.env` files, connected app secrets, org IDs, or a `sfdx-project.json`
edited to point at an org-specific login URL.

## Sandbox first

Run the scan against a sandbox before production. The queries are read-only either way, and a
sandbox run tells you whether a check misfires against your org's schema before you spend
production API calls finding out.

Deploy the optional Apex batch class to a sandbox and run its tests there before deploying it
anywhere else. Its test class has not been executed against a live org by this project.

## What this tool does not do

It does not certify, validate, or determine compliance with any standard, framework, or
program. It produces evidence for a person to review.
