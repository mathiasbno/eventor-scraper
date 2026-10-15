-- The cohort chart dropped runners without a club even with no district selected,
-- so its totals were lower than the age group chart's. Only filter on club when a
-- district is selected.
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
        LEFT JOIN organisations org ON r."organisationId" = org."organisationId"
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

-- Eventor sometimes puts someone else's id on a runner: relays in 2014-2017 carry
-- bib number + leg (team 301, leg 2 -> 302), and people entered by someone else carry
-- that person's id (23476 is on all 172 runners of one race). The birth date and sex
-- that come with it belong to the id's owner. strip_person_ids moves such runners to
-- their own id when exactly one runner with an id has the same name, never ran the
-- same event and was active within two years of them (their club often differs: a
-- runner keeps only their latest club). The rest become name-only runners ("-name",
-- what the scraper makes when there is no id) without the borrowed birth date and sex.
CREATE OR REPLACE FUNCTION public.strip_person_ids(pids text[])
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  stripped integer;
BEGIN
  DROP TABLE IF EXISTS strip_map;
  CREATE TEMP TABLE strip_map ON COMMIT DROP AS
  WITH s AS (
    SELECT ru."personId" AS pid, lower(btrim(ru."fullName")) AS name,
      (SELECT min(r.date) FROM results r WHERE r."personId" = ru."personId") AS first,
      (SELECT max(r.date) FROM results r WHERE r."personId" = ru."personId") AS last
    FROM runners ru
    WHERE ru."personId" = ANY(pids) AND ru."personId" ~ '^[0-9]+-'
  ),
  twin AS (
    SELECT lower(btrim("fullName")) AS name, min("personId") AS pid
    FROM runners
    WHERE "personId" ~ '^[0-9]+-' AND NOT "personId" = ANY(pids)
    GROUP BY 1
    HAVING count(*) = 1
  )
  SELECT s.pid AS old_pid, coalesce((
    SELECT t.pid FROM twin t
    WHERE t.name = s.name
      AND NOT EXISTS (
        SELECT 1 FROM results a
        JOIN results b ON b."eventId" = a."eventId"
        WHERE a."personId" = s.pid AND b."personId" = t.pid)
      AND EXISTS (
        SELECT 1 FROM results r
        WHERE r."personId" = t.pid
          AND r.date BETWEEN s.first - interval '2 years' AND s.last + interval '2 years')
  ), substr(s.pid, strpos(s.pid, '-'))) AS new_pid
  FROM s;

  -- Keep an existing name-only runner, else create one from the old runner with the
  -- latest result.
  INSERT INTO runners ("personId", "fullName", "organisationId", nationality)
  SELECT DISTINCT ON (m.new_pid) m.new_pid, ru."fullName", ru."organisationId", ru.nationality
  FROM strip_map m
  JOIN runners ru ON ru."personId" = m.old_pid
  WHERE m.new_pid LIKE '-%'
    AND NOT EXISTS (SELECT 1 FROM runners x WHERE x."personId" = m.new_pid)
  ORDER BY m.new_pid, (SELECT max(r.date) FROM results r WHERE r."personId" = m.old_pid) DESC NULLS LAST;

  UPDATE results SET "personId" = m.new_pid
  FROM strip_map m
  WHERE results."personId" = m.old_pid;

  UPDATE entries SET "personId" = m.new_pid
  FROM strip_map m
  WHERE entries."personId" = m.old_pid;

  DELETE FROM runners
  WHERE "personId" IN (SELECT old_pid FROM strip_map);
  GET DIAGNOSTICS stripped = ROW_COUNT;
  RETURN stripped;
END;
$function$
;

-- Runner ids are "<Eventor id>-<name>", so one Eventor id can sit on several runners.
-- The runner with the most results owns the id. Runners whose name matches the owner's
-- (same first name, or a near-identical spelling) and who never ran the same event
-- as the owner are the owner under another spelling or a new surname: merged into the
-- owner. The rest borrowed the id: stripped. Runs after every scrape.
CREATE OR REPLACE FUNCTION public.fix_shared_person_ids()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  merged integer;
BEGIN
  DROP TABLE IF EXISTS shared_ids;
  CREATE TEMP TABLE shared_ids ON COMMIT DROP AS
  WITH p AS (
    SELECT ru."personId" AS pid, ru.id, split_part(ru."personId", '-', 1) AS prefix,
      lower(regexp_replace(btrim(ru."fullName"), '\s+', ' ', 'g')) AS name
    FROM runners ru
    WHERE ru."personId" ~ '^[0-9]+-'
  ),
  shared AS (
    SELECT p.*,
      (SELECT count(*) FROM results r WHERE r."personId" = p.pid) AS n,
      (SELECT max(r.date) FROM results r WHERE r."personId" = p.pid) AS last
    FROM p
    WHERE prefix IN (SELECT prefix FROM p GROUP BY 1 HAVING count(*) > 1)
  ),
  owner AS (
    SELECT DISTINCT ON (prefix) prefix, pid AS owner_pid, name AS owner_name
    FROM shared
    ORDER BY prefix, n DESC, last DESC NULLS LAST, id
  )
  SELECT s.pid, o.owner_pid,
    (split_part(s.name, ' ', 1) = split_part(o.owner_name, ' ', 1)
      OR extensions.similarity(s.name, o.owner_name) > 0.6)
    AND NOT EXISTS (
      SELECT 1 FROM results a
      JOIN results b ON b."eventId" = a."eventId"
      WHERE a."personId" = s.pid AND b."personId" = o.owner_pid
    ) AS same_person
  FROM shared s
  JOIN owner o USING (prefix)
  WHERE s.pid <> o.owner_pid;

  UPDATE results SET "personId" = s.owner_pid
  FROM shared_ids s
  WHERE s.same_person AND results."personId" = s.pid;

  UPDATE entries SET "personId" = s.owner_pid
  FROM shared_ids s
  WHERE s.same_person AND entries."personId" = s.pid;

  DELETE FROM runners
  WHERE "personId" IN (SELECT pid FROM shared_ids WHERE same_person);
  GET DIAGNOSTICS merged = ROW_COUNT;

  RETURN merged + strip_person_ids(ARRAY(SELECT pid FROM shared_ids WHERE NOT same_person));
END;
$function$
;

-- Only the scraper (service role) runs these; they delete runners.
REVOKE EXECUTE ON FUNCTION public.strip_person_ids(text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fix_shared_person_ids() FROM PUBLIC, anon, authenticated;
