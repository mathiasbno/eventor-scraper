import xml2js from "xml2js";

const { parseStringPromise, processors } = xml2js;

const toArray = (value) =>
  value == null ? [] : Array.isArray(value) ? value : [value];

// GET an Eventor API path and parse the XML. Env is read per call because
// dotenv.config() runs after this module is imported.
async function get(path, query, withAttrs = true) {
  const qs = query ? `?${new URLSearchParams(query)}` : "";
  const response = await fetch(`${process.env.EVENTOR_PATH}${path}${qs}`, {
    headers: { ApiKey: process.env.EVENTOR_APIKEY },
  });
  if (!response.ok) {
    throw new Error(`Eventor ${path} failed: HTTP ${response.status}`);
  }
  return parseStringPromise(await response.text(), {
    explicitArray: false,
    ignoreAttrs: !withAttrs,
    mergeAttrs: withAttrs,
    tagNameProcessors: [processors.firstCharLowerCase],
  });
}

export const events = async (query) =>
  toArray((await get("events", query))?.eventList?.event);

export const event = async (eventId) =>
  toArray((await get(`event/${eventId}`))?.event);

export const entryfees = async (eventId) =>
  toArray((await get(`entryfees/events/${eventId}`))?.entryFeeList?.entryFee);

export const entries = async (query) =>
  (await get("entries", query))?.entryList?.entry || [];

export const competitorCount = async (organisationIds, eventIds) =>
  toArray(
    (
      await get("competitorcount", {
        organisationIds: organisationIds.join(),
        eventIds: eventIds.join(),
      })
    )?.competitorCountList?.competitorCount,
  );

export const starts = async (organisationId, eventId) =>
  toArray(
    (
      await get("starts/organisation", {
        organisationIds: organisationId,
        eventId,
      })
    )?.startList?.classStart,
  );

export const results = async (query) =>
  toArray((await get("results/event", query))?.resultList?.classResult);

export const personsByOrg = (organisationId) =>
  get(`persons/organisations/${organisationId}`, null, false);

export const person = (personId) => get(`competitor/${personId}`, null, false);

export const organisation = async (organisationId) =>
  (await get(`organisation/${organisationId}`, null, false))?.organisation;

export const organisations = async () =>
  (await get("organisations", null, false))?.organisationList?.organisation;
