CREATE OR REPLACE FUNCTION public.get_biggest_events_year(year_param integer, organisation_ids bigint[] DEFAULT NULL::bigint[], discipline_list bigint[] DEFAULT NULL::bigint[])
 RETURNS TABLE("eventId" bigint, "eventName" text, "startDate" date, "organisationNames" text, total_starts smallint)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT
      events."eventId",
      events."name" AS eventName,
      events."startDate",
      STRING_AGG(DISTINCT organisations."name", ', ') AS organisationNames,
      MAX(events."numberOfStarts") AS total_starts
  FROM get_distinct_events(organisation_ids, discipline_list, 'all', year_param) AS events
  INNER JOIN organisations ON organisations."organisationId" = ANY(events."organiserId")
  GROUP BY
      events."eventId",
      events."name",
      events."startDate"
  ORDER BY total_starts DESC;
END;
$function$
;

GRANT ALL ON FUNCTION public.get_biggest_events_year(integer, bigint[], bigint[]) TO anon;
GRANT ALL ON FUNCTION public.get_biggest_events_year(integer, bigint[], bigint[]) TO authenticated;
GRANT ALL ON FUNCTION public.get_biggest_events_year(integer, bigint[], bigint[]) TO service_role;
