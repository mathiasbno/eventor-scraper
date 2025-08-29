create extension if not exists "hypopg" with schema "extensions";

create extension if not exists "index_advisor" with schema "extensions";


drop function if exists "public"."get_duplicate_runners"(step integer);

drop function if exists "public"."get_duplicate_runners"(year integer, step integer);

drop index if exists "public"."events_eventId_idx";

drop index if exists "public"."idx_classifications_id";

drop index if exists "public"."idx_events_classification_composite";

drop index if exists "public"."idx_events_startdate_composite";

drop index if exists "public"."idx_events_startdate_disciplineid";

drop index if exists "public"."idx_events_startdate_eventid";

drop index if exists "public"."idx_org_parent";

drop index if exists "public"."idx_organisations_type_name";

drop index if exists "public"."idx_results_composite";

drop index if exists "public"."idx_results_date";

drop index if exists "public"."idx_results_event";

drop index if exists "public"."idx_results_eventid_personid";

drop index if exists "public"."idx_results_person";

drop index if exists "public"."idx_results_resultid";

drop index if exists "public"."idx_runners_birthdate_personid";

drop index if exists "public"."idx_runners_birthdate_personid_orgid";

drop index if exists "public"."idx_runners_fullname";

drop index if exists "public"."idx_runners_org";

drop index if exists "public"."idx_runners_organisationid";

drop index if exists "public"."idx_runners_personid";

drop index if exists "public"."idx_runners_personid_orgid";

CREATE INDEX "classes_eventId_idx" ON public.classes USING btree ("eventId");

CREATE INDEX "entries_eventId_idx" ON public.entries USING btree ("eventId");

CREATE INDEX "entryfees_eventId_idx" ON public.entryfees USING btree ("eventId");

CREATE INDEX "events_classificationId_idx" ON public.events USING btree ("classificationId");

CREATE INDEX "events_disciplineId_idx" ON public.events USING btree ("disciplineId");

CREATE INDEX "results_classId_idx" ON public.results USING btree ("classId");

CREATE INDEX "runners_organisationId_idx" ON public.runners USING btree ("organisationId");

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_duplicate_runners(year integer, step integer DEFAULT 1)
 RETURNS TABLE(original_fullname text, duplicate_fullname text, original_personid text, duplicate_personid text)
 LANGUAGE sql
AS $function$WITH runner_counts AS (
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
                           AND similarity(rc1."fullName"::text, rc2."fullName"::text) > 0.9
        WHEN step = 3 THEN similarity(rc1."personId"::text, rc2."personId"::text) > 0.9
        ELSE rc1."fullName" = rc2."fullName"
    END
  )
  AND rc1."personId" <> rc2."personId"
WHERE rc1."last_used" >= rc2."last_used"
LIMIT 5000;$function$
;

CREATE OR REPLACE FUNCTION public.get_starts_by_age_group(organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
 RETURNS TABLE(period text, total_starts_under_9 bigint, total_starts_9_10 bigint, total_starts_11_12 bigint, total_starts_13_14 bigint, total_starts_15_16 bigint, total_starts_17_18 bigint, total_starts_19_20 bigint, total_starts_21_34 bigint, total_starts_35_39 bigint, total_starts_40_44 bigint, total_starts_45_49 bigint, total_starts_50_54 bigint, total_starts_55_59 bigint, total_starts_60_64 bigint, total_starts_65_69 bigint, total_starts_70_74 bigint, total_starts_75_79 bigint, total_starts_80_84 bigint, total_starts_85_89 bigint, total_starts_90_plus bigint, total_starts_ungdom bigint, total_starts_junior bigint, total_starts_senior bigint, total_starts_veteran bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
  WITH results_with_starts_count
AS (
	SELECT CAST (EXTRACT(YEAR FROM e."startDate") as text ) AS "period"
		,EXTRACT(YEAR FROM e."startDate") - EXTRACT(YEAR FROM ru."birthDate") AS "age"
		,COUNT(r."id") AS "starts_count"
	FROM results r
	INNER JOIN (
		SELECT DISTINCT e2."id"
			,e2."eventId"
			,e2."startDate"
			,e2."organiserId"
			,e2."disciplineId"
		FROM events e2
		INNER JOIN organisations o ON o."organisationId" = ANY(e2."organiserId")
		INNER JOIN discipline d ON e2."disciplineId" = d."disciplineId"
		WHERE 
			(organisation_ids IS NULL OR o."parentOrganisationId" = ANY(organisation_ids))
			AND (discipline_list IS NULL OR d."disciplineId" = ANY(discipline_list))
		) e ON r."eventId" = e."eventId"
	INNER JOIN runners ru ON r."personId" = ru."personId"
	WHERE ru."birthDate" IS NOT NULL
	GROUP BY period
		,age
	)
SELECT r."period",
	CAST(SUM(starts_count) FILTER (WHERE age <= 8) as bigint) AS "total_starts_under_9",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 9 AND 10) as bigint) AS "total_starts_9_10",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 11 AND 12) as bigint) AS "total_starts_11_12",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 13 AND 14) as bigint) AS "total_starts_13_14",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 15 AND 16) as bigint) AS "total_starts_15_16",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 17 AND 18) as bigint) AS "total_starts_17_18",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 19 AND 20) as bigint) AS "total_starts_19_20",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 21 AND 34) as bigint) AS "total_starts_21_34",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 35 AND 39) as bigint) AS "total_starts_35_39",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 40 AND 44) as bigint) AS "total_starts_40_44",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 45 AND 49) as bigint) AS "total_starts_45_49",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 50 AND 54) as bigint) AS "total_starts_50_54",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 55 AND 59) as bigint) AS "total_starts_55_59",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 60 AND 64) as bigint) AS "total_starts_60_64",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 65 AND 69) as bigint) AS "total_starts_65_69",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 70 AND 74) as bigint) AS "total_starts_70_74",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 75 AND 79) as bigint) AS "total_starts_75_79",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 80 AND 84) as bigint) AS "total_starts_80_84",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 85 AND 89) as bigint) AS "total_starts_85_89",
	CAST(SUM(starts_count) FILTER (WHERE age >= 90) as bigint) AS "total_starts_90_plus",

	CAST(SUM(starts_count) FILTER (WHERE age <= 16) as bigint) AS "total_starts_ungdom",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 17 AND 20) as bigint) AS "total_starts_junior",
	CAST(SUM(starts_count) FILTER (WHERE age BETWEEN 21 AND 34) as bigint) AS "total_starts_senior",
	CAST(SUM(starts_count) FILTER (WHERE age >= 35) as bigint) AS "total_starts_veteran"
FROM results_with_starts_count r
GROUP BY r.period
ORDER BY r.period;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_duplicate_runners(year integer, step integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
AS $function$BEGIN
  -- 1) Re‑link all results from the duplicates back to the original
  UPDATE results
  SET "personId" = tdr.original_personId
  FROM get_duplicate_runners(year, step) AS tdr
  WHERE results."personId" = tdr.duplicate_personId;

  -- 2) Remove the duplicate runner rows
  DELETE FROM runners
  WHERE "personId" IN (
    SELECT duplicate_personId
    FROM get_duplicate_runners(year, step)
  );
END;$function$
;


