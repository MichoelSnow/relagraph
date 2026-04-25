export type Entity = {
  id: string
  entity_kind: "person" | "animal" | "place"
  display_name: string
}

export type Edge = {
  id: string
  relationship_type: string
  from_entity_id: string
  to_entity_id: string
  roles: {
    from: string
    to: string
  }
  active: boolean
  start: string
  end: string | null
}

export type RelationshipParticipant = {
  relationship_id: string
  entity_id: string
  role: string
}

export type RelationshipInterval = {
  id: string
  relationship_id: string
  start: string
  end: string | null
}

export type Event = {
  id: string
  event_type: string
  start: string
  end?: string | null
}

export type Name = {
  id: string
  entity_id: string
  name_text: string
  name_type: string
  language_code?: string | null
  start?: string | null
  end?: string | null
}

export type Media = {
  id: string
  media_type: string
  url: string
}

export type GraphResponse = {
  entities: Entity[]
  edges: Edge[]
  meta: {
    truncated: boolean
    node_count: number
    edge_count: number
  }
}
