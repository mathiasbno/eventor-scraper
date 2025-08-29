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
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key to avoid explicit auth
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
  return await fetch(`${process.env.API_PATH}/persons/organisations/${orgId}`)
    .then((response) => response.json())
    .then((persons) => persons)
    .catch((err) => console.error(err));
};

const fetchOrgs = async () => {
  return await fetch(`${process.env.API_PATH}/organisations`)
    .then((response) => response.json())
    .then((orgs) => orgs)
    .catch((err) => console.error(err));
};

const fetchEvent = async (id) => {
  return await fetch(`${process.env.API_PATH}/event/${id}`)
    .then((response) => response.json())
    .then(async (_event) => {
      const event = _event[0];
      const [competiorCount, eventResults, eventEntries, eventEntryfees] =
        await Promise.all([
          fetchWithRetry(
            `${process.env.API_PATH}/competitorcount/${event.eventId}`
          ),
          fetchWithRetry(`${process.env.API_PATH}/results/${event.eventId}`),
          fetchWithRetry(`${process.env.API_PATH}/entries/${event.eventId}`),
          fetchWithRetry(`${process.env.API_PATH}/entryfees/${event.eventId}`),
        ]);
      event.competiorCount = competiorCount;
      event.results = eventResults;
      event.entries = eventEntries;
      event.entryfees = eventEntryfees;

      return event;
    })
    .catch((err) => console.error(err));
};

const fetchEntryFees = async (id) => {
  return await fetch(`${process.env.API_PATH}/entryfees/${id}`)
    .then((response) => response.json())
    .then((event) => console.log(event))
    .catch((err) => console.error(err));
};

const mergeDuplicateRunners = async (
  step = 1,
  yearStart = 2011,
  yearEnd = new Date().getFullYear()
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
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (err) {
      if (i === retries - 1) {
        throw err;
      }
      console.warn(`Retrying fetch for ${url} (${i + 1}/${retries})`);
    }
  }
};

const fetchEvents = async (options) => {
  const params = new URLSearchParams(options);
  try {
    const events = await fetchWithRetry(
      `${process.env.API_PATH}/events?${params}`
    );

    return Promise.all(
      events
        .filter((item) =>
          ["0", "1", "2", "3", "4"].includes(item.eventClassificationId)
        )
        .map(async (event) => {
          try {
            const [competiorCount, eventResults, eventEntries, eventEntryfees] =
              await Promise.all([
                fetchWithRetry(
                  `${process.env.API_PATH}/competitorcount/${event.eventId}`
                ),
                fetchWithRetry(
                  `${process.env.API_PATH}/results/${event.eventId}`
                ),
                fetchWithRetry(
                  `${process.env.API_PATH}/entries/${event.eventId}`
                ),
                fetchWithRetry(
                  `${process.env.API_PATH}/entryfees/${event.eventId}`
                ),
              ]);

            event.competiorCount = competiorCount;
            event.results = eventResults;
            event.entries = eventEntries;
            event.entryfees = eventEntryfees;
          } catch (err) {
            console.error(
              `Error fetching data for event ${event.eventId}:`,
              err
            );
          }
          return event;
        })
    );
  } catch (err) {
    console.error("Error fetching events:", err);
  }
};

const batchInsert = async (data, table, options, batchSize = 1000) => {
  const insertedData = [];
  let error = null;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

    console.log(
      `Processing batch ${Math.ceil(i / batchSize) + 1} of ${table}...`
    );

    const { data: batchData, error: batchError } = await supabase
      .from(table)
      .upsert(batch, options)
      .select();

    if (batchError) {
      error = batchError;
    }

    if (batchData) {
      insertedData.push(...batchData);
    }
  }

  return { data: insertedData, error };
};

export const fetchAndInsertOrgs = async () => {
  const organisations = await fetchOrgs();
  const formattedOrganisations = formatOrganisations(organisations);

  const { data, error } = await supabase
    .from("organisations")
    .upsert(formattedOrganisations, { onConflict: "organisationId" })
    .select();

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
    }
  );

  const { data: classesData, error: classesError } = await batchInsert(
    formattedEvents.flatMap((item) => item.classes),
    "classes",
    {
      onConflict: "classId",
      ignoreDuplicates: false,
    }
  );

  const { data: runnersData, error: runnersError } = await batchInsert(
    filterAndMergeRunners(formattedEvents.flatMap((item) => item.runners)),
    "runners",
    {
      onConflict: "personId",
      ignoreDuplicates: false,
    }
  );

  const { data: resultsData, error: resultsError } = await batchInsert(
    formattedEvents.flatMap((item) => item.results),
    "results",
    {
      onConflict: "resultId",
      ignoreDuplicates: false,
    }
  );

  const { data: entriesData, error: entriesError } = await supabase
    .from("entries")
    .upsert(
      formattedEvents.flatMap((item) => item.entries),
      {
        onConflict: "entryId",
        ignoreDuplicates: false,
      }
    )
    .select();
  const { data: entryFeesData, error: entryFeesError } = await supabase
    .from("entryfees")
    .upsert(
      formattedEvents.flatMap((item) => item.entryFees),
      {
        onConflict: "entryFeeId",
        ignoreDuplicates: true,
      }
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
    return formattedEvent[0];
  } catch (err) {
    console.error(`Error fetching and formatting event ${eventId}:`, err);
  }
};

export const fetchEventsAndInsert = async (
  _startDate,
  _endDate,
  granularity = 15,
  dryrun = false
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

    console.log(">>>> START");
    console.time("fetch");
    const events = await fetchEvents(options);
    console.timeEnd("fetch");
    console.time("format");
    let formattedEvents = formatEvents(events);
    formattedEvents = formattedEvents.filter(
      (item) =>
        !item.event.organiserId.some((r) =>
          blackListedOrganisations.includes(r)
        )
    );
    console.timeEnd("format");

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
              item.fullName.includes("undefined")
          ),
        formattedEvents
          .flatMap((item) => item.results)
          .filter(
            (item) =>
              item.personId === "" ||
              item.personId === null ||
              item.personId === undefined ||
              item.personId.includes("undefined")
          )
      );
      console.log(`from ${startDate} to ${toDate}`);
      console.log("------------------------------------");
      console.log(
        `Fetched ${
          formattedEvents.flatMap((item) => item.event)?.length
        } events`
      );
      console.log(
        `Fetched ${
          formattedEvents.flatMap((item) => item.classes)?.length
        } classes`
      );
      console.log(
        `Fetched ${
          formattedEvents.flatMap((item) => item.runners)?.length
        } runners`
      );
      console.log(
        `Fetched ${
          formattedEvents.flatMap((item) => item.results)?.length
        } results`
      );
      console.log(
        `Fetched ${
          formattedEvents.flatMap((item) => item.entries)?.length
        } entries`
      );
      console.log(
        `Fetched ${
          formattedEvents.flatMap((item) => item.entryFees)?.length
        } entry fees`
      );
      console.log(">>>> END");
    }

    startDate.setDate(startDate.getDate() + granularity);
  }
};
