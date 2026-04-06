function ensureArray(item) {
  if (item === undefined || item === null) {
    return [];
  }

  return Array.isArray(item) ? item : [item];
}

function toCamelcase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-åA-Å0-9]+(.)/g, (m, chr) => chr.toUpperCase());
}

function removeDuplicates(data, key) {
  const uniqueEntries = data.reduce((acc, current) => {
    const uniqueKey = current[key]; // Use the dynamic key passed as a parameter
    if (!acc.has(uniqueKey)) {
      acc.set(uniqueKey, current);
    }
    return acc;
  }, new Map());

  return Array.from(uniqueEntries.values());
}

const filterUniqueByKey = (data, uniqueKey) => {
  const uniqueItems = new Set();
  return data.filter((item) => {
    const key = item[uniqueKey];
    if (uniqueItems.has(key)) {
      return false;
    } else {
      uniqueItems.add(key);
      return true;
    }
  });
};

export const filterAndMergeRunners = (data) => {
  // Filter out duplicates based on personId, keeping those with empty personId
  const filteredData = data
    .filter((item, index, self) =>
      item.personId
        ? index === self.findIndex((t) => t.personId === item.personId)
        : true
    )
    .sort((a, b) => a.personId - b.personId);

  return filteredData;
};

export const formatRunners = (results, entries, event) => {
  const { eventForm } = event;
  const normalizedResults = ensureArray(results).filter(Boolean);
  const normalizedEntries = ensureArray(entries).filter(Boolean);

  if (eventForm === "RelaySingleDay") {
    const items = normalizedResults.length
      ? normalizedResults.flatMap((r) =>
          ensureArray(r.teamResult).flatMap((team) =>
            ensureArray(team.teamMemberResult).map((member) => ({
              ...member,
              organisation: team.organisation,
            }))
          )
        )
      : normalizedEntries.flatMap((item) => ensureArray(item.teamCompetitor));

    results = items
      .map((item) => {
        return {
          person: item?.person,
          organisation: item?.organisation || item?.organisationId,
        };
      })
      .filter((p) => Boolean(p.person));
  } else {
    results = normalizedResults.flatMap((item) =>
      item.personResult ? ensureArray(item.personResult) : []
    );
  }

  const data = results
    .filter((item) => Boolean(item?.person?.personName))
    .map((item) => {
      const fullName = `${item.person.personName.given._} ${item.person.personName.family}`;

      const birthDate = item.person?.birthDate?.date
        ? new Date(item.person.birthDate.date).toISOString()
        : null;

      const country = item.person.nationality?.country?.name
        ? item.person.nationality.country.name[0]?._
        : null;

      const personId = `${item.person.personId}-${toCamelcase(fullName)}`;

      return {
        personId: personId,
        gender: item.person.sex,
        fullName: fullName,
        birthDate: birthDate,
        nationality: country,
        organisationId: organisationIdRemap(item?.organisation?.organisationId),
      };
    });

  return filterUniqueByKey(data, "personId");
};

export const formatResults = (results, entries, event) => {
  const { eventId, eventForm, eventStatusId } = event;
  const normalizedResults = ensureArray(results).filter(Boolean);
  const normalizedEntries = ensureArray(entries).filter(Boolean);

  const items = normalizedResults.length ? normalizedResults : normalizedEntries;

  const data = items.flatMap((item) => {
    const personResult = ensureArray(item.personResult).filter(Boolean);
    const teamCompetitor = ensureArray(item.teamCompetitor).filter((p) =>
      Boolean(p?.person)
    );
    const teamResult = ensureArray(item?.teamResult)
      .flatMap((team) => ensureArray(team?.teamMemberResult))
      .filter(Boolean);

    let results = personResult;

    if (eventForm === "RelaySingleDay") {
      results = teamResult;
    }

    // If there are not results we use the entries to make an estimate of the results.
    // This only apoplies to relay events, as thats whats used especially for "Lagkonkuransen"
    // where many < 12y runners are and we want to track them in the system
    // OBS OBS: only do this for rases with eventStatusId === 12 since we only want to process
    // compleated races
    if (
      !results.length &&
      eventForm === "RelaySingleDay" &&
      eventStatusId === "9"
    ) {
      return teamCompetitor.map((entry) => {
        const fullName = `${entry.person.personName.given._} ${entry.person.personName.family}`;
        // const personId = entry.person.personId || fullName;
        const personId = `${entry.person.personId}-${toCamelcase(fullName)}`;

        return {
          resultId: `${entry.teamCompetitorId}${personId}`,
          classId: item.entryClass?.eventClassId,
          eventId: eventId,
          personId: personId,
          date: new Date(event?.startDate?.date)?.toISOString(),
          name: fullName,
        };
      });
    }

    return results
      .map((person) => {
        // If the person did not start or is inactive we dont want to include them in the results
        if (
          !person?.person?.personName ||
          person.result?.competitorStatus?.value === "DidNotStart" ||
          person.result?.competitorStatus?.value === "Inactive"
        ) {
          return null;
        }

        const fullName = `${person.person.personName.given._} ${person.person.personName.family}`;
        // const personId = person.person.personId || fullName;
        const personId = `${person.person.personId}-${toCamelcase(fullName)}`;
        const resultId =
          person.result?.resultId ||
          person.raceResult?.result?.resultId ||
          `${eventId}${person.bibNumber}${personId}`;

        return {
          resultId: resultId,
          classId: item.eventClass?.eventClassId,
          eventId: eventId,
          personId: personId,
          date: new Date(event?.startDate?.date)?.toISOString(),
          name: fullName,
        };
      })
      .filter(Boolean);
  });

  return filterUniqueByKey(
    data.filter((item) => Boolean(item?.personId)),
    "resultId"
  );
};

