// Run: node --test
import test from "node:test";
import assert from "node:assert/strict";
import { formatEvents } from "./index.js";

const person = (id, given) => ({
  personId: id,
  personName: { given: { _: given }, family: "Nordmann" },
});
const entry = (id, given, result) => ({ person: person(id, given), ...result });
const cls = (eventClassId, name, personResult) => ({
  eventClass: { eventClassId, name },
  personResult,
});
const event = (extra) => ({
  eventId: "1",
  startDate: { date: "2026-04-11" },
  organiser: { organisationId: "303" },
  entries: [],
  ...extra,
});

test("knockout heats in one race count as one start per runner", () => {
  const ok = (resultId) => ({ result: { resultId, competitorStatus: { value: "OK" } } });
  const [{ event: e, results }] = formatEvents([
    event({
      eventRace: { eventRaceId: "20117" },
      competiorCount: [{ numberOfEntries: "5", numberOfStarts: "5" }],
      entries: [{ entryId: "e1" }, { entryId: "e2" }],
      results: [
        cls("10", "H 21-", [entry("1", "Ola", ok("a")), entry("2", "Kari", ok("b"))]),
        cls("11", "H 21 KV 1", [entry("1", "Ola", ok("c"))]),
        cls("12", "H 21 NM KO Total", [entry("1", "Ola", ok("d")), entry("2", "Kari", ok("e"))]),
      ],
    }),
  ]);
  assert.deepEqual(results.map((r) => r.classId), ["10", "10"]);
  assert.equal(e.numberOfStarts, 2);
  assert.equal(e.numberOfEntries, 2);
});

test("multi-day events keep one start per day and drop no-shows", () => {
  const race = (eventRaceId, resultId, value = "OK") => ({
    raceResult: { eventRaceId, result: { resultId, competitorStatus: { value } } },
  });
  const [{ event: e, results }] = formatEvents([
    event({
      eventRace: [{ eventRaceId: "1" }, { eventRaceId: "2" }],
      competiorCount: [{ numberOfEntries: "3", numberOfStarts: "2" }],
      results: [
        cls("10", "H 21-", [
          entry("1", "Ola", race("1", "a")),
          entry("1", "Ola", race("2", "b")),
          entry("2", "Kari", race("1", "c", "DidNotStart")),
        ]),
      ],
    }),
  ]);
  assert.equal(results.length, 2);
  assert.equal(e.numberOfStarts, 2);
  assert.equal(e.numberOfEntries, 3);
});
