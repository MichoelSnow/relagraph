import { randomUUID } from "node:crypto"

import { and, asc, desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getDb } from "@/db/client"
import { animalProfile, entity, entityName, personProfile, placeProfile } from "@/db/schema"
import { requireApiGraphAccess } from "@/server/api/auth"
import { requireCsrfProtection } from "@/server/api/csrf"
import { isJsonRequest, jsonError } from "@/server/api/http"

type RouteContext = {
  params: Promise<{ graphId: string; id: string }>
}

type EntityNameInput = {
  name_text?: string
  name_type?: string
  language_code?: string | null
  script_code?: string | null
  notes?: string | null
  is_primary?: boolean
  sort_order?: number | null
  start_date?: string | null
  end_date?: string | null
}

type PersonProfileInput = {
  birth_date?: string | null
  death_date?: string | null
  sex_at_birth?: string | null
  gender_identity?: string | null
  notes?: string | null
}

type AnimalProfileInput = {
  species?: string | null
  breed?: string | null
  sex?: string | null
  reproductive_status?: string | null
  birth_date?: string | null
  death_date?: string | null
  notes?: string | null
}

type PlaceProfileInput = {
  place_type?: string | null
  built_date?: string | null
  demolished_date?: string | null
  lat?: number | null
  lng?: number | null
  address_text?: string | null
  notes?: string | null
}

