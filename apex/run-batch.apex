// Anonymous Apex to kick off the record-level scan.
// Run with: sf apex run --target-org my-npsp-org --file apex/run-batch.apex
Database.executeBatch(new MigrationReadinessBatch(), 200);
