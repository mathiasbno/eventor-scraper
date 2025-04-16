

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;







COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."calculate_runner_age"("birth_date" "date", "event_date" "date") RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    RETURN EXTRACT(YEAR FROM event_date) - EXTRACT(YEAR FROM birth_date);
END;
$$;


ALTER FUNCTION "public"."calculate_runner_age"("birth_date" "date", "event_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clean_up_runners"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    DELETE FROM runners
    WHERE "personId" IN (
        SELECT runners."personId"
        FROM runners
        LEFT JOIN results ON runners."personId" = results."personId"
        GROUP BY runners."personId"
        HAVING COUNT(results."id") = 0
    );
    
    RETURN;
END;
$$;


ALTER FUNCTION "public"."clean_up_runners"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_disctrict_starts"("year_param" integer, "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("parentorgid" "text", "parentorgname" "text", "unique_runners" bigint, "total_starts" bigint, "total_entries" bigint)
    LANGUAGE "plpgsql"
    AS $$
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
    AND TO_CHAR(events."startDate", 'MM-DD') < TO_CHAR(CURRENT_DATE, 'MM-DD')
    AND parent_org.type = '2'
  GROUP BY 
      COALESCE(parent_org."organisationId", organisations."organisationId"),
      COALESCE(parent_org."name", organisations."name")
  ORDER BY "total_starts" DESC;
END;
$$;


ALTER FUNCTION "public"."get_disctrict_starts"("year_param" integer, "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_distinct_events"("organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[], "todate" boolean DEFAULT false) RETURNS TABLE("eventId" "text", "name" "text", "startDate" "date", "numberOfEntries" smallint, "numberOfStarts" smallint, "punchingUnitType" "text", "location" "json", "lightConditions" "text", "distance" "text", "disciplineId" "text", "classificationId" "text", "organiserId" "text"[])
    LANGUAGE "plpgsql"
    AS $$
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
    (toDate IS TRUE OR TO_CHAR(events."startDate", 'MM-DD') < TO_CHAR(CURRENT_DATE, 'MM-DD')) -- Ensure that only events up to current day in month is selected for all years
    AND (toDate IS FALSE OR events."startDate" < CURRENT_DATE)                                -- Get all events up untill today
    AND (organisation_ids IS NULL OR organisations."parentOrganisationId" = ANY(organisation_ids))
    AND (discipline_list IS NULL OR discipline."disciplineId" = ANY(discipline_list))
  ORDER BY events."eventId", events."startDate";
END;
$$;


ALTER FUNCTION "public"."get_distinct_events"("organisation_ids" "text"[], "discipline_list" "text"[], "todate" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_distinct_results"("year" integer DEFAULT NULL::integer) RETURNS TABLE("resultid" "text", "startdate" "date", "personid" "text")
    LANGUAGE "sql"
    AS $$
SELECT DISTINCT 
    results."resultId",
    events."startDate",
    results."personId"
FROM results
INNER JOIN get_distinct_events() AS events 
    ON results."eventId" = events."eventId"
WHERE (year IS NULL OR EXTRACT(YEAR FROM events."startDate") = year)
ORDER BY events."startDate" DESC;
$$;


ALTER FUNCTION "public"."get_distinct_results"("year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_district_starts"("year_param" integer, "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("parentorgid" "text", "parentorgname" "text", "unique_runners" bigint, "total_starts" bigint, "total_entries" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH org_data AS (
    SELECT 
      COALESCE(parent_org."organisationId", organisations."organisationId") AS "parentorgid",
      COALESCE(parent_org."name", organisations."name") AS "parentorgname"
    FROM organisations
    LEFT JOIN organisations AS parent_org ON organisations."parentOrganisationId" = parent_org."organisationId"
    WHERE parent_org.type = '2'
  )
  SELECT 
      org_data."parentorgid",
      org_data."parentorgname",
      COUNT(DISTINCT runners."personId") AS "unique_runners",
      COUNT(results."id") AS "total_starts",
      COUNT(entries."id") AS "total_entries"
  FROM results
  INNER JOIN events ON results."eventId" = events."eventId"
  INNER JOIN runners ON results."personId" = runners."personId"
  INNER JOIN org_data ON runners."organisationId" = org_data."parentorgid"
  LEFT JOIN entries ON runners."personId" = entries."personId"
  LEFT JOIN discipline ON events."disciplineId" = discipline."disciplineId"
  WHERE EXTRACT(YEAR FROM events."startDate") = year_param
    -- Filter by discipline list
    AND (discipline_list IS NULL OR events."disciplineId" = ANY(discipline_list))
    -- Only consider events before today's date
    AND events."startDate" < CURRENT_DATE
  GROUP BY 
      org_data."parentorgid",
      org_data."parentorgname"
  ORDER BY "total_starts" DESC;
END;
$$;


ALTER FUNCTION "public"."get_district_starts"("year_param" integer, "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_duplicate_runners"("step" integer DEFAULT 1) RETURNS TABLE("original_fullname" "text", "duplicate_fullname" "text", "original_personid" "text", "duplicate_personid" "text")
    LANGUAGE "sql"
    AS $$
WITH runner_counts AS (
    -- Get the count of results for each runner and their most recent result date
     SELECT
        runners."personId",
        runners."fullName",
        runners."organisationId"  -- Ensure organisationId is available
    FROM runners
    GROUP BY runners."personId", runners."fullName", runners."organisationId"
)
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
$$;


ALTER FUNCTION "public"."get_duplicate_runners"("step" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_duplicate_runners"("year" integer, "step" integer DEFAULT 1) RETURNS TABLE("original_fullname" "text", "duplicate_fullname" "text", "original_personid" "text", "duplicate_personid" "text")
    LANGUAGE "sql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_duplicate_runners"("year" integer, "step" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_entry_fees"("organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("period" "text", "amount" smallint, "class_type" "text", "type" "text", "event_classification" "text", "event_name" "text", "organiser_name" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(events."startDate", 'YYYY') AS period,  -- Event year
    entryfees.amount,                               -- Entry fee amount
    entryfees."classType" AS class_type,            -- Class type
    entryfees."type" AS type,                       -- Type (adult, youth, kids, etc.)
    events."classificationId" AS event_classification,      -- Event classification (discipline name)
    events."name" AS event_name,                    -- Name of the event
    organisations."name" AS organiser_name          -- Name of the organising organisation
  FROM entryfees
  LEFT JOIN events ON entryfees."eventId" = events."eventId"
  LEFT JOIN organisations ON organisations."organisationId" = ANY(events."organiserId")
  WHERE entryfees."order" = '0'  -- Only include the first entry fee
    AND (organisation_ids IS NULL OR organisations."parentOrganisationId" = ANY(organisation_ids))  -- Filter by parent organisation if provided
    AND (discipline_list IS NULL OR events."disciplineId" = ANY(discipline_list))  -- Filter by discipline list if provided
  ORDER BY period ASC, entryfees.amount ASC;
END;
$$;


ALTER FUNCTION "public"."get_entry_fees"("organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_events_by_classification_granularity"("granularity" "text", "organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("period" "text", "number_of_events_international" bigint, "number_of_events_championchip" bigint, "number_of_events_national" bigint, "number_of_events_regional" bigint, "number_of_events_local" bigint, "total_entries_international" bigint, "total_entries_championchip" bigint, "total_entries_national" bigint, "total_entries_regional" bigint, "total_entries_local" bigint, "total_starts_international" bigint, "total_starts_championchip" bigint, "total_starts_national" bigint, "total_starts_regional" bigint, "total_starts_local" bigint)
    LANGUAGE "plpgsql"
    AS $$
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
  FROM get_distinct_events(organisation_ids, discipline_list) AS events
  INNER JOIN classifications ON events."classificationId" = classifications."classificationId"
  GROUP BY get_period_by_granularity(granularity, events."startDate")
  ORDER BY period ASC;
END;
$$;


ALTER FUNCTION "public"."get_events_by_classification_granularity"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_events_by_discipline"("granularity" "text", "organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("period" "text", "number_of_events" bigint, "total_entries" bigint, "total_starts" bigint, "total_starts_o" bigint, "total_starts_m" bigint, "total_starts_s" bigint, "total_starts_p" bigint)
    LANGUAGE "plpgsql"
    AS $$
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
  FROM get_distinct_events(organisation_ids, discipline_list) AS events
  GROUP BY get_period_by_granularity(granularity, events."startDate")
  ORDER BY period ASC;
END;
$$;


ALTER FUNCTION "public"."get_events_by_discipline"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_events_by_distance"("granularity" "text" DEFAULT 'year'::"text", "organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("period" "text", "distance" "text", "total_events" bigint, "total_starts" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    get_period_by_granularity(granularity, events."startDate") AS period,
    events."distance",
    COUNT(events."eventId") AS total_events,
    SUM(events."numberOfStarts") AS total_starts
  FROM get_distinct_events(organisation_ids, discipline_list) AS events
  GROUP BY period, events."distance"
  ORDER BY period ASC, events."distance" ASC;
END;
$$;


ALTER FUNCTION "public"."get_events_by_distance"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_events_by_lightcondition"("granularity" "text" DEFAULT 'year'::"text", "organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("period" "text", "lightconditions" "text", "total_events" bigint, "total_starts" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    get_period_by_granularity(granularity, events."startDate") AS period,
    events."lightConditions",
    COUNT(events."eventId") AS total_events,
    SUM(events."numberOfStarts") AS total_starts
  FROM get_distinct_events(organisation_ids, discipline_list) AS events
  GROUP BY period, events."lightConditions"
  ORDER BY period ASC, events."lightConditions" ASC;
END;
$$;


ALTER FUNCTION "public"."get_events_by_lightcondition"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_events_by_name"("search_name" "text", "organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("eventId" "text", "eventName" "text", "startDate" "date", "distance" "text", "organisationNames" "text", "total_entries" smallint, "total_starts" smallint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
      events."eventId", 
      events."name" AS eventName, 
      events."startDate",
      events."distance", 
      STRING_AGG(DISTINCT organisations."name", ', ') AS organisationNames,  -- Aggregate distinct organisation names
      MAX(events."numberOfEntries") AS total_entries,  -- Use MAX to avoid summing duplicate entries
      MAX(events."numberOfStarts") AS total_starts    -- Use MAX to avoid summing duplicate starts
  FROM get_distinct_events(organisation_ids, discipline_list) AS events
  -- Join organisations using ANY() to match organisationId with organiserId array
  INNER JOIN organisations ON organisations."organisationId" = ANY(events."organiserId")
  WHERE LOWER(events."name") LIKE '%' || LOWER(search_name) || '%'
  GROUP BY 
      events."eventId",
      events."name",
      events."startDate", 
      events."distance"
  ORDER BY events."startDate" DESC;
END;
$$;


ALTER FUNCTION "public"."get_events_by_name"("search_name" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_events_by_organisation_year"("year_param" integer, "organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("organisationName" "text", "organisationId" "text", "number_of_events" bigint, "total_entries" bigint, "total_starts" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
      organisations."name" AS organisationName,
      organisations."organisationId",
      COUNT(DISTINCT events."eventId") AS number_of_events,  -- Count distinct events
      SUM(events."numberOfEntries") AS total_entries,
      SUM(events."numberOfStarts") AS total_starts
  FROM get_distinct_events(organisation_ids, discipline_list) AS events
  INNER JOIN organisations ON organisations."organisationId" = ANY(events."organiserId")
  LEFT JOIN organisations AS parent_org ON organisations."parentOrganisationId" = parent_org."organisationId"
  WHERE EXTRACT(YEAR FROM events."startDate") = year_param
    AND (organisation_ids IS NULL OR parent_org."organisationId" = ANY(organisation_ids))  -- Check if parent organisation is in the list
  GROUP BY
      organisations."organisationId",
      organisations."name"
  ORDER BY total_starts DESC;
END;
$$;


ALTER FUNCTION "public"."get_events_by_organisation_year"("year_param" integer, "organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_events_count_by_year"("organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("event_year" numeric, "total_events" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
      EXTRACT(YEAR FROM events."startDate") AS event_year,  -- Extract the year from startDate
      COUNT(events."eventId") AS total_events     -- Count distinct event IDs
  FROM get_distinct_events(organisation_ids, discipline_list) AS events
  GROUP BY EXTRACT(YEAR FROM events."startDate")
  ORDER BY event_year ASC;
END;
$$;


ALTER FUNCTION "public"."get_events_count_by_year"("organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_events_location"("year_param" integer DEFAULT NULL::integer, "organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("location" "text", "eventId" "text", "numberOfStarts" smallint, "name" "text", "startDate" "date", "org_name" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
      events."location"::TEXT as location,
      events."eventId",
      events."numberOfStarts",
      events."name",
      events."startDate",
      organisations."name" as org_name
  FROM get_distinct_events(organisation_ids, discipline_list) AS events
  INNER JOIN organisations ON 
    organisations."organisationId" = ANY(events."organiserId")
    AND (
      organisation_ids IS NULL 
      OR EXISTS (
        SELECT 1 
        FROM organisations AS parent_org 
        WHERE parent_org."organisationId" = organisations."parentOrganisationId"
        AND parent_org."organisationId" = ANY(organisation_ids)
      )
    )
  WHERE 
    events."location" IS NOT NULL
    AND (year_param IS NULL OR EXTRACT(YEAR FROM events."startDate") = year_param)
  GROUP BY
      events."location"::TEXT,
      events."eventId",
      events."numberOfStarts",
      events."name",
      events."startDate",
      organisations."name"
  ORDER BY
    events."startDate" DESC;
END;
$$;


ALTER FUNCTION "public"."get_events_location"("year_param" integer, "organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_events_starts"("granularity" "text", "organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("period" "text", "number_of_events" bigint, "total_entries" bigint, "total_starts" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN QUERY
    WITH period_events AS (
        -- Pre-compute periods and aggregate data
        SELECT
            get_period_by_granularity(granularity, events."startDate") AS event_period,
            events."eventId",
            events."numberOfEntries",
            events."numberOfStarts"
        FROM get_distinct_events(organisation_ids, discipline_list, true) events
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
$$;


ALTER FUNCTION "public"."get_events_starts"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_mid_week_and_weekend_starts"("organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("period" "text", "weekend_events" bigint, "weekend_starts" bigint, "weekday_events" bigint, "weekday_starts" bigint)
    LANGUAGE "plpgsql"
    AS $$
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
  FROM get_distinct_events(organisation_ids, discipline_list) AS events
    WHERE
      events."classificationId" IN ('3', '4')
  GROUP BY period 
  ORDER BY period ASC;
END;
$$;


ALTER FUNCTION "public"."get_mid_week_and_weekend_starts"("organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_organisations_by_parent"() RETURNS TABLE("organisationId" "text", "organisationName" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
      organisations."organisationId",
      "name" AS name
  FROM organisations
  WHERE organisations."type" = '2'
  ORDER BY organisations."name";
END;
$$;


ALTER FUNCTION "public"."get_organisations_by_parent"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_parent_org_stats_by_year"("year_param" integer, "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("parentorgname" "text", "number_of_events" bigint, "nasjonal" bigint, "krets" bigint, "naerlop" bigint, "total_entries" bigint, "total_starts" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    -- Step 1: Extract unique parentOrganisationIds per event where parent type is 2
    WITH unique_event_parents AS (
        SELECT DISTINCT
            events."eventId",
            parent_organisations."name" AS parent_name,  -- Explicitly reference the parent organisation's name
            events."classificationId",
            events."numberOfEntries",
            events."numberOfStarts"
        FROM
            events
        -- Unnest the organiserId array to handle multiple organisations per event
        JOIN LATERAL unnest(events."organiserId") AS org_id ON TRUE
        -- Join with organisations to get parentOrganisationId
        JOIN organisations ON organisations."organisationId" = org_id
        -- Join again to get details of the parent organisation
        JOIN organisations parent_organisations ON parent_organisations."organisationId" = organisations."parentOrganisationId"
        -- Join with discipline table
        JOIN discipline ON events."disciplineId" = discipline."disciplineId"
        -- Filter to include only parent organisations of type 2
        WHERE parent_organisations."type" = '2'
        -- Apply discipline filter if a list is passed
        AND (discipline_list IS NULL OR discipline."disciplineId"::TEXT = ANY(discipline_list))  -- Cast disciplineId to TEXT for comparison
        -- Apply year filter
        AND EXTRACT(YEAR FROM events."startDate") = year_param
        -- Only include past events
        AND TO_CHAR(events."startDate", 'MM-DD') < TO_CHAR(CURRENT_DATE, 'MM-DD')
    )
    
    -- Step 2: Aggregate the numberOfStarts for each parentOrganisationId
    SELECT
        parent_name AS parentOrgName,  -- Use the alias 'parent_name' to refer to the parent organisation's name
        COUNT(DISTINCT "eventId") AS number_of_events,  -- Count distinct events per parent org
        SUM(CASE WHEN "classificationId" = '2' THEN 1 ELSE 0 END) AS nasjonal,
        SUM(CASE WHEN "classificationId" = '3' THEN 1 ELSE 0 END) AS krets,
        SUM(CASE WHEN "classificationId" = '4' THEN 1 ELSE 0 END) AS naerlop,
        SUM("numberOfEntries") AS total_entries,  -- Sum entries
        SUM("numberOfStarts") AS total_starts  -- Sum starts
    FROM
        unique_event_parents
    GROUP BY
        parent_name
    ORDER BY
        total_starts DESC;
END;
$$;


ALTER FUNCTION "public"."get_parent_org_stats_by_year"("year_param" integer, "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_participation_by_birth_year_cohort"("organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("birth_year" numeric, "event_year" numeric, "participant_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH filtered_distinct_events AS (
    -- Pre-filter events from get_distinct_events function
    SELECT de.*
    FROM get_distinct_events(organisation_ids) de
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
$$;


ALTER FUNCTION "public"."get_participation_by_birth_year_cohort"("organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_period_by_granularity"("granularity" "text", "startdate" "date") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE STRICT PARALLEL SAFE
    AS $$
BEGIN
    IF granularity IS NULL THEN
        RETURN TO_CHAR(startDate, 'YYYY-MM');  -- Default to month if NULL
    END IF;

    RETURN
        CASE granularity
            WHEN 'day' THEN TO_CHAR(startDate, 'YYYY-MM-DD')
            WHEN 'month' THEN TO_CHAR(startDate, 'YYYY-MM')
            WHEN 'year' THEN TO_CHAR(startDate, 'YYYY')
            ELSE TO_CHAR(startDate, 'YYYY-MM')  -- Default to month for unknown granularity
        END;
END;
$$;


ALTER FUNCTION "public"."get_period_by_granularity"("granularity" "text", "startdate" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_runners_by_age_range"("min_age" integer DEFAULT NULL::integer, "max_age" integer DEFAULT NULL::integer, "organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("event_year" numeric, "total_starts" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
      EXTRACT(YEAR FROM events."startDate") AS event_year,
      COUNT(results."id") AS total_starts
  FROM get_distinct_events(organisation_ids, discipline_list) AS events  -- Use distinct events
  INNER JOIN results ON results."eventId" = events."eventId"
  INNER JOIN runners ON results."personId" = runners."personId"
  -- Ensure the runner's organisation matches the provided organisation_ids
  INNER JOIN organisations AS runner_org ON runners."organisationId" = runner_org."organisationId"
  WHERE (
    (min_age IS NULL AND max_age IS NULL)
    OR (min_age IS NULL AND EXTRACT(YEAR FROM events."startDate") - EXTRACT(YEAR FROM runners."birthDate") <= max_age)
    OR (max_age IS NULL AND EXTRACT(YEAR FROM events."startDate") - EXTRACT(YEAR FROM runners."birthDate") >= min_age)
    OR (EXTRACT(YEAR FROM events."startDate") - EXTRACT(YEAR FROM runners."birthDate") BETWEEN min_age AND max_age)
  )
  AND ((organisation_ids IS NULL OR runner_org."parentOrganisationId" = ANY(organisation_ids)))  -- Filter runners by organisation
  GROUP BY EXTRACT(YEAR FROM events."startDate")
  ORDER BY event_year ASC;
END;
$$;


ALTER FUNCTION "public"."get_runners_by_age_range"("min_age" integer, "max_age" integer, "organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_runners_for_year"("year" integer DEFAULT NULL::integer, "birth_year" integer DEFAULT NULL::integer, "organisation_id" "text" DEFAULT NULL::"text", "parent_organisation_id" "text" DEFAULT NULL::"text") RETURNS TABLE("fullName" "text", "birthDate" "text", "personId" "text", "organisationName" "text", "total_starts" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
      runners."fullName",
      TO_CHAR(runners."birthDate", 'YYYY') AS "birthDate",
      runners."personId",
      organisations."name" AS "organisationName",
      COUNT(results."resultId") AS "total_starts"
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
$$;


ALTER FUNCTION "public"."get_runners_for_year"("year" integer, "birth_year" integer, "organisation_id" "text", "parent_organisation_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_starts_by_age_group"("organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("period" "text", "total_starts_under_9" bigint, "total_starts_9_10" bigint, "total_starts_11_12" bigint, "total_starts_13_14" bigint, "total_starts_15_16" bigint, "total_starts_17_18" bigint, "total_starts_19_20" bigint, "total_starts_21_34" bigint, "total_starts_35_39" bigint, "total_starts_40_44" bigint, "total_starts_45_49" bigint, "total_starts_50_54" bigint, "total_starts_55_59" bigint, "total_starts_60_64" bigint, "total_starts_65_69" bigint, "total_starts_70_74" bigint, "total_starts_75_79" bigint, "total_starts_80_84" bigint, "total_starts_85_89" bigint, "total_starts_90_plus" bigint, "total_starts_ungdom" bigint, "total_starts_junior" bigint, "total_starts_senior" bigint, "total_starts_veteran" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH event_data AS (
    -- Pre-compute the period and get filtered events
    SELECT 
      events."eventId",
      events."startDate",
      get_period_by_granularity('year', events."startDate") AS "period"
    FROM get_distinct_events(organisation_ids, discipline_list) AS events
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
$$;


ALTER FUNCTION "public"."get_starts_by_age_group"("organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_starts_by_organisation_year"("year_param" integer, "organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("organisationId" "text", "organisationName" "text", "number_of_runners" bigint, "total_result_count" bigint, "total_entries_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
      organisations."organisationId" AS organisationId,
      organisations."name" AS organisationName,
      COUNT(DISTINCT runners."personId") AS number_of_runners,
      COUNT(DISTINCT results."id") AS total_result_count,
      COUNT(DISTINCT entries."id") AS total_entries_count
  FROM results
  INNER JOIN events ON results."eventId" = events."eventId"
  INNER JOIN runners ON results."personId" = runners."personId"
  INNER JOIN organisations ON runners."organisationId" = organisations."organisationId"
  LEFT JOIN entries ON runners."personId" = entries."personId"
  LEFT JOIN organisations AS parent_org ON organisations."parentOrganisationId" = parent_org."organisationId"
  LEFT JOIN discipline ON events."disciplineId" = discipline."disciplineId"
  WHERE EXTRACT(YEAR FROM events."startDate") = year_param
    AND (organisation_ids IS NULL OR parent_org."organisationId" = ANY(organisation_ids))
    AND (discipline_list IS NULL OR events."disciplineId" = ANY(discipline_list))
    AND TO_CHAR(events."startDate", 'MM-DD') < TO_CHAR(CURRENT_DATE, 'MM-DD')
  GROUP BY 
      organisations."organisationId",
      organisations."name"
  ORDER BY total_result_count DESC;
END;
$$;


ALTER FUNCTION "public"."get_starts_by_organisation_year"("year_param" integer, "organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_starts_by_year"("organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("event_year" numeric, "total_starts" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
      EXTRACT(YEAR FROM events."startDate") AS event_year,
      SUM(events."numberOfStarts") AS total_starts
  FROM get_distinct_events(organisation_ids, discipline_list) AS events
  GROUP BY EXTRACT(YEAR FROM events."startDate")
  ORDER BY event_year ASC;
END;
$$;


ALTER FUNCTION "public"."get_starts_by_year"("organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unique_runners_by_year"("organisation_ids" "text"[] DEFAULT NULL::"text"[], "discipline_list" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("event_year" numeric, "total_unique_runners" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
      EXTRACT(YEAR FROM events."startDate") AS event_year,
      COUNT(DISTINCT results."personId") AS total_unique_runners
  FROM events
  INNER JOIN results ON results."eventId" = events."eventId"
  WHERE 
      (
          discipline_list IS NULL 
          OR events."disciplineId" = ANY(discipline_list)
      )
      AND (
          organisation_ids IS NULL 
          OR EXISTS (
              SELECT 1 
              FROM organisations 
              WHERE organisations."organisationId" = ANY(events."organiserId")
              AND organisations."parentOrganisationId" = ANY(organisation_ids)
          )
      )
  GROUP BY EXTRACT(YEAR FROM events."startDate")
  ORDER BY event_year ASC;
END;
$$;


ALTER FUNCTION "public"."get_unique_runners_by_year"("organisation_ids" "text"[], "discipline_list" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_duplicate_runners"("year" integer, "step" integer DEFAULT 1) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Step 1: Update the results table, replacing duplicate personId with the original personId
    UPDATE results
    SET "personId" = tdr.original_personId
    FROM get_duplicate_runners(year, step) tdr
    WHERE results."personId" = tdr.duplicate_personId;

    -- Step 2: Delete the duplicate runners from the runners table
    --DELETE FROM runners
    --WHERE runners."personId" IN (
    --    SELECT duplicate_personId
    --    FROM get_duplicate_runners(1)
    --);

    -- No need to return anything, this is a regular function
    RETURN;
END;
$$;


ALTER FUNCTION "public"."handle_duplicate_runners"("year" integer, "step" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "classId" "text",
    "eventId" "text",
    "name" "text",
    "shortName" "text",
    "lowAge" smallint,
    "highAge" smallint,
    "sex" character varying,
    "type" "text"
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


ALTER TABLE "public"."classes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."classes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."classifications" (
    "id" bigint NOT NULL,
    "classificationId" "text",
    "classificationName" "text"
);


ALTER TABLE "public"."classifications" OWNER TO "postgres";


ALTER TABLE "public"."classifications" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."classifications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."discipline" (
    "id" bigint NOT NULL,
    "disciplineId" "text",
    "name" "text"
);


ALTER TABLE "public"."discipline" OWNER TO "postgres";


ALTER TABLE "public"."discipline" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."diciplene_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."entries" (
    "id" bigint NOT NULL,
    "classId" "text",
    "eventId" "text",
    "personId" "text",
    "date" "date",
    "entryId" "text"
);


ALTER TABLE "public"."entries" OWNER TO "postgres";


ALTER TABLE "public"."entries" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."entries_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."entryfees" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "eventId" "text",
    "entryFeeId" "text" NOT NULL,
    "name" "text",
    "amount" smallint,
    "type" "text",
    "valueOperator" "text",
    "order" "text",
    "classType" "text"
);


ALTER TABLE "public"."entryfees" OWNER TO "postgres";


ALTER TABLE "public"."entryfees" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."entryFees_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "eventId" "text",
    "name" "text",
    "disciplineId" "text",
    "classificationId" "text",
    "distance" "text",
    "lightConditions" "text",
    "numberOfEntries" smallint,
    "numberOfStarts" smallint,
    "startDate" "date",
    "location" "json",
    "punchingUnitType" "text",
    "organiserId" "text"[]
);


ALTER TABLE "public"."events" OWNER TO "postgres";


ALTER TABLE "public"."events" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."organisations" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organisationId" "text",
    "name" "text",
    "countryName" "text",
    "parentOrganisationId" "text",
    "type" "text"
);


ALTER TABLE "public"."organisations" OWNER TO "postgres";


ALTER TABLE "public"."organisations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."organisations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."parent_organisations" AS
 SELECT "organisations"."organisationId",
    "organisations"."name" AS "organisationName"
   FROM "public"."organisations"
  WHERE ("organisations"."type" = '2'::"text")
  ORDER BY "organisations"."name";


ALTER TABLE "public"."parent_organisations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."results" (
    "id" bigint NOT NULL,
    "classId" "text",
    "eventId" "text",
    "personId" "text",
    "name" "text",
    "date" "date",
    "resultId" "text"
);


ALTER TABLE "public"."results" OWNER TO "postgres";


ALTER TABLE "public"."results" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."results_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."runners" (
    "id" bigint NOT NULL,
    "personId" "text",
    "gender" "text",
    "fullName" "text",
    "birthDate" "date",
    "nationality" "text",
    "organisationId" "text"
);


ALTER TABLE "public"."runners" OWNER TO "postgres";


ALTER TABLE "public"."runners" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."runners_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_classId_key" UNIQUE ("classId");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classifications"
    ADD CONSTRAINT "classifications_classificationId_key" UNIQUE ("classificationId");



ALTER TABLE ONLY "public"."classifications"
    ADD CONSTRAINT "classifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discipline"
    ADD CONSTRAINT "diciplene_diciplineId_key" UNIQUE ("disciplineId");



ALTER TABLE ONLY "public"."discipline"
    ADD CONSTRAINT "diciplene_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_entryId_key" UNIQUE ("entryId");



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entryfees"
    ADD CONSTRAINT "entryFees_entryFeeId_key" UNIQUE ("entryFeeId");



ALTER TABLE ONLY "public"."entryfees"
    ADD CONSTRAINT "entryFees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_eventId_key" UNIQUE ("eventId");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organisations"
    ADD CONSTRAINT "organisations_organisationId_key" UNIQUE ("organisationId");



ALTER TABLE ONLY "public"."organisations"
    ADD CONSTRAINT "organisations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_resultId_key" UNIQUE ("resultId");



ALTER TABLE ONLY "public"."runners"
    ADD CONSTRAINT "runners_personId_key" UNIQUE ("personId");



ALTER TABLE ONLY "public"."runners"
    ADD CONSTRAINT "runners_pkey" PRIMARY KEY ("id");



CREATE INDEX "events_eventId_idx" ON "public"."events" USING "btree" ("eventId");



CREATE INDEX "idx_classifications_id" ON "public"."classifications" USING "btree" ("classificationId");



CREATE INDEX "idx_entries_personid" ON "public"."entries" USING "btree" ("personId");



CREATE INDEX "idx_events_classification_composite" ON "public"."events" USING "btree" ("startDate", "classificationId", "eventId", "numberOfEntries", "numberOfStarts");



CREATE INDEX "idx_events_startdate" ON "public"."events" USING "btree" ("startDate");



CREATE INDEX "idx_events_startdate_composite" ON "public"."events" USING "btree" ("startDate", "eventId", "numberOfEntries", "numberOfStarts");



CREATE INDEX "idx_events_startdate_disciplineid" ON "public"."events" USING "btree" ("startDate", "disciplineId");



CREATE INDEX "idx_events_startdate_eventid" ON "public"."events" USING "btree" ("startDate", "eventId");



CREATE INDEX "idx_events_startdate_starts" ON "public"."events" USING "btree" ("startDate", "numberOfStarts");



CREATE INDEX "idx_org_parent" ON "public"."organisations" USING "btree" ("parentOrganisationId");



CREATE INDEX "idx_organisations_parentorgid" ON "public"."organisations" USING "btree" ("parentOrganisationId");



CREATE INDEX "idx_organisations_type_name" ON "public"."organisations" USING "btree" ("type", "name") WHERE ("type" = '2'::"text");



CREATE INDEX "idx_organisations_type_parentid" ON "public"."organisations" USING "btree" ("type", "parentOrganisationId");



CREATE INDEX "idx_results_composite" ON "public"."results" USING "btree" ("eventId", "personId");



CREATE INDEX "idx_results_date" ON "public"."results" USING "btree" ("date");



CREATE INDEX "idx_results_event" ON "public"."results" USING "btree" ("eventId");



CREATE INDEX "idx_results_eventid_personid" ON "public"."results" USING "btree" ("eventId", "personId");



CREATE INDEX "idx_results_person" ON "public"."results" USING "btree" ("personId");



CREATE INDEX "idx_results_personid" ON "public"."results" USING "btree" ("personId");



CREATE INDEX "idx_results_resultid" ON "public"."results" USING "btree" ("resultId");



CREATE INDEX "idx_runners_birthdate" ON "public"."runners" USING "btree" ("birthDate");



CREATE INDEX "idx_runners_birthdate_personid" ON "public"."runners" USING "btree" ("birthDate", "personId", "organisationId");



CREATE INDEX "idx_runners_birthdate_personid_orgid" ON "public"."runners" USING "btree" ("birthDate", "personId", "organisationId");



CREATE INDEX "idx_runners_fullname" ON "public"."runners" USING "btree" ("fullName");



CREATE INDEX "idx_runners_fullname_personid" ON "public"."runners" USING "btree" ("fullName", "personId");



CREATE INDEX "idx_runners_org" ON "public"."runners" USING "btree" ("organisationId");



CREATE INDEX "idx_runners_organisationid" ON "public"."runners" USING "btree" ("organisationId");



CREATE INDEX "idx_runners_personid" ON "public"."runners" USING "btree" ("personId");



CREATE INDEX "idx_runners_personid_orgid" ON "public"."runners" USING "btree" ("personId", "organisationId");



CREATE INDEX "results_eventId_idx" ON "public"."results" USING "btree" ("eventId");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."classes"("classId") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_personId_fkey" FOREIGN KEY ("personId") REFERENCES "public"."runners"("personId") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entryfees"
    ADD CONSTRAINT "entryFees_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "public"."classifications"("classificationId") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "public"."discipline"("disciplineId");



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."classes"("classId") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."events"("eventId") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_personId_fkey" FOREIGN KEY ("personId") REFERENCES "public"."runners"("personId") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."runners"
    ADD CONSTRAINT "runners_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "public"."organisations"("organisationId");



CREATE POLICY "Enable insert for authenticated users only" ON "public"."classes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."entries" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."entryfees" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."organisations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."results" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."runners" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."classes" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."classifications" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."discipline" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."entries" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."entryfees" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."events" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."organisations" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."results" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."runners" FOR SELECT USING (true);



CREATE POLICY "Enable update for authenticated users" ON "public"."events" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."classes" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."entries" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."entryfees" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."organisations" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."results" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for users when authenticated" ON "public"."runners" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discipline" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entryfees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organisations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."runners" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





























































































































































































































































































GRANT ALL ON FUNCTION "public"."calculate_runner_age"("birth_date" "date", "event_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_runner_age"("birth_date" "date", "event_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_runner_age"("birth_date" "date", "event_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."clean_up_runners"() TO "anon";
GRANT ALL ON FUNCTION "public"."clean_up_runners"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_up_runners"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_disctrict_starts"("year_param" integer, "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_disctrict_starts"("year_param" integer, "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_disctrict_starts"("year_param" integer, "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_distinct_events"("organisation_ids" "text"[], "discipline_list" "text"[], "todate" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_distinct_events"("organisation_ids" "text"[], "discipline_list" "text"[], "todate" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_distinct_events"("organisation_ids" "text"[], "discipline_list" "text"[], "todate" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_distinct_results"("year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_distinct_results"("year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_distinct_results"("year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_district_starts"("year_param" integer, "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_district_starts"("year_param" integer, "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_district_starts"("year_param" integer, "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_duplicate_runners"("step" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_duplicate_runners"("step" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_duplicate_runners"("step" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_duplicate_runners"("year" integer, "step" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_duplicate_runners"("year" integer, "step" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_duplicate_runners"("year" integer, "step" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_entry_fees"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_entry_fees"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_entry_fees"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_events_by_classification_granularity"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_events_by_classification_granularity"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_events_by_classification_granularity"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_events_by_discipline"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_events_by_discipline"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_events_by_discipline"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_events_by_distance"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_events_by_distance"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_events_by_distance"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_events_by_lightcondition"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_events_by_lightcondition"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_events_by_lightcondition"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_events_by_name"("search_name" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_events_by_name"("search_name" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_events_by_name"("search_name" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_events_by_organisation_year"("year_param" integer, "organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_events_by_organisation_year"("year_param" integer, "organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_events_by_organisation_year"("year_param" integer, "organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_events_count_by_year"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_events_count_by_year"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_events_count_by_year"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_events_location"("year_param" integer, "organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_events_location"("year_param" integer, "organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_events_location"("year_param" integer, "organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_events_starts"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_events_starts"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_events_starts"("granularity" "text", "organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_mid_week_and_weekend_starts"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_mid_week_and_weekend_starts"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_mid_week_and_weekend_starts"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_organisations_by_parent"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_organisations_by_parent"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organisations_by_parent"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_parent_org_stats_by_year"("year_param" integer, "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_parent_org_stats_by_year"("year_param" integer, "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_parent_org_stats_by_year"("year_param" integer, "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_participation_by_birth_year_cohort"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_participation_by_birth_year_cohort"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_participation_by_birth_year_cohort"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_period_by_granularity"("granularity" "text", "startdate" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_period_by_granularity"("granularity" "text", "startdate" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_period_by_granularity"("granularity" "text", "startdate" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_runners_by_age_range"("min_age" integer, "max_age" integer, "organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_runners_by_age_range"("min_age" integer, "max_age" integer, "organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_runners_by_age_range"("min_age" integer, "max_age" integer, "organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_runners_for_year"("year" integer, "birth_year" integer, "organisation_id" "text", "parent_organisation_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_runners_for_year"("year" integer, "birth_year" integer, "organisation_id" "text", "parent_organisation_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_runners_for_year"("year" integer, "birth_year" integer, "organisation_id" "text", "parent_organisation_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_starts_by_age_group"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_starts_by_age_group"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_starts_by_age_group"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_starts_by_organisation_year"("year_param" integer, "organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_starts_by_organisation_year"("year_param" integer, "organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_starts_by_organisation_year"("year_param" integer, "organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_starts_by_year"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_starts_by_year"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_starts_by_year"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unique_runners_by_year"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_unique_runners_by_year"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unique_runners_by_year"("organisation_ids" "text"[], "discipline_list" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_duplicate_runners"("year" integer, "step" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."handle_duplicate_runners"("year" integer, "step" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_duplicate_runners"("year" integer, "step" integer) TO "service_role";





















GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."classes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."classes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."classes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."classifications" TO "anon";
GRANT ALL ON TABLE "public"."classifications" TO "authenticated";
GRANT ALL ON TABLE "public"."classifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."classifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."classifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."classifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."discipline" TO "anon";
GRANT ALL ON TABLE "public"."discipline" TO "authenticated";
GRANT ALL ON TABLE "public"."discipline" TO "service_role";



GRANT ALL ON SEQUENCE "public"."diciplene_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."diciplene_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."diciplene_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."entries" TO "anon";
GRANT ALL ON TABLE "public"."entries" TO "authenticated";
GRANT ALL ON TABLE "public"."entries" TO "service_role";



GRANT ALL ON SEQUENCE "public"."entries_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."entries_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."entries_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."entryfees" TO "anon";
GRANT ALL ON TABLE "public"."entryfees" TO "authenticated";
GRANT ALL ON TABLE "public"."entryfees" TO "service_role";



GRANT ALL ON SEQUENCE "public"."entryFees_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."entryFees_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."entryFees_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."organisations" TO "anon";
GRANT ALL ON TABLE "public"."organisations" TO "authenticated";
GRANT ALL ON TABLE "public"."organisations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."organisations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."organisations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."organisations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."parent_organisations" TO "anon";
GRANT ALL ON TABLE "public"."parent_organisations" TO "authenticated";
GRANT ALL ON TABLE "public"."parent_organisations" TO "service_role";



GRANT ALL ON TABLE "public"."results" TO "anon";
GRANT ALL ON TABLE "public"."results" TO "authenticated";
GRANT ALL ON TABLE "public"."results" TO "service_role";



GRANT ALL ON SEQUENCE "public"."results_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."results_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."results_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."runners" TO "anon";
GRANT ALL ON TABLE "public"."runners" TO "authenticated";
GRANT ALL ON TABLE "public"."runners" TO "service_role";



GRANT ALL ON SEQUENCE "public"."runners_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."runners_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."runners_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
