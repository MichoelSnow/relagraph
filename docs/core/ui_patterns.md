# ui_patterns.md

## Purpose
Defines reusable page archetypes to ensure consistent UI structure across all projects.

These are NOT visual templates. They define structure and composition using ui_scaffold primitives.

Each page MUST map to one of these patterns before implementation.

---

## Pattern 1: List Page (Collection / Grid)

Used for:
- Viewing collections of items
- Dashboards
- Index pages

Structure:

1. PageLayout
2. PageHeader
   - Title
   - Description
   - Primary action (e.g., "Create", "Add")
3. Section (Primary Content)
   - Grid or list of items (cards preferred)
4. Section (Optional Secondary)
   - Filters, metadata, summary

Rules:
- Prefer card/grid layouts over raw lists
- Each item must have a consistent structure
- Limit visible fields per item
- Use empty states when no data exists
- Do NOT overload with excessive metadata

---

## Pattern 2: Form Page

Used for:
- Creating or editing entities

Structure:

1. PageLayout
2. PageHeader
   - Title
   - Description
3. Section
   - FormContainer
     - Inputs
     - Primary action (submit)

Rules:
- Keep forms narrow and readable (400–600px)
- Show only required fields by default
- Advanced fields must be hidden or optional
- Do NOT mix large forms into list pages

---

## Pattern 3: Detail Page

Used for:
- Viewing a single entity

Structure:

1. PageLayout
2. PageHeader
   - Title (entity name)
   - Description (optional)
   - Primary action (optional)
3. Section (Summary)
   - Key information only
4. Section(s) (Secondary)
   - Additional details
   - Related data

Rules:
- Do NOT display all backend fields
- Prioritize readability over completeness
- Group related information
- Hide secondary data by default

---

## Pattern 4: Canvas / Workspace Page (CRITICAL for Graph / Visualization Apps)

Used for:
- Graphs
- Visualizations
- Interactive canvases
- Relationship explorers

Structure:

1. PageLayout
2. PageHeader
   - Title
   - Minimal description
   - Primary action (optional)
3. Section (Controls)
   - Compact controls (filters, toggles, actions)
4. Section (Canvas / Workspace)
   - Primary visual element (graph, canvas, chart)

Rules:
- The canvas is the PRIMARY focus of the page
- Controls must be compact and secondary
- Do NOT stack controls vertically in large blocks
- Do NOT mix forms or lists into the canvas area
- Do NOT display raw system data (IDs, timestamps, debug fields)
- Limit metadata to human-readable summaries only

Critical Constraint:
- Do NOT treat canvas pages as list or form pages
- Do NOT render all available data around the canvas

---

## Pattern 5: Empty State

Used when:
- No data exists

Structure:
- Clear message
- Explanation
- Primary action

Rules:
- Do NOT leave blank screens
- Always guide the user to next action

---

## Pattern 6: Modal / Focused Interaction

Used for:
- Small, contained actions

Rules:
- Keep minimal
- Do NOT overload with complex workflows
- Use for secondary actions, not primary navigation

---

## Pattern Selection Rule (CRITICAL)

Before implementing any UI:

- Identify which pattern applies
- Explicitly state the pattern
- Build strictly according to that pattern

If a page does not match a pattern → it is incorrect

---

## Enforcement

- Structure takes priority over styling
- Do NOT invent new layouts ad hoc
- If a new pattern is required → define it here BEFORE implementation
