import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core"

export const entityKindEnum = pgEnum("entity_kind_enum", ["person", "animal", "place"])

export const appUser = pgTable(
  "app_user",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow()
  },
  (table) => [index("idx_app_user_email").on(table.email)]
)

export const userGraph = pgTable(
  "user_graph",
  {
    id: uuid("id").primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow()
  },
  (table) => [index("idx_user_graph_owner_user_id").on(table.ownerUserId)]
)

export const userSession = pgTable(
  "user_session",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow()
  },
  (table) => [
    index("idx_user_session_user_id").on(table.userId),
    index("idx_user_session_expires_at").on(table.expiresAt)
  ]
)

export const entity = pgTable("entity", {
  id: uuid("id").primaryKey(),
  graphId: uuid("graph_id").references(() => userGraph.id, { onDelete: "cascade" }),
  entityKind: entityKindEnum("entity_kind").notNull(),
  canonicalDisplayName: text("canonical_display_name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow()
},
(table) => [index("idx_entity_graph_id").on(table.graphId)])

export const personProfile = pgTable(
  "person_profile",
  {
    entityId: uuid("entity_id")
      .primaryKey()
      .references(() => entity.id, { onDelete: "cascade" }),
    birthDate: date("birth_date", { mode: "string" }),
    deathDate: date("death_date", { mode: "string" }),
    sexAtBirth: text("sex_at_birth"),
    genderIdentity: text("gender_identity"),
    notes: text("notes")
  },
  (table) => [
    check(
      "person_profile_birth_death_check",
      sql`${table.deathDate} is null or ${table.birthDate} is null or ${table.deathDate} >= ${table.birthDate}`
    )
  ]
)

export const animalProfile = pgTable(
  "animal_profile",
  {
    entityId: uuid("entity_id")
      .primaryKey()
      .references(() => entity.id, { onDelete: "cascade" }),
    species: text("species").notNull(),
    breed: text("breed"),
    sex: text("sex"),
    reproductiveStatus: text("reproductive_status"),
    birthDate: date("birth_date", { mode: "string" }),
    deathDate: date("death_date", { mode: "string" }),
    notes: text("notes")
  },
  (table) => [
    check(
      "animal_profile_birth_death_check",
      sql`${table.deathDate} is null or ${table.birthDate} is null or ${table.deathDate} >= ${table.birthDate}`
    )
  ]
)

export const placeProfile = pgTable(
  "place_profile",
  {
    entityId: uuid("entity_id")
      .primaryKey()
      .references(() => entity.id, { onDelete: "cascade" }),
    placeType: text("place_type").notNull(),
    builtDate: date("built_date", { mode: "string" }),
    demolishedDate: date("demolished_date", { mode: "string" }),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    addressText: text("address_text"),
    notes: text("notes")
  },
  (table) => [
    check(
      "place_profile_built_demolished_check",
      sql`${table.demolishedDate} is null or ${table.builtDate} is null or ${table.demolishedDate} >= ${table.builtDate}`
    )
  ]
)

export const entityName = pgTable(
  "entity_name",
  {
    id: uuid("id").primaryKey(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entity.id, { onDelete: "cascade" }),
    nameText: text("name_text").notNull(),
    languageCode: text("language_code"),
    scriptCode: text("script_code"),
    nameType: text("name_type").notNull(),
    isPrimary: boolean("is_primary").default(false),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    notes: text("notes"),
    sortOrder: integer("sort_order")
  },
  (table) => [
    index("idx_entity_name_entity_id").on(table.entityId),
    check("entity_name_date_check", sql`${table.endDate} is null or ${table.startDate} is null or ${table.endDate} >= ${table.startDate}`)
  ]
)

export const relationshipType = pgTable("relationship_type", {
  id: uuid("id").primaryKey(),
  code: text("code").notNull().unique(),
  displayName: text("display_name").notNull(),
  isDirected: boolean("is_directed").notNull(),
  category: text("category"),
  allowsMultipleParticipants: boolean("allows_multiple_participants"),
  description: text("description")
})

export const relationship = pgTable("relationship", {
  id: uuid("id").primaryKey(),
  graphId: uuid("graph_id").references(() => userGraph.id, { onDelete: "cascade" }),
  relationshipTypeId: uuid("relationship_type_id")
    .notNull()
    .references(() => relationshipType.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow()
},
(table) => [index("idx_relationship_graph_id").on(table.graphId)])

export const relationshipParticipant = pgTable(
  "relationship_participant",
  {
    id: uuid("id").primaryKey(),
    relationshipId: uuid("relationship_id")
      .notNull()
      .references(() => relationship.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entity.id),
    roleInRelationship: text("role_in_relationship").notNull(),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    notes: text("notes")
  },
  (table) => [
    index("idx_relationship_participant_entity_id").on(table.entityId),
    check(
      "relationship_participant_date_check",
      sql`${table.endDate} is null or ${table.startDate} is null or ${table.endDate} >= ${table.startDate}`
    )
  ]
)

export const relationshipInterval = pgTable(
  "relationship_interval",
  {
    id: uuid("id").primaryKey(),
    relationshipId: uuid("relationship_id")
      .notNull()
      .references(() => relationship.id, { onDelete: "cascade" }),
    validFrom: timestamp("valid_from", { mode: "string" }).notNull(),
    validTo: timestamp("valid_to", { mode: "string" }),
    status: text("status"),
    notes: text("notes")
  },
  (table) => [
    index("idx_relationship_interval_time").on(table.validFrom, table.validTo),
    check("relationship_interval_valid_range_check", sql`${table.validTo} is null or ${table.validTo} >= ${table.validFrom}`)
  ]
)

export const eventType = pgTable("event_type", {
  id: uuid("id").primaryKey(),
  code: text("code").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description")
})

export const event = pgTable(
  "event",
  {
    id: uuid("id").primaryKey(),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventType.id),
    title: text("title"),
    description: text("description"),
    startDatetime: timestamp("start_datetime", { mode: "string" }).notNull(),
    endDatetime: timestamp("end_datetime", { mode: "string" }),
    datePrecision: text("date_precision"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow()
  },
  (table) => [
    index("idx_event_start").on(table.startDatetime),
    check(
      "event_datetime_range_check",
      sql`${table.endDatetime} is null or ${table.endDatetime} >= ${table.startDatetime}`
    )
  ]
)

export const eventParticipant = pgTable("event_participant", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entity.id),
  roleInEvent: text("role_in_event"),
  notes: text("notes")
})

