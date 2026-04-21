# docs_policy.md

## Purpose
Defines rules for documentation creation, organization, and maintenance.

Goal: Prevent documentation bloat while keeping docs accurate and useful.

---

## Core Rules

- Do NOT create new documentation files unless explicitly requested
- Prefer updating existing files over creating new ones
- Keep documentation concise and structured

---

## Organization

- All control documents, i.e., files that actively constrain or direct AI agent behavior and project structure, must live in:
  - /docs/core/

- Do NOT create duplicate or overlapping documents
- Each document must have a single clear responsibility

---

## Content Standards

- Use clear headings and bullet points
- Avoid long-form prose unless necessary
- Focus on actionable, relevant information

---

## Accuracy

- Documentation must reflect the current state of the codebase
- When code changes → update relevant documentation
- Outdated documentation must be corrected or removed

---

## Duplication

- Do NOT duplicate information across documents
- Reference existing docs instead of repeating content

---

## Lifecycle

- Regularly review docs for:
  - accuracy
  - clarity
  - redundancy

- Remove unused or obsolete documentation

---

## Anti-Patterns (Do NOT do)

- Creating docs “just in case”
- Writing long narrative explanations
- Duplicating the same content in multiple files
- Letting docs drift from code

---

## Enforcement

- If documentation is unnecessary → do not create it
- If documentation exists → it must be maintained
- Documentation quality is as important as code quality
