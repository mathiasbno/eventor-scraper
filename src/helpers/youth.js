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
    const { className } = result;
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
 *     event, classes, entries, results, runners, entryFees,
 *   }
 */
export const formatYouthEvents = (events) => {
  return formatEvents(events).map((item) => {
    const groupedResults = computeGroupedResults(item.results);

    return {
      eventId: item.event.eventId,
      name: item.event.name,
      link: `https://eventor.orientering.no/Events/Show/${item.event.eventId}`,
      startDate: item.event.startDate
        ? new Date(item.event.startDate).toLocaleDateString("no-NO")
        : null,
      distance: item.event.distance,
      lightConditions: item.event.lightConditions,
      numberTTStarts: item.event.numberOfStarts,
      ...groupedResults,
      event: item.event,
      classes: item.classes,
      entries: item.entries,
      results: item.results,
      runners: item.runners,
      entryFees: item.entryFees,
    };
  });
};
