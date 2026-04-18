CREATE TYPE "public"."entity_kind_enum" AS ENUM('person', 'animal', 'place');--> statement-breakpoint
CREATE TABLE "animal_profile" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"species" text NOT NULL,
	"breed" text,
	"sex" text,
	"reproductive_status" text,
	"birth_date" date,
	"death_date" date,
	"notes" text,
	CONSTRAINT "animal_profile_birth_death_check" CHECK ("animal_profile"."death_date" is null or "animal_profile"."birth_date" is null or "animal_profile"."death_date" >= "animal_profile"."birth_date")
);
--> statement-breakpoint
CREATE TABLE "entity" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_kind" "entity_kind_enum" NOT NULL,
	"canonical_display_name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_attribute" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_id" uuid,
	"key" text,
	"value_text" text,
	"value_number" double precision,
	"value_json" jsonb,
	"start_date" date,
	"end_date" date
);
--> statement-breakpoint
CREATE TABLE "entity_name" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_id" uuid NOT NULL,
	"name_text" text NOT NULL,
	"language_code" text,
	"script_code" text,
	"name_type" text NOT NULL,
	"is_primary" boolean DEFAULT false,
	"start_date" date,
	"end_date" date,
	"notes" text,
	"sort_order" integer,
	CONSTRAINT "entity_name_date_check" CHECK ("entity_name"."end_date" is null or "entity_name"."start_date" is null or "entity_name"."end_date" >= "entity_name"."start_date")
);
--> statement-breakpoint
CREATE TABLE "entity_place_relationship" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"relationship_type" text,
	"start_date" date,
	"end_date" date,
	"notes" text,
	CONSTRAINT "entity_place_relationship_date_check" CHECK ("entity_place_relationship"."end_date" is null or "entity_place_relationship"."start_date" is null or "entity_place_relationship"."end_date" >= "entity_place_relationship"."start_date")
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_type_id" uuid NOT NULL,
	"title" text,
	"description" text,
	"start_datetime" timestamp NOT NULL,
	"end_datetime" timestamp,
	"date_precision" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "event_datetime_range_check" CHECK ("event"."end_datetime" is null or "event"."end_datetime" >= "event"."start_datetime")
);
--> statement-breakpoint
CREATE TABLE "event_participant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"role_in_event" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "event_place" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"role" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "event_relationship" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"role" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "event_type" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	CONSTRAINT "event_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "media_asset" (
	"id" uuid PRIMARY KEY NOT NULL,
	"media_type" text NOT NULL,
	"storage_url" text NOT NULL,
	"thumbnail_url" text,
	"taken_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"description" text,
	"uploaded_by" uuid
);
--> statement-breakpoint
CREATE TABLE "media_link" (
	"id" uuid PRIMARY KEY NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"link_type" text,
	"sort_order" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "person_profile" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"birth_date" date,
	"death_date" date,
	"sex_at_birth" text,
	"gender_identity" text,
	"notes" text,
	CONSTRAINT "person_profile_birth_death_check" CHECK ("person_profile"."death_date" is null or "person_profile"."birth_date" is null or "person_profile"."death_date" >= "person_profile"."birth_date")
);
--> statement-breakpoint
CREATE TABLE "place_profile" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"place_type" text NOT NULL,
	"built_date" date,
	"demolished_date" date,
	"lat" double precision,
	"lng" double precision,
	"address_text" text,
	"notes" text,
	CONSTRAINT "place_profile_built_demolished_check" CHECK ("place_profile"."demolished_date" is null or "place_profile"."built_date" is null or "place_profile"."demolished_date" >= "place_profile"."built_date")
);
--> statement-breakpoint
CREATE TABLE "relationship" (
	"id" uuid PRIMARY KEY NOT NULL,
	"relationship_type_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationship_interval" (
	"id" uuid PRIMARY KEY NOT NULL,
	"relationship_id" uuid NOT NULL,
	"valid_from" timestamp NOT NULL,
	"valid_to" timestamp,
	"status" text,
	"notes" text,
	CONSTRAINT "relationship_interval_valid_range_check" CHECK ("relationship_interval"."valid_to" is null or "relationship_interval"."valid_to" >= "relationship_interval"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "relationship_participant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"relationship_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"role_in_relationship" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"notes" text,
	CONSTRAINT "relationship_participant_date_check" CHECK ("relationship_participant"."end_date" is null or "relationship_participant"."start_date" is null or "relationship_participant"."end_date" >= "relationship_participant"."start_date")
);
--> statement-breakpoint
CREATE TABLE "relationship_type" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"display_name" text NOT NULL,
	"is_directed" boolean NOT NULL,
	"category" text,
	"allows_multiple_participants" boolean,
	"description" text,
	CONSTRAINT "relationship_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "animal_profile" ADD CONSTRAINT "animal_profile_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_attribute" ADD CONSTRAINT "entity_attribute_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_name" ADD CONSTRAINT "entity_name_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_place_relationship" ADD CONSTRAINT "entity_place_relationship_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_place_relationship" ADD CONSTRAINT "entity_place_relationship_place_id_entity_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_event_type_id_event_type_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participant" ADD CONSTRAINT "event_participant_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participant" ADD CONSTRAINT "event_participant_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_place" ADD CONSTRAINT "event_place_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_place" ADD CONSTRAINT "event_place_place_id_entity_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_relationship" ADD CONSTRAINT "event_relationship_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_relationship" ADD CONSTRAINT "event_relationship_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_link" ADD CONSTRAINT "media_link_media_asset_id_media_asset_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_profile" ADD CONSTRAINT "person_profile_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_profile" ADD CONSTRAINT "place_profile_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship" ADD CONSTRAINT "relationship_relationship_type_id_relationship_type_id_fk" FOREIGN KEY ("relationship_type_id") REFERENCES "public"."relationship_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_interval" ADD CONSTRAINT "relationship_interval_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_participant" ADD CONSTRAINT "relationship_participant_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_participant" ADD CONSTRAINT "relationship_participant_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_entity_name_entity_id" ON "entity_name" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_event_start" ON "event" USING btree ("start_datetime");--> statement-breakpoint
CREATE INDEX "idx_media_link_subject" ON "media_link" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "idx_relationship_interval_time" ON "relationship_interval" USING btree ("valid_from","valid_to");--> statement-breakpoint
CREATE INDEX "idx_relationship_participant_entity_id" ON "relationship_participant" USING btree ("entity_id");