drop function if exists "public"."get_disctrict_starts"(year_param integer, discipline_list text[]);

drop function if exists "public"."get_distinct_events"(organisation_ids text[], discipline_list text[], todate boolean);

drop function if exists "public"."get_events_count_by_year"(organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_runners_by_age_range"(min_age integer, max_age integer, organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_starts_by_year"(organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_unique_runners_by_year"(organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_runners_for_year"(year integer, birth_year integer, organisation_id text, parent_organisation_id text);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_distinct_events(organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[], date_filter text DEFAULT 'current'::text, filter_year numeric DEFAULT NULL::numeric)
 RETURNS TABLE("eventId" text, name text, "startDate" date, "numberOfEntries" smallint, "numberOfStarts" smallint, "punchingUnitType" text, location json, "lightConditions" text, distance text, "disciplineId" text, "classificationId" text, "organiserId" text[])
 LANGUAGE plpgsql
AS $function$
BEGIN
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
     WHEN 'current' THEN TO_CHAR(events."startDate", 'MM-DD') < TO_CHAR(CURRENT_DATE, 'MM-DD')
     WHEN 'to_date' THEN events."startDate" < CURRENT_DATE
     WHEN 'all' THEN TRUE
     ELSE FALSE
   END
   AND (filter_year IS NULL OR EXTRACT(YEAR FROM events."startDate") = filter_year)
   AND (organisation_ids IS NULL OR organisations."parentOrganisationId" = ANY(organisation_ids))
   AND (discipline_list IS NULL OR discipline."disciplineId" = ANY(discipline_list))
 ORDER BY events."eventId", events."startDate";
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_events_count_by_year(year_param numeric DEFAULT NULL::numeric, organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE(event_year numeric, total_events bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
      EXTRACT(YEAR FROM events."startDate") AS event_year,  -- Extract the year from startDate
      COUNT(events."eventId") AS total_events     -- Count distinct event IDs
  FROM get_distinct_events(organisation_ids, discipline_list,CASE 
       WHEN year_param = EXTRACT(YEAR FROM CURRENT_DATE) THEN 'current'
       ELSE 'all'  
     END) AS events
  GROUP BY EXTRACT(YEAR FROM events."startDate")
  ORDER BY event_year ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_runners_by_age_range(year_param numeric DEFAULT NULL::numeric, min_age integer DEFAULT NULL::integer, max_age integer DEFAULT NULL::integer, organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE(event_year numeric, total_starts bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
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
   INNER JOIN organisations o ON ru."organisationId" = o."organisationId"
   WHERE (
     (min_age IS NULL AND max_age IS NULL)
     OR (min_age IS NULL AND EXTRACT(YEAR FROM fe."startDate") - EXTRACT(YEAR FROM ru."birthDate") <= max_age)
     OR (max_age IS NULL AND EXTRACT(YEAR FROM fe."startDate") - EXTRACT(YEAR FROM ru."birthDate") >= min_age)
     OR (EXTRACT(YEAR FROM fe."startDate") - EXTRACT(YEAR FROM ru."birthDate") BETWEEN min_age AND max_age)
   )
   AND (organisation_ids IS NULL OR o."parentOrganisationId" = ANY(organisation_ids))
 )
 SELECT
   EXTRACT(YEAR FROM ar."startDate") AS event_year,
   COUNT(ar.id) AS total_starts
 FROM age_filtered_results ar
 GROUP BY EXTRACT(YEAR FROM ar."startDate")
 ORDER BY event_year ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_starts_by_year(year_param numeric DEFAULT NULL::numeric, organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE(event_year numeric, total_starts bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
      EXTRACT(YEAR FROM events."startDate") AS event_year,
      SUM(events."numberOfStarts") AS total_starts
  FROM get_distinct_events(
      organisation_ids, 
      discipline_list,
      CASE 
          WHEN year_param = EXTRACT(YEAR FROM CURRENT_DATE) THEN 'current'
          ELSE 'all'  
      END
  ) AS events
  GROUP BY EXTRACT(YEAR FROM events."startDate")
  ORDER BY event_year ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_unique_runners_by_year(year_param numeric DEFAULT NULL::numeric, organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE(event_year numeric, total_unique_runners bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
 RETURN QUERY
 WITH filtered_events AS (
   SELECT e."eventId", e."startDate", e."disciplineId", e."organiserId"
   FROM get_distinct_events(organisation_ids, discipline_list, 
     CASE 
       WHEN year_param = EXTRACT(YEAR FROM CURRENT_DATE) THEN 'current'
       ELSE 'all'  
     END) e
   WHERE 
     (discipline_list IS NULL OR e."disciplineId" = ANY(discipline_list))
 ),
 filtered_orgs AS (
   SELECT DISTINCT events."eventId" 
   FROM filtered_events events
   INNER JOIN organisations org ON org."organisationId" = ANY(events."organiserId")
   WHERE organisation_ids IS NULL OR org."parentOrganisationId" = ANY(organisation_ids)
 )
 SELECT 
   EXTRACT(YEAR FROM fe."startDate") AS event_year,
   COUNT(DISTINCT r."personId") AS total_unique_runners
 FROM filtered_events fe
 INNER JOIN filtered_orgs fo ON fo."eventId" = fe."eventId"
 INNER JOIN results r ON r."eventId" = fe."eventId"
 GROUP BY EXTRACT(YEAR FROM fe."startDate")
 ORDER BY event_year ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_distinct_results(year integer DEFAULT NULL::integer)
 RETURNS TABLE(resultid text, startdate date, personid text)
 LANGUAGE sql
AS $function$
-- Core query
SELECT DISTINCT 
    results."resultId",
    events."startDate",
    results."personId"
FROM results
INNER JOIN get_distinct_events() AS events 
    ON results."eventId" = events."eventId"
WHERE (year IS NULL OR EXTRACT(YEAR FROM events."startDate") = year)
ORDER BY events."startDate" DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.get_district_starts(year_param integer, discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE(parentorgid text, parentorgname text, unique_runners bigint, total_starts bigint, total_entries bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
      COALESCE(parent_org."organisationId", organisations."organisationId") AS "parentorgid",
      COALESCE(parent_org."name", organisations."name") AS "parentorgname",
      COUNT(DISTINCT runners."personId") AS "number_of_runners",
      COUNT(DISTINCT results."id") AS "total_starts",
      COUNT(DISTINCT entries."id") AS "total_entries"
  FROM results
  INNER JOIN events ON results."eventId" = events."eventId"
  INNER JOIN runners ON results."personId" = runners."personId"
  INNER JOIN organisations ON runners."organisationId" = organisations."organisationId"
  LEFT JOIN organisations AS parent_org ON organisations."parentOrganisationId" = parent_org."organisationId"
  LEFT JOIN entries ON runners."personId" = entries."personId"
  LEFT JOIN discipline ON events."disciplineId" = discipline."disciplineId"
  WHERE EXTRACT(YEAR FROM events."startDate") = year_param
    -- Filter by discipline list
    AND (discipline_list IS NULL OR events."disciplineId" = ANY(discipline_list))
    -- Only consider events before today's date (ignoring the year)
    AND (year_param != EXTRACT(YEAR FROM CURRENT_DATE) OR TO_CHAR("startDate", 'MM-DD') < TO_CHAR(CURRENT_DATE, 'MM-DD'))
    AND parent_org.type = '2'
  GROUP BY 
      COALESCE(parent_org."organisationId", organisations."organisationId"),
      COALESCE(parent_org."name", organisations."name")
  ORDER BY "total_starts" DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_duplicate_runners(step integer DEFAULT 1)
 RETURNS TABLE(original_fullname text, duplicate_fullname text, original_personid text, duplicate_personid text)
 LANGUAGE sql
AS $function$
WITH runner_counts AS (
    -- Get the count of results for each runner and their most recent result date
     SELECT
        runners."personId",
        runners."fullName",
        runners."organisationId"  -- Ensure organisationId is available
    FROM runners
    GROUP BY runners."personId", runners."fullName", runners."organisationId"
)
-- Return the duplicate runners to merge based on the condition
SELECT 
    rc1."fullName" AS "original_fullName",
    rc2."fullName" AS "duplicate_fullName",
    rc1."personId" AS "original_personId",
    rc2."personId" AS "duplicate_personId"
FROM runner_counts rc1
JOIN runner_counts rc2
  ON (
    CASE 
        WHEN step = 1 THEN rc1."fullName" = rc2."fullName" 
        WHEN step = 2 THEN LEFT(rc1."fullName", 3) = LEFT(rc2."fullName", 3)
                         AND similarity(rc1."fullName", rc2."fullName") > 0.9
        ELSE rc1."fullName" = rc2."fullName"
    END
  )
  AND rc1."personId" <> rc2."personId"
  LIMIT 5000
$function$
;

CREATE OR REPLACE FUNCTION public.get_duplicate_runners(year integer, step integer DEFAULT 1)
 RETURNS TABLE(original_fullname text, duplicate_fullname text, original_personid text, duplicate_personid text)
 LANGUAGE sql
AS $function$
WITH runner_counts AS (
    -- Get the count of results for each runner and their most recent result date for the given year
    SELECT
        runners."personId",
        runners."fullName",
        COALESCE(
            MIN(runners."organisationId") FILTER (WHERE runners."organisationId" <> '16'),
            MIN(runners."organisationId")
        ) AS "organisationId",
        COUNT(results."resultid") AS result_count,
        MAX(results."startdate") AS last_used
    FROM runners
    LEFT JOIN get_distinct_results(year) AS results  -- Use the results filtered by the year
    ON runners."personId" = results."personid"
    GROUP BY runners."personId", runners."fullName", runners."organisationId"
    HAVING COUNT(results."resultid") > 0
)
-- Return the duplicate runners to merge based on the condition
SELECT 
    rc1."fullName" AS "original_fullName",
    rc2."fullName" AS "duplicate_fullName",
    rc1."personId" AS "original_personId",
    rc2."personId" AS "duplicate_personId"
FROM runner_counts rc1
JOIN runner_counts rc2
  ON (
    CASE 
        WHEN step = 1 THEN rc1."fullName" = rc2."fullName"
        WHEN step = 2 THEN LEFT(rc1."fullName", 3) = LEFT(rc2."fullName", 3)
                           AND similarity(rc1."fullName", rc2."fullName") > 0.9
        WHEN step = 3 THEN similarity(rc1."personId", rc2."personId") > 0.9
        ELSE rc1."fullName" = rc2."fullName"
    END
  )
  AND rc1."personId" <> rc2."personId"
WHERE rc1."last_used" >= rc2."last_used"
LIMIT 5000;
$function$
;

CREATE OR REPLACE FUNCTION public.get_events_by_organisation_year(year_param integer, organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE("organisationName" text, "organisationId" text, number_of_events bigint, total_entries bigint, total_starts bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
 RETURN QUERY
 SELECT 
     organisations."name" AS organisationName,
     organisations."organisationId",
     COUNT(DISTINCT events."eventId") AS number_of_events,
     SUM(events."numberOfEntries") AS total_entries,
     SUM(events."numberOfStarts") AS total_starts
 FROM get_distinct_events(organisation_ids, discipline_list, 'all') AS events
 INNER JOIN organisations ON organisations."organisationId" = ANY(events."organiserId")
 LEFT JOIN organisations AS parent_org ON organisations."parentOrganisationId" = parent_org."organisationId"
 WHERE EXTRACT(YEAR FROM events."startDate") = year_param
   AND (organisation_ids IS NULL OR parent_org."organisationId" = ANY(organisation_ids))
   AND (year_param != EXTRACT(YEAR FROM CURRENT_DATE) OR TO_CHAR(events."startDate", 'MM-DD') < TO_CHAR(CURRENT_DATE, 'MM-DD'))
 GROUP BY
     organisations."organisationId",
     organisations."name"
 ORDER BY total_starts DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_events_starts(granularity text, organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE(period text, number_of_events bigint, total_entries bigint, total_starts bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN QUERY
    WITH period_events AS (
        -- Pre-compute periods and aggregate data
        SELECT
            get_period_by_granularity(granularity, events."startDate") AS event_period,
            events."eventId",
            events."numberOfEntries",
            events."numberOfStarts"
        FROM get_distinct_events(organisation_ids, discipline_list, 'all') events
    )
    SELECT
        event_period AS period,
        COUNT(period_events."eventId") AS number_of_events,
        SUM(period_events."numberOfEntries") AS total_entries,
        SUM(period_events."numberOfStarts") AS total_starts
    FROM period_events
    GROUP BY event_period
    ORDER BY event_period ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_runners_for_year(year integer DEFAULT NULL::integer, birth_year integer DEFAULT NULL::integer, organisation_id text DEFAULT NULL::text, parent_organisation_id text DEFAULT NULL::text)
 RETURNS TABLE("fullName" text, "birthDate" text, "organisationName" text, total_starts bigint, "personId" text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
      runners."fullName",
      TO_CHAR(runners."birthDate", 'YYYY') AS "birthDate",
      organisations."name" AS "organisationName",
      COUNT(results."resultId") AS "total_starts",
      runners."personId"
  FROM runners
  INNER JOIN results ON runners."personId" = results."personId"
  INNER JOIN events ON results."eventId" = events."eventId"
  INNER JOIN organisations ON runners."organisationId" = organisations."organisationId"
  LEFT JOIN organisations AS parent_org ON organisations."parentOrganisationId" = parent_org."organisationId"
  WHERE (year  IS NULL OR EXTRACT(YEAR FROM events."startDate") = year)
    AND events."startDate" < CURRENT_DATE
    AND events."startDate" < CURRENT_DATE
    AND (organisation_id IS NULL OR organisations."organisationId" = organisation_id)
    AND (parent_organisation_id IS NULL OR parent_org."organisationId" = parent_organisation_id)
    AND (birth_year IS NULL OR EXTRACT(YEAR FROM runners."birthDate") = birth_year)
  GROUP BY 
      runners."personId", 
      runners."birthDate", 
      runners."fullName", 
      organisations."name"
  ORDER BY total_starts DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_starts_by_organisation_year(year_param integer, organisation_ids text[] DEFAULT NULL::text[], discipline_list text[] DEFAULT NULL::text[])
 RETURNS TABLE("organisationId" text, "organisationName" text, number_of_runners bigint, total_result_count bigint, total_entries_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
 RETURN QUERY
 WITH filtered_events AS (
   SELECT "eventId"
   FROM events
   WHERE EXTRACT(YEAR FROM "startDate") = year_param
   AND (year_param != EXTRACT(YEAR FROM CURRENT_DATE) OR TO_CHAR("startDate", 'MM-DD') < TO_CHAR(CURRENT_DATE, 'MM-DD'))
   AND (discipline_list IS NULL OR "disciplineId" = ANY(discipline_list))
 )
 SELECT 
     o."organisationId",
     o."name" AS organisationName,
     COUNT(DISTINCT r."personId") AS number_of_runners,
     COUNT(DISTINCT res."id") AS total_result_count,
     COUNT(DISTINCT e."id") AS total_entries_count
 FROM filtered_events fe
 INNER JOIN results res ON res."eventId" = fe."eventId"
 INNER JOIN runners r ON res."personId" = r."personId"
 INNER JOIN organisations o ON r."organisationId" = o."organisationId"
 LEFT JOIN entries e ON r."personId" = e."personId"
 LEFT JOIN organisations parent_org ON o."parentOrganisationId" = parent_org."organisationId"
 WHERE (organisation_ids IS NULL OR parent_org."organisationId" = ANY(organisation_ids))
 GROUP BY 
     o."organisationId",
     o."name"
 ORDER BY total_result_count DESC;
END;
$function$
;


