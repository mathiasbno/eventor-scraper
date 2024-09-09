import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  filterAndMergeRunners,
  formatEvents,
  formatOrganisations,
} from "./helpers/index.js";

dotenv.config();

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
  return await fetch(`http://localhost:4000/api/persons/organisations/${orgId}`)
    .then((response) => response.json())
    .then((persons) => persons)
    .catch((err) => console.error(err));
};

const fetchOrgs = async () => {
  return await fetch("http://localhost:4000/api/organisations")
    .then((response) => response.json())
    .then((orgs) => orgs)
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
      `http://localhost:4000/api/events?${params}`
    );

    return Promise.all(
      events
        .filter((item) =>
          ["0", "1", "2", "3", "4"].includes(item.eventClassificationId)
        )
        .map(async (event) => {
          const [competiorCount, eventResults, eventEntries] =
            await Promise.all([
              fetchWithRetry(
                `http://localhost:4000/api/competitorcount/${event.eventId}`
              ),
              fetchWithRetry(
                `http://localhost:4000/api/results/${event.eventId}`
              ),
              fetchWithRetry(
                `http://localhost:4000/api/entries/${event.eventId}`
              ),
            ]);
          event.competiorCount = competiorCount;
          event.results = eventResults;
          event.entries = eventEntries;
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

// Create a single supabase client for interacting with your database
const supabase = createClient(
  "https://zhmjbteiremuhyelwbar.supabase.co",
  process.env.VITE_SUPABASE_PUBLIC_ANON_KEY
);

const insertData = async (formattedEvents, startDate, toDate) => {
  const { data: eventsData, error: eventsError } = await supabase
    .from("events")
    .upsert(
      formattedEvents.map((item) => item.event),
      { onConflict: "eventId" }
    )
    .select();
  const { data: classesData, error: classesError } = await supabase
    .from("classes")
    .upsert(formattedEvents.map((item) => item.classes).flat(), {
      onConflict: "classId",
    })
    .select();
  const { data: runnersData, error: runnersError } = await supabase
    .from("runners")
    .upsert(
      filterAndMergeRunners(formattedEvents.map((item) => item.runners).flat()),
      {
        onConflict: "personId",
      }
    )
    .select();
  const { data: resultsData, error: resultsError } = await supabase
    .from("results")
    .upsert(formattedEvents.map((item) => item.results).flat(), {
      onConflict: "resultId",
    })
    .select();
  const { data: entriesData, error: entriesError } = await supabase
    .from("entries")
    .upsert(formattedEvents.map((item) => item.entries).flat(), {
      onConflict: "entryId",
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
};

const fetchEventsAndInsert = async (_startDate, _endDate, granularity = 15) => {
  let startDate = _startDate;
  let endDate = _endDate;
  let toDate = new Date(startDate);

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
    const formattedEvents = formatEvents(events);

    await insertData(formattedEvents, options.fromDate, options.toDate);

    startDate.setDate(startDate.getDate() + granularity);
  }
};

const startDate = new Date("2016-07-02 00:00:00");
const endDate = new Date("2017-01-01 00:00:00");

// fetchEventsAndInsert(startDate, endDate, 10);
