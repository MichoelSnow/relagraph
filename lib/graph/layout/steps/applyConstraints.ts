import {
  isFamilyChildRelationshipType,
  isFamilyParentRelationshipType,
  isParentChildRelationshipType,
  isRomanticRelationshipType,
  tryGetRoleSemantics
} from "@/lib/graph/semantics/relationshipSemantics"
import type { Entity } from "@/types"

import type { LayoutStage } from "@/lib/graph/layout/pipeline"
import type { FamilyTreeStructure } from "@/lib/graph/layout/steps/buildStructure"

export type FamilyTreeConstraints = {
  levels: Map<string, number>
  dependentsByParentId?: Map<string, string[]>
  parentByDependentId?: Map<string, string>
  orderRankById?: Map<string, number>
  visualDependentsByParentId?: Map<string, string[]>
  primaryFamilyId?: string | null
  primarySiblingSet?: Set<string>
}

function resolveRoleGenerationDelta(type: string, role: string, fallback: number): number {
  return tryGetRoleSemantics(type, role)?.generationDelta ?? fallback
}

function buildFamilyTreeConstraints(
  entities: Entity[],
  edges: Array<{ relationship_type: string; roles: { from: string; to: string }; from_entity_id: string; to_entity_id: string }>,
  structure: FamilyTreeStructure
): FamilyTreeConstraints {
  const levels = new Map<string, number>()

  for (const entity of entities) {
    levels.set(entity.id, 0)
  }
  for (const anchor of structure.anchors) {
    levels.set(anchor.id, 0)
  }

  for (let iteration = 0; iteration < entities.length * 8; iteration += 1) {
    let changed = false

    for (const component of structure.romanticComponents.values()) {
      const componentLevel = Math.max(...component.map((id) => levels.get(id) ?? 0))
      for (const memberId of component) {
        const currentLevel = levels.get(memberId) ?? 0
        if (currentLevel !== componentLevel) {
          levels.set(memberId, componentLevel)
          changed = true
        }
      }
    }

    for (const edge of edges) {
      if (isRomanticRelationshipType(edge.relationship_type)) {
        const fromLevel = levels.get(edge.from_entity_id) ?? 0
        const toLevel = levels.get(edge.to_entity_id) ?? 0
        const sharedLevel = Math.max(fromLevel, toLevel)
        if (fromLevel !== sharedLevel) {
          levels.set(edge.from_entity_id, sharedLevel)
          changed = true
        }
        if (toLevel !== sharedLevel) {
          levels.set(edge.to_entity_id, sharedLevel)
          changed = true
        }
        continue
      }

      if (isFamilyParentRelationshipType(edge.relationship_type)) {
        const parentLevel = levels.get(edge.from_entity_id) ?? 0
        const familyLevel = levels.get(edge.to_entity_id) ?? 0
        const familyDelta = resolveRoleGenerationDelta(edge.relationship_type, edge.roles.to, 0.5)
        const nextFamilyLevel = Math.max(familyLevel, parentLevel + familyDelta)
        if (nextFamilyLevel !== familyLevel) {
          levels.set(edge.to_entity_id, nextFamilyLevel)
          changed = true
        }
        continue
      }

      if (isFamilyChildRelationshipType(edge.relationship_type)) {
        const fromLevel = levels.get(edge.from_entity_id) ?? 0
        const toLevel = levels.get(edge.to_entity_id) ?? 0
        const childDelta = resolveRoleGenerationDelta(edge.relationship_type, edge.roles.to, 0.5)
        const nextToLevel = Math.max(toLevel, fromLevel + childDelta)
        if (nextToLevel !== toLevel) {
          levels.set(edge.to_entity_id, nextToLevel)
          changed = true
        }
        continue
      }

      if (isParentChildRelationshipType(edge.relationship_type)) {
        const fromLevel = levels.get(edge.from_entity_id) ?? 0
        const toLevel = levels.get(edge.to_entity_id) ?? 0
        const childDelta = resolveRoleGenerationDelta(edge.relationship_type, edge.roles.to, 1)
        const nextToLevel = Math.max(toLevel, fromLevel + childDelta)
        if (nextToLevel !== toLevel) {
          levels.set(edge.to_entity_id, nextToLevel)
          changed = true
        }
      }
    }

    for (const [dependentId, ownerIds] of structure.petOwnerIdsByDependentId) {
      const ownerLevel = Math.max(...[...ownerIds].map((ownerId) => levels.get(ownerId) ?? 0))
      const dependentLevel = levels.get(dependentId) ?? 0
      const nextDependentLevel = Math.max(dependentLevel, ownerLevel + 1)
      if (nextDependentLevel !== dependentLevel) {
        levels.set(dependentId, nextDependentLevel)
        changed = true
      }
    }

    for (const anchor of structure.anchors) {
      const parentLevel = Math.max(...anchor.parentIds.map((parentId) => levels.get(parentId) ?? 0), 0)
      const anchorLevel = levels.get(anchor.id) ?? 0
      const nextAnchorLevel = Math.max(anchorLevel, parentLevel + 0.5)
      if (nextAnchorLevel !== anchorLevel) {
        levels.set(anchor.id, nextAnchorLevel)
        changed = true
      }
      for (const childId of anchor.childIds) {
        const currentChildLevel = levels.get(childId) ?? 0
        const nextChildLevel = Math.max(currentChildLevel, nextAnchorLevel + 0.5)
        if (nextChildLevel !== currentChildLevel) {
          levels.set(childId, nextChildLevel)
          changed = true
        }
      }
    }

    if (!changed) {
      break
    }
  }

  const minLevel = Math.min(
    ...entities.map((entity) => levels.get(entity.id) ?? 0),
    ...structure.anchors.map((anchor) => levels.get(anchor.id) ?? 0),
    0
  )
  if (minLevel < 0) {
    for (const entity of entities) {
      levels.set(entity.id, (levels.get(entity.id) ?? 0) - minLevel)
    }
    for (const anchor of structure.anchors) {
      levels.set(anchor.id, (levels.get(anchor.id) ?? 0) - minLevel)
    }
  }

  return {
    levels
  }
}

export const applyConstraints: LayoutStage = (ctx) => {
  const structure = ctx.structure as FamilyTreeStructure | undefined
  if (!structure) {
    return ctx
  }

  const constrained = buildFamilyTreeConstraints(ctx.entities, ctx.edges, structure)
  return {
    ...ctx,
    constrained
  }
}
