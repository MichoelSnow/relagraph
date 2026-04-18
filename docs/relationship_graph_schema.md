# Relationship Graph Schema

## Overview
This document defines a temporal, multi-entity relationship graph model. It is designed to support rich, evolving relationships between people, animals, and places, along with events, media, and extensible metadata.

The model enables:
- Representation of complex interpersonal and inter-entity relationships
- Support for non-traditional relationship structures (e.g., polyamory, chosen family)
- Temporal tracking of relationships and events
- First-class treatment of animals and places alongside people
- Attachment of media and annotations across all objects

---

## Design Principles

### 1. Graph-Oriented
The system is fundamentally a graph:
- Entities are nodes
- Relationships are edges
- Events provide temporal context

### 2. Temporal by Default
All relationships and many associations are time-aware:
- Start and end dates are first-class
- Enables timeline queries and visualization

### 3. First-Class Entities
People, animals, and places are all treated as entities:
- No special-casing or secondary status
- Enables uniform relationship modeling

### 4. Separation of Concerns
- Relationships represent enduring states
- Events represent changes or occurrences
- Media and annotations are independent layers

### 5. Extensibility
The model is designed to evolve:
- New relationship types can be added without schema changes
- Attributes can be extended dynamically
- Supports future AI-driven tagging and inference

### 6. Minimal Assumptions
The system avoids hardcoded assumptions:
- No enforced monogamy
- No rigid family structure
- Supports cultural and contextual variation

---

## Core Concepts

### Entity
A node in the graph representing a person, animal, place, or other object.

### Relationship
A typed, time-bound connection between two or more entities.

### Relationship Participant
Defines how an entity participates in a relationship (role-based).

### Event
A discrete occurrence involving one or more entities and/or relationships.

### Location / Place
A physical or conceptual place, treated as an entity with its own lifecycle.

### Media
Photos or other assets that can be linked to entities, relationships, events, or places.

### Annotation
Metadata derived from users or AI (e.g., tagging people in photos).

### Temporal Interval
Defines when something is valid or active, enabling time-based queries and visualization.

## Entity Model

### Purpose
The `entity` table represents the foundational node in the graph. All objects in the system (people, animals, places, and future types) are represented as entities.

This abstraction enables:
- A unified relationship model
- Cross-type relationships (e.g., person ↔ animal, person ↔ place)
- Extensibility without schema redesign

### Tables

