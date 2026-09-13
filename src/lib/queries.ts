/**
 * queries.ts
 *
 * All schema and data queries the scanner needs, isolated in one place so the
 * scoring logic (scoring.ts) never has to know about SOQL, Tooling API paths,
 * or jsforce specifics. Every function here is read-only - this plugin never
 * inserts, updates, or deletes anything in the target org.
 */
import { Connection } from "@salesforce/core";

export interface FieldUsage {
  fieldApiName: string;
  isCustom: boolean;
  totalRecords: number;
  populatedRecords: number;
  populationRate: number; // 0-1
}

export interface TriggerInfo {
  name: string;
  tableEnumOrId: string;
  bodyLineCount: number;
  status: string;
  isManaged: boolean;
}

/** True if the given sObject API name exists in this org's schema. */
export async function objectExists(conn: Connection, sobject: string): Promise<boolean> {
  try {
    await conn.describe(sobject);
    return true;
  } catch (err: any) {
    if (err?.errorCode === "NOT_FOUND") return false;
    throw err;
  }
}

/** Total record count for an sObject (used as the denominator for population rate). */
export async function totalRecordCount(conn: Connection, sobject: string): Promise<number> {
  const res = await conn.query<{ expr0: number }>(`SELECT COUNT(Id) expr0 FROM ${sobject}`);
  return res.records[0]?.expr0 ?? 0;
}

/**
 * Population rate for a single field: what fraction of existing records have
 * a non-null value in this field. Used to flag "field nobody has used since
 * 2018" style custom fields that add migration weight for no reporting value.
 */
export async function fieldPopulationRate(
  conn: Connection,
  sobject: string,
  fieldApiName: string,
  totalRecords?: number
): Promise<FieldUsage> {
  const total = totalRecords ?? (await totalRecordCount(conn, sobject));
  if (total === 0) {
    return { fieldApiName, isCustom: fieldApiName.endsWith("__c"), totalRecords: 0, populatedRecords: 0, populationRate: 0 };
  }
  const res = await conn.query<{ expr0: number }>(
    `SELECT COUNT(Id) expr0 FROM ${sobject} WHERE ${fieldApiName} != null`
  );
  const populated = res.records[0]?.expr0 ?? 0;
  return {
    fieldApiName,
    isCustom: fieldApiName.endsWith("__c"),
    totalRecords: total,
    populatedRecords: populated,
    populationRate: populated / total,
  };
}

/** All custom (__c) fields defined on an sObject, from the standard describe call. */
export async function listCustomFields(conn: Connection, sobject: string): Promise<string[]> {
  const describe = await conn.describe(sobject);
  return describe.fields.filter((f) => f.custom).map((f) => f.name);
}

/**
 * Apex triggers active on a given sObject, via the Tooling API. Distinguishes
 * managed-package triggers (namespace-prefixed, generally NPSP's own and not
 * something the org has to port) from unmanaged custom triggers (the org's
 * own code, which does need to be reviewed/ported during migration).
 */
export async function listTriggersForObject(conn: Connection, sobject: string): Promise<TriggerInfo[]> {
  const tooling = conn.tooling;
  const res = await tooling.query<{
    Name: string;
    TableEnumOrId: string;
    Body: string;
    Status: string;
    NamespacePrefix: string | null;
  }>(
    `SELECT Name, TableEnumOrId, Body, Status, NamespacePrefix FROM ApexTrigger WHERE TableEnumOrId = '${sobject}'`
  );
  return res.records.map((r) => ({
    name: r.Name,
    tableEnumOrId: r.TableEnumOrId,
    bodyLineCount: (r.Body || "").split("\n").length,
    status: r.Status,
    isManaged: Boolean(r.NamespacePrefix),
  }));
}

/** Count of active (non-closed) Recurring Donations, RD2 or legacy. */
export async function countActiveRecurringDonations(conn: Connection): Promise<number> {
  const exists = await objectExists(conn, "npe03__Recurring_Donation__c");
  if (!exists) return 0;
  const res = await conn.query<{ expr0: number }>(
    `SELECT COUNT(Id) expr0 FROM npe03__Recurring_Donation__c WHERE npsp__Status__c = 'Active'`
  );
  return res.records[0]?.expr0 ?? 0;
}

/** Whether the org still has the legacy pre-2016 Household object populated with data. */
export async function legacyHouseholdRecordCount(conn: Connection): Promise<number> {
  const exists = await objectExists(conn, "npsp__Household__c");
  if (!exists) return 0;
  return totalRecordCount(conn, "npsp__Household__c");
}

/** Count of GAU Allocation records - a rough proxy for how much designation logic has to migrate. */
export async function allocationRecordCount(conn: Connection): Promise<number> {
  const exists = await objectExists(conn, "npsp__Allocation__c");
  if (!exists) return 0;
  return totalRecordCount(conn, "npsp__Allocation__c");
}

/** Count of Affiliation and Relationship records - proxy for how much of affiliations-relationships.yaml's open gap this org actually depends on. */
export async function affiliationAndRelationshipCounts(
  conn: Connection
): Promise<{ affiliations: number; relationships: number }> {
  const [hasAffil, hasRel] = await Promise.all([
    objectExists(conn, "npe5__Affiliation__c"),
    objectExists(conn, "npsp__Relationship__c"),
  ]);
  const [affiliations, relationships] = await Promise.all([
    hasAffil ? totalRecordCount(conn, "npe5__Affiliation__c") : 0,
    hasRel ? totalRecordCount(conn, "npsp__Relationship__c") : 0,
  ]);
  return { affiliations, relationships };
}

/** Active Customizable Rollups defined (npsp__Rollup__c custom metadata), if the org uses CRLP. */
export async function customizableRollupCount(conn: Connection): Promise<number> {
  const exists = await objectExists(conn, "npsp__Rollup__mdt");
  if (!exists) return 0;
  const res = await conn.query<{ expr0: number }>(
    `SELECT COUNT(Id) expr0 FROM npsp__Rollup__mdt WHERE npsp__Active__c = true`
  );
  return res.records[0]?.expr0 ?? 0;
}
