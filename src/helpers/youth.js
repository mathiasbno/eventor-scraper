import { formatEvents } from "./index.js";

// ─── Private time helpers ────────────────────────────────────────────────────

const timeStringToSeconds = (timeStr) => {
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 2) {
    parts.unshift(0);
  }
  return parts.reduce(
    (total, part, index) =>
      total + part * Math.pow(60, parts.length - 1 - index),
    0,
  );
};

const secondsToTimeString = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((v) => v.toString().padStart(2, "0"))
    .join(":");
};

const computeMedian = (sortedArr) => {
  if (sortedArr.length === 0) return null;
  const mid = Math.floor(sortedArr.length / 2);
  return sortedArr.length % 2 === 0
    ? Math.round((sortedArr[mid - 1] + sortedArr[mid]) / 2)
    : sortedArr[mid];
};

// ─── Class name normalisation ────────────────────────────────────────────────
// Only the TrimTex classes count; åpen/N/C/B and stray "løype" classes are
// dropped. Handles "D13-14" (no space) and the "jatkstart" typo seen in Eventor.
const CLASS_RE = /^([DH])\s?(11-12|13-14|15-16)(\s+ja[kt]+start)?$/i;

const normalizeClassName = (name = "") => {
  const m = name.trim().match(CLASS_RE);
  if (!m) return null;
  return `${m[1].toUpperCase()} ${m[2]}${m[3] ? " jaktstart" : ""}`;
};

// An event that has both "D 13-14" and "D 13-14 jaktstart" is a prolog +
// jaktstart on the same day. Split it into two rows; the prolog row drops
// numberTTStarts so the event total is not counted twice.
const splitJaktstart = (base, grouped) => {
  const entries = Object.entries(grouped);
  const jakt = entries.filter(([k]) => k.endsWith(" jaktstart"));
  if (!jakt.length) return [{ ...base, ...grouped }];

  const prolog = Object.fromEntries(
    entries.filter(([k]) => !k.endsWith(" jaktstart")),
  );
  const jaktstart = Object.fromEntries(
    jakt.map(([k, v]) => [k.replace(" jaktstart", ""), v]),
  );
  return [
    { ...base, name: `${base.name} prolog`, numberTTStarts: null, ...prolog },
    { ...base, name: `${base.name} jaktstart`, ...jaktstart },
  ];
};

// ─── Exports ─────────────────────────────────────────────────────────────────

/**
 * Groups a flat results array by className and computes per-class time
 * statistics (min/max/avg/median finish times and time-behind-winner diffs).
 *
 * Output shape:
 *   {
 *     "H 13-14": { numberOfStarts, numberOfDNF, maxTime, minTime, avgTime,
 *                  medianTime, medianDiff, maxDiff, avgDiff },
 *     ...
 *   }
 */
export const computeGroupedResults = (results) => {
  const grouped = results.reduce((acc, result) => {
    const className = normalizeClassName(result.className);
    if (!className) return acc;
    if (!acc[className]) {
      acc[className] = [];
    }
    acc[className].push(result);
    return acc;
  }, {});

  Object.keys(grouped).forEach((className) => {
    const classResults = grouped[className];

    const timesInSeconds = classResults
      .map((r) => r.time)
      .filter(Boolean)
      .map(timeStringToSeconds);

    const timeDiffsInSeconds = classResults
      .map((r) => r.timeDiff)
      .filter(Boolean)
      .map(timeStringToSeconds);

    const numberOfDNF = classResults.filter(
      (item) =>
        item.status === "Disqualified" || item.status === "DidNotFinish",
    ).length;

    if (timesInSeconds.length > 0) {
      const sortedTimes = [...timesInSeconds].sort((a, b) => a - b);
      const maxTime = Math.max(...timesInSeconds);
      const minTime = Math.min(...timesInSeconds);
      const avgTime = Math.round(
        timesInSeconds.reduce((sum, t) => sum + t, 0) / timesInSeconds.length,
      );
      const medianTime = computeMedian(sortedTimes);

      let medianDiff = null;
      let maxDiff = null;
      let avgDiff = null;
      if (timeDiffsInSeconds.length > 0) {
        const sortedDiffs = [...timeDiffsInSeconds].sort((a, b) => a - b);
        medianDiff = computeMedian(sortedDiffs);
        maxDiff = Math.max(...timeDiffsInSeconds);
        avgDiff = Math.round(
          timeDiffsInSeconds.reduce((sum, t) => sum + t, 0) /
            timeDiffsInSeconds.length,
        );
      }

      grouped[className] = {
        numberOfStarts: classResults.length,
        numberOfDNF,
        maxTime: secondsToTimeString(maxTime),
        minTime: secondsToTimeString(minTime),
        avgTime: secondsToTimeString(avgTime),
        medianTime:
          medianTime !== null ? secondsToTimeString(medianTime) : null,
        medianDiff:
          medianDiff !== null ? secondsToTimeString(medianDiff) : null,
        maxDiff: maxDiff !== null ? secondsToTimeString(maxDiff) : null,
        avgDiff: avgDiff !== null ? secondsToTimeString(avgDiff) : null,
      };
    } else {
      grouped[className] = {
        numberOfStarts: classResults.length,
        numberOfDNF,
      };
    }
  });

  return grouped;
};

/**
 * Formats raw Eventor events into the youth file-output structure.
 *
 * Output shape per event:
 *   {
 *     eventId, name, link, startDate, distance, lightConditions,
 *     numberTTStarts,
 *     // per-class stats spread at the top level (e.g. "H 13-14": { ... }),
 *   }
 */
export const formatYouthEvents = (events) => {
  return formatEvents(events).flatMap((item) => {
    const groupedResults = computeGroupedResults(item.results);

    const base = {
      eventId: item.event.eventId,
      name: item.event.name,
      link: `https://eventor.orientering.no/Events/Show/${item.event.eventId}`,
      startDate: item.event.startDate
        ? new Date(item.event.startDate).toLocaleDateString("no-NO")
        : null,
      distance: item.event.distance,
      lightConditions: item.event.lightConditions,
      numberTTStarts: item.event.numberOfStarts,
    };
    return splitJaktstart(base, groupedResults);
  });
};
