-- get_duplicate_runners returns both directions for runners with the same last_used
-- date, and chains (A <- B <- C). The old merge then deleted runners that still had
-- results pointing at them, and ON DELETE SET NULL wiped those results' personId.
-- Now: keep one direction of mirrored pairs, and skip duplicates that are themselves
-- an original this round (a later run picks them up). Update and delete share one list.
CREATE OR REPLACE FUNCTION public.handle_duplicate_runners(year integer, step integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DROP TABLE IF EXISTS merge_pairs;
  CREATE TEMP TABLE merge_pairs ON COMMIT DROP AS
  WITH d AS (
    SELECT original_personid, duplicate_personid FROM get_duplicate_runners(year, step)
  ),
  pairs AS (
    SELECT * FROM d
    WHERE d.original_personid > d.duplicate_personid
       OR NOT EXISTS (
         SELECT 1 FROM d m
         WHERE m.original_personid = d.duplicate_personid
           AND m.duplicate_personid = d.original_personid)
  )
  SELECT DISTINCT ON (duplicate_personid) original_personid, duplicate_personid
  FROM pairs
  WHERE duplicate_personid NOT IN (SELECT original_personid FROM pairs)
  ORDER BY duplicate_personid, original_personid;

  UPDATE results
  SET "personId" = m.original_personid
  FROM merge_pairs m
  WHERE results."personId" = m.duplicate_personid;

  DELETE FROM runners
  WHERE "personId" IN (SELECT duplicate_personid FROM merge_pairs);
END;
$function$
;
