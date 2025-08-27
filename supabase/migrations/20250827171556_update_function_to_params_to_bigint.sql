drop function if exists "public"."get_distinct_events"(organisation_ids text[], discipline_list text[], date_filter text, filter_year numeric);

drop function if exists "public"."get_district_starts"(year_param integer, discipline_list text[]);

drop function if exists "public"."get_entry_fees"(organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_events_by_classification_granularity"(granularity text, organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_events_by_discipline"(granularity text, organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_events_by_distance"(granularity text, organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_events_by_lightcondition"(granularity text, organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_events_by_name"(search_name text, organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_events_by_organisation_year"(year_param integer, organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_events_count_by_year"(year_param numeric, organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_events_location"(year_param integer, organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_events_starts"(granularity text, organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_mid_week_and_weekend_starts"(organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_parent_org_stats_by_year"(year_param integer, discipline_list text[]);

drop function if exists "public"."get_participation_by_birth_year_cohort"(organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_runners_by_age_range"(year_param numeric, min_age integer, max_age integer, organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_runners_for_year"(year integer, birth_year integer, organisation_id text, parent_organisation_id text);

drop function if exists "public"."get_starts_by_age_group"(organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_starts_by_organisation_year"(year_param integer, organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_starts_by_year"(year_param numeric, organisation_ids text[], discipline_list text[]);

drop function if exists "public"."get_unique_runners_by_year"(year_param numeric, organisation_ids text[], discipline_list text[]);

drop view if exists "public"."parent_organisations";

alter table "public"."events" alter column "organiserId" set data type bigint[] using "organiserId"::bigint[];

alter table "public"."organisations" alter column "parentOrganisationId" set data type bigint using "parentOrganisationId"::bigint;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_distinct_events(organisation_ids bigint[], discipline_list bigint[], date_filter text, filter_year integer DEFAULT NULL::integer)
 RETURNS TABLE("eventId" bigint, name text, "startDate" date, "numberOfEntries" smallint, "numberOfStarts" smallint, "punchingUnitType" text, location json, "lightConditions" text, distance text, "disciplineId" bigint, "classificationId" bigint, "organiserId" bigint[])
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
     WHEN 'current' THEN TO_CHAR(events."startDate", 'MM-DD') <= TO_CHAR(CURRENT_DATE, 'MM-DD')
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

CREATE OR REPLACE FUNCTION public.get_district_starts(year_param integer, discipline_list bigint[] DEFAULT NULL::bigint[])
 RETURNS TABLE(parentorgid bigint, parentorgname text, unique_runners bigint, total_starts bigint, total_entries bigint)
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

CREATE OR REPLACE FUNCTION public.get_entry_fees(organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
 RETURNS TABLE(period text, amount smallint, class_type text, type text, event_classification bigint, event_name text, organiser_name text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        TO_CHAR(events."startDate", 'YYYY') AS period,
        entryfees.amount,
        entryfees."classType" AS class_type,
        entryfees."type" AS type,
        events."classificationId" AS event_classification,
        events."name" AS event_name,
        organisations."name" AS organiser_name
    FROM entryfees
    LEFT JOIN events ON entryfees."eventId" = events."eventId"
    LEFT JOIN organisations ON organisations."organisationId" = ANY(events."organiserId")
    WHERE entryfees."order" = '0'
        AND (organisation_ids IS NULL OR organisations."parentOrganisationId" = ANY(organisation_ids))
        AND (discipline_list IS NULL OR events."disciplineId" = ANY(discipline_list))
    ORDER BY period ASC, entryfees.amount ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_events_by_classification_granularity(granularity text, organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
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

CREATE OR REPLACE FUNCTION public.get_events_by_discipline(granularity text, organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
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

CREATE OR REPLACE FUNCTION public.get_events_by_distance(granularity text DEFAULT 'year'::text, organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
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

CREATE OR REPLACE FUNCTION public.get_events_by_lightcondition(granularity text DEFAULT 'year'::text, organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
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

CREATE OR REPLACE FUNCTION public.get_events_by_name(search_name text, organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
 RETURNS TABLE("eventId" bigint, "eventName" text, "startDate" date, distance text, "organisationNames" text, total_entries smallint, total_starts smallint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        events."eventId", 
        events."name" AS eventName, 
        events."startDate",
        events."distance", 
        STRING_AGG(DISTINCT organisations."name", ', ') AS organisationNames,
        MAX(events."numberOfEntries") AS total_entries,
        MAX(events."numberOfStarts") AS total_starts
    FROM get_distinct_events(organisation_ids, discipline_list, 'all', null) AS events
    INNER JOIN organisations ON organisations."organisationId" = ANY(events."organiserId")
    WHERE LOWER(events."name") LIKE '%' || LOWER(search_name) || '%'
    GROUP BY 
        events."eventId",
        events."name",
        events."startDate", 
        events."distance"
    ORDER BY events."startDate" DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_events_by_organisation_year(year_param integer, organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
 RETURNS TABLE("organisationName" text, "organisationId" bigint, number_of_events bigint, total_entries bigint, total_starts bigint)
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

CREATE OR REPLACE FUNCTION public.get_events_count_by_year(year_param numeric DEFAULT NULL::numeric, organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
 RETURNS TABLE(event_year numeric, total_events bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(YEAR FROM events."startDate") AS event_year,
        COUNT(events."eventId") AS total_events
    FROM get_distinct_events(organisation_ids, discipline_list, CASE 
        WHEN year_param = EXTRACT(YEAR FROM CURRENT_DATE) THEN 'current'
        ELSE 'all'  
    END) AS events
    GROUP BY EXTRACT(YEAR FROM events."startDate")
    ORDER BY event_year ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_events_location(year_param integer DEFAULT NULL::integer, organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
 RETURNS TABLE(location text, "eventId" bigint, "numberOfStarts" smallint, name text, "startDate" date, org_name text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        events."location"::TEXT as location,
        events."eventId",
        events."numberOfStarts",
        events."name",
        events."startDate",
        organisations."name" as org_name
    FROM get_distinct_events(organisation_ids, discipline_list, 'all', year_param) AS events
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_events_starts(granularity text, organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
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

CREATE OR REPLACE FUNCTION public.get_mid_week_and_weekend_starts(organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
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
        events."classificationId" IN (3, 4)
    GROUP BY period 
    ORDER BY period ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_parent_org_stats_by_year(year_param integer, discipline_list bigint[] DEFAULT NULL::bigint[])
 RETURNS TABLE(parentorgname text, number_of_events bigint, nasjonal bigint, krets bigint, naerlop bigint, total_entries bigint, total_starts bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    -- Step 1: Extract unique parentOrganisationIds per event where parent type is 2
    WITH unique_event_parents AS (
        SELECT DISTINCT
            events."eventId",
            parent_organisations."name" AS parent_name,
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
        AND (discipline_list IS NULL OR discipline."disciplineId" = ANY(discipline_list))
        -- Apply year filter
        AND EXTRACT(YEAR FROM events."startDate") = year_param
        -- Only include past events
        AND TO_CHAR(events."startDate", 'MM-DD') < TO_CHAR(CURRENT_DATE, 'MM-DD')
    )
    
    -- Step 2: Aggregate the numberOfStarts for each parentOrganisationId
    SELECT
        parent_name AS parentOrgName,
        COUNT(DISTINCT "eventId") AS number_of_events,
        SUM(CASE WHEN "classificationId" = '2' THEN 1 ELSE 0 END) AS nasjonal,
        SUM(CASE WHEN "classificationId" = '3' THEN 1 ELSE 0 END) AS krets,
        SUM(CASE WHEN "classificationId" = '4' THEN 1 ELSE 0 END) AS naerlop,
        SUM("numberOfEntries") AS total_entries,
        SUM("numberOfStarts") AS total_starts
    FROM
        unique_event_parents
    GROUP BY
        parent_name
    ORDER BY
        total_starts DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_participation_by_birth_year_cohort(organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
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

CREATE OR REPLACE FUNCTION public.get_runners_by_age_range(year_param numeric DEFAULT NULL::numeric, min_age integer DEFAULT NULL::integer, max_age integer DEFAULT NULL::integer, organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
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
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_runners_for_year(year integer DEFAULT NULL::integer, birth_year integer DEFAULT NULL::integer, organisation_id bigint DEFAULT NULL::bigint, parent_organisation_id bigint DEFAULT NULL::bigint)
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
    WHERE (year IS NULL OR EXTRACT(YEAR FROM events."startDate") = year)
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

CREATE OR REPLACE FUNCTION public.get_starts_by_age_group(organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
 RETURNS TABLE(period text, total_starts_under_9 bigint, total_starts_9_10 bigint, total_starts_11_12 bigint, total_starts_13_14 bigint, total_starts_15_16 bigint, total_starts_17_18 bigint, total_starts_19_20 bigint, total_starts_21_34 bigint, total_starts_35_39 bigint, total_starts_40_44 bigint, total_starts_45_49 bigint, total_starts_50_54 bigint, total_starts_55_59 bigint, total_starts_60_64 bigint, total_starts_65_69 bigint, total_starts_70_74 bigint, total_starts_75_79 bigint, total_starts_80_84 bigint, total_starts_85_89 bigint, total_starts_90_plus bigint, total_starts_ungdom bigint, total_starts_junior bigint, total_starts_senior bigint, total_starts_veteran bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
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
        INNER JOIN results ON results."eventId" = event_data."eventId"
        INNER JOIN runners ON results."personId" = runners."personId"
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
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_starts_by_organisation_year(year_param integer, organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
 RETURNS TABLE("organisationId" bigint, "organisationName" text, number_of_runners bigint, total_result_count bigint, total_entries_count bigint)
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

CREATE OR REPLACE FUNCTION public.get_starts_by_year(year_param numeric DEFAULT NULL::numeric, organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
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

CREATE OR REPLACE FUNCTION public.get_unique_runners_by_year(year_param numeric DEFAULT NULL::numeric, organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
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

create or replace view "public"."parent_organisations" as  SELECT organisations."organisationId",
    organisations.name AS "organisationName"
   FROM organisations
  WHERE (organisations.type = '2'::text)
  ORDER BY organisations.name;



