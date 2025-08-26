import EventorApi from "eventor-api";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cron from "node-cron";

dotenv.config();

export const eventorApi = new EventorApi({
  eventorApiUrl: process.env.EVENTOR_PATH,
  apiKey: process.env.EVENTOR_APIKEY,
});

const app = express();
app.use(express.json());
app.use(cors());

// Extract cron job functionality to reusable function
async function updateEventsData() {
  console.log("Fetching new events");
  try {
    const { fetchEventsAndInsert, fetchAndInsertOrgs } = await import(
      "../src/process.js"
    );
    const startDate = new Date();
    const endDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    await fetchAndInsertOrgs();
    await fetchEventsAndInsert(startDate, endDate, 7);

    console.log(
      "Events update completed successfully: Events imported for the last 7 days"
    );
    return true;
  } catch (error) {
    console.error("Error updating events data:", error);
    return false;
  }
}

cron.schedule(
  "0 1 * * *",
  async () => {
    console.log(`Daily cron job started for ${new Date().toISOString()}`);
    await updateEventsData();
  },
  {
    scheduled: true,
    timezone: "Europe/Stockholm",
  }
);

app.get("/api", (req, res) => {
  res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
  res.status(200).send("API Ready to go");
});

// Add new endpoint to manually trigger update
app.get("/api/force-update", async (req, res) => {
  console.log("Manual update triggered");
  try {
    const success = await updateEventsData();
    if (success) {
      res.status(200).json({ message: "Update completed successfully" });
    } else {
      res.status(500).json({ message: "Update failed" });
    }
  } catch (error) {
    console.error("Error in force update:", error);
    res
      .status(500)
      .json({ message: "Error processing update", error: error.message });
  }
});

app.get("/api/events", async (req, res) => {
  try {
    const response = await eventorApi.events(req.query);
    res.json(response);
  } catch (error) {
    res.status;
  }
});

app.get("/api/event/:eventId", async (req, res) => {
  const { eventId } = req.params;
  try {
    const response = await eventorApi.event(eventId);
    res.json(response);
  } catch (error) {
    res.status;
  }
});

app.get("/api/entryfees/:eventId", async (req, res) => {
  const { eventId } = req.params;
  try {
    const response = await eventorApi.entryfees(eventId);
    res.json(response);
  } catch (error) {
    res.status;
  }
});

app.get("/api/results/:eventId", async (req, res) => {
  const { eventId } = req.params;
  try {
    const response = await eventorApi.results({ eventId: eventId });
    res.json(response);
  } catch (error) {
    res.status;
  }
});

app.get("/api/starts/:orgNumber/:raceId", async (req, res) => {
  const { orgNumber, raceId } = req.params;
  try {
    const response = await eventorApi.starts(orgNumber, raceId);
    res.json(response);
  } catch (error) {
    res.status;
  }
});

app.get("/api/competitorcount/:raceId", async (req, res) => {
  const { raceId } = req.params;
  try {
    const response = await eventorApi.competitorCount([], [raceId]);
    res.json(response);
  } catch (error) {
    res.status;
  }
});

app.get("/api/entries", async (req, res) => {
  try {
    const response = await eventorApi.entries(req.query);
    res.json(response);
  } catch (error) {
    res.status;
  }
});

app.get("/api/entries/:eventId", async (req, res) => {
  const { eventId } = req.params;
  try {
    const response = await eventorApi.entries({ eventIds: eventId });
    res.json(response);
  } catch (error) {
    res.status;
  }
});

app.get("/api/organisation/:orgNumber", async (req, res) => {
  const { orgNumber } = req.params;
  try {
    const response = await eventorApi.organisation(orgNumber);
    res.json(response);
  } catch (error) {
    res.status;
  }
});
app.get("/api/persons/organisations/:orgNumber", async (req, res) => {
  const { orgNumber } = req.params;
  try {
    const response = await eventorApi.personsByOrg(orgNumber);
    res.json(response);
  } catch (error) {
    res.status;
  }
});

app.get("/api/organisations", async (req, res) => {
  try {
    const response = await eventorApi.organisations();
    res.json(response);
  } catch (error) {
    res.status;
  }
});

app.get("/api/person/:personId", async (req, res) => {
  const { personId } = req.params;
  try {
    const response = await eventorApi.person(personId);
    res.json(response);
  } catch (error) {
    res.status;
  }
});

// Serve static files from the 'public' directory
app.use(express.static("dist"));

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

export default app;
