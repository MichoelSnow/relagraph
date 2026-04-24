# session_state.md

## Purpose
This file is a strict, low-entropy checkpoint for AI agent handoff between sessions.

It MUST be:
- Read at the start of every session
- Updated at the end of every session

Do NOT add sections. Do NOT write long prose.

---

## Current Objective
(1–2 sentences max)
- Stabilize `family_tree` layout readability and correctness (generation constraints, dependent placement, routing, and fallback safety).
- Keep graph API behavior stable while preventing virtual-family expand crashes.

---

## Completed This Session
(max 5 bullets)
- Introduced layout abstraction in `lib/graph/layout.ts` (`LayoutInput/LayoutOutput/LayoutEngine`, registry, `graph` + `family_tree`) and wired `GraphCanvas`/`GraphExplorer`/`GraphWorkspace` to consume it.
- Implemented generation-based `family_tree` layout with sibling ordering (birth-date when available, stable fallback), spacing config, and live spacing controls in workspace UI.
- Added orthogonal routing metadata/styles for family-tree edges; enforced romantic same-level grouping and dependent placement for children + pets/animals.
- Reworked family subtree placement to bottom-up subtree widths + top-down span assignment, eliminating sibling subtree interleaving and reducing crossings.
- Added fallback resolver (`resolveLayoutWithFallback`) for `family_tree` edge cases (`too_many_parents`, `unsupported_structure`, `excessive_crossing`, `layout_error`) and fixed virtual `family:*` expand requests in API handler to return safe empty deltas instead of UUID DB errors.

---

## In Progress / Open
(max 5 bullets)
- Manual UX verification in real graph data: confirm romantic edge readability and dependent subtree centering in dense families.
- Decide whether to surface fallback reason (`ResolvedLayout.fallbackReason`) in debug UI/telemetry for troubleshooting.

---

## Next Concrete Steps
(ordered, actionable, max 5)
1. Run manual exploratory checks on family-heavy graphs (single dependent, multi-parent, romantic + pet mixed cases).
2. If visual regressions appear, tune subtree gap/centering constants in `family_tree` only.
3. Optional: add lightweight logging/telemetry hook when layout resolver falls back from `family_tree` to `graph`.
4. Commit current branch changes after manual verification.

---

## Working Tree State

Branch:
- `feature/ai-spec-integration`

Modified Files:
- `package.json`
- `tsconfig.app.json` (new)
- `tsconfig.json`
- `tsconfig.vitest.json`
- `docs/core/session_state.md`

Uncommitted Changes:
- Present in the files listed above; no commit created in this session.

Notes:
(max 3 bullets, only critical info)
- Layout work is the primary change set this session; config split for app/test TypeScript projects was a minor IDE ergonomics follow-up.
- `graph/expand` now safely handles virtual `family:*` IDs at request boundary (no UUID query path).
- Typecheck now has explicit app/tests split scripts: `typecheck`, `typecheck:tests`, `typecheck:all`.

---

## Rules

- Be concise. No paragraphs.
- No duplication across sections.
- Only include information relevant to immediate execution.
- If nothing changed in a section, leave it unchanged.
- Do NOT speculate or add future ideas beyond next steps.

### Resume prompt (paste at next session start)
`Use docs/core/session_state.md as canonical context. Continue from "Next concrete steps" and do not reopen already-completed items unless I request regression work.`
