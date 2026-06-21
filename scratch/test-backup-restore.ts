import { pool } from "../src/lib/db";
import { generateLogicalDump } from "../src/lib/backup-restore";
import fs from "fs";
import path from "path";

async function main() {
  console.log("=== Testing Database Backup/Restore Utility ===");
  const client = await pool.connect();
  try {
    console.log("1. Generating database logical dump of public schema...");
    const dump = await generateLogicalDump(client);
    console.log("✓ Success: Logical dump generated.");

    const scratchDir = path.join(process.cwd(), "scratch");
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }

    const dumpPath = path.join(scratchDir, "test_schema.sql");
    fs.writeFileSync(dumpPath, dump);
    console.log(`2. Saved dump to file: ${dumpPath}`);

    console.log("3. Verifying SQL executes without syntax errors (in transaction block)...");
    // We execute the queries inside a transaction and ROLLBACK to verify syntax correctness
    // without altering the state of the active database.
    await client.query("BEGIN");
    try {
      await client.query(dump);
      console.log("✓ Success: Entire dump SQL executed successfully on database!");
    } finally {
      console.log("4. Rolling back transaction to preserve existing database state...");
      await client.query("ROLLBACK");
    }

    console.log("=== ALL UTILITY TESTS PASSED SUCCESSFULLY ===");
  } catch (err: any) {
    console.error("❌ Test failed:", err.message || err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
