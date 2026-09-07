import fs from "fs";

import { fetchEvent } from "./fetchUtils.js";
import { formatYouthEvents } from "./helpers/youth.js";

// ─── Fetch & format a single event using the youth formatter ─────────────────

const fetchAndFormatYouthEvent = async (eventId) => {
  try {
    const event = await fetchEvent(eventId);
    if (!event) return [];
    return formatYouthEvents([event]);
  } catch (err) {
    console.error(`Error fetching and formatting event ${eventId}:`, err);
    return [];
  }
};

// ─── Youth race IDs per year ──────────────────────────────────────────────────

const races2026 = [
  22783, 22566, 22526, 22587, 22463, 22565, 22525, 22580, 22731,
  //22547, 22575,
];
const races2025 = [
  20674, 20686, 20781, 20666, 20849, 20672, 20641, 20671, 20812, 20675,
];
const races2024 = [
  18602, 18871, 19601, 18865, 14736, 19104, 18870, 18848, 18881, 18875,
];
const races2023 = [
  17589, 17166, 17195, 17234, 17215, 17092, 17233, 17211, 17256, 17217,
];
const races2022 = [
  15600, 15582, 15606, 16134, 15590, 15535, 15604, 16996, 15572, 15601,
];
const races2021 = [
  13723, 13627, 13681, 14820, 13672, 13706, 13694, 14917, 14707,
];
const races2020 = [
  12051, 12037, 12001, 12044, 12213, 12038, 12058, 12057, 13511, 13510,
];
const races2019 = [
  10574, 10570, 11094, 10575, 10647, 10550, 10548, 10573, 10554,
];
const races2018 = [9075, 9006, 9020, 8998, 8967, 9047, 9087, 9054];
const races2017 = [7538, 7546, 7570, 7596, 7578, 7574, 7557, 8191];
const races2016 = [6109, 6086, 6080, 6068, 6128, 6087, 6096, 6072, 5956];
const races2015 = [3636, 4620, 4541, 4626, 4636, 4564, 4644, 4730, 4629];
const races2014 = [3163, 3414, 3260, 3345, 3316, 3255, 3327, 3318, 3250];
const races2013 = [2007, 2004, 1983, 1163, 1947, 1996, 1999];
const races2012 = [880, 555, 859, 889, 879, 865];

// ─── Fetch all races and write results.json ───────────────────────────────────

const allRaces = [
  ...races2026,
  // ...races2025,
  // ...races2024,
  // ...races2023,
  // ...races2022,
  // ...races2021,
  // ...races2020,
  // ...races2019,
  // ...races2018,
  // ...races2017,
  // ...races2016,
  // ...races2015,
  // ...races2014,
  // ...races2013,
  // ...races2012,
];

const content = [];

for (let i = 0; i < allRaces.length; i++) {
  const race = allRaces[i];
  console.log(`[${i + 1}/${allRaces.length}] Fetching event ${race}...`);
  const data = await fetchAndFormatYouthEvent(race);
  content.push(data);
}
console.log("All events fetched. Writing results.json...");

const flatContent = content.flat();
fs.writeFileSync("results.json", JSON.stringify(flatContent, null, 2));

// ─── Total registered runners per class per year ──────────────────────────────
// These counts come from the Eventor results pages and represent the total
// unique runners in each age group across all ranked events for that season.
// Array.from(
//   document.querySelectorAll('table.manualStriped a[href*="?eventId="]')
// ).map((a) => parseInt(new URL(a.href).search.split("=")[1]));

