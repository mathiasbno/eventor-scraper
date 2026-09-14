DROP FUNCTION IF EXISTS public.get_starts_by_age_group(bigint[], bigint[]);

-- count_unique: count distinct runners instead of starts. A runner has one age per year,
-- so distinct counts per (period, age) sum correctly into the age groups.
CREATE OR REPLACE FUNCTION public.get_starts_by_age_group(organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[], count_unique boolean DEFAULT false)
 RETURNS TABLE(period text, total_starts_under_9 bigint, total_starts_9_10 bigint, total_starts_11_12 bigint, total_starts_13_14 bigint, total_starts_15_16 bigint, total_starts_17_18 bigint, total_starts_19_20 bigint, total_starts_21_34 bigint, total_starts_35_39 bigint, total_starts_40_44 bigint, total_starts_45_49 bigint, total_starts_50_54 bigint, total_starts_55_59 bigint, total_starts_60_64 bigint, total_starts_65_69 bigint, total_starts_70_74 bigint, total_starts_75_79 bigint, total_starts_80_84 bigint, total_starts_85_89 bigint, total_starts_90_plus bigint, total_starts_ungdom bigint, total_starts_junior bigint, total_starts_senior bigint, total_starts_veteran bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN QUERY
  WITH results_with_starts_count
AS (
	SELECT CAST (EXTRACT(YEAR FROM e."startDate") as text ) AS "period"
		,EXTRACT(YEAR FROM e."startDate") - EXTRACT(YEAR FROM ru."birthDate") AS "age"
		,CASE WHEN count_unique THEN COUNT(DISTINCT r."personId") ELSE COUNT(r."id") END AS "starts_count"
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

GRANT ALL ON FUNCTION public.get_starts_by_age_group(bigint[], bigint[], boolean) TO anon;
GRANT ALL ON FUNCTION public.get_starts_by_age_group(bigint[], bigint[], boolean) TO authenticated;
GRANT ALL ON FUNCTION public.get_starts_by_age_group(bigint[], bigint[], boolean) TO service_role;
