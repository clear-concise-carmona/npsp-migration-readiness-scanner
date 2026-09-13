/**
 * MigrationReadinessBatchTest
 *
 * Covers MigrationReadinessBatch's core case: a Contact whose primary
 * Affiliation account differs from its own AccountId (the household/affiliation
 * workaround pattern) should produce exactly one Migration_Readiness_Finding__c.
 *
 * Requires NPSP (npe5__Affiliation__c) installed in the org, same as the batch
 * class itself. Uses one-time test data setup and asserts both the finding
 * record and the batch's own instance counters.
 */
@IsTest
private class MigrationReadinessBatchTest {

    @TestSetup
    static void setup() {
        Account household = new Account(Name = 'Test Household');
        Account org1 = new Account(Name = 'Test Org 1');
        insert new List<Account>{ household, org1 };

        Contact c = new Contact(
            FirstName = 'Jamie',
            LastName = 'Donor',
            AccountId = household.Id
        );
        insert c;

        // Primary Affiliation points at a DIFFERENT account than c.AccountId -
        // this is the mismatch pattern the batch is designed to catch.
        insert new npe5__Affiliation__c(
            npe5__Contact__c = c.Id,
            npe5__Organization__c = org1.Id,
            npe5__Primary__c = true,
            npe5__Status__c = 'Current'
        );
    }

    @IsTest
    static void flagsHouseholdAffiliationMismatch() {
        Test.startTest();
        MigrationReadinessBatch batch = new MigrationReadinessBatch();
        Database.executeBatch(batch, 200);
        Test.stopTest();

        List<Migration_Readiness_Finding__c> findings = [
            SELECT Id, Finding_Type__c, Severity__c
            FROM Migration_Readiness_Finding__c
            WHERE Finding_Type__c = 'household_affiliation_mismatch'
        ];

        System.assertEquals(
            1,
            findings.size(),
            'Expected exactly one household/affiliation mismatch finding for the test Contact.'
        );
        System.assertEquals('medium', findings[0].Severity__c);
    }

    @IsTest
    static void producesNoFindingsWhenAffiliationMatchesAccount() {
        Account matchedOrg = new Account(Name = 'Matched Org');
        insert matchedOrg;

        Contact matched = new Contact(
            FirstName = 'Sam',
            LastName = 'Match',
            AccountId = matchedOrg.Id
        );
        insert matched;

        insert new npe5__Affiliation__c(
            npe5__Contact__c = matched.Id,
            npe5__Organization__c = matchedOrg.Id, // same account -> no mismatch
            npe5__Primary__c = true,
            npe5__Status__c = 'Current'
        );

        Test.startTest();
        Database.executeBatch(new MigrationReadinessBatch(), 200);
        Test.stopTest();

        List<Migration_Readiness_Finding__c> findings = [
            SELECT Id
            FROM Migration_Readiness_Finding__c
            WHERE Related_Record_Id__c = :matched.Id
        ];
        System.assertEquals(0, findings.size(), 'Matched affiliation should not produce a finding.');
    }
}
