set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.clear_database()
 RETURNS void
 LANGUAGE plpgsql
AS $function$BEGIN
  TRUNCATE results cascade;
  TRUNCATE entries cascade;
  TRUNCATE classes cascade;
  TRUNCATE events cascade;
  TRUNCATE runners cascade;
  TRUNCATE entryfees cascade;
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_distinct_events(organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[], date_filter text DEFAULT 'current'::text, filter_year numeric DEFAULT NULL::numeric)
 RETURNS TABLE("eventId" text, name text, "startDate" date, "numberOfEntries" smallint, "numberOfStarts" smallint, "punchingUnitType" text, location json, "lightConditions" text, distance text, "disciplineId" text, "classificationId" text, "organiserId" text[])
 LANGUAGE plpgsql
AS $function$BEGIN
 RETURN QUERY
 SELECT DISTINCT ON (events."eventId")
     events."eventId",
     events."name",
     events."startDate", 
     events."numberOfEntries",
     events."numberOfStarts",
     events."punchingUnitType",
     events."location",
     events."lightConditions",
     events."distance",
     events."disciplineId",
     events."classificationId",
     events."organiserId"
 FROM events
 LEFT JOIN organisations ON organisations."organisationId" = ANY(events."organiserId")
 LEFT JOIN discipline ON events."disciplineId" = discipline."disciplineId"
 WHERE
   CASE date_filter
     WHEN 'current' THEN TO_CHAR(events."startDate", 'MM-DD') <= TO_CHAR(CURRENT_DATE, 'MM-DD')
     WHEN 'to_date' THEN events."startDate" < CURRENT_DATE
     WHEN 'all' THEN TRUE
     ELSE FALSE
   END
   AND (filter_year IS NULL OR EXTRACT(YEAR FROM events."startDate") = filter_year)
   AND (organisation_ids IS NULL OR organisations."parentOrganisationId" = ANY(organisation_ids))
   AND (discipline_list IS NULL OR discipline."disciplineId" = ANY(discipline_list))
 ORDER BY events."eventId", events."startDate";
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_runners_by_age_range(year_param numeric DEFAULT NULL::numeric, min_age integer DEFAULT NULL::integer, max_age integer DEFAULT NULL::integer, organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE(event_year numeric, total_starts bigint)
 LANGUAGE plpgsql
AS $function$BEGIN
 RETURN QUERY
 WITH filtered_events AS (
   SELECT e."eventId", e."startDate"
   FROM get_distinct_events(organisation_ids, discipline_list, 
     CASE 
       WHEN year_param = EXTRACT(YEAR FROM CURRENT_DATE) THEN 'current'
       ELSE 'all'
     END) e
 ),
 age_filtered_results AS (
   SELECT fe."eventId", fe."startDate", r.id
   FROM filtered_events fe
   INNER JOIN results r ON r."eventId" = fe."eventId"
   INNER JOIN runners ru ON r."personId" = ru."personId"
   LEFT JOIN organisations o ON ru."organisationId" = o."organisationId"
    WHERE ru."birthDate" IS NOT NULL
    AND (
      organisation_ids IS NULL 
      OR o."parentOrganisationId" = ANY(organisation_ids)
      OR ru."organisationId" IS NULL  -- Include runners without organization
    )
    AND (
      (min_age IS NULL AND max_age IS NULL)
      OR (min_age IS NULL AND EXTRACT(YEAR FROM fe."startDate") - EXTRACT(YEAR FROM ru."birthDate") <= max_age)
      OR (max_age IS NULL AND EXTRACT(YEAR FROM fe."startDate") - EXTRACT(YEAR FROM ru."birthDate") >= min_age)
      OR (EXTRACT(YEAR FROM fe."startDate") - EXTRACT(YEAR FROM ru."birthDate") BETWEEN min_age AND max_age)
    )
 )
 SELECT
   EXTRACT(YEAR FROM ar."startDate") AS event_year,
   COUNT(ar.id) AS total_starts
 FROM age_filtered_results ar
 GROUP BY EXTRACT(YEAR FROM ar."startDate")
 ORDER BY event_year ASC;
END;$function$
;

CREATE OR REPLACE FUNCTION public.get_starts_by_age_group(organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE(period text, total_starts_under_9 bigint, total_starts_9_10 bigint, total_starts_11_12 bigint, total_starts_13_14 bigint, total_starts_15_16 bigint, total_starts_17_18 bigint, total_starts_19_20 bigint, total_starts_21_34 bigint, total_starts_35_39 bigint, total_starts_40_44 bigint, total_starts_45_49 bigint, total_starts_50_54 bigint, total_starts_55_59 bigint, total_starts_60_64 bigint, total_starts_65_69 bigint, total_starts_70_74 bigint, total_starts_75_79 bigint, total_starts_80_84 bigint, total_starts_85_89 bigint, total_starts_90_plus bigint, total_starts_ungdom bigint, total_starts_junior bigint, total_starts_senior bigint, total_starts_veteran bigint)
 LANGUAGE plpgsql
AS $function$BEGIN
  RETURN QUERY
  WITH event_data AS (
    SELECT 
      events."eventId",
      events."startDate",
      get_period_by_granularity('year', events."startDate") AS "period"
    FROM get_distinct_events(organisation_ids, discipline_list, 'all') AS events
  ),
  runner_ages AS (
    SELECT 
      results."id" AS "resultId",
      results."eventId",
      event_data."period",
      EXTRACT(YEAR FROM event_data."startDate") - EXTRACT(YEAR FROM runners."birthDate") AS "age"
    FROM event_data
    INNER JOIN results ON results."eventId" = event_data."eventId"  -- Changed to INNER JOIN
    INNER JOIN runners ON results."personId" = runners."personId"   -- Changed to INNER JOIN
    LEFT JOIN organisations AS runner_org ON runners."organisationId" = runner_org."organisationId"
    WHERE runners."birthDate" IS NOT NULL
    AND (
      organisation_ids IS NULL 
      OR runner_org."parentOrganisationId" = ANY(organisation_ids)
      OR runners."organisationId" IS NULL
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
END;$function$
;