const total2026 = [
  { title: "D 13-14", rowCount: 45 },
  { title: "D 15-16", rowCount: 41 },
  { title: "H 13-14", rowCount: 38 },
  { title: "H 15-16", rowCount: 50 },
];
const total2025 = [
  { title: "D 13-14", rowCount: 45 },
  { title: "D 15-16", rowCount: 41 },
  { title: "H 13-14", rowCount: 38 },
  { title: "H 15-16", rowCount: 50 },
];
const total2024 = [
  { title: "D 13-14", rowCount: 42 },
  { title: "D 15-16", rowCount: 43 },
  { title: "H 13-14", rowCount: 59 },
  { title: "H 15-16", rowCount: 52 },
];
const total2023 = [
  { title: "D 13-14", rowCount: 43 },
  { title: "D 15-16", rowCount: 40 },
  { title: "H 13-14", rowCount: 47 },
  { title: "H 15-16", rowCount: 45 },
];
const total2022 = [
  { title: "D 13-14", rowCount: 44 },
  { title: "D 15-16", rowCount: 36 },
  { title: "H 13-14", rowCount: 61 },
  { title: "H 15-16", rowCount: 57 },
];
const total2021 = [
  { title: "D 13-14", rowCount: 49 },
  { title: "H 13-14", rowCount: 57 },
  { title: "D 15-16", rowCount: 43 },
  { title: "H 15-16", rowCount: 58 },
];
const total2020 = [
  { title: "D 13-14", rowCount: 55 },
  { title: "H 13-14", rowCount: 63 },
  { title: "D 15-16", rowCount: 51 },
  { title: "H 15-16", rowCount: 61 },
];
const total2019 = [
  { title: "D 13-14", rowCount: 47 },
  { title: "D 15-16", rowCount: 45 },
  { title: "H 13-14", rowCount: 57 },
  { title: "H 15-16", rowCount: 49 },
];
const total2018 = [
  { title: "D 13-14", rowCount: 56 },
  { title: "D 15-16", rowCount: 63 },
  { title: "H 13-14", rowCount: 58 },
  { title: "H 15-16", rowCount: 65 },
];
const total2017 = [
  { title: "D 13-14", rowCount: 62 },
  { title: "D 15-16", rowCount: 59 },
  { title: "H 13-14", rowCount: 73 },
  { title: "H 15-16", rowCount: 47 },
];
const total2016 = [
  { title: "D 13-14", rowCount: 60 },
  { title: "D 15-16", rowCount: 66 },
  { title: "H 13-14", rowCount: 77 },
  { title: "H 15-16", rowCount: 44 },
];
const total2015 = [
  { title: "H 13-14", rowCount: 63 },
  { title: "H 15-16", rowCount: 78 },
  { title: "D 13-14", rowCount: 67 },
  { title: "D 15-16", rowCount: 71 },
];
const total2014 = [
  { title: "H 13-14", rowCount: 62 },
  { title: "D 13-14", rowCount: 67 },
  { title: "H 15-16", rowCount: 64 },
  { title: "D 15-16", rowCount: 47 },
];
const total2013 = [
  { title: "H 13-14", rowCount: 89 },
  { title: "D 13-14", rowCount: 65 },
  { title: "H 15-16", rowCount: 58 },
  { title: "D 15-16", rowCount: 55 },
];
const total2012 = [
  { title: "H 13-14", rowCount: 84 },
  { title: "H 15-16", rowCount: 69 },
  { title: "D 13-14", rowCount: 78 },
  { title: "D 15-16", rowCount: 71 },
];

const totals = {
  2026: total2026,
  // 2025: total2025,
  // 2024: total2024,
  // 2023: total2023,
  // 2022: total2022,
  // 2021: total2021,
  // 2020: total2020,
  // 2019: total2019,
  // 2018: total2018,
  // 2017: total2017,
  // 2016: total2016,
  // 2015: total2015,
  // 2014: total2014,
  // 2013: total2013,
  // 2012: total2012,
};

const groupTotal = Object.entries(totals).reduce((acc, [year, classes]) => {
  classes.forEach(({ title, rowCount }) => {
    if (!acc[title]) {
      acc[title] = {};
    }
    acc[title][year] = rowCount;
  });
  return acc;
}, {});

fs.writeFileSync("total.json", JSON.stringify(groupTotal, null, 2));
