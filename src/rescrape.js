// Re-scrape one year, replacing each event's results, then redo the runner merges.
// Kept out of process.js: the API cron imports that file, so top-level calls would run there.
// Usage (with `npm run server` running): node src/rescrape.js 2025
import {
  fetchAndInsertOrgs,
  fetchEventsAndInsert,
  fixSharedPersonIds,
  mergeDuplicateRunners,
  mergeRunnersByNameAndClub,
  estimateBirthYears,
  removeRunnersWithoutResult,
} from "./process.js";

const year = Number(process.argv[2]);
if (!Number.isInteger(year)) {
  console.error("Usage: node src/rescrape.js <year>");
  process.exit(1);
}

const startDate = new Date(`${year}-01-01`);
const endDate = new Date(Math.min(Date.now(), new Date(`${year + 1}-01-01`)));

await fetchAndInsertOrgs();
await fetchEventsAndInsert(startDate, endDate, 15);
await fixSharedPersonIds();
await mergeDuplicateRunners(1, year, year);
await mergeDuplicateRunners(2, year, year);
await mergeRunnersByNameAndClub();
await removeRunnersWithoutResult();
await estimateBirthYears();
