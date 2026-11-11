-- Histogram of how many runners had N starts in a year.
-- A start is one row in results. Results without a personId are skipped, since
-- they can't be tied to a runner.
-- organisation_ids filters on the runner's own club's district (not the event
-- organiser), and counts all of that runner's starts, wherever they ran.
-- classification_list limits the events to those classifications (event category),
-- NULL means all.
-- same_period cuts every year at today's date (MM-DD), so the current year can be
-- compared with earlier years.
CREATE OR REPLACE FUNCTION public.get_runners_by_start_count(organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[], same_period boolean DEFAULT false, classification_list bigint[] DEFAULT NULL::bigint[])
 RETURNS TABLE(event_year integer, start_count integer, runner_count bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN QUERY
    WITH filtered_events AS (
        SELECT e."eventId", e."startDate"
        FROM get_distinct_events(NULL::bigint[], discipline_list, CASE WHEN same_period THEN 'current' ELSE 'all' END) e
        WHERE classification_list IS NULL OR e."classificationId" = ANY(classification_list)
    ),
    starts_per_runner AS (
        SELECT
            EXTRACT(YEAR FROM fe."startDate")::integer AS yr,
            r."personId",
            COUNT(*)::integer AS n
        FROM filtered_events fe
        INNER JOIN results r ON r."eventId" = fe."eventId"
        WHERE r."personId" IS NOT NULL AND r."personId" <> ''
        GROUP BY 1, 2
    )
    SELECT s.yr, s.n, COUNT(*)::bigint
    FROM starts_per_runner s
    WHERE organisation_ids IS NULL
       OR EXISTS (
            SELECT 1
            FROM runners ru
            INNER JOIN organisations o ON o."organisationId" = ru."organisationId"
            WHERE ru."personId" = s."personId"
              AND o."parentOrganisationId" = ANY(organisation_ids)
       )
    GROUP BY s.yr, s.n
    ORDER BY s.yr, s.n;
END;
$function$
;

GRANT EXECUTE ON FUNCTION public.get_runners_by_start_count(bigint[], bigint[], boolean, bigint[]) TO anon, authenticated, service_role;
