# testing_rules.md

## Purpose
Defines mandatory testing requirements for all code in this repository.

Testing is NOT optional. Code without tests is incomplete.

---

## Core Rules

- Every new function must have a corresponding test
- Every bug fix must include a regression test
- Do NOT merge or consider work complete without tests
- If tests are skipped, state why and provide a manual verification step

---

## Test Types

### Unit Tests (Required)
- Test individual functions and components
- Cover:
  - normal cases
  - edge cases
  - failure cases

### Integration Tests (When Applicable)
- Required for:
  - API endpoints
  - database interactions
  - multi-step workflows

### Smoke Tests (Optional but Recommended)
- Required for:
  - New Workflows
  - CLI commands

---

## What Must Be Tested

- Business logic
- Data transformations
- API inputs/outputs
- Error handling
- Edge cases (empty inputs, invalid inputs, boundary values)

---

## What NOT to Skip

- Do NOT skip tests for “simple” functions
- Do NOT assume correctness without validation
- Do NOT rely on manual testing alone

---

## Test Structure

- Tests must be:
  - deterministic
  - isolated
  - repeatable

- Avoid:
  - shared mutable state
  - hidden dependencies

---

## Naming

- Test names must clearly describe behavior
- Use format:
  - should_<expected_behavior>_when_<condition>

---

## Enforcement

- If tests are missing → implementation is incomplete
- If tests fail → fix tests or code before proceeding

---

## Notes

- Prefer fast tests over slow tests
- Prefer clarity over cleverness
