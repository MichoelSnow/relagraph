# SQL Schema

## Overview
This document defines the **production-ready SQL schema** for Relagraph.

Includes:
- Tables
- Enums
- Constraints
- Indexes
- Foreign key behaviors
- Auth and graph tenancy ownership

All SQL is executable in PostgreSQL.

---

## Enums

```sql
CREATE TYPE entity_kind_enum AS ENUM ('person', 'animal', 'place');
```

---

## Auth & Tenancy

```sql
CREATE TABLE app_user (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_user_email ON app_user(email);

CREATE TABLE user_graph (
    id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_graph_owner_user_id ON user_graph(owner_user_id);

CREATE TABLE user_session (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_session_user_id ON user_session(user_id);
CREATE INDEX idx_user_session_expires_at ON user_session(expires_at);
```

---

## Entity

```sql
CREATE TABLE entity (
    id UUID PRIMARY KEY,
    graph_id UUID REFERENCES user_graph(id) ON DELETE CASCADE,
    entity_kind entity_kind_enum NOT NULL,
    canonical_display_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entity_graph_id ON entity(graph_id);
```

---

## Profiles

```sql
CREATE TABLE person_profile (
    entity_id UUID PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
    birth_date DATE,
    death_date DATE,
    sex_at_birth TEXT,
    gender_identity TEXT,
    notes TEXT,
    CHECK (death_date IS NULL OR birth_date IS NULL OR death_date >= birth_date)
);

CREATE TABLE animal_profile (
    entity_id UUID PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
    species TEXT NOT NULL,
    breed TEXT,
    sex TEXT,
    reproductive_status TEXT,
    birth_date DATE,
    death_date DATE,
    notes TEXT,
    CHECK (death_date IS NULL OR birth_date IS NULL OR death_date >= birth_date)
);

CREATE TABLE place_profile (
    entity_id UUID PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
    place_type TEXT NOT NULL,
    built_date DATE,
    demolished_date DATE,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    address_text TEXT,
    notes TEXT,
    CHECK (demolished_date IS NULL OR built_date IS NULL OR demolished_date >= built_date)
);
```

---

## Names

```sql
CREATE TABLE entity_name (
    id UUID PRIMARY KEY,
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    name_text TEXT NOT NULL,
    language_code TEXT,
    script_code TEXT,
    name_type TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    start_date DATE,
    end_date DATE,
    notes TEXT,
    sort_order INTEGER,
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_entity_name_entity_id ON entity_name(entity_id);
```

---

## Relationships

```sql
CREATE TABLE relationship_type (
    id UUID PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    is_directed BOOLEAN NOT NULL,
    category TEXT,
    allows_multiple_participants BOOLEAN,
    description TEXT
);

CREATE TABLE relationship (
    id UUID PRIMARY KEY,
    graph_id UUID REFERENCES user_graph(id) ON DELETE CASCADE,
    relationship_type_id UUID NOT NULL REFERENCES relationship_type(id),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_relationship_graph_id ON relationship(graph_id);

CREATE TABLE relationship_participant (
    id UUID PRIMARY KEY,
    relationship_id UUID NOT NULL REFERENCES relationship(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entity(id),
    role_in_relationship TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    notes TEXT,
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_relationship_participant_entity_id 
ON relationship_participant(entity_id);
```

---

## Relationship Intervals

```sql
CREATE TABLE relationship_interval (
    id UUID PRIMARY KEY,
    relationship_id UUID NOT NULL REFERENCES relationship(id) ON DELETE CASCADE,
    valid_from TIMESTAMP NOT NULL,
    valid_to TIMESTAMP,
    status TEXT,
    notes TEXT,
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX idx_relationship_interval_time 
ON relationship_interval(valid_from, valid_to);
```

---

## Events

```sql
CREATE TABLE event_type (
    id UUID PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE event (
    id UUID PRIMARY KEY,
    event_type_id UUID NOT NULL REFERENCES event_type(id),
    title TEXT,
    description TEXT,
    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP,
    date_precision TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CHECK (end_datetime IS NULL OR end_datetime >= start_datetime)
);

CREATE TABLE event_participant (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entity(id),
    role_in_event TEXT,
    notes TEXT
);

CREATE TABLE event_relationship (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    relationship_id UUID NOT NULL REFERENCES relationship(id),
    role TEXT,
    notes TEXT
);

CREATE INDEX idx_event_start ON event(start_datetime);
```

---

## Place Relationships

```sql
CREATE TABLE entity_place_relationship (
    id UUID PRIMARY KEY,
    entity_id UUID NOT NULL REFERENCES entity(id),
    place_id UUID NOT NULL REFERENCES entity(id),
    relationship_type TEXT,
    start_date DATE,
    end_date DATE,
    notes TEXT,
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE event_place (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES event(id),
    place_id UUID NOT NULL REFERENCES entity(id),
    role TEXT,
    notes TEXT
);
```

---

## Media

```sql
CREATE TABLE media_asset (
    id UUID PRIMARY KEY,
    media_type TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    thumbnail_url TEXT,
    taken_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    description TEXT,
    uploaded_by UUID
);

CREATE TABLE media_link (
    id UUID PRIMARY KEY,
    media_asset_id UUID NOT NULL REFERENCES media_asset(id) ON DELETE CASCADE,
    subject_type TEXT NOT NULL,
    subject_id UUID NOT NULL,
    link_type TEXT,
    sort_order INTEGER,
    notes TEXT
);

CREATE INDEX idx_media_link_subject ON media_link(subject_id);
```

---

## Extensibility

```sql
CREATE TABLE entity_attribute (
    id UUID PRIMARY KEY,
    entity_id UUID REFERENCES entity(id) ON DELETE CASCADE,
    key TEXT,
    value_text TEXT,
    value_number DOUBLE PRECISION,
    value_json JSONB,
    start_date DATE,
    end_date DATE
);
```

---

## Summary

This schema is:
- Fully executable
- Constraint-enforced
- Indexed for performance
- Ready for migrations

All application logic should build directly on top of this schema.
