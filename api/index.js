import EventorApi from "eventor-api";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

export const eventorApi = new EventorApi({
  eventorApiUrl: process.env.EVENTOR_PATH,
  apiKey: process.env.EVENTOR_APIKEY,
});

const app = express();
app.use(express.json());
app.use(cors());

app.get("/api", (req, res) => {
  res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
  res.status(200).send("API Ready to go");
});

app.get("/api/cron", async (req, res) => {
  if (req.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end("Unauthorized");
  }

  try {
    const { fetchEventsAndInsert, fetchAndInsertOrgs } = await import(
      "../src/process.js"
    );
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 7);

    await fetchAndInsertOrgs();
    await fetchEventsAndInsert(startDate, endDate, 7);

    res.status(200).end("Events imported for the last 7 days");
  } catch (error) {
    res.status(500).end(error);
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
