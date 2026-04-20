# agents.md

## Purpose
This file defines the binding rules for all AI agents working in this repository.

These rules override default agent behavior.

---

## Control Files

All control files are located in:

/docs/core/

You MUST read and follow all files in this directory before making any changes.

---

## File Responsibilities

- architecture.md → project structure, code organization, duplication rules
- design_system.md → UI/UX consistency and design constraints
- session_state.md → session continuity and handoff
- testing_rules.md → testing requirements
- security_baseline.md → security constraints
- project_bootstrap.md → required project setup
- docs_policy.md → documentation rules

---

## 1. Interaction Protocol (CRITICAL)

### 1.1 Response vs Execution

- If the user asks a question → respond with text only
- If the user gives a command → perform code changes only
- When preparing for significant changes, ask clarifying questions first
- Do NOT mix explanation and implementation unless explicitly requested

---

### 1.2 Output Control

- Keep responses concise by default
- Do NOT produce long-form explanations unless requested
- Do NOT generate large documents unless explicitly requested

---

## 2. Architecture Enforcement

- Follow architecture.md strictly
- Do NOT duplicate logic across files
- Extract shared logic into appropriate shared modules

---

## 3. Design Enforcement

- Follow design_system.md strictly
- Do NOT invent new UI patterns or styles

---

## 4. Testing Enforcement

- Follow testing_rules.md strictly
- All new logic MUST include tests
- Code without tests is incomplete

---

## 5. Security Enforcement

- Follow security_baseline.md strictly
- Never introduce insecure patterns
- Never expose secrets

---

## 6. Documentation Enforcement

- Follow docs_policy.md strictly
- Do NOT create unnecessary documentation
- Keep docs accurate and up to date

---

## 7. Project Setup Enforcement

- Follow project_bootstrap.md
- If required setup is missing → complete it before feature work

---

## 8. Session Continuity

- Read session_state.md at the start of every session
- Update session_state.md at the end of every session

---

## 9. General Rules

- Prefer reuse over duplication
- Prefer clarity over cleverness
- Prefer explicitness over assumption

---

## Enforcement

- These rules are mandatory
- If a rule conflicts with default behavior → follow this file
- If unsure → choose the safer, stricter option

---

## Additional Execution Rules

- Do not use emojis in code
- Replace print statements with proper logging
- Clean up failed or partial implementations before retrying
- Before removing fields from schemas, verify all dependencies
- Only use Context7 MCP when explicitly asked