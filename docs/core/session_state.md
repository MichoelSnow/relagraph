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
- Keep `family_tree` layout behavior stable while enforcing strict stage ownership in the layout pipeline.
- Verify visual correctness (partner alignment, anchor-centered dependents, stable sibling ordering) on real graph data.

---

## Completed This Session
(max 5 bullets)
- Completed pipeline stage split for `family_tree`: `FilterGraph -> BuildStructure -> ApplyConstraints -> AssignOrder -> ComputeLayout -> RouteEdges`.
- Made `AssignOrder` the single ordering authority; removed ordering logic from `ApplyConstraints` and `ComputeLayout`.
- Removed monolithic legacy layout execution and deleted `lib/graph/layout/index.ts`; runtime now uses pipeline-only layout paths.
- Added layout-only shared modules (`lib/graph/layout/types.ts`, `lib/graph/layout/deriveFamilyOrder.ts`) and updated graph UI/test imports to use them.
- Fixed correctness issues by stage: romantic same-level enforcement (`ApplyConstraints`), partner/dependent ordering stability (`AssignOrder`), anchor-based dependent centering + post-adjacency re-centering (`ComputeLayout`); typecheck + layout unit tests pass.

---

## In Progress / Open
(max 5 bullets)
- Manual validation on production-like dense family graphs is still pending.
- Need focused checks for mixed cases: romantic + sibling + pet owners with incremental updates.

---

## Next Concrete Steps
(ordered, actionable, max 5)
1. Run manual family-view verification on dense graphs (single dependent, multi-dependent, romantic cross-family, pet ownership).
2. Confirm no visual regressions during add/remove interactions with auto layout enabled.
3. If issues appear, patch only the owning stage (`ApplyConstraints` for levels, `AssignOrder` for order, `ComputeLayout` for positions).
4. Add/adjust targeted unit tests for any discovered edge case before further refactors.

---

## Working Tree State

Branch:
- `feature/layout-modes`

Modified Files:
- None

Uncommitted Changes:
- None

Notes:
(max 3 bullets, only critical info)
- `lib/graph/layout/index.ts` has been removed; no runtime layout fallback path remains.
- `family_tree` pipeline stages are now the single source of truth for filtering, structure, constraints, order, positions, and routing.
- Latest checks completed: `pnpm typecheck` and `vitest` layout-focused unit suites are passing.

---

## Rules

- Be concise. No paragraphs.
- No duplication across sections.
- Only include information relevant to immediate execution.
- If nothing changed in a section, leave it unchanged.
- Do NOT speculate or add future ideas beyond next steps.

### Resume prompt (paste at next session start)
`Use docs/core/session_state.md as canonical context. Continue from "Next concrete steps" and do not reopen already-completed items unless I request regression work.`
