import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  filterAndMergeRunners,
  formatEvents,
  formatOrganisations,
} from "./helpers/index.js";

dotenv.config();

// Create a single supabase client for interacting with your database
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLIC_ANON_KEY
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

const fetchWithRetry = async (url, options, retries = 3, delay = 5000) => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error("Fetch failed");
    return response.json();
  } catch (error) {
    if (retries > 0) {
      console.warn(`Fetch failed, retrying in ${delay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay);
    } else {
      throw error;
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
          return event;
        })
    );
  } catch (err) {
    console.error(err);
  }
};

const fetchAndInsertOrgs = async () => {
  const organisations = await fetchOrgs();
  const formattedOrganisations = formatOrganisations(organisations);

  const { data, error } = await supabase
    .from("organisations")
    .upsert(formattedOrganisations, { onConflict: "organisationId" })
    .select();

  console.log(data, error);
};

const insertData = async (formattedEvents, startDate, toDate) => {
  const { data: eventsData, error: eventsError } = await supabase
    .from("events")
    .upsert(
      formattedEvents.map((item) => item.event),
      { onConflict: "eventId", ignoreDuplicates: false }
    )
    .select();
  const { data: classesData, error: classesError } = await supabase
    .from("classes")
    .upsert(formattedEvents.map((item) => item.classes).flat(), {
      onConflict: "classId",
      ignoreDuplicates: false,
    })
    .select();
  const { data: runnersData, error: runnersError } = await supabase
    .from("runners")
    .upsert(
      filterAndMergeRunners(formattedEvents.map((item) => item.runners).flat()),
      {
        onConflict: "personId",
        ignoreDuplicates: false,
      }
    )
    .select();
  const { data: resultsData, error: resultsError } = await supabase
    .from("results")
    .upsert(formattedEvents.map((item) => item.results).flat(), {
      onConflict: "resultId",
      ignoreDuplicates: false,
    })
    .select();
  const { data: entriesData, error: entriesError } = await supabase
    .from("entries")
    .upsert(formattedEvents.map((item) => item.entries).flat(), {
      onConflict: "entryId",
      ignoreDuplicates: false,
    })
    .select();
  const { data: entryFeesData, error: entryFeesError } = await supabase
    .from("entryfees")
    .upsert(formattedEvents.map((item) => item.entryFees).flat(), {
      onConflict: "entryFeeId",
      ignoreDuplicates: true,
    })
    .select();

  console.log("=====================================");
  console.log(`from ${startDate} to ${toDate}`);
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

    const events = await fetchEvents(options);
    let formattedEvents = formatEvents(events);
    formattedEvents = formattedEvents.filter(
      (item) =>
        !item.event.organiserId.some((r) =>
          blackListedOrganisations.includes(r)
        )
    );

    // console.log(formattedEvents.map((item) => item.event).flat());

    if (!dryrun) {
      await insertData(formattedEvents, options.fromDate, options.toDate);
    } else {
      console.log("=====================================");
      console.log(`from ${startDate} to ${toDate}`);
      console.log(
        `Fetched ${
          formattedEvents.map((item) => item.event).flat()?.length
        } events`
      );
      console.log(
        `Fetched ${
          formattedEvents.map((item) => item.classes).flat()?.length
        } classes`
      );
      console.log(
        `Fetched ${
          formattedEvents.map((item) => item.runners).flat()?.length
        } runners`
      );
      console.log(
        `Fetched ${
          formattedEvents.map((item) => item.results).flat()?.length
        } results`
      );
      console.log(
        `Fetched ${
          formattedEvents.map((item) => item.entries).flat()?.length
        } entries`
      );
      console.log(
        `Fetched ${
          formattedEvents.map((item) => item.entryFees).flat()?.length
        } entry fees`
      );
    }

    startDate.setDate(startDate.getDate() + granularity);
  }
};

// // Get the last 7 days of events
// const startDate = new Date().setDate(new Date().getDate() - 7);
// const endDate = new Date();

// const granularity = 10; // some times the database times out with larger granularities when there are big races being processed from Eventor
// const dryrun = true; // set to true if you just want the fetch data and not insert it into the database

// fetchEventsAndInsert(startDate, endDate, granularity, dryrun);
