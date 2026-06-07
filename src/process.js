import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  filterAndMergeRunners,
  formatEvents,
  formatOrganisations,
} from "./helpers/index.js";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // Use service role key to avoid explicit auth
);

const blackListedOrganisations = ["3591"];
const defaultRequestTimeoutMs = Number(process.env.FETCH_TIMEOUT_MS || 45000);

const getApiBasePath = () => {
  const apiBasePath = process.env.INTERNAL_API_PATH || process.env.API_PATH;

  if (!apiBasePath) {
    throw new Error(
      "Missing API_PATH or INTERNAL_API_PATH environment variable",
    );
  }

  return apiBasePath.replace(/\/$/, "");
};

const getApiUrl = (path) => `${getApiBasePath()}${path}`;

const withRequestTimeout = (options = {}) => {
  if (options.signal || typeof AbortSignal?.timeout !== "function") {
    return options;
  }

  return {
    ...options,
    signal: AbortSignal.timeout(defaultRequestTimeoutMs),
  };
};

const nukeDate = async () => {
  const { data: eventsData } = await supabase
    .from("events")
    .select()
    .limit(1000);
  const { data: classesData } = await supabase
    .from("classes")
    .select()
    .limit(1000);
  const { data: runnersData } = await supabase
    .from("runners")
    .select()
    .limit(1000);
  const { data: resultsData } = await supabase
    .from("results")
    .select()
    .limit(1000);
  const { data: entriesData } = await supabase
    .from("entries")
    .select()
    .limit(1000);

  const data = {
    runners: runnersData.map((item) => item.id),
    results: resultsData.map((item) => item.id),
    entries: entriesData.map((item) => item.id),
    classes: classesData.map((item) => item.id),
    events: eventsData.map((item) => item.id),
  };

  for (const key of Object.keys(data)) {
    const { error } = await supabase.from(key).delete().in("id", data[key]);
    console.log(`Deleted ${data[key].length} ${key}`, error);
  }
};

const fetchPersonsForOrg = async (orgId) => {
  try {
    return await fetchWithRetry(getApiUrl(`/persons/organisations/${orgId}`));
  } catch (err) {
    console.error(`Error fetching persons for organisation ${orgId}:`, err);
    return [];
  }
};

const fetchOrgs = async () => {
  try {
    return await fetchWithRetry(getApiUrl("/organisations"));
  } catch (err) {
    console.error("Error fetching organisations:", err);
    return [];
  }
};

const fetchEvent = async (id) => {
  try {
    const _event = await fetchWithRetry(getApiUrl(`/event/${id}`));
    const event = _event[0];

    if (!event) {
      return null;
    }

    return await enrichEvent(event);
  } catch (err) {
    console.error(`Error fetching event ${id}:`, err);
    return null;
  }
};

const fetchEntryFees = async (id) => {
  try {
    return await fetchWithRetry(getApiUrl(`/entryfees/${id}`));
  } catch (err) {
    console.error(`Error fetching entry fees for event ${id}:`, err);
    return [];
  }
};

const mergeDuplicateRunners = async (
  step = 1,
  yearStart = 2011,
  yearEnd = new Date().getFullYear(),
) => {
  let year = yearStart;

  while (year <= yearEnd) {
    console.time("fetch");
    const { data, error } = await supabase.rpc("handle_duplicate_runners", {
      step: step,
      year: year,
    });
    // const { data, error } = await supabase.rpc("get_duplicate_runners");
    console.log(year);
    console.log(data, error);
    year++;
    console.timeEnd("fetch");
  }
};

const removeRunnersWithoutResult = async () => {
  console.time("remove runners");
  const { data, error } = await supabase.rpc("clean_up_runners");
  console.log(data, error);
  console.timeEnd("remove runners");
};

const fetchWithRetry = async (url, options = {}, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, withRequestTimeout(options));
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (err) {
      if (i === retries - 1) {
        throw err;
      }
      console.warn(
        `Retrying fetch for ${url} (${i + 1}/${retries})`,
        err.message,
      );
    }
  }
};

const fetchWithFallback = async (url, fallback, label) => {
  try {
    return await fetchWithRetry(url);
  } catch (error) {
    console.error(`Error fetching ${label}:`, error);
    return fallback;
  }
};

const enrichEvent = async (event) => {
  if (!event?.eventId) {
    return event;
  }

  const eventId = event.eventId;
  const [competiorCount, results, entries, entryfees] = await Promise.all([
    fetchWithFallback(
      getApiUrl(`/competitorcount/${eventId}`),
      [],
      `competitor count for event ${eventId}`,
    ),
    fetchWithFallback(
      getApiUrl(`/results/${eventId}`),
      [],
      `results for event ${eventId}`,
    ),
    fetchWithFallback(
      getApiUrl(`/entries/${eventId}`),
      [],
      `entries for event ${eventId}`,
    ),
    fetchWithFallback(
      getApiUrl(`/entryfees/${eventId}`),
      [],
      `entry fees for event ${eventId}`,
    ),
  ]);

  return {
    ...event,
    competiorCount,
    results,
    entries,
    entryfees,
  };
};

