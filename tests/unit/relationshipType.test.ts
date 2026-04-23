import { describe, expect, it } from "vitest"

import { normalizeRelationshipTypeCode } from "@/lib/graph/relationshipType"

describe("normalizeRelationshipTypeCode", () => {
  it("should_normalize_to_lower_snake_case_when_value_has_spaces_and_hyphens", () => {
    expect(normalizeRelationshipTypeCode(" Parent-Child Relationship ")).toBe("parent_child_relationship")
  })

  it("should_return_empty_string_when_value_is_whitespace_only", () => {
    expect(normalizeRelationshipTypeCode("   ")).toBe("")
  })

  it("should_preserve_existing_snake_case_when_value_already_normalized", () => {
    expect(normalizeRelationshipTypeCode("parent_child")).toBe("parent_child")
  })
})
