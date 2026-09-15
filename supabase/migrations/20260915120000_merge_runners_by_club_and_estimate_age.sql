-- handle_duplicate_runners only pairs runners that both have results in the same year,
-- so a runner entered by name only (personId "-name", no Eventor account) is never
-- merged with the same person's Eventor account from another year. This merges runners
-- with the same name and club across all years, unless they have different birth dates
-- from Eventor. The kept runner has an Eventor birth date and id when anyone in the group has one.
ALTER TABLE public.runners ADD COLUMN IF NOT EXISTS "birthDateEstimated" boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.merge_runners_by_name_and_club()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  merged integer;
BEGIN
  DROP TABLE IF EXISTS club_merge_pairs;
  CREATE TEMP TABLE club_merge_pairs ON COMMIT DROP AS
  WITH groups AS (
    SELECT lower(btrim("fullName")) AS name, "organisationId"
    FROM runners
    WHERE "organisationId" IS NOT NULL
    GROUP BY 1, 2
    HAVING count(*) > 1
      AND count(DISTINCT "birthDate") FILTER (WHERE NOT "birthDateEstimated") <= 1
  ),
  ranked AS (
    SELECT ru."personId", g.name, g."organisationId",
      row_number() OVER (
        PARTITION BY g.name, g."organisationId"
        ORDER BY ru."birthDate" IS NULL OR ru."birthDateEstimated",
          ru."personId" LIKE '-%',
          (SELECT max(r.date) FROM results r WHERE r."personId" = ru."personId") DESC NULLS LAST,
          ru.id
      ) AS rn
    FROM runners ru
    JOIN groups g ON g.name = lower(btrim(ru."fullName")) AND g."organisationId" = ru."organisationId"
  )
  SELECT k."personId" AS original_personid, d."personId" AS duplicate_personid
  FROM ranked d
  JOIN ranked k ON k.name = d.name AND k."organisationId" = d."organisationId" AND k.rn = 1
  WHERE d.rn > 1;

  UPDATE results SET "personId" = m.original_personid
  FROM club_merge_pairs m
  WHERE results."personId" = m.duplicate_personid;

  UPDATE entries SET "personId" = m.original_personid
  FROM club_merge_pairs m
  WHERE entries."personId" = m.duplicate_personid;

  DELETE FROM runners
  WHERE "personId" IN (SELECT duplicate_personid FROM club_merge_pairs);
  GET DIAGNOSTICS merged = ROW_COUNT;
  RETURN merged;
END;
$function$
;

-- Runners without a birth date from Eventor get one estimated from the age limits of the
-- classes they ran (age = event year - birth year), stored as 1 January like Eventor's
-- and flagged "birthDateEstimated". The scraper sends the flag as false with every runner
-- upsert, so a real Eventor date always wins and this refills the rest. Backtested on
-- runners with an Eventor birth date, in order of priority:
--   class limits narrow it to 2 years or less: 95% in range, median error 0
--   step up to the next youth/veteran class in consecutive years: 76% exact
--   veteran classes only, youngest allowed age: median error 2 years
-- Everyone else stays null.
CREATE OR REPLACE FUNCTION public.estimate_birth_years()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  updated integer;
BEGIN
  WITH rc AS (
    SELECT r."personId", EXTRACT(YEAR FROM r.date)::int AS y,
      NULLIF(c."lowAge", 0) AS lo, NULLIF(c."highAge", 0) AS hi
    FROM results r
    JOIN runners ru ON ru."personId" = r."personId"
      AND (ru."birthDate" IS NULL OR ru."birthDateEstimated")
    JOIN classes c ON c."classId" = r."classId"
  ),
  bounds AS (
    SELECT "personId", max(y - hi) AS min_by, min(y - lo) AS max_by, max(lo) AS max_lo
    FROM rc GROUP BY 1
  ),
  -- oldest class (highest lower age limit) per year, to find step ups between years
  ry AS (SELECT "personId", y, max(lo) AS lo FROM rc GROUP BY 1, 2),
  steps AS (
    SELECT "personId", percentile_disc(0.5) WITHIN GROUP (ORDER BY y - lo) AS est
    FROM (
      SELECT *, lag(y) OVER w AS py, lag(lo) OVER w AS plo
      FROM ry WINDOW w AS (PARTITION BY "personId" ORDER BY y)
    ) t
    WHERE py = y - 1 AND lo > plo AND (plo >= 35 OR (plo >= 9 AND lo <= 17))
    GROUP BY 1
  ),
  est AS (
    SELECT b."personId", make_date((CASE
      WHEN b.min_by <= b.max_by AND b.max_by - b.min_by <= 2 THEN round((b.min_by + b.max_by) / 2.0)
      WHEN s.est IS NOT NULL THEN s.est
      WHEN b.min_by IS NULL AND b.max_lo >= 35 THEN b.max_by
    END)::int, 1, 1) AS est
    FROM bounds b LEFT JOIN steps s USING ("personId")
  )
  UPDATE runners ru SET "birthDate" = est.est, "birthDateEstimated" = est.est IS NOT NULL
  FROM est
  WHERE ru."personId" = est."personId"
    AND (ru."birthDate" IS NULL OR ru."birthDateEstimated")
    AND ru."birthDate" IS DISTINCT FROM est.est;
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated;
END;
$function$
;

-- Only the scraper (service role) runs these; the merge deletes runners.
REVOKE EXECUTE ON FUNCTION public.merge_runners_by_name_and_club() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.estimate_birth_years() FROM PUBLIC, anon, authenticated;