const fetchEvents = async (options) => {
  const params = new URLSearchParams(options);
  try {
    const events = await fetchWithRetry(getApiUrl(`/events?${params}`));
    const eventList = Array.isArray(events) ? events : [];

    return (
      await Promise.all(
        eventList
          .filter((item) =>
            ["0", "1", "2", "3", "4"].includes(item.eventClassificationId),
          )
          .map((event) => enrichEvent(event)),
      )
    ).filter(Boolean);
  } catch (err) {
    console.error("Error fetching events:", err);
    return [];
  }
};

const batchInsert = async (data, table, options, batchSize = 1000) => {
  if (!Array.isArray(data) || data.length === 0) {
    return { data: [], error: null };
  }

  const insertedData = [];
  let error = null;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

    console.log(
      `Processing batch ${Math.ceil(i / batchSize) + 1}/${Math.ceil(data.length / batchSize)} of ${table}...`,
    );

    const { data: batchData, error: batchError } = await supabase
      .from(table)
      .upsert(batch, options)
      .select();

    if (batchError) {
      error = batchError;
      console.error(`Error inserting batch into ${table}:`, batchError);
    }

    if (batchData) {
      insertedData.push(...batchData);
    }
  }

  return { data: insertedData, error };
};

export const fetchAndInsertOrgs = async () => {
  const organisations = await fetchOrgs();

  if (!organisations.length) {
    console.warn("No organisations fetched");
    return;
  }

  const formattedOrganisations = formatOrganisations(organisations);

  const { data, error } = await batchInsert(
    formattedOrganisations,
    "organisations",
    {
      onConflict: "organisationId",
    },
  );

  if (error) {
    console.error("Error inserting organisations:", error);
    return;
  }

  console.log(`Inserted ${data.length} organisations`);
};

const insertData = async (formattedEvents, startDate, toDate) => {
  const { data: eventsData, error: eventsError } = await batchInsert(
    formattedEvents.flatMap((item) => item.event),
    "events",
    {
      onConflict: "eventId",
      ignoreDuplicates: false,
    },
  );

  const { data: classesData, error: classesError } = await batchInsert(
    formattedEvents.flatMap((item) => item.classes),
    "classes",
    {
      onConflict: "classId",
      ignoreDuplicates: false,
    },
  );

  const { data: runnersData, error: runnersError } = await batchInsert(
    filterAndMergeRunners(formattedEvents.flatMap((item) => item.runners)),
    "runners",
    {
      onConflict: "personId",
      ignoreDuplicates: false,
    },
  );

  const { data: resultsData, error: resultsError } = await batchInsert(
    formattedEvents.flatMap((item) => item.results),
    "results",
    {
      onConflict: "resultId",
      ignoreDuplicates: false,
    },
  );

  const { data: entriesData, error: entriesError } = await supabase
    .from("entries")
    .upsert(
      formattedEvents.flatMap((item) => item.entries),
      {
        onConflict: "entryId",
        ignoreDuplicates: false,
      },
    )
    .select();
  const { data: entryFeesData, error: entryFeesError } = await supabase
    .from("entryfees")
    .upsert(
      formattedEvents.flatMap((item) => item.entryFees),
      {
        onConflict: "entryFeeId",
        ignoreDuplicates: true,
      },
    )
    .select();

  console.log(`from ${startDate} to ${toDate}`);
  console.log("------------------------------------");
  console.log(`Inserted ${eventsData?.length} events`);
  if (eventsError) console.error("Events Error:", eventsError);
  console.log(`Inserted ${classesData?.length} classes`);
  if (classesError) console.error("Classes Error:", classesError);
  console.log(`Inserted ${runnersData?.length} runners`);
  if (runnersError) console.error("Runners Error:", runnersError);
  console.log(`Inserted ${resultsData?.length} results`);
  if (resultsError) console.error("Results Error:", resultsError);
  console.log(`Inserted ${entriesData?.length} entries`);
  if (entriesError) console.error("Entries Error:", entriesError);
  console.log(`Inserted ${entryFeesData?.length} entry fees`);
  if (entryFeesError) console.error("Entry fees Error:", entryFeesError);
  console.log("------------------------------------");
};

const nameMap = new Map();
const detectNameChanges = (data) => {
  const changes = [];

  data
    .flatMap((item) => item.runners)
    .forEach((runner) => {
      const { personId, fullName } = runner;
      if (nameMap.has(personId)) {
        const oldName = nameMap.get(personId);
        if (oldName !== fullName) {
          changes.push({ personId, oldName, newName: fullName });
          nameMap.set(personId, fullName); // Update to the new name
        }
      } else {
        nameMap.set(personId, fullName);
      }
    });

  return changes;
};

const fetchAndFormatEvent = async (eventId) => {
  try {
    const event = await fetchEvent(eventId);
    const formattedEvent = formatEvents([event]);
    return formattedEvent;
  } catch (err) {
    console.error(`Error fetching and formatting event ${eventId}:`, err);
  }
};