```sql
CREATE TABLE entity (
    id UUID PRIMARY KEY,
    entity_kind TEXT NOT NULL, -- person, animal, place
    canonical_display_name TEXT,
    description TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Semantics

- `entity_kind` defines the subtype and determines which profile table applies
- `canonical_display_name` is a convenience field; full naming is handled separately
- Entities are intentionally minimal to keep the core model stable

### Constraints & Rules

- Every entity MUST have exactly one corresponding profile table based on `entity_kind`
- `entity_kind` should be constrained via an enum or lookup table in production
- Entities should not contain domain-specific fields (these belong in profile tables)

---

## Profile Extensions

### Purpose
Profile tables extend the base entity with type-specific attributes while maintaining a shared identity model.

This avoids:
- Sparse tables with many null fields
- Loss of type-specific validation
- Overloaded generic schemas

---

### Person Profile

```sql
CREATE TABLE person_profile (
    entity_id UUID PRIMARY KEY REFERENCES entity(id),
    birth_date DATE,
    death_date DATE,
    sex_at_birth TEXT,
    gender_identity TEXT,
    notes TEXT
);
```

#### Semantics

- Represents human-specific attributes
- Supports both biological and identity-based fields
- Allows partial or unknown data

#### Constraints & Rules

- `entity_kind` must be `person`
- `death_date` must be >= `birth_date` when both are present
- Fields are optional to support incomplete data

---

### Animal Profile

```sql
CREATE TABLE animal_profile (
    entity_id UUID PRIMARY KEY REFERENCES entity(id),
    species TEXT,
    breed TEXT,
    sex TEXT,
    reproductive_status TEXT,
    birth_date DATE,
    death_date DATE,
    notes TEXT
);
```

#### Semantics

- Represents animals, including pets and non-pet animals
- Supports lineage tracking and biological relationships
- `sex` is biological; reproductive status is independent

#### Constraints & Rules

- `entity_kind` must be `animal`
- `species` should ideally be standardized (e.g., controlled vocabulary)
- `death_date` must be >= `birth_date` when both are present

---

### Place Profile

```sql
CREATE TABLE place_profile (
    entity_id UUID PRIMARY KEY REFERENCES entity(id),
    place_type TEXT, -- house, venue, city, etc.
    built_date DATE,
    demolished_date DATE,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    address_text TEXT,
    notes TEXT
);
```

#### Semantics

- Represents physical or conceptual locations as first-class entities
- Supports lifecycle events (build, remodel, demolition)
- Can participate in relationships and events

#### Constraints & Rules

- `entity_kind` must be `place`
- `demolished_date` must be >= `built_date` when both are present
- Latitude/longitude should be validated if present

---

### Design Notes

- All profiles share the same primary key as their base entity
- Profiles are optional at the DB level but required at the application level
- Additional entity types can be added by introducing new profile tables
- This pattern enables clean separation between identity and attributes




## Naming System

### Purpose
The naming system supports multiple names per entity across languages, contexts, and time. It enables representation of legal names, chosen names, nicknames, and culturally specific naming systems.

### Tables

```sql
CREATE TABLE entity_name (
    id UUID PRIMARY KEY,
    entity_id UUID REFERENCES entity(id),
    name_text TEXT NOT NULL,
    language_code TEXT,
    script_code TEXT,
    name_type TEXT, -- legal, birth, chosen, nickname, maiden, alias, etc.
    is_primary BOOLEAN DEFAULT FALSE,
    start_date DATE,
    end_date DATE,
    notes TEXT,
    sort_order INTEGER
);
```

### Semantics

- An entity can have multiple names simultaneously or over time
- Names may vary by language and script
- `name_type` defines the role or context of the name
- `is_primary` indicates the preferred display name at a given time

### Constraints & Rules

- Only one primary name per entity per time interval (enforced at application level)
- Overlapping name intervals should be allowed but interpreted carefully
- Language and script codes should follow standards (ISO where possible)

---

## Relationship Model

### Purpose
Represents connections between entities in a flexible, multi-party, and time-aware manner.

### Tables

```sql
CREATE TABLE relationship (
    id UUID PRIMARY KEY,
    relationship_type_id UUID REFERENCES relationship_type(id),
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE relationship_participant (
    id UUID PRIMARY KEY,
    relationship_id UUID REFERENCES relationship(id),
    entity_id UUID REFERENCES entity(id),
    role_in_relationship TEXT,
    start_date DATE,
    end_date DATE,
    notes TEXT
);
```

### Semantics

- Relationships connect two or more entities
- Participants define roles within the relationship
- Relationships are not limited to pairs (supports poly relationships)

### Constraints & Rules

- A relationship must have at least two participants
- Roles should be consistent with the relationship type
- Participant intervals may differ within a relationship

---

## Relationship Types & Roles

### Purpose
Defines the classification and semantics of relationships and the roles entities can play within them.

### Tables

```sql
CREATE TABLE relationship_type (
    id UUID PRIMARY KEY,
    code TEXT UNIQUE,
    display_name TEXT,
    is_directed BOOLEAN,
    category TEXT, -- familial, romantic, social, animal, etc.
    allows_multiple_participants BOOLEAN,
    description TEXT
);
```

### Semantics

- `code` is the stable identifier for programmatic use
- `display_name` is for UI/UX
- `is_directed` determines whether role ordering matters
- Roles are defined dynamically in `relationship_participant`

### Constraints & Rules

- Relationship types should be extensible without schema changes
- Role validation should be enforced at the application layer
- Certain types may restrict entity kinds (e.g., animal-only)

---

## Relationship Intervals (Temporal Model)

### Purpose
Enables relationships to evolve over time and supports temporal queries and visualization.

### Tables

```sql
CREATE TABLE relationship_interval (
    id UUID PRIMARY KEY,
    relationship_id UUID REFERENCES relationship(id),
    valid_from DATE,
    valid_to DATE,
    status TEXT, -- active, ended, paused, etc.
    notes TEXT
);
```

### Semantics

- A relationship can have multiple intervals (e.g., on/off relationships)
- Intervals define when a relationship is active
- Supports time-based graph reconstruction

### Constraints & Rules

- Intervals for a relationship should not overlap unless explicitly allowed
- `valid_to` must be >= `valid_from` when both are present
- Open intervals (null `valid_to`) represent ongoing relationships

---

### Design Notes

- Temporal modeling is critical for accurate visualization
- Relationships are intentionally decoupled from intervals for flexibility
- Naming, relationships, and temporal data together enable full historical reconstruction of the graph

## Event Model

### Purpose
The event model represents discrete occurrences that happen at a point in time or over an interval. Events provide temporal anchors for changes in relationships and entity states.

Events are distinct from relationships:
- Relationships represent enduring states
- Events represent transitions, milestones, or occurrences

### Tables

```sql
CREATE TABLE event_type (
    id UUID PRIMARY KEY,
    code TEXT UNIQUE,
    display_name TEXT,
    description TEXT
);

CREATE TABLE event (
    id UUID PRIMARY KEY,
    event_type_id UUID REFERENCES event_type(id),
    title TEXT,
    description TEXT,
    start_datetime TIMESTAMP,
    end_datetime TIMESTAMP,
    date_precision TEXT, -- exact, approximate, year, month
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Semantics

- Events may represent instantaneous or duration-based occurrences
- `date_precision` allows handling of uncertain or partial temporal data
- Events are independent objects and can exist without relationships

### Constraints & Rules

- `end_datetime` must be >= `start_datetime` when both are present
- `event_type` should be extensible (e.g., wedding, divorce, birth, move, adoption)
- Events may exist without participants, but typically should include at least one

---

## Event Participation

### Purpose
Defines how entities participate in events, enabling multi-entity and role-based event modeling.

### Tables

```sql
CREATE TABLE event_participant (
    id UUID PRIMARY KEY,
    event_id UUID REFERENCES event(id),
    entity_id UUID REFERENCES entity(id),
    role_in_event TEXT, -- bride, groom, child, deceased, attendee, pet, etc.
    notes TEXT
);
```

### Semantics

- An event can have multiple participants
- Each participant may have a distinct role
- Roles provide semantic meaning (e.g., “parent” in a birth event)

### Constraints & Rules

- A participant must reference a valid entity
- Role definitions are flexible but should align with event type
- Duplicate participant roles should be allowed unless explicitly restricted

---

## Event–Relationship Linkage

### Purpose
Links events to relationships to represent how events affect or relate to relationships.

This enables modeling of:
- Relationship formation (e.g., wedding → marriage)
- Relationship termination (e.g., divorce → end of marriage)
- Relationship modification (e.g., cohabitation start, separation)

### Tables

```sql
CREATE TABLE event_relationship (
    id UUID PRIMARY KEY,
    event_id UUID REFERENCES event(id),
    relationship_id UUID REFERENCES relationship(id),
    role TEXT, -- formed, formalized, ended, modified, celebrated
    notes TEXT
);
```

### Semantics

- An event can be associated with one or more relationships
- The `role` defines how the event relates to the relationship
- Allows separation between state (relationship) and change (event)

### Constraints & Rules

- A relationship can be linked to multiple events over time
- `role` should be standardized at the application level
- Linkage is optional but strongly recommended for lifecycle tracking

---

### Design Notes

- Events are the primary mechanism for capturing change over time
- Event participation allows rich contextual modeling
- Event–relationship linkage enables lifecycle reconstruction of relationships
- Together, these structures support timeline visualization and historical queries

## Location / Place Model

### Purpose
Represents places as first-class entities with their own lifecycle, attributes, and relationships.

Places can:
- Exist independently (e.g., a house, city, venue)
- Participate in relationships (e.g., residence, ownership)
- Be associated with events (e.g., wedding venue, birthplace)
- Have their own history (e.g., built, remodeled, demolished)

### Tables

```sql
-- Place-specific attributes (extends entity)
CREATE TABLE place_profile (
    entity_id UUID PRIMARY KEY REFERENCES entity(id),
    place_type TEXT, -- house, venue, city, etc.
    built_date DATE,
    demolished_date DATE,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    address_text TEXT,
    notes TEXT
);

-- Entity ↔ Place relationships (e.g., lived_at, owned_by)
CREATE TABLE entity_place_relationship (
    id UUID PRIMARY KEY,
    entity_id UUID REFERENCES entity(id),
    place_id UUID REFERENCES entity(id),
    relationship_type TEXT, -- lived_at, owned, visited, etc.
    start_date DATE,
    end_date DATE,
    notes TEXT
);

-- Event ↔ Place linkage
CREATE TABLE event_place (
    id UUID PRIMARY KEY,
    event_id UUID REFERENCES event(id),
    place_id UUID REFERENCES entity(id),
    role TEXT, -- venue, birthplace, etc.
    notes TEXT
);
```

### Semantics

- Places are entities, not just attributes
- `entity_place_relationship` models time-bound interactions with places
- Events can reference places independently of entity relationships

### Constraints & Rules

- `place_id` must reference an entity with `entity_kind = 'place'`
- `end_date` must be >= `start_date` when both are present
- Coordinates should be validated if provided
- Relationship types should be standardized at the application level

---

## Media & Annotation Model

### Purpose
Supports storage and association of media assets (photos, videos, documents) and their annotations.

Media can be linked to:
- Entities (people, animals, places)
- Relationships
- Events

Annotations enable:
- Tagging entities in media
- AI-based recognition
- Metadata extraction

### Tables

```sql
CREATE TABLE media_asset (
    id UUID PRIMARY KEY,
    media_type TEXT, -- photo, video, document
    storage_url TEXT,
    thumbnail_url TEXT,
    taken_at TIMESTAMP,
    created_at TIMESTAMP,
    description TEXT,
    uploaded_by UUID
);

CREATE TABLE media_link (
    id UUID PRIMARY KEY,
    media_asset_id UUID REFERENCES media_asset(id),
    subject_type TEXT, -- entity, relationship, event
    subject_id UUID,
    link_type TEXT, -- depicts, attachment, cover
    sort_order INTEGER,
    notes TEXT
);

CREATE TABLE media_annotation (
    id UUID PRIMARY KEY,
    media_asset_id UUID REFERENCES media_asset(id),
    annotation_type TEXT, -- entity_tag, object_tag, face_box, etc.
    entity_id UUID, -- nullable
    label_text TEXT,
    confidence DOUBLE PRECISION,
    bounding_box JSONB,
    source TEXT, -- ai, manual
    created_at TIMESTAMP
);
```

### Semantics

- Media is stored once and linked flexibly via `media_link`
- Annotations allow both structured (entity-linked) and unstructured tagging
- AI-generated and manual annotations coexist

### Constraints & Rules

- `subject_id` must correspond to the correct `subject_type`
- `entity_id` in annotations is optional but recommended when known
- Confidence values should be normalized (e.g., 0–1)
- Bounding boxes should follow a consistent schema

---

### Design Notes

- Treating places as entities enables richer modeling of location history
- Media is decoupled from domain objects for flexibility
- Annotation system is designed for future AI integration
- These layers enrich the core graph without complicating its structure

## Temporal Semantics

### Purpose
Defines how time is represented across entities, relationships, events, and associations.

### Core Principles
- Time is **first-class** across relationships, events, names, and locations
- Supports **point-in-time** and **interval-based** modeling
- Enables **historical reconstruction** and **timeline visualization**

### Temporal Fields
Common patterns used across tables:
- `start_date` / `end_date`
- `valid_from` / `valid_to`
- `start_datetime` / `end_datetime`
- `date_precision` (exact, year, month, approximate)

### Semantics

- **Open intervals** (null end) indicate ongoing state
- **Closed intervals** indicate completed states
- **Multiple intervals** may represent intermittent relationships
- **Precision fields** handle uncertain or partial dates

### Temporal Consistency Rules

- `end >= start` when both present
- Intervals should not overlap unless explicitly allowed
- Precision must be interpreted consistently across the system

---

## Constraints & Validation Rules

### Purpose
Defines logical and domain constraints that may not be fully enforceable at the database level.

### Entity Constraints
- Each entity must have a valid `entity_kind`
- Profile table must match entity type
- Entity must not exist without a valid identifier

### Relationship Constraints
- Minimum of two participants per relationship
- Roles must align with relationship type
- Participant entity types may be restricted (e.g., animal-only)

### Temporal Constraints
- Dates must be logically consistent
- No invalid backward intervals
- Optional enforcement of non-overlapping intervals

### Naming Constraints
- One primary name per entity per time interval
- Name types should be standardized
- Language codes should follow ISO standards

### Event Constraints
- Events should have at least one participant
- Event roles should align with event type
- Event time ranges must be valid

### Media Constraints
- Media must have a valid storage reference
- Links must reference valid subjects
- Annotation confidence values normalized (0–1)

### Validation Strategy

- **Database-level constraints** for structural integrity
- **Application-level validation** for semantic rules
- **Optional auditing layer** for historical corrections

---

## Extensibility Framework (Attributes, Types, Metadata)

### Purpose
Provides a flexible mechanism to extend the schema without requiring structural changes.

### Attribute Model

```sql
CREATE TABLE entity_attribute (
    id UUID PRIMARY KEY,
    entity_id UUID REFERENCES entity(id),
    key TEXT,
    value_text TEXT,
    value_number DOUBLE PRECISION,
    value_json JSONB,
    start_date DATE,
    end_date DATE
);

CREATE TABLE relationship_attribute (
    id UUID PRIMARY KEY,
    relationship_id UUID REFERENCES relationship(id),
    key TEXT,
    value_text TEXT,
    value_number DOUBLE PRECISION,
    value_json JSONB
);

CREATE TABLE event_attribute (
    id UUID PRIMARY KEY,
    event_id UUID REFERENCES event(id),
    key TEXT,
    value_text TEXT,
    value_number DOUBLE PRECISION,
    value_json JSONB
);
```

### Type Extension

- New relationship types can be added without schema changes
- New event types can be introduced dynamically
- Role definitions remain flexible and extensible

### Metadata Support

- Supports structured and unstructured metadata
- JSON fields allow complex data without schema updates
- Enables future AI-generated attributes and tagging

### Semantics

- Attributes act as **key-value extensions**
- Time-bound attributes allow historical tracking
- Multiple value types support flexible storage

### Constraints & Rules

- Keys should be standardized where possible
- Avoid overuse of JSON for core logic fields
- Maintain balance between flexibility and queryability

---

### Design Notes

- Temporal semantics enable full lifecycle reconstruction
- Constraints ensure data integrity without over-constraining flexibility
- Extensibility framework future-proofs the model
- Designed to support evolving requirements and AI integration

## Query Patterns

### Purpose
Defines common access patterns for retrieving and analyzing data from the relationship graph.

### Core Query Types

#### 1. Entity-Centric Queries
Retrieve all information about a single entity:
- Names
- Relationships
- Events
- Media

Example:
- "Show all relationships for Alex"
- "Show all events involving this person"

---

#### 2. Relationship Traversal

Explore connections between entities:
- Direct relationships (1 hop)
- Extended network (multi-hop)

Example:
- "Who are Alex’s partners?"
- "Show all connections within 2 degrees"

---

#### 3. Temporal Snapshot Queries

Reconstruct the graph at a specific point in time:

Example:
- "What did the relationship graph look like in June 2022?"
- Filter:
  - relationships where valid_from <= date <= valid_to
  - events before that date

---

#### 4. Timeline Queries

Track how relationships evolve over time:

Example:
- "Show all relationships Alex has had over time"
- "Show changes in a polycule between 2020–2025"

---

#### 5. Event-Centric Queries

Retrieve events and their participants:

Example:
- "Show all weddings involving Alex"
- "Who attended this event?"

---

#### 6. Location-Based Queries

Example:
- "Who lived at this house between 2018–2020?"
- "Where has Alex lived over time?"

---

#### 7. Media Queries

Example:
- "Show all photos of Alex"
- "Show all media from a specific event"
- "Find photos tagged with both Alex and Sam"

---

## Example Scenarios

### 1. Family Tree

- Parent-child relationships (biological, adoptive)
- Birth and death events
- Multi-generational traversal

---

### 2. Polycule / Relationship Network

- Multiple concurrent romantic relationships
- Temporal overlap and changes
- Visualization of relationship evolution

---

### 3. Animal Lineage

- Parent-child relationships between animals
- Sibling relationships
- Owner-pet relationships

---

### 4. Residence History

- Entity-place relationships over time
- Moves captured as events
- Timeline of where someone lived

---

### 5. Event Lifecycle

- Marriage formed via wedding event
- Divorce ending relationship
- Media attached to event

---

### 6. Mixed Graph

- People, animals, and places all connected
- Example:
  - Alex owns Dog A
  - Alex lives in House X
  - Wedding occurs at Venue Y

---

## Implementation Notes

### Database Choice

- Recommended: PostgreSQL
- Supports:
  - relational integrity
  - JSONB for flexible attributes
  - indexing for performance

---

### Indexing Strategy

Suggested indexes:
- entity(id)
- relationship_participant(entity_id)
- relationship_interval(valid_from, valid_to)
- event(start_datetime)
- media_link(subject_id)

---

### Performance Considerations

- Use indexes for temporal queries
- Cache frequently accessed relationship graphs
- Consider denormalized views for UI

---

### Graph Traversal

- Start with SQL-based traversal
- Add graph layer (e.g., recursive CTEs)
- Consider graph DB later if needed

---

### Validation Layer

- Database enforces structure
- Application enforces:
  - role validity
  - temporal consistency
  - type constraints

---

### Migration Strategy

- Use versioned migrations
- Keep schema backward-compatible where possible
- Add new types instead of modifying existing ones

---

### Future Enhancements

- AI-based relationship inference
- Automated tagging of media
- Recommendation systems based on graph structure

---

### Design Summary

This model supports:
- Complex relationships
- Temporal evolution
- Multi-entity interaction
- Extensibility

It is designed to scale from simple family trees to rich social graphs.
