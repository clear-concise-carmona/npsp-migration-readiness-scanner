/**
 * scoring.ts
 *
 * The weighted 0-100 migration-readiness scoring algorithm. A HIGH score means
 * LOW migration risk (the org is close to Nonprofit Cloud's data model
 * already, or has little to lose in translation). A LOW score means the org
 * has a lot of "redesign required" territory to work through - see
 * npsp-to-nonprofit-cloud-field-map for what "redesign required" means at the
 * field level.
 *
 * Design intent: every check here maps to a specific, named blocker a
 * consultant would otherwise have to find by hand during a discovery call.
 * The weights are a starting point, not a claim of statistical validity -
 * see README.md "Scoring methodology" for how to argue with them.
 */
import { Connection } from "@salesforce/core";
import * as q from "./queries";

export type Severity = "low" | "medium" | "high" | "critical";

export interface Blocker {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  recommendation: string;
}

export interface CheckResult {
  checkId: string;
  weight: number; // relative weight in the overall score, all weights sum to 100
  subscore: number; // 0-100, this check's own readiness score before weighting
  blockers: Blocker[];
}

export interface ScanResult {
  overallScore: number; // 0-100
  checks: CheckResult[];
  blockers: Blocker[];
  scannedAt: string;
}

/**
 * A check is "how much of this specific migration risk area does this org
 * actually have." Weights sum to 100 across all checks.
 */
const WEIGHTS = {
  legacyHouseholdModel: 20, // pre-2016 Household object still in use -> extra migration step before the real migration
  unmanagedTriggers: 20, // custom Apex on NPSP objects that has to be reviewed/ported by hand
  unusedCustomFields: 10, // dead weight that inflates scope without adding migration risk per se, but signals org hygiene
  customizableRollups: 15, // every active CRLP rollup is reporting logic that has no direct Nonprofit Cloud equivalent yet
  recurringDonationVolume: 15, // more active RD2 records = more installment history to carry through GiftCommitment/GiftCommitmentSchedule
  allocationVolume: 10, // more Allocation records = more GAU-to-GiftDesignation remapping work
  affiliationRelationshipDependence: 10, // this area of the field map is the least mature - heavy usage here is the least predictable migration risk
} as const;

async function checkLegacyHouseholdModel(conn: Connection): Promise<CheckResult> {
  const count = await q.legacyHouseholdRecordCount(conn);
  const blockers: Blocker[] = [];
  let subscore = 100;
  if (count > 0) {
    subscore = 0;
    blockers.push({
      id: "legacy-household-model",
      severity: "critical",
      title: "Legacy pre-2016 Household object still in use",
      detail: `${count} record(s) found in npsp__Household__c. This org has not yet moved to the modern Household Account model.`,
      recommendation:
        "Migrate to NPSP's Household Account model first, and confirm it's stable, before starting any Nonprofit Cloud migration work. Attempting both moves at once compounds risk for no benefit.",
    });
  }
  return { checkId: "legacyHouseholdModel", weight: WEIGHTS.legacyHouseholdModel, subscore, blockers };
}

