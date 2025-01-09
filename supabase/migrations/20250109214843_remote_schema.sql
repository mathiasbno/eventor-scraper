set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_events_by_classification_granularity(granularity text, organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE(period text, number_of_events_international bigint, number_of_events_championchip bigint, number_of_events_national bigint, number_of_events_regional bigint, number_of_events_local bigint, total_entries_international bigint, total_entries_championchip bigint, total_entries_national bigint, total_entries_regional bigint, total_entries_local bigint, total_starts_international bigint, total_starts_championchip bigint, total_starts_national bigint, total_starts_regional bigint, total_starts_local bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
      get_period_by_granularity(granularity, events."startDate") AS period,
      COUNT(events."eventId") FILTER (WHERE classifications."classificationId" = '0') AS number_of_events_international,
      COUNT(events."eventId") FILTER (WHERE classifications."classificationId" = '1') AS number_of_events_championchip,
      COUNT(events."eventId") FILTER (WHERE classifications."classificationId" = '2') AS number_of_events_national,
      COUNT(events."eventId") FILTER (WHERE classifications."classificationId" = '3') AS number_of_events_regional,
      COUNT(events."eventId") FILTER (WHERE classifications."classificationId" = '4') AS number_of_events_local,
      SUM(events."numberOfEntries") FILTER (WHERE classifications."classificationId" = '0') AS total_entries_international,
      SUM(events."numberOfEntries") FILTER (WHERE classifications."classificationId" = '1') AS total_entries_championchip,
      SUM(events."numberOfEntries") FILTER (WHERE classifications."classificationId" = '2') AS total_entries_national,
      SUM(events."numberOfEntries") FILTER (WHERE classifications."classificationId" = '3') AS total_entries_regional,
      SUM(events."numberOfEntries") FILTER (WHERE classifications."classificationId" = '4') AS total_entries_local,
      SUM(events."numberOfStarts") FILTER (WHERE classifications."classificationId" = '0') AS total_starts_international,
      SUM(events."numberOfStarts") FILTER (WHERE classifications."classificationId" = '1') AS total_starts_championchip,
      SUM(events."numberOfStarts") FILTER (WHERE classifications."classificationId" = '2') AS total_starts_national,
      SUM(events."numberOfStarts") FILTER (WHERE classifications."classificationId" = '3') AS total_starts_regional,
      SUM(events."numberOfStarts") FILTER (WHERE classifications."classificationId" = '4') AS total_starts_local
  FROM get_distinct_events(organisation_ids, discipline_list, 'all') AS events
  INNER JOIN classifications ON events."classificationId" = classifications."classificationId"
  GROUP BY get_period_by_granularity(granularity, events."startDate")
  ORDER BY period ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_events_by_discipline(granularity text, organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE(period text, number_of_events bigint, total_entries bigint, total_starts bigint, total_starts_o bigint, total_starts_m bigint, total_starts_s bigint, total_starts_p bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
      get_period_by_granularity(granularity, events."startDate") AS period,
      COUNT(events."eventId") AS number_of_events,
      SUM(events."numberOfEntries") AS total_entries,
      SUM(events."numberOfStarts") AS total_starts,
      SUM(events."numberOfStarts") FILTER (WHERE events."disciplineId" = '1') AS total_starts_o,
      SUM(events."numberOfStarts") FILTER (WHERE events."disciplineId" = '2') AS total_starts_m,
      SUM(events."numberOfStarts") FILTER (WHERE events."disciplineId" = '3') AS total_starts_s,
      SUM(events."numberOfStarts") FILTER (WHERE events."disciplineId" = '4') AS total_starts_p
  FROM get_distinct_events(organisation_ids, discipline_list, 'all') AS events
  GROUP BY get_period_by_granularity(granularity, events."startDate")
  ORDER BY period ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_events_by_distance(granularity text DEFAULT 'year'::text, organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE(period text, distance text, total_events bigint, total_starts bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    get_period_by_granularity(granularity, events."startDate") AS period,
    events."distance",
    COUNT(events."eventId") AS total_events,
    SUM(events."numberOfStarts") AS total_starts
  FROM get_distinct_events(organisation_ids, discipline_list, 'all') AS events
  GROUP BY period, events."distance"
  ORDER BY period ASC, events."distance" ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_events_by_lightcondition(granularity text DEFAULT 'year'::text, organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE(period text, lightconditions text, total_events bigint, total_starts bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    get_period_by_granularity(granularity, events."startDate") AS period,
    events."lightConditions",
    COUNT(events."eventId") AS total_events,
    SUM(events."numberOfStarts") AS total_starts
  FROM get_distinct_events(organisation_ids, discipline_list, 'all') AS events
  GROUP BY period, events."lightConditions"
  ORDER BY period ASC, events."lightConditions" ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_mid_week_and_weekend_starts(organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE(period text, weekend_events bigint, weekend_starts bigint, weekday_events bigint, weekday_starts bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    get_period_by_granularity('year', events."startDate") AS period,

    -- For weekends (Friday, Saturday, Sunday)
    COUNT(events."eventId") FILTER (WHERE EXTRACT(DOW FROM events."startDate") IN (0, 5, 6)) AS weekend_events,
    SUM(events."numberOfStarts") FILTER (WHERE EXTRACT(DOW FROM events."startDate") IN (0, 5, 6)) AS weekend_starts,

    -- For weekdays (Monday to Thursday)
    COUNT(events."eventId") FILTER (WHERE EXTRACT(DOW FROM events."startDate") BETWEEN 1 AND 4) AS weekday_events,
    SUM(events."numberOfStarts") FILTER (WHERE EXTRACT(DOW FROM events."startDate") BETWEEN 1 AND 4) AS weekday_starts
  FROM get_distinct_events(organisation_ids, discipline_list, 'all') AS events
    WHERE
      events."classificationId" IN ('3', '4')
  GROUP BY period 
  ORDER BY period ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_participation_by_birth_year_cohort(organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE(birth_year numeric, event_year numeric, participant_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH filtered_distinct_events AS (
    -- Pre-filter events from get_distinct_events function
    SELECT de.*
    FROM get_distinct_events(organisation_ids, discipline_list, 'all') de
    WHERE discipline_list IS NULL 
      OR de."disciplineId" = ANY(discipline_list)
  ),
  filtered_runners AS (
    -- Pre-filter runners based on organisation
    SELECT r.*
    FROM runners r
    INNER JOIN organisations org ON r."organisationId" = org."organisationId"
    WHERE organisation_ids IS NULL 
      OR org."parentOrganisationId" = ANY(organisation_ids)
  )
  SELECT 
      EXTRACT(YEAR FROM fr."birthDate") AS birth_year,
      EXTRACT(YEAR FROM fde."startDate") AS event_year,
      COUNT(r."id") AS participant_count
  FROM results r
  INNER JOIN filtered_distinct_events fde ON r."eventId" = fde."eventId"
  INNER JOIN filtered_runners fr ON r."personId" = fr."personId"
  GROUP BY 
      EXTRACT(YEAR FROM fr."birthDate"),
      EXTRACT(YEAR FROM fde."startDate")
  ORDER BY birth_year ASC, event_year ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_starts_by_age_group(organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE(period text, total_starts_under_9 bigint, total_starts_9_10 bigint, total_starts_11_12 bigint, total_starts_13_14 bigint, total_starts_15_16 bigint, total_starts_17_18 bigint, total_starts_19_20 bigint, total_starts_21_34 bigint, total_starts_35_39 bigint, total_starts_40_44 bigint, total_starts_45_49 bigint, total_starts_50_54 bigint, total_starts_55_59 bigint, total_starts_60_64 bigint, total_starts_65_69 bigint, total_starts_70_74 bigint, total_starts_75_79 bigint, total_starts_80_84 bigint, total_starts_85_89 bigint, total_starts_90_plus bigint, total_starts_ungdom bigint, total_starts_junior bigint, total_starts_senior bigint, total_starts_veteran bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH event_data AS (
    -- Pre-compute the period and get filtered events
    SELECT 
      events."eventId",
      events."startDate",
      get_period_by_granularity('year', events."startDate") AS "period"
    FROM get_distinct_events(organisation_ids, discipline_list, 'all') AS events
  ),
  runner_ages AS (
    -- Pre-compute ages and filter by organisation
    SELECT 
      results."id" AS "resultId",
      results."eventId",
      EXTRACT(YEAR FROM event_data."startDate") - EXTRACT(YEAR FROM runners."birthDate") AS "age"
    FROM event_data
    LEFT JOIN results ON results."eventId" = event_data."eventId"
    LEFT JOIN runners ON results."personId" = runners."personId"
    LEFT JOIN organisations AS runner_org ON runners."organisationId" = runner_org."organisationId"
    WHERE (
      organisation_ids IS NULL 
      OR runner_org."parentOrganisationId" = ANY(organisation_ids)
    )
  )
  SELECT 
    event_data."period",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 1 AND 8) AS "total_starts_under_9",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 9 AND 10) AS "total_starts_9_10",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 11 AND 12) AS "total_starts_11_12",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 13 AND 14) AS "total_starts_13_14",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 15 AND 16) AS "total_starts_15_16",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 17 AND 18) AS "total_starts_17_18",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 19 AND 20) AS "total_starts_19_20",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 21 AND 34) AS "total_starts_21_34",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 35 AND 39) AS "total_starts_35_39",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 40 AND 44) AS "total_starts_40_44",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 45 AND 49) AS "total_starts_45_49",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 50 AND 54) AS "total_starts_50_54",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 55 AND 59) AS "total_starts_55_59",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 60 AND 64) AS "total_starts_60_64",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 65 AND 69) AS "total_starts_65_69",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 70 AND 74) AS "total_starts_70_74",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 75 AND 79) AS "total_starts_75_79",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 80 AND 84) AS "total_starts_80_84",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 85 AND 89) AS "total_starts_85_89",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" >= 90) AS "total_starts_90_plus",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 1 AND 16) AS "total_starts_ungdom",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 17 AND 20) AS "total_starts_junior",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" BETWEEN 21 AND 34) AS "total_starts_senior",
    COUNT(runner_ages."resultId") FILTER (WHERE runner_ages."age" >= 35) AS "total_starts_veteran"
  FROM event_data
  LEFT JOIN runner_ages ON event_data."eventId" = runner_ages."eventId"
  GROUP BY event_data."period"
  ORDER BY event_data."period" ASC;
END;
$function$
;