type UpdateEntityRequest = {
  entity_kind?: "person" | "animal" | "place"
  display_name?: string
  entity_name?: EntityNameInput
  profile?: PersonProfileInput | AnimalProfileInput | PlaceProfileInput
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function cleanDate(value: unknown): string | null {
  const text = cleanText(value)
  if (!text) {
    return null
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function cleanInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

async function buildEntityDetail(graphId: string, id: string): Promise<NextResponse | null> {
  const db = getDb()
  const [entityRow] = await db
    .select({
      id: entity.id,
      entity_kind: entity.entityKind,
      display_name: entity.canonicalDisplayName
    })
    .from(entity)
    .where(and(eq(entity.id, id), eq(entity.graphId, graphId)))
    .limit(1)

  if (!entityRow) {
    return null
  }

  const [nameRow] = await db
    .select({
      name_text: entityName.nameText,
      name_type: entityName.nameType,
      language_code: entityName.languageCode,
      script_code: entityName.scriptCode,
      notes: entityName.notes,
      is_primary: entityName.isPrimary,
      sort_order: entityName.sortOrder,
      start_date: entityName.startDate,
      end_date: entityName.endDate
    })
    .from(entityName)
    .where(eq(entityName.entityId, id))
    .orderBy(desc(entityName.isPrimary), asc(entityName.sortOrder), asc(entityName.id))
    .limit(1)

  let profile: Record<string, unknown> | null = null
  if (entityRow.entity_kind === "person") {
    const [row] = await db
      .select({
        birth_date: personProfile.birthDate,
        death_date: personProfile.deathDate,
        sex_at_birth: personProfile.sexAtBirth,
        gender_identity: personProfile.genderIdentity,
        notes: personProfile.notes
      })
      .from(personProfile)
      .where(eq(personProfile.entityId, id))
      .limit(1)
    profile = row ?? null
  } else if (entityRow.entity_kind === "animal") {
    const [row] = await db
      .select({
        species: animalProfile.species,
        breed: animalProfile.breed,
        sex: animalProfile.sex,
        reproductive_status: animalProfile.reproductiveStatus,
        birth_date: animalProfile.birthDate,
        death_date: animalProfile.deathDate,
        notes: animalProfile.notes
      })
      .from(animalProfile)
      .where(eq(animalProfile.entityId, id))
      .limit(1)
    profile = row ?? null
  } else if (entityRow.entity_kind === "place") {
    const [row] = await db
      .select({
        place_type: placeProfile.placeType,
        built_date: placeProfile.builtDate,
        demolished_date: placeProfile.demolishedDate,
        lat: placeProfile.lat,
        lng: placeProfile.lng,
        address_text: placeProfile.addressText,
        notes: placeProfile.notes
      })
      .from(placeProfile)
      .where(eq(placeProfile.entityId, id))
      .limit(1)
    profile = row ?? null
  }

  return NextResponse.json({
    ...entityRow,
    entity_name: nameRow ?? null,
    profile
  })
}

export async function GET(_: Request, context: RouteContext): Promise<NextResponse> {
  const { graphId, id } = await context.params
  const auth = await requireApiGraphAccess(graphId)
  if (!auth.user) {
    return auth.response
  }

  const response = await buildEntityDetail(graphId, id)
  if (!response) {
    return jsonError(404, "entity_not_found", "Entity not found", { id })
  }

  return response
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const csrfError = requireCsrfProtection(request)
  if (csrfError) {
    return csrfError
  }

  const { graphId, id } = await context.params
  const auth = await requireApiGraphAccess(graphId)
  if (!auth.user) {
    return auth.response
  }

  if (!isJsonRequest(request)) {
    return jsonError(415, "unsupported_media_type", "Content-Type must be application/json")
  }

  let body: UpdateEntityRequest
  try {
    body = (await request.json()) as UpdateEntityRequest
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON")
  }

  const db = getDb()
  const [existingEntity] = await db
    .select({ id: entity.id, entity_kind: entity.entityKind })
    .from(entity)
    .where(and(eq(entity.id, id), eq(entity.graphId, graphId)))
    .limit(1)

  if (!existingEntity) {
    return jsonError(404, "entity_not_found", "Entity not found", { id })
  }

  const updates: { entityKind?: "person" | "animal" | "place"; canonicalDisplayName?: string } = {}
  if (body.entity_kind) {
    updates.entityKind = body.entity_kind
  }
  if (typeof body.display_name === "string" && body.display_name.trim()) {
    updates.canonicalDisplayName = body.display_name.trim()
  }

  const isUpdatingName = body.entity_name !== undefined
  const isUpdatingProfile = body.profile !== undefined
  if (Object.keys(updates).length === 0 && !isUpdatingName && !isUpdatingProfile) {
    return jsonError(400, "invalid_request", "At least one editable field is required")
  }

  const finalKind = updates.entityKind ?? existingEntity.entity_kind

  try {
    await db.transaction(async (tx) => {
      if (Object.keys(updates).length > 0) {
        await tx
          .update(entity)
          .set(updates)
          .where(and(eq(entity.id, id), eq(entity.graphId, graphId)))
      }

      if (body.entity_kind) {
        if (finalKind !== "person") {
          await tx.delete(personProfile).where(eq(personProfile.entityId, id))
        }
        if (finalKind !== "animal") {
          await tx.delete(animalProfile).where(eq(animalProfile.entityId, id))
        }
        if (finalKind !== "place") {
          await tx.delete(placeProfile).where(eq(placeProfile.entityId, id))
        }
      }

      if (isUpdatingName) {
        const nameText = cleanText(body.entity_name?.name_text)
        if (!nameText) {
          throw new Error("entity_name.name_text is required when entity_name is provided")
        }
        const [existingName] = await tx
          .select({ id: entityName.id })
          .from(entityName)
          .where(eq(entityName.entityId, id))
          .orderBy(desc(entityName.isPrimary), asc(entityName.sortOrder), asc(entityName.id))
          .limit(1)

        const nameValues = {
          nameText,
          nameType: cleanText(body.entity_name?.name_type) ?? "preferred",
          languageCode: cleanText(body.entity_name?.language_code),
          scriptCode: cleanText(body.entity_name?.script_code),
          notes: cleanText(body.entity_name?.notes),
          isPrimary: body.entity_name?.is_primary ?? true,
          sortOrder: cleanInteger(body.entity_name?.sort_order),
          startDate: cleanDate(body.entity_name?.start_date),
          endDate: cleanDate(body.entity_name?.end_date)
        }

        if (existingName) {
          await tx.update(entityName).set(nameValues).where(eq(entityName.id, existingName.id))
        } else {
          await tx.insert(entityName).values({
            id: randomUUID(),
            entityId: id,
            ...nameValues
          })
        }
      }

      if (isUpdatingProfile) {
        if (finalKind === "person") {
          const values = {
            birthDate: cleanDate((body.profile as PersonProfileInput | undefined)?.birth_date),
            deathDate: cleanDate((body.profile as PersonProfileInput | undefined)?.death_date),
            sexAtBirth: cleanText((body.profile as PersonProfileInput | undefined)?.sex_at_birth),
            genderIdentity: cleanText((body.profile as PersonProfileInput | undefined)?.gender_identity),
            notes: cleanText((body.profile as PersonProfileInput | undefined)?.notes)
          }
          const [existingProfile] = await tx
            .select({ entityId: personProfile.entityId })
            .from(personProfile)
            .where(eq(personProfile.entityId, id))
            .limit(1)
          if (existingProfile) {
            await tx.update(personProfile).set(values).where(eq(personProfile.entityId, id))
          } else {
            await tx.insert(personProfile).values({ entityId: id, ...values })
          }
        }

        if (finalKind === "animal") {
          const [existingProfile] = await tx
            .select({ species: animalProfile.species })
            .from(animalProfile)
            .where(eq(animalProfile.entityId, id))
            .limit(1)
          const species =
            cleanText((body.profile as AnimalProfileInput | undefined)?.species) ?? existingProfile?.species ?? null
          if (!species) {
            throw new Error("profile.species is required for animal entities")
          }
          const values = {
            species,
            breed: cleanText((body.profile as AnimalProfileInput | undefined)?.breed),
            sex: cleanText((body.profile as AnimalProfileInput | undefined)?.sex),
            reproductiveStatus: cleanText((body.profile as AnimalProfileInput | undefined)?.reproductive_status),
            birthDate: cleanDate((body.profile as AnimalProfileInput | undefined)?.birth_date),
            deathDate: cleanDate((body.profile as AnimalProfileInput | undefined)?.death_date),
            notes: cleanText((body.profile as AnimalProfileInput | undefined)?.notes)
          }
          if (existingProfile) {
            await tx.update(animalProfile).set(values).where(eq(animalProfile.entityId, id))
          } else {
            await tx.insert(animalProfile).values({ entityId: id, ...values })
          }
        }

        if (finalKind === "place") {
          const [existingProfile] = await tx
            .select({ placeType: placeProfile.placeType })
            .from(placeProfile)
            .where(eq(placeProfile.entityId, id))
            .limit(1)
          const placeType =
            cleanText((body.profile as PlaceProfileInput | undefined)?.place_type) ??
            existingProfile?.placeType ??
            null
          if (!placeType) {
            throw new Error("profile.place_type is required for place entities")
          }
          const values = {
            placeType,
            builtDate: cleanDate((body.profile as PlaceProfileInput | undefined)?.built_date),
            demolishedDate: cleanDate((body.profile as PlaceProfileInput | undefined)?.demolished_date),
            lat: cleanNumber((body.profile as PlaceProfileInput | undefined)?.lat),
            lng: cleanNumber((body.profile as PlaceProfileInput | undefined)?.lng),
            addressText: cleanText((body.profile as PlaceProfileInput | undefined)?.address_text),
            notes: cleanText((body.profile as PlaceProfileInput | undefined)?.notes)
          }
          if (existingProfile) {
            await tx.update(placeProfile).set(values).where(eq(placeProfile.entityId, id))
          } else {
            await tx.insert(placeProfile).values({ entityId: id, ...values })
          }
        }
      }
    })
  } catch (error: unknown) {
    return jsonError(
      400,
      "invalid_request",
      error instanceof Error ? error.message : "Failed to update entity"
    )
  }

  const response = await buildEntityDetail(graphId, id)
  if (!response) {
    return jsonError(404, "entity_not_found", "Entity not found", { id })
  }
  return response
}
