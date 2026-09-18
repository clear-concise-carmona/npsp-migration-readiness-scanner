<!-- Fictional sample. See the note at the end of this file. -->

> **This example uses fictional or placeholder data. It does not represent a real Salesforce
> org, client, or assessment result.** It was written by hand to show every section of the
> report format, including a blocker of each severity. It is not the output of a scan against
> any org.

# NPSP Migration Readiness Report

**Org:** demo-org@clearconciseconsulting.com.scanner-sample
**Scanned:** 2026-09-01T14:32:07.000Z

## Score: 38/100

High migration risk - this org has meaningful custom-code and data-model dependencies to work through first.

**11 blocker(s) found**, sorted by severity below.

## Score breakdown by check

| Check | Weight | Subscore | Blockers found |
|---|---|---|---|
| legacyHouseholdModel | 20 | 0 | 1 |
| unmanagedTriggers | 20 | 25 | 4 |
| unusedCustomFields | 10 | 78 | 2 |
| customizableRollups | 15 | 60 | 1 |
| recurringDonationVolume | 15 | 46 | 1 |
| allocationVolume | 10 | 65 | 1 |
| affiliationRelationshipDependence | 10 | 40 | 1 |

## Blockers

### 1. Legacy pre-2016 Household object still in use

**Severity:** Critical

12 record(s) found in npsp__Household__c. This org has not yet moved to the modern Household Account model.

**Recommendation:** Migrate to NPSP's Household Account model first, and confirm it's stable, before starting any Nonprofit Cloud migration work. Attempting both moves at once compounds risk for no benefit.

### 2. Unmanaged trigger on Opportunity: OpportunityRollupOverride

**Severity:** High

342 lines, status Active. This is custom code, not part of the NPSP managed package, so it will not be replaced by anything in Nonprofit Cloud automatically.

**Recommendation:** Read this trigger before migrating. Anything it does against NPSP objects (Opportunity, Payment, Recurring Donation, Allocation) needs a decision: rebuild against the new Fundraising objects, replace with declarative automation, or retire if the business logic no longer applies.

### 3. Unmanaged trigger on npe03__Recurring_Donation__c: RD_LegacyStatusSync

**Severity:** High

211 lines, status Active. This is custom code, not part of the NPSP managed package, so it will not be replaced by anything in Nonprofit Cloud automatically.

**Recommendation:** Read this trigger before migrating. Anything it does against NPSP objects (Opportunity, Payment, Recurring Donation, Allocation) needs a decision: rebuild against the new Fundraising objects, replace with declarative automation, or retire if the business logic no longer applies.

### 4. 24 active Customizable Rollup(s) (CRLP)

**Severity:** High

Customizable Rollups are NPSP-specific reporting logic (npsp__Rollup__mdt custom metadata) with no direct 1:1 successor confirmed in Nonprofit Cloud's Fundraising object model as of this scan.

**Recommendation:** Inventory which rollups actually drive reports or dashboards still in active use, and plan to rebuild those specifically (via declarative rollup tools or Data Cloud/Reports) rather than assuming all of them carry forward automatically.

### 5. 1,204 active Recurring Donation(s)

**Severity:** High

Each active RD2 record and its installment history needs a documented migration path to GiftCommitment + GiftCommitmentSchedule + GiftTransaction (see npsp-to-nonprofit-cloud-field-map/field-map/recurring-donations.yaml).

**Recommendation:** Follow Salesforce's official RD2-and-installment-Opportunity import guide rather than a generic data-loader migration - this object graph does not migrate with a simple field copy.

### 6. 340 Affiliation(s) and 58 Relationship(s) in active use

**Severity:** High

This is the least mature area of the current field map - no confirmed Salesforce-documented object-level replacement exists yet for npe5__Affiliation__c or npsp__Relationship__c. Heavy usage here is the least predictable migration risk in this scan.

**Recommendation:** Flag this explicitly in your migration plan as a research/prototype item, not a known-quantity task. Budget discovery time specifically for this before committing to a migration timeline.

### 7. Unmanaged trigger on Contact: ContactHouseholdNamingOverride

**Severity:** Medium

88 lines, status Active. This is custom code, not part of the NPSP managed package, so it will not be replaced by anything in Nonprofit Cloud automatically.

**Recommendation:** Read this trigger before migrating. Anything it does against NPSP objects (Opportunity, Payment, Recurring Donation, Allocation) needs a decision: rebuild against the new Fundraising objects, replace with declarative automation, or retire if the business logic no longer applies.

### 8. Unmanaged trigger on npsp__Allocation__c: AllocationGauValidation

**Severity:** Medium

64 lines, status Active. This is custom code, not part of the NPSP managed package, so it will not be replaced by anything in Nonprofit Cloud automatically.

**Recommendation:** Read this trigger before migrating. Anything it does against NPSP objects (Opportunity, Payment, Recurring Donation, Allocation) needs a decision: rebuild against the new Fundraising objects, replace with declarative automation, or retire if the business logic no longer applies.

### 9. 2,910 GAU Allocation record(s)

**Severity:** Medium

Each Allocation record needs a home in GiftDesignation/GiftTransactionDesignation. Field-level names on those objects are not yet fully confirmed publicly - see npsp-to-nonprofit-cloud-field-map/field-map/allocations-gau.yaml.

**Recommendation:** Export current GAU/Allocation structure before migrating so you have a known-good source to validate against once designations exist in the target org.

### 10. Unused custom field: Opportunity.Legacy_Grant_Tracking_Id__c

**Severity:** Low

0% population across 6,140 record(s). This field adds migration scope (does it need a Nonprofit Cloud home?) without adding any actual data or reporting value.

**Recommendation:** Confirm nobody depends on this field (check for it in reports, flows, and Apex first), then either retire it before migrating or explicitly mark it out of scope in the migration plan so nobody wastes time mapping it.

### 11. Unused custom field: Contact.Old_Newsletter_Opt_In__c

**Severity:** Low

0% population across 3,882 record(s). This field adds migration scope (does it need a Nonprofit Cloud home?) without adding any actual data or reporting value.

**Recommendation:** Confirm nobody depends on this field (check for it in reports, flows, and Apex first), then either retire it before migrating or explicitly mark it out of scope in the migration plan so nobody wastes time mapping it.

---

_Generated by [npsp-migration-readiness-scanner](https://github.com/clear-concise-carmona/npsp-migration-readiness-scanner). Field-level migration detail for any blocker above: [npsp-to-nonprofit-cloud-field-map](https://github.com/clear-concise-carmona/npsp-to-nonprofit-cloud-field-map)._

---

**Note:** This is a fabricated sample org used to illustrate report format and is not a real client's data. Run `sf npsp scan --target-org <your-org>` to generate a real report.
