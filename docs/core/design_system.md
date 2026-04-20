# design_system.md v3

## Purpose
Defines enforced UI/UX rules to ensure consistent, modern, and usable interfaces.

This is a binding contract. Do NOT deviate.

---

## Design Archetype (Required)

All UI must follow a modern SaaS dashboard style inspired by:

- Linear
- Stripe Dashboard

Design characteristics:
- Clean, minimal interfaces
- Strong hierarchy
- Generous whitespace
- Subtle visual styling (no heavy borders/shadows)

Do NOT invent new design styles.

---

## UX Philosophy (Required)

Use **minimal / progressive disclosure**:

- Show only essential information by default
- Secondary or advanced information must be:
  - collapsed
  - hidden behind interactions (dropdowns, modals, tabs)
  - or moved to secondary screens

Do NOT display all available data at once.

---

## Component System (Required)

- Use a standardized component system
- Default: **Tailwind + shadcn/ui**

Rules:
- Do NOT build custom components if an equivalent exists in the system
- Extend components only when necessary
- Maintain visual consistency across all components
- All reusable UI must be built as components
- Components must be:
  - reusable
  - composable
  - consistent in style

- Do NOT duplicate UI elements across files
---

## Layout Constraints (CRITICAL)

- Max content width: 1200px
- Content must be centered
- Avoid full-width layouts unless explicitly required

- Use:
  - grid layouts
  - column structures
  - clear section separation

Do NOT:
- stretch inputs across full screen
- stack large numbers of elements without grouping

---

## Information Density

- Each screen must have a single clear purpose
- Limit visible elements

Rules:
- Prefer multiple focused screens over dense screens
- Group related information
- Establish hierarchy:
  - primary → visible
  - secondary → hidden or de-emphasized

---

## Data Exposure Rules (CRITICAL)

Only display information that is meaningful to the end user.

### Allowed (User-Relevant)
- Human-readable, actionable data
- Names, statuses, dates, key metrics

### Conditional (Secondary)
- Supporting/contextual data
- Must be:
  - de-emphasized
  - or hidden behind interaction

### Forbidden (System/Internal)
Do NOT display:
- IDs (UUIDs, database keys)
- internal identifiers
- foreign keys
- raw API fields
- debug or metadata fields

If unsure → do NOT display.

---

## Data Presentation

- Transform raw data into user-friendly formats
- Do NOT expose backend structures directly
- Use labels and formatting for clarity

---

## Default Bias

- Err on the side of showing LESS information
- Do NOT render all available data
- Start minimal, expand only when necessary

---

## Typography

- Use a consistent font system
- Clear hierarchy:
  - H1 → page title
  - H2 → section headers
  - Body → content

- Avoid excessive text blocks
- Break content into readable sections

---

## Colors

- Define a primary color
- Define a neutral palette (backgrounds, text)
- Use colors consistently for:
  - Actions
  - Errors
  - Success states

---

## Spacing System

- Use consistent spacing scale (4px base)
- Standard increments: 4, 8, 12, 16, 24, 32

- Use whitespace to:
  - separate sections
  - improve readability

Do NOT use arbitrary spacing values.

---

## Forms & Inputs

- Max width: 400–600px
- Inputs must NOT be full-width on large screens
- Group related fields
- Show required fields first
- Hide advanced fields

---

## Page Structure

Each page should include:

- Clear title
- Primary action (visible and obvious)
- Structured content sections

Avoid:
- dumping all data at once
- unclear entry points for user actions

---

## Interaction Patterns

- Primary actions → emphasized
- Secondary actions → de-emphasized

Use:
- modals for focused tasks
- tabs for context switching
- dropdowns for secondary options

---

## Responsiveness

- Desktop-first
- Maintain hierarchy across sizes
- Graceful degradation

---

## Anti-Patterns (Do NOT do)

- Full-width forms and inputs
- Overloaded screens
- Exposing internal/system data
- Inconsistent styling
- Mixing design styles
- Creating new UI patterns without updating this file

---

## Enforcement

- Consistency over creativity
- Simplicity over completeness
- If unsure → reduce complexity
