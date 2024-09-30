function ensureArray(item) {
  return Array.isArray(item) ? item : [item];
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

export const formatRunners = (results, event) => {
  const { eventForm } = event;

  if (eventForm === "RelaySingleDay") {
    results = results
      .map((r) =>
        ensureArray(r.teamResult).map((item) => item.teamMemberResult)
      )
      .flat(Infinity)
      .map((item) => ({
        person: item.person,
        organisation: item.organisation,
      }))
      .filter((item) => Boolean(item?.person?.personId));
  } else {
    results = results
      .map((item) => {
        if (!item.personResult) {
          return [];
        }

        return ensureArray(item.personResult)
          ? item.personResult
          : [item.personResult];
      })
      .flat()
      .filter((item) => Boolean(item?.person?.personId));
  }

  const data = results.map((item) => {
    const birthDate = !!item.person?.birthDate?.date
      ? new Date(item.person?.birthDate?.date)?.toISOString()
      : null;

    return {
      personId: item.person.personId,
      gender: item.person.sex,
      fullName:
        item.person.personName.given._ + " " + item.person.personName.family,
      birthDate: birthDate,
      nationality: item.person.nationality?.country?.name[0]._,
      organisationId: organisationIdRemap(item?.organisation?.organisationId),
    };
  });

  return data;
};

export const formatResults = (results, event) => {
  const { eventId, eventForm } = event;
  const data = results
    .map((item) => {
      if (!item.personResult?.length && !item.teamResult?.length) {
        return [];
      }

      const personResult = ensureArray(item.personResult);
      const teamResult = ensureArray(
        item?.teamResult?.map((item) => item?.teamMemberResult)
      ).flat();

      let results = personResult;

      if (eventForm === "RelaySingleDay") {
        results = teamResult;
      }

      return [
        ...results.map((person) => {
          const resultId =
            person.result?.resultId ||
            person.raceResult?.result?.resultId ||
            eventId + person.bibNumber;

          return {
            resultId: resultId,
            classId: item.eventClass?.eventClassId,
            eventId: eventId,
            personId: person.person.personId,
            date: new Date(event?.startDate?.date)?.toISOString(),
            name:
              person.person.personName.given._ +
              " " +
              person.person.personName.family,
          };
        }),
      ];
    })
    .flat()
    .filter((item) => Boolean(item.personId));

  return data;
};

export const formatEntries = (_entries, event) => {
  const { eventId } = event;
  let entries = ensureArray(_entries);

  const data = entries
    .map((item) => {
      if (item?.teamCompetitor?.length) {
        return item.teamCompetitor.map((teamMember) => ({
          entryId: item.entryId,
          classId: item.entryClass.eventClassId,
          eventId: eventId,
          personId: teamMember?.person?.personId,
          date: new Date(event?.startDate?.date)?.toISOString(),
        }));
      }

      // if (!item.competitor?.competitorId) console.log(eventId, item);

      return {
        entryId: item.entryId,
        classId: item.entryClass.eventClassId,
        eventId: eventId,
        personId: item.competitor?.competitorId,
      };
    })
    .flat();

  return removeDuplicates(data, "classId");
};

export const formatClasses = (results, event) => {
  const { eventId } = event;

  const data = results
    .filter((item) => item.eventClass)
    .map((item) => {
      return {
        classId: item.eventClass?.eventClassId,
        eventId: eventId,
        name: item.eventClass.name,
        shortName: item.eventClass.classShortName,
        lowAge: parseInt(item.eventClass.lowAge),
        highAge: parseInt(item.eventClass.highAge),
        sex: item.eventClass.sex,
        type: item.eventClass.classTypeId,
      };
    });

  return data;
};

export const formatEntryFees = (entryFees, event) => {
  const { eventId } = event;

  const estimateType = (name) => {
    if (name?.toLowerCase().includes("voks")) {
      return "adult";
    }
    if (name?.toLowerCase().includes("ungdom")) {
      return "youth";
    }
    if (name?.toLowerCase().includes("barn")) {
      return "kids";
    }
    return "notSpecified";
  };

  const estimateOrder = (name) => {
    if (
      name?.toLowerCase().includes("ordinær") ||
      name?.toLowerCase().includes("påmelding")
    ) {
      return 0;
    }
    if (name?.toLowerCase().includes("etteranmelding")) {
      return 1;
    }
    return;
  };

  const estimateClassType = (name) => {
    if (name?.toLowerCase().includes("åpen")) {
      return "open";
    }
    return "normal";
  };

  return entryFees.map((item) => {
    return {
      eventId: eventId,
      entryFeeId: item.entryFeeId,
      name: item.name,
      amount: parseInt(item.amount._),
      type: item.type === "elite" ? estimateType(item.name) : item.type,
      valueOperator: item?.valueOperator,
      order: estimateOrder(item.name),
      classType: estimateClassType(item.name),
    };
  });
};

export const formatRaceData = (_results, _entries, _entryFees, event) => {
  const runners = formatRunners(_results, event);

  const classes = formatClasses(_results, event);

  const entryFees = formatEntryFees(_entryFees, event);

  const validClassIds = new Set(classes.map((cls) => cls.classId));
  const entries = formatEntries(_entries, event).filter(
    (item) =>
      Boolean(item.personId) &&
      runners.find((r) => r.personId === item.personId) &&
      validClassIds.has(item.classId)
  );

  const results = formatResults(_results, event);

  return { classes, entries, results, runners, entryFees };
};

export const formatEvents = (events) => {
  const data = events.map((item) => {
    const { classes, entries, results, runners, entryFees } = formatRaceData(
      item.results,
      item.entries,
      item.entryfees,
      item
    );

    let organisationId = ensureArray(
      item.organiser.organisationId ||
        item.organiser.organisation.organisationId
    ).filter(Boolean);

    if (!organisationId.length && item.organiser.organisation.length) {
      organisationId = item.organiser.organisation?.map(
        (item) => item.organisationId
      );
    }

    const disciplineId = ensureArray(item.disciplineId);

    const numberOfEntries =
      item.competiorCount[0]?.numberOfEntries === "0"
        ? entries.length
        : parseInt(item.competiorCount[0]?.numberOfEntries || 0);

    let numberOfStarts =
      item.competiorCount[0]?.numberOfStarts === "0"
        ? results.length
        : parseInt(item.competiorCount[0]?.numberOfStarts || 0);

    // Make exceptions for relay events so we count the number of starts as
    // personal starts and not team starts
    if (item.eventForm === "RelaySingleDay") {
      if (numberOfStarts < results.length) {
        numberOfStarts = results.length;
      }
    }

    // If we dont have any results or there are no registered starts on the event we just asume that
    // it was at least as many starts as entries
    if (numberOfStarts === 0) {
      numberOfStarts = numberOfEntries;
    }

    return {
      event: {
        eventId: item.eventId,
        name: item.name,
        organiserId: organisationId.map((item) => organisationIdRemap(item)),
        startDate: new Date(item.startDate.date).toISOString(),
        disciplineId: disciplineId[0],
        classificationId: item.eventClassificationId,
        distance: item.eventRace?.raceDistance,
        lightConditions: item.eventRace?.raceLightCondition,
        numberOfEntries: numberOfEntries,
        numberOfStarts: numberOfStarts,
        location: item.eventRace?.eventCenterPosition,
        punchingUnitType: item.punchingUnitType?.value,
      },
      classes: classes,
      entries: entries,
      results: results,
      runners: runners,
      entryFees: entryFees,
    };
  });

  return data;
};

export const formatOrganisations = (organisations) => {
  return organisations.map((item) => {
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
  if (organisationId === "18") {
    return "4"; // Agder O-krets -> Agder O-krets
  } else if (organisationId === "7") {
    return "12"; // Hedmark -> Innlandet
  } else if (organisationId === "16") {
    return "19"; // Telemark -> Vestfold og Telemark
  }

  return organisationId;
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
