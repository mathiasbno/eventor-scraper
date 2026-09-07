import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  fetchEvent,
  fetchEvents,
  fetchWithRetry,
  getApiUrl,
} from "./fetchUtils.js";
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