export const eventRelationship = pgTable("event_relationship", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  relationshipId: uuid("relationship_id")
    .notNull()
    .references(() => relationship.id),
  role: text("role"),
  notes: text("notes")
})

export const entityPlaceRelationship = pgTable(
  "entity_place_relationship",
  {
    id: uuid("id").primaryKey(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entity.id),
    placeId: uuid("place_id")
      .notNull()
      .references(() => entity.id),
    relationshipType: text("relationship_type"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    notes: text("notes")
  },
  (table) => [
    check(
      "entity_place_relationship_date_check",
      sql`${table.endDate} is null or ${table.startDate} is null or ${table.endDate} >= ${table.startDate}`
    )
  ]
)

export const eventPlace = pgTable("event_place", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => event.id),
  placeId: uuid("place_id")
    .notNull()
    .references(() => entity.id),
  role: text("role"),
  notes: text("notes")
})

export const mediaAsset = pgTable("media_asset", {
  id: uuid("id").primaryKey(),
  mediaType: text("media_type").notNull(),
  storageUrl: text("storage_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  takenAt: timestamp("taken_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  description: text("description"),
  uploadedBy: uuid("uploaded_by")
})

export const mediaLink = pgTable(
  "media_link",
  {
    id: uuid("id").primaryKey(),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAsset.id, { onDelete: "cascade" }),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    linkType: text("link_type"),
    sortOrder: integer("sort_order"),
    notes: text("notes")
  },
  (table) => [index("idx_media_link_subject").on(table.subjectId)]
)

export const entityAttribute = pgTable("entity_attribute", {
  id: uuid("id").primaryKey(),
  entityId: uuid("entity_id").references(() => entity.id, { onDelete: "cascade" }),
  key: text("key"),
  valueText: text("value_text"),
  valueNumber: doublePrecision("value_number"),
  valueJson: jsonb("value_json"),
  startDate: date("start_date", { mode: "string" }),
  endDate: date("end_date", { mode: "string" })
})