async function checkUnmanagedTriggers(conn: Connection): Promise<CheckResult> {
  const objects = [
    "Opportunity",
    "Contact",
    "Account",
    "npe03__Recurring_Donation__c",
    "npsp__Allocation__c",
    "npe01__OppPayment__c",
  ];
  const blockers: Blocker[] = [];
  let totalUnmanaged = 0;
  let totalLines = 0;

  for (const obj of objects) {
    const triggers = await q.listTriggersForObject(conn, obj);
    const unmanaged = triggers.filter((t) => !t.isManaged);
    totalUnmanaged += unmanaged.length;
    for (const t of unmanaged) {
      totalLines += t.bodyLineCount;
      blockers.push({
        id: `unmanaged-trigger-${obj}-${t.name}`,
        severity: t.bodyLineCount > 200 ? "high" : "medium",
        title: `Unmanaged trigger on ${obj}: ${t.name}`,
        detail: `${t.bodyLineCount} lines, status ${t.status}. This is custom code, not part of the NPSP managed package, so it will not be replaced by anything in Nonprofit Cloud automatically.`,
        recommendation:
          "Read this trigger before migrating. Anything it does against NPSP objects (Opportunity, Payment, Recurring Donation, Allocation) needs a decision: rebuild against the new Fundraising objects, replace with declarative automation, or retire if the business logic no longer applies.",
      });
    }
  }

  // Subscore drops as unmanaged trigger count and total code volume rise.
  // 0 triggers = 100. 1-2 small triggers = high 70s-80s. 5+ or 500+ lines = near 0.
  const countPenalty = Math.min(totalUnmanaged * 15, 70);
  const volumePenalty = Math.min(Math.floor(totalLines / 50) * 5, 30);
  const subscore = Math.max(0, 100 - countPenalty - volumePenalty);

  return { checkId: "unmanagedTriggers", weight: WEIGHTS.unmanagedTriggers, subscore, blockers };
}

async function checkUnusedCustomFields(conn: Connection): Promise<CheckResult> {
  const objects = ["Opportunity", "Contact", "Account", "npe03__Recurring_Donation__c"];
  const blockers: Blocker[] = [];
  let checkedCount = 0;
  let unusedCount = 0;

  for (const obj of objects) {
    const total = await q.totalRecordCount(conn, obj);
    if (total === 0) continue;
    const customFields = await q.listCustomFields(conn, obj);
    for (const field of customFields) {
      checkedCount++;
      const usage = await q.fieldPopulationRate(conn, obj, field, total);
      if (usage.populationRate === 0) {
        unusedCount++;
        blockers.push({
          id: `unused-field-${obj}-${field}`,
          severity: "low",
          title: `Unused custom field: ${obj}.${field}`,
          detail: `0% population across ${total} record(s). This field adds migration scope (does it need a Nonprofit Cloud home?) without adding any actual data or reporting value.`,
          recommendation:
            "Confirm nobody depends on this field (check for it in reports, flows, and Apex first), then either retire it before migrating or explicitly mark it out of scope in the migration plan so nobody wastes time mapping it.",
        });
      }
    }
  }

  const unusedRate = checkedCount === 0 ? 0 : unusedCount / checkedCount;
  const subscore = Math.round((1 - unusedRate) * 100);
  return { checkId: "unusedCustomFields", weight: WEIGHTS.unusedCustomFields, subscore, blockers };
}

async function checkCustomizableRollups(conn: Connection): Promise<CheckResult> {
  const count = await q.customizableRollupCount(conn);
  const blockers: Blocker[] = [];
  if (count > 0) {
    blockers.push({
      id: "customizable-rollups-in-use",
      severity: count > 20 ? "high" : "medium",
      title: `${count} active Customizable Rollup(s) (CRLP)`,
      detail:
        "Customizable Rollups are NPSP-specific reporting logic (npsp__Rollup__mdt custom metadata) with no direct 1:1 successor confirmed in Nonprofit Cloud's Fundraising object model as of this scan.",
      recommendation:
        "Inventory which rollups actually drive reports or dashboards still in active use, and plan to rebuild those specifically (via declarative rollup tools or Data Cloud/Reports) rather than assuming all of them carry forward automatically.",
    });
  }
  // 0 rollups = 100. Every 4 active rollups costs 10 points, floor 10.
  const subscore = Math.max(10, 100 - Math.floor(count / 4) * 10);
  return { checkId: "customizableRollups", weight: WEIGHTS.customizableRollups, subscore, blockers };
}

