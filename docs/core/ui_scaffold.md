# ui_scaffold.md

## Purpose
Defines the mandatory UI composition system used across all projects.

This is a framework-agnostic structure. It defines HOW UI must be built, not how it is styled.

All UI must be composed using these primitives. Do NOT build layouts from raw elements.

---

## Core Primitives (Required)

### 1. PageLayout

Purpose:
- Constrains width
- Centers content
- Provides consistent page padding

Rules:
- Every page MUST use PageLayout as the root
- No content may exist outside PageLayout
- Enforce max-width (e.g., 800–1200px)

---

### 2. PageHeader

Purpose:
- Establishes hierarchy
- Defines page intent

Structure:
- Title (required)
- Description (optional)
- Primary action (optional)

Rules:
- Must appear at the top of every page
- Must clearly communicate the page purpose

---

### 3. Section

Purpose:
- Groups related content
- Creates visual separation

Structure:
- Optional section title
- Content body

Rules:
- Use for ALL logical groupings
- Do NOT place raw content directly on the page
- Sections should be clearly separated (spacing or visual container)

---

### 4. FormContainer

Purpose:
- Prevents full-width forms
- Enforces readable input layouts

Rules:
- All forms MUST be wrapped in FormContainer
- Enforce constrained width (400–600px)
- Inputs must NOT span full screen width

---

### 5. Stack

Purpose:
- Controls vertical spacing
- Prevents arbitrary spacing decisions

Rules:
- Use Stack for vertical layout
- Do NOT manually add inconsistent spacing between elements
- Spacing must be consistent across the app

---

## Composition Rules (CRITICAL)

- Pages MUST be composed using only these primitives
- Do NOT construct layouts using raw containers (divs, etc.)
- Do NOT create new layout primitives without updating this file

---

## Layout Rules

- All content must be centered
- No full-width layouts unless explicitly justified
- Use grouping (Section) instead of long vertical lists
- Maintain clear visual hierarchy

---

## Data Display Rules

- Only display user-relevant data
- Do NOT expose internal/system data (IDs, keys, metadata)
- Transform raw data into user-friendly formats

---

## Default Bias

- Err on the side of LESS content
- Prefer multiple simple sections over one dense layout
- If unsure → simplify

---

## Enforcement

- This system is mandatory
- If a UI does not follow these primitives → it is incorrect
- If unsure how to structure → use existing pages as reference