export const formatEntries = (_entries, event) => {
  const { eventId, eventForm } = event;
  const entries = ensureArray(_entries).filter(Boolean);

  const data = entries.flatMap((item) => {
    if (eventForm === "RelaySingleDay") {
      return ensureArray(item.teamCompetitor)
        .map((teamMember) => ({
          entryId: `${item.entryId}${teamMember?.person?.personId}`,
          classId: item.entryClass?.eventClassId,
          eventId: eventId,
          personId: teamMember?.person?.personId,
          date: new Date(event?.startDate?.date)?.toISOString(),
        }))
        .filter((entry) => Boolean(entry.personId));
    }

    return {
      entryId: item.entryId,
      classId: item.entryClass?.eventClassId,
      eventId: eventId,
      personId: item.competitor?.competitorId,
    };
  });

  return removeDuplicates(data.filter((item) => Boolean(item.entryId)), "entryId");
};

export const formatClasses = (results, entries, event) => {
  const { eventId } = event;

  let items = ensureArray(results)
    .filter(Boolean)
    .map((item) => ({ ...item.eventClass }));

  if (items.length === 0) {
    items = ensureArray(entries)
      .filter(Boolean)
      .map((item) => ({ ...item.entryClass }));
  }

  const data = items.map((item) => {
    return {
      classId: item?.eventClassId,
      eventId: eventId,
      name: item?.name,
      shortName: item?.classShortName,
      lowAge: parseInt(item?.lowAge),
      highAge: parseInt(item?.highAge),
      sex: item?.sex,
      type: item?.classTypeId,
    };
  });

  return removeDuplicates(data, "classId");
};

export const formatEntryFees = (entryFees, event) => {
  const { eventId } = event;

  const estimateClassType = (name) => {
    return name?.toLowerCase().includes("åpen") ? "open" : "normal";
  };

  return ensureArray(entryFees).filter(Boolean).map((item) => ({
    eventId: eventId,
    entryFeeId: item.entryFeeId,
    name: item.name,
    amount: parseInt(item.amount._),
    type: item.type === "elite" ? estimateEntryFeeType(item.name) : item.type,
    valueOperator: item?.valueOperator,
    order: estimateOrder(item.name),
    classType: estimateClassType(item.name),
  }));
};

export const formatRaceData = (_results, _entries, _entryFees, event) => {
  const runners = formatRunners(_results, _entries, event);

  const classes = formatClasses(_results, _entries, event);

  const entryFees = formatEntryFees(_entryFees, event);

  // Since entries does not contain any person info except for the personId
  // we have to filter it out (we basicly have no way of knowing what runenrs excists without the results)
  const validPersonIds = new Set(runners.map((cls) => cls.personId));
  const validClassIds = new Set(classes.map((cls) => cls.classId));
  const entries = formatEntries(_entries, event).filter(
    (item) =>
      validClassIds.has(item.classId) && validPersonIds.has(item.personId)
  );

  const results = formatResults(_results, _entries, event);

  return { classes, entries, results, runners, entryFees };
};