async function checkRecurringDonationVolume(conn: Connection): Promise<CheckResult> {
  const count = await q.countActiveRecurringDonations(conn);
  const blockers: Blocker[] = [];
  if (count > 0) {
    blockers.push({
      id: "active-recurring-donations",
      severity: count > 500 ? "high" : count > 50 ? "medium" : "low",
      title: `${count} active Recurring Donation(s)`,
      detail:
        "Each active RD2 record and its installment history needs a documented migration path to GiftCommitment + GiftCommitmentSchedule + GiftTransaction (see npsp-to-nonprofit-cloud-field-map/field-map/recurring-donations.yaml).",
      recommendation:
        "Follow Salesforce's official RD2-and-installment-Opportunity import guide rather than a generic data-loader migration - this object graph does not migrate with a simple field copy.",
    });
  }
  // Subscore penalizes volume on a log-ish curve so the score doesn't bottom out from one big nonprofit's normal donor base alone.
  const subscore = Math.max(10, 100 - Math.min(90, Math.round(Math.log10(count + 1) * 30)));
  return { checkId: "recurringDonationVolume", weight: WEIGHTS.recurringDonationVolume, subscore, blockers };
}

async function checkAllocationVolume(conn: Connection): Promise<CheckResult> {
  const count = await q.allocationRecordCount(conn);
  const blockers: Blocker[] = [];
  if (count > 0) {
    blockers.push({
      id: "gau-allocation-volume",
      severity: count > 1000 ? "medium" : "low",
      title: `${count} GAU Allocation record(s)`,
      detail:
        "Each Allocation record needs a home in GiftDesignation/GiftTransactionDesignation. Field-level names on those objects are not yet fully confirmed publicly - see npsp-to-nonprofit-cloud-field-map/field-map/allocations-gau.yaml.",
      recommendation:
        "Export current GAU/Allocation structure before migrating so you have a known-good source to validate against once designations exist in the target org.",
    });
  }
  const subscore = Math.max(15, 100 - Math.min(85, Math.round(Math.log10(count + 1) * 25)));
  return { checkId: "allocationVolume", weight: WEIGHTS.allocationVolume, subscore, blockers };
}

async function checkAffiliationRelationshipDependence(conn: Connection): Promise<CheckResult> {
  const { affiliations, relationships } = await q.affiliationAndRelationshipCounts(conn);
  const total = affiliations + relationships;
  const blockers: Blocker[] = [];
  if (total > 0) {
    blockers.push({
      id: "affiliation-relationship-dependence",
      severity: total > 200 ? "high" : "medium",
      title: `${affiliations} Affiliation(s) and ${relationships} Relationship(s) in active use`,
      detail:
        "This is the least mature area of the current field map - no confirmed Salesforce-documented object-level replacement exists yet for npe5__Affiliation__c or npsp__Relationship__c. Heavy usage here is the least predictable migration risk in this scan.",
      recommendation:
        "Flag this explicitly in your migration plan as a research/prototype item, not a known-quantity task. Budget discovery time specifically for this before committing to a migration timeline.",
    });
  }
  const subscore = Math.max(5, 100 - Math.min(95, Math.round(Math.log10(total + 1) * 35)));
  return {
    checkId: "affiliationRelationshipDependence",
    weight: WEIGHTS.affiliationRelationshipDependence,
    subscore,
    blockers,
  };
}

export async function runAllChecks(conn: Connection): Promise<ScanResult> {
  const checks = await Promise.all([
    checkLegacyHouseholdModel(conn),
    checkUnmanagedTriggers(conn),
    checkUnusedCustomFields(conn),
    checkCustomizableRollups(conn),
    checkRecurringDonationVolume(conn),
    checkAllocationVolume(conn),
    checkAffiliationRelationshipDependence(conn),
  ]);

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = checks.reduce((sum, c) => sum + c.subscore * c.weight, 0);
  const overallScore = Math.round(weightedSum / totalWeight);

  const blockers = checks
    .flatMap((c) => c.blockers)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  return { overallScore, checks, blockers, scannedAt: new Date().toISOString() };
}

function severityRank(s: Severity): number {
  return { critical: 4, high: 3, medium: 2, low: 1 }[s];
}
