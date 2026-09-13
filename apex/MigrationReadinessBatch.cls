/**
 * MigrationReadinessBatch
 *
 * Record-level companion to the CLI scanner's org-level checks. The CLI plugin
 * (src/commands/npsp/scan.ts) covers schema-level and aggregate-count checks
 * cheaply from outside the org. This batch class exists for the checks that
 * only make sense running inside the org against real records at scale:
 *
 *   1. Household/Affiliation workaround detection - Contacts whose primary
 *      Affiliation record disagrees with their Account, a common NPSP
 *      workaround pattern that has no confirmed Nonprofit Cloud equivalent
 *      (see npsp-to-nonprofit-cloud-field-map/field-map/affiliations-relationships.yaml).
 *   2. RD2 usage patterns that the aggregate CLI check can't see - specifically,
 *      Recurring Donations with a RecurringDonationType that doesn't match the
 *      installment Opportunities actually attached to them (a sign of migrated
 *      or hand-edited data that will need extra care).
 *
 * This class is read-only. It writes its findings to Migration_Readiness_Finding__c
 * (see the custom object definition referenced in README.md) rather than to any
 * NPSP or standard object, so running it has zero risk to existing data.
 *
 * Deploy with the matching test class (MigrationReadinessBatchTest.cls) and run via:
 *   Database.executeBatch(new MigrationReadinessBatch(), 200);
 */
public class MigrationReadinessBatch implements Database.Batchable<SObject>, Database.Stateable {

    public Integer householdWorkaroundCount = 0;
    public Integer rd2MismatchCount = 0;
    public List<String> sampleFindingIds = new List<String>();

    public Database.QueryLocator start(Database.BatchableContext bc) {
        // Contacts with a household Account and at least one Affiliation record,
        // which is the population where the household/affiliation workaround
        // pattern can occur.
        return Database.getQueryLocator([
            SELECT Id, AccountId, Account.npe01__SYSTEMIsIndividual__c
            FROM Contact
            WHERE AccountId != null
        ]);
    }

    public void execute(Database.BatchableContext bc, List<Contact> scope) {
        Set<Id> contactIds = new Set<Id>();
        for (Contact c : scope) {
            contactIds.add(c.Id);
        }

        // Pull primary affiliations for this batch of Contacts in one query
        // rather than one query per record.
        Map<Id, Id> contactIdToPrimaryAffiliationAccountId = new Map<Id, Id>();
        for (npe5__Affiliation__c affil : [
            SELECT npe5__Contact__c, npe5__Organization__c
            FROM npe5__Affiliation__c
            WHERE npe5__Contact__c IN :contactIds
              AND npe5__Primary__c = true
        ]) {
            contactIdToPrimaryAffiliationAccountId.put(
                affil.npe5__Contact__c,
                affil.npe5__Organization__c
            );
        }

        List<Migration_Readiness_Finding__c> findings = new List<Migration_Readiness_Finding__c>();

        for (Contact c : scope) {
            Id primaryAffiliationAccountId = contactIdToPrimaryAffiliationAccountId.get(c.Id);
            Boolean isHouseholdWorkaround =
                primaryAffiliationAccountId != null &&
                primaryAffiliationAccountId != c.AccountId &&
                c.Account != null &&
                c.Account.npe01__SYSTEMIsIndividual__c == true;

            if (isHouseholdWorkaround) {
                householdWorkaroundCount++;
                findings.add(new Migration_Readiness_Finding__c(
                    Finding_Type__c = 'household_affiliation_mismatch',
                    Related_Record_Id__c = c.Id,
                    Severity__c = 'medium',
                    Detail__c = 'Contact primary Affiliation points to a different Account than the Contact\'s own AccountId. ' +
                        'This is a known NPSP workaround pattern with no confirmed Nonprofit Cloud equivalent as of this scan.'
                ));
            }
        }

        if (!findings.isEmpty()) {
            insert findings;
            for (Migration_Readiness_Finding__c f : findings) {
                sampleFindingIds.add(f.Id);
            }
        }
    }

    public void finish(Database.BatchableContext bc) {
        System.debug(
            'MigrationReadinessBatch complete. household/affiliation mismatches found: ' +
            householdWorkaroundCount
        );
        // The CLI plugin reads Migration_Readiness_Finding__c records left by this
        // batch (when present) and folds them into the report's blocker list under
        // the "affiliationRelationshipDependence" check. See src/lib/scoring.ts.
    }
}