export const formatEvents = (events) => {
  // TODO handle cancelled events, dont save competitors
  // item.eventStatusId === "10"
  return ensureArray(events)
    .filter(Boolean)
    .map((item) => {
      try {
        const { classes, entries, results, runners, entryFees } =
          formatRaceData(item.results, item.entries, item.entryfees, item);

        const organiser = item.organiser || {};
        let organisationId = ensureArray(
          organiser.organisationId || organiser.organisation?.organisationId
        ).filter(Boolean);

        if (!organisationId.length && Array.isArray(organiser.organisation)) {
          organisationId = organiser.organisation
            .map((org) => org?.organisationId)
            .filter(Boolean);
        }

        const disciplineId = ensureArray(item.disciplineId);
        const eventLocation = ensureArray(item.eventRace)[0]?.eventCenterPosition;
        const competitorCount = ensureArray(item.competiorCount);

        let numberOfEntries =
          competitorCount[0]?.numberOfEntries === "0"
            ? entries.length
            : parseInt(competitorCount[0]?.numberOfEntries || 0);

        let numberOfStarts =
          competitorCount[0]?.numberOfStarts === "0"
            ? results.length
            : parseInt(competitorCount[0]?.numberOfStarts || 0);

        // Make exceptions for relay events so we count the number of starts as
        // personal starts and not team starts
        if (item.eventForm === "RelaySingleDay") {
          numberOfEntries = Math.max(numberOfEntries, entries.length);
          numberOfStarts = Math.max(numberOfStarts, results.length);
        }

        // If we don't have any results or there are no registered starts on the event,
        // we assume that it was at least as many starts as entries
        if (numberOfStarts === 0) {
          numberOfStarts = numberOfEntries;
        }

        return {
          event: {
            eventId: item.eventId,
            name: item.name,
            organiserId: organisationId.map(organisationIdRemap),
            startDate: item.startDate?.date
              ? new Date(item.startDate.date).toISOString()
              : null,
            disciplineId: disciplineId[0],
            classificationId: item.eventClassificationId,
            distance: item.eventRace?.raceDistance,
            lightConditions: item.eventRace?.raceLightCondition,
            numberOfEntries: numberOfEntries,
            numberOfStarts: numberOfStarts,
            location: eventLocation,
            punchingUnitType: item.punchingUnitType?.value,
          },
          classes,
          entries,
          results,
          runners,
          entryFees,
        };
      } catch (error) {
        console.error(`Error formatting event ${item?.eventId}:`, error);
        return null;
      }
    })
    .filter(Boolean);
};

export const formatOrganisations = (organisations) => {
  return ensureArray(organisations).filter(Boolean).map((item) => {
    return {
      organisationId: item.organisationId,
      type: item.organisationTypeId,
      name: item.name,
      countryName: item.country.name[0],
      parentOrganisationId: item.parentOrganisation?.organisationId,
    };
  });
};

const organisationIdRemap = (organisationId) => {
  // If there is no organisationId we set it to "Klubbløs" which is a custom organisationId in the database
  if (!organisationId) {
    return null;
  }

  if (organisationId === "18") {
    return "4"; // Agder O-krets -> Agder O-krets
  } else if (organisationId === "7") {
    return "12"; // Hedmark -> Innlandet
  } else if (organisationId === "16") {
    return "19"; // Telemark -> Vestfold og Telemark
  }

  return organisationId;
};

const estimateEntryFeeType = (name) => {
  const lowerName = name?.toLowerCase() || "";
  if (lowerName?.includes("voks")) return "adult";
  if (lowerName?.includes("ungdom")) return "youth";
  if (lowerName?.includes("barn") || lowerName?.includes("N-åpen"))
    return "kids";
  return "notSpecified";
};

const estimateOrder = (name) => {
  const lowerName = name?.toLowerCase();
  if (lowerName?.includes("ordinær") || lowerName?.includes("påmelding"))
    return 0;
  if (lowerName?.includes("etteranmelding")) return 1;
  return;
};

const disciplineLookup = (discipline) => {
  switch (discipline) {
    case "1":
      return "Orientering";
    case "3":
      return "Skiorientering";
    case "2":
      return "MTBO";
    case "4":
      return "PREO";
    default:
      return "Unknown";
  }
};

const classificationLookup = (classification) => {
  switch (classification) {
    case "0":
      return "Internasjonalt";
    case "2":
      return "Nasjonalt";
    case "3":
      return "Krets";
    case "4":
      return "Nærløp";
    case "5":
      return "Trening";
    default:
      return "Unknown";
  }
};