export const fetchEventsAndInsert = async (
  _startDate,
  _endDate,
  granularity = 15,
  dryrun = false,
) => {
  let startDate = new Date(_startDate);
  startDate.setHours(0, 0, 0, 0);

  let endDate = new Date(_endDate);
  let toDate = new Date(startDate);
  toDate.setHours(23, 59, 59, 999);

  while (startDate < endDate) {
    toDate = new Date(startDate.getTime());
    toDate.setDate(startDate.getDate() + granularity);

    // Ensure toDate doesn't exceed endDate
    if (toDate > endDate) {
      toDate = new Date(endDate.getTime());
    }

    const options = {
      fromDate: startDate.toISOString(),
      toDate: toDate.toISOString(),
    };
    const fetchTimerLabel = `fetch ${options.fromDate} -> ${options.toDate}`;
    const formatTimerLabel = `format ${options.fromDate} -> ${options.toDate}`;
    let events = [];
    let formattedEvents = [];

    console.log(">>>> START");
    console.time(fetchTimerLabel);
    try {
      events = await fetchEvents(options);
    } finally {
      console.timeEnd(fetchTimerLabel);
    }

    console.time(formatTimerLabel);
    try {
      formattedEvents = formatEvents(events);
      formattedEvents = formattedEvents.filter(
        (item) =>
          !item.event.organiserId.some((r) =>
            blackListedOrganisations.includes(r),
          ),
      );
    } finally {
      console.timeEnd(formatTimerLabel);
    }

    if (!dryrun) {
      console.time("insert");
      await insertData(formattedEvents, options.fromDate, options.toDate);
      console.timeEnd("insert");
      console.log(">>>> END");
    } else {
      console.log("---- DRY RUN");
      console.log(
        detectNameChanges(formattedEvents),
        formattedEvents
          .flatMap((item) => item.runners)
          .filter(
            (item) =>
              item.fullName === "" ||
              item.fullName === null ||
              item.fullName === undefined ||
              item.fullName.includes("undefined"),
          ),
        formattedEvents
          .flatMap((item) => item.results)
          .filter(
            (item) =>
              item.personId === "" ||
              item.personId === null ||
              item.personId === undefined ||
              item.personId.includes("undefined"),
          ),
      );
      console.log(`from ${startDate} to ${toDate}`);
      console.log("------------------------------------");
      console.log(
        `Fetched ${
          formattedEvents.flatMap((item) => item.event)?.length
        } events`,
      );
      console.log(
        `Fetched ${
          formattedEvents.flatMap((item) => item.classes)?.length
        } classes`,
      );
      console.log(
        `Fetched ${
          formattedEvents.flatMap((item) => item.runners)?.length
        } runners`,
      );
      console.log(
        `Fetched ${
          formattedEvents.flatMap((item) => item.results)?.length
        } results`,
      );
      console.log(
        `Fetched ${
          formattedEvents.flatMap((item) => item.entries)?.length
        } entries`,
      );
      console.log(
        `Fetched ${
          formattedEvents.flatMap((item) => item.entryFees)?.length
        } entry fees`,
      );
      console.log(">>>> END");
    }

    startDate.setDate(startDate.getDate() + granularity);
  }
};

// DO NOT COMMIT AS IT CAUSES SIDE EFFECTS WITH THE CRON JOB IMPORT

// Get the last 7 days of events
const startDate = new Date("2025-01-01");
const endDate = new Date();

// const startDate = new Date().setDate(new Date().getDate() - 7);
// const endDate = new Date();

const granularity = 7; // some times the database times out with larger granularities when there are big races being processed from Eventor
const dryrun = false; // set to true if you just want the fetch data and not insert it into the database

// await fetchAndInsertOrgs();
// await fetchEventsAndInsert(startDate, endDate, granularity, dryrun);

// const data = await fetchAndFormatEvent(21214);
// console.log(data[0].event);
// insertData(data);

// await mergeDuplicateRunners(1, 2012, 2013);
// await mergeDuplicateRunners(2, 2012, 2013);
// await removeRunnersWithoutResult();

import fs from "fs";

const content = [];

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

for (const race of [
  ...races2025,
  ...races2024,
  ...races2023,
  ...races2022,
  ...races2021,
  ...races2020,
  ...races2019,
  ...races2018,
  ...races2017,
  ...races2016,
  ...races2015,
  ...races2014,
  ...races2013,
  ...races2012,
]) {
  const data = await fetchAndFormatEvent(race);
  content.push(data);
}

const flatContent = content.flat();
// console.log(flatContent);

// Write to output.json
fs.writeFileSync("results.json", JSON.stringify(flatContent, null, 2));

// Array.from(
//   document.querySelectorAll('table.manualStriped a[href*="?eventId="]')
// ).map((a) => parseInt(new URL(a.href).search.split("=")[1]));

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
  2025: total2025,
  2024: total2024,
  2023: total2023,
  2022: total2022,
  2021: total2021,
  2020: total2020,
  2019: total2019,
  2018: total2018,
  2017: total2017,
  2016: total2016,
  2015: total2015,
  2014: total2014,
  2013: total2013,
  2012: total2012,
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

// fs.writeFileSync("total.json", JSON.stringify(groupTotal, null, 2));
