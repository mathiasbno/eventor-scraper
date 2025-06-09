set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_entry_fees_csv(year_param integer)
 RETURNS TABLE(event_id text, event_name text, startdate date, amount smallint, type text, classtype text, name text, organiser_runners_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ef."eventId",
    e.name AS event_name,
    e."startDate",
    ef.amount,
    ef.type,
    ef."classType",
    ef.name,
    COALESCE(runner_counts.organiser_runners, 0) AS organiser_runners_count
  FROM entryfees ef
  LEFT JOIN events e ON ef."eventId" = e."eventId"
  LEFT JOIN (
    SELECT 
      r."eventId",
      COUNT(DISTINCT ru."personId") AS organiser_runners
    FROM results r
    INNER JOIN runners ru ON r."personId" = ru."personId"
    INNER JOIN organisations org ON ru."organisationId" = org."organisationId"
    INNER JOIN events ev ON r."eventId" = ev."eventId"
    WHERE org."organisationId" = ANY(ev."organiserId")
    GROUP BY r."eventId"
  ) runner_counts ON ef."eventId" = runner_counts."eventId"
  WHERE (ef."valueOperator" != 'percent' OR ef."valueOperator" IS NULL)
    AND EXTRACT(YEAR FROM e."startDate") = year_param
  ORDER BY e."name";
END;
$function$
;


