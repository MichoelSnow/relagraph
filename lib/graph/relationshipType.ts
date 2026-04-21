export function normalizeRelationshipTypeCode(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_")
}
