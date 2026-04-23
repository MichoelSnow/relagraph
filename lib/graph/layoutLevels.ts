import type { Edge, Entity } from "@/types"

function normalizeRole(value: string): string {
  return value.trim().toLowerCase()
}

function resolveHierarchyConstraint(
  edge: Edge
): { higherEntityId: string; lowerEntityId: string } | null {
  const fromRole = normalizeRole(edge.roles.from)
  const toRole = normalizeRole(edge.roles.to)
  const higherPairs: Array<[string, string]> = [
    ["parent", "child"],
    ["parent", "family"],
    ["family", "child"],
    ["owner", "pet"],
    ["owner", "animal"],
    ["friend", "animal"],
    ["friend", "pet"]
  ]

  for (const [higherRole, lowerRole] of higherPairs) {
    if (fromRole === higherRole && toRole === lowerRole) {
      return { higherEntityId: edge.from_entity_id, lowerEntityId: edge.to_entity_id }
    }
    if (toRole === higherRole && fromRole === lowerRole) {
      return { higherEntityId: edge.to_entity_id, lowerEntityId: edge.from_entity_id }
    }
  }

  return null
}

function isSameLevelRelationship(edge: Edge): boolean {
  const relationshipType = edge.relationship_type.trim().toLowerCase().replace(/[-\s]+/g, "_")
  if (relationshipType === "sibling" || relationshipType === "romantic") {
    return true
  }

  const fromRole = normalizeRole(edge.roles.from)
  const toRole = normalizeRole(edge.roles.to)
  if (fromRole === "sibling" && toRole === "sibling") {
    return true
  }
  if (fromRole === "spouse" && toRole === "spouse") {
    return true
  }

  return false
}

export function computeNodeLevels(entities: Entity[], edges: Edge[]): Map<string, number> {
  const levels = new Map<string, number>()
  for (const entity of entities) {
    levels.set(entity.id, 0)
  }

  const constraints = edges
    .map(resolveHierarchyConstraint)
    .filter((constraint): constraint is { higherEntityId: string; lowerEntityId: string } => constraint !== null)
  const sameLevelPairs = edges
    .filter((edge) => isSameLevelRelationship(edge))
    .map((edge) => [edge.from_entity_id, edge.to_entity_id] as const)

  for (let iteration = 0; iteration < entities.length * 2; iteration += 1) {
    let changed = false
    for (const constraint of constraints) {
      const higher = levels.get(constraint.higherEntityId) ?? 0
      const lower = levels.get(constraint.lowerEntityId) ?? 0
      const nextLower = Math.max(lower, higher + 1)
      if (nextLower !== lower) {
        levels.set(constraint.lowerEntityId, nextLower)
        changed = true
      }
    }
    for (const [leftId, rightId] of sameLevelPairs) {
      const left = levels.get(leftId) ?? 0
      const right = levels.get(rightId) ?? 0
      const nextLevel = Math.max(left, right)
      if (nextLevel !== left) {
        levels.set(leftId, nextLevel)
        changed = true
      }
      if (nextLevel !== right) {
        levels.set(rightId, nextLevel)
        changed = true
      }
    }
    if (!changed) {
      break
    }
  }

  return levels
}
