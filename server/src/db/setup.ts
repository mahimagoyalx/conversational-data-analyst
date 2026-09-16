import { getBreakdowns, getDatabasePath, getRowCounts, setupDatabase } from "./database.js";

function printGroup(title: string, rows: Array<{ label: string; count: number }>) {
  console.log(title);
  for (const row of rows) {
    console.log(`  ${row.label}: ${row.count}`);
  }
}

const dbPath = getDatabasePath();
const db = setupDatabase(dbPath);
const counts = getRowCounts(db);
const breakdowns = getBreakdowns(db);

console.log(`Database created at ${dbPath}`);
console.log(`branches: ${counts.branches}`);
console.log(`customers: ${counts.customers}`);
console.log(`onboarding_applications: ${counts.onboarding_applications}`);
console.log(`transactions: ${counts.transactions}`);
printGroup("customers by segment", breakdowns.customersBySegment);
printGroup("customers by branch", breakdowns.customersByBranch);
printGroup("applications by status", breakdowns.applicationsByStatus);

db.close();
