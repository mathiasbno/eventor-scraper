-- get_distinct_events lost its argument defaults in 20250827171556, so the
-- no-argument call here failed and broke the runner merge (handle_duplicate_runners).
-- The old call also defaulted to date_filter 'current', cutting each year at today's date.
CREATE OR REPLACE FUNCTION public.get_distinct_results(year integer DEFAULT NULL::integer)
 RETURNS TABLE(resultid text, startdate date, personid text)
 LANGUAGE sql
AS $function$
SELECT DISTINCT
    results."resultId",
    events."startDate",
    results."personId"
FROM results
INNER JOIN get_distinct_events(NULL, NULL, 'all', year) AS events
    ON results."eventId" = events."eventId"
ORDER BY events."startDate" DESC;
$function$
;
