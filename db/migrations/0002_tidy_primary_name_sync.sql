ALTER TABLE "entity" ALTER COLUMN "canonical_display_name" SET DEFAULT '';
--> statement-breakpoint
UPDATE "entity_name"
SET "is_primary" = false
WHERE "is_primary" IS NULL;
--> statement-breakpoint
WITH ranked_primary AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "entity_id"
      ORDER BY "sort_order" ASC NULLS LAST, "id" ASC
    ) AS "rn"
  FROM "entity_name"
  WHERE "is_primary" IS TRUE
)
UPDATE "entity_name" AS target
SET "is_primary" = false
FROM ranked_primary
WHERE target."id" = ranked_primary."id"
  AND ranked_primary."rn" > 1;
--> statement-breakpoint
WITH missing_primary AS (
  SELECT "id"
  FROM (
    SELECT
      "id",
      row_number() OVER (
        PARTITION BY "entity_id"
        ORDER BY "sort_order" ASC NULLS LAST, "id" ASC
      ) AS "rn",
      max(CASE WHEN "is_primary" THEN 1 ELSE 0 END) OVER (
        PARTITION BY "entity_id"
      ) AS "has_primary"
    FROM "entity_name"
  ) ranked
  WHERE ranked."has_primary" = 0
    AND ranked."rn" = 1
)
UPDATE "entity_name" AS target
SET "is_primary" = true
FROM missing_primary
WHERE target."id" = missing_primary."id";
--> statement-breakpoint
ALTER TABLE "entity_name" ALTER COLUMN "is_primary" SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE "entity_name" ALTER COLUMN "is_primary" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_entity_name_primary_per_entity"
  ON "entity_name" USING btree ("entity_id")
  WHERE "is_primary" IS TRUE;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sync_entity_canonical_display_name(p_entity_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_name text;
BEGIN
  SELECT n."name_text"
    INTO resolved_name
  FROM "entity_name" AS n
  WHERE n."entity_id" = p_entity_id
  ORDER BY n."is_primary" DESC, n."sort_order" ASC NULLS LAST, n."id" ASC
  LIMIT 1;

  UPDATE "entity"
  SET "canonical_display_name" = COALESCE(resolved_name, '')
  WHERE "id" = p_entity_id;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION trg_sync_entity_canonical_display_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM sync_entity_canonical_display_name(OLD."entity_id");
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW."entity_id" <> OLD."entity_id" THEN
    PERFORM sync_entity_canonical_display_name(OLD."entity_id");
  END IF;

  PERFORM sync_entity_canonical_display_name(NEW."entity_id");
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "entity_name_sync_canonical_display_name" ON "entity_name";
--> statement-breakpoint
CREATE TRIGGER "entity_name_sync_canonical_display_name"
AFTER INSERT OR UPDATE OR DELETE ON "entity_name"
FOR EACH ROW
EXECUTE FUNCTION trg_sync_entity_canonical_display_name();
--> statement-breakpoint
UPDATE "entity" AS e
SET "canonical_display_name" = COALESCE(
  (
    SELECT n."name_text"
    FROM "entity_name" AS n
    WHERE n."entity_id" = e."id"
    ORDER BY n."is_primary" DESC, n."sort_order" ASC NULLS LAST, n."id" ASC
    LIMIT 1
  ),
  e."canonical_display_name",
  ''
);
