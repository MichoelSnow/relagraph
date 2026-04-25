import type { Edge } from "@/types"

export type RoleSemantics = {
  generationDelta: number
  isDependent?: boolean
  isPeer?: boolean
}

export type RelationshipSemantics = {
  roles: Record<string, RoleSemantics>
}

export const relationshipSemantics: Record<string, RelationshipSemantics> = {
  parent_child: {
    roles: {
      parent: { generationDelta: 0, isDependent: false, isPeer: false },
      child: { generationDelta: 1, isDependent: true, isPeer: false }
    }
  },
  family_parent: {
    roles: {
      parent: { generationDelta: 0, isDependent: false, isPeer: false },
      family: { generationDelta: 0.5, isDependent: false, isPeer: false }
    }
  },
  family_child: {
    roles: {
      family: { generationDelta: 0.5, isDependent: false, isPeer: false },
      child: { generationDelta: 0.5, isDependent: true, isPeer: false }
    }
  },
  animal: {
    roles: {
      owner: { generationDelta: 0, isDependent: false, isPeer: false },
      parent: { generationDelta: 0, isDependent: false, isPeer: false },
      friend: { generationDelta: 0, isDependent: false, isPeer: false },
      animal: { generationDelta: 1, isDependent: true, isPeer: false },
      pet: { generationDelta: 1, isDependent: true, isPeer: false }
    }
  },
  romantic: {
    roles: {
      partner: { generationDelta: 0, isDependent: false, isPeer: true },
      spouse: { generationDelta: 0, isDependent: false, isPeer: true },
      husband: { generationDelta: 0, isDependent: false, isPeer: true },
      wife: { generationDelta: 0, isDependent: false, isPeer: true },
      boyfriend: { generationDelta: 0, isDependent: false, isPeer: true },
      girlfriend: { generationDelta: 0, isDependent: false, isPeer: true },
      "it's complicated": { generationDelta: 0, isDependent: false, isPeer: true }
    }
  },
  sibling: {
    roles: {
      sibling: { generationDelta: 0, isDependent: false, isPeer: true },
      "step-sibling": { generationDelta: 0, isDependent: false, isPeer: true },
      "half-sibling": { generationDelta: 0, isDependent: false, isPeer: true },
      "adopted sibling": { generationDelta: 0, isDependent: false, isPeer: true },
      "foster sibling": { generationDelta: 0, isDependent: false, isPeer: true }
    }
  }
}

function normalizeSemanticsKey(value: string): string {
  return value.trim().toLowerCase().replace(/[-\s]+/g, "_")
}

function buildNormalizedSemanticsRegistry(): Record<string, RelationshipSemantics> {
  const normalized: Record<string, RelationshipSemantics> = {}
  for (const [typeKey, semantics] of Object.entries(relationshipSemantics)) {
    const normalizedType = normalizeSemanticsKey(typeKey)
    normalized[normalizedType] = {
      roles: Object.fromEntries(
        Object.entries(semantics.roles).map(([roleKey, roleSemantics]) => [
          normalizeSemanticsKey(roleKey),
          roleSemantics
        ])
      )
    }
  }
  return normalized
}

const normalizedRelationshipSemantics = buildNormalizedSemanticsRegistry()

export function normalizeRelationshipTypeKey(type: string): string {
  return normalizeSemanticsKey(type)
}

export function normalizeRelationshipRoleKey(role: string): string {
  return normalizeSemanticsKey(role)
}

export function getRoleSemantics(type: string, role: string): RoleSemantics {
  const normalizedType = normalizeRelationshipTypeKey(type)
  const rel = normalizedRelationshipSemantics[normalizedType]
  if (!rel) {
    throw new Error(`Unknown relationship type: ${type}`)
  }
  const normalizedRole = normalizeRelationshipRoleKey(role)
  const roleSem = rel.roles[normalizedRole]
  if (!roleSem) {
    throw new Error(`Unknown role ${role} for type ${type}`)
  }
  return roleSem
}

export function tryGetRoleSemantics(type: string, role: string): RoleSemantics | null {
  try {
    return getRoleSemantics(type, role)
  } catch {
    return null
  }
}

export function isParentChildRelationshipType(type: string): boolean {
  return normalizeRelationshipTypeKey(type) === "parent_child"
}

export function isAnimalRelationshipType(type: string): boolean {
  return normalizeRelationshipTypeKey(type) === "animal"
}

export function isRomanticRelationshipType(type: string): boolean {
  return normalizeRelationshipTypeKey(type) === "romantic"
}

export function isFamilyParentRelationshipType(type: string): boolean {
  return normalizeRelationshipTypeKey(type) === "family_parent"
}

export function isFamilyChildRelationshipType(type: string): boolean {
  return normalizeRelationshipTypeKey(type) === "family_child"
}

export function isFamilyRelationshipType(type: string): boolean {
  return isFamilyParentRelationshipType(type) || isFamilyChildRelationshipType(type)
}

export function inferDependentEdgeDirection(
  edge: Edge
): { sourceId: string; dependentId: string } | null {
  const fromRoleSemantics = tryGetRoleSemantics(edge.relationship_type, edge.roles.from)
  const toRoleSemantics = tryGetRoleSemantics(edge.relationship_type, edge.roles.to)

  if (fromRoleSemantics?.isDependent && toRoleSemantics && !toRoleSemantics.isDependent) {
    return { sourceId: edge.to_entity_id, dependentId: edge.from_entity_id }
  }
  if (toRoleSemantics?.isDependent && fromRoleSemantics && !fromRoleSemantics.isDependent) {
    return { sourceId: edge.from_entity_id, dependentId: edge.to_entity_id }
  }

  return null
}
